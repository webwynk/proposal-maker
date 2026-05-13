document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '';
    
    let invoices = [];
    let proposals = [];
    let projects = [];

    // Check auth
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!token || user.role !== 'client') {
      window.location.href = 'index.html';
    }

    const userNameEl = document.getElementById('userName');
    const userCompanyEl = document.getElementById('userCompany');
    const welcomeNameEl = document.getElementById('welcomeName');

    if (userNameEl) userNameEl.textContent = user.name;
    if (userCompanyEl) userCompanyEl.textContent = user.company;
    if (welcomeNameEl) welcomeNameEl.textContent = user.name.split(' ')[0];

    // Navigation is now handled by standard anchor tags

    async function apiCall(endpoint, options = {}) {
      const res = await fetch(API_URL + endpoint, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        }
      });
      const data = await res.json();
      
      if (!options.method || options.method === 'GET') {
        if (!data.error) {
          sessionStorage.setItem('cache_' + endpoint, JSON.stringify(data));
        }
      }
      
      return data;
    }

    function loadPageData(page) {
      switch(page) {
        case 'dashboard': loadDashboard(); break;
        case 'invoices': loadInvoices(); break;
        case 'proposals': loadProposals(); break;
        case 'projects': loadProjects(); break;
      }
    }
    
    function showLoading(elementId, colspan = 6, isList = false) {
      const el = document.getElementById(elementId);
      if (el) {
        if (isList) {
          el.innerHTML = `<div class="loading-row"><div class="spinner"></div><span class="loading-text">Fetching latest data...</span></div>`;
        } else {
          el.innerHTML = `<tr><td colspan="${colspan}" class="loading-row"><div class="spinner"></div><span class="loading-text">Fetching latest data...</span></td></tr>`;
        }
      }
    }

    // Dashboard
    async function loadDashboard() {
      invoices = await apiCall('/api/my-invoices');
      proposals = await apiCall('/api/my-proposals');
      projects = await apiCall('/api/my-projects');

      const statInvoices = document.getElementById('statInvoices');
      const statProposals = document.getElementById('statProposals');
      const statProjects = document.getElementById('statProjects');

      if (statInvoices) statInvoices.textContent = invoices.length;
      if (statProposals) statProposals.textContent = proposals.length;
      if (statProjects) statProjects.textContent = projects.filter(p => p.status !== 'launched').length;

      const recent = projects.slice(0, 3);
      const container = document.getElementById('recentProjects');
      if (container) {
        container.innerHTML = recent.map(p => renderProjectCard(p)).join('') || '<p style="color:var(--body); text-align:center;">No active projects</p>';
      }
    }

    // Invoices
    async function loadInvoices() {
      const cached = sessionStorage.getItem('cache_/api/my-invoices');
      if (cached) {
        invoices = JSON.parse(cached);
        renderInvoices();
      } else {
        showLoading('invoicesTable', 7);
      }

      invoices = await apiCall('/api/my-invoices');
      renderInvoices();
    }

    function renderInvoices() {
      const tbody = document.getElementById('invoicesTable');
      if (!tbody) return;
      tbody.innerHTML = invoices.map(inv => {
        const total = calculateTotal(inv.services);
        const balance = total - (inv.payment_received || 0);
        return `
          <tr>
            <td>${inv.invoice_number}</td>
            <td>${formatCurrency(total, inv.currency)}</td>
            <td style="color:var(--success);">${formatCurrency(inv.payment_received || 0, inv.currency)}</td>
            <td>${formatCurrency(balance, inv.currency)}</td>
            <td><span class="status-badge status-${inv.status}">${inv.status}</span></td>
            <td>${inv.invoice_date || '—'}</td>
            <td><button class="btn btn-sm view-btn" onclick="openInvoice(${inv.id})">View</button></td>
          </tr>
        `;
      }).join('') || '<tr><td colspan="7" class="empty-state">No invoices yet</td></tr>';
    }

    function openInvoice(id) {
      window.open(`invoice.html?id=${id}&view=true`, '_blank');
    }

    function openProposal(id) {
      window.open(`proposal.html?id=${id}&view=true`, '_blank');
    }

    // Proposals
    async function loadProposals() {
      const cached = sessionStorage.getItem('cache_/api/my-proposals');
      if (cached) {
        proposals = JSON.parse(cached);
        renderProposals();
      } else {
        showLoading('proposalsTable', 6);
      }

      proposals = await apiCall('/api/my-proposals');
      renderProposals();
    }

    function renderProposals() {
      const tbody = document.getElementById('proposalsTable');
      if (!tbody) return;
      
      tbody.innerHTML = proposals.map(p => {
        const services = typeof p.services === 'string' ? JSON.parse(p.services || '[]') : (p.services || []);
        return `
          <tr>
            <td>${p.proposal_number}</td>
            <td>${p.project_title || '—'}</td>
            <td>${formatCurrency(calculateTotal(services), p.currency)}</td>
            <td><span class="status-badge status-${p.status}">${p.status}</span></td>
            <td>${p.proposal_date || '—'}</td>
            <td><button class="btn btn-sm view-btn" onclick="openProposal(${p.id})">View</button></td>
          </tr>
        `;
      }).join('') || '<tr><td colspan="6" class="empty-state">No proposals yet</td></tr>';
    }

    // Projects
    async function loadProjects() {
      const cached = sessionStorage.getItem('cache_/api/my-projects');
      if (cached) {
        projects = JSON.parse(cached);
        renderProjects();
      } else {
        showLoading('projectsList', 0, true);
      }

      projects = await apiCall('/api/my-projects');
      renderProjects();
    }

    function renderProjectCard(p) {
      const milestones = p.milestones || [];
      const totalProgress = milestones.length > 0 
        ? Math.round(milestones.reduce((acc, m) => acc + (parseInt(m.progress) || 0), 0) / milestones.length) 
        : (p.progress || 0);

      const typeClass = (p.project_type || '').toLowerCase().replace(' ', '-');

      return `
        <div class="project-card-saas" data-type="${p.project_type || 'Other'}">
          <div class="project-header">
            <div style="flex:1;">
              <div class="project-name">
                ${p.name}
                <span class="type-pill ${typeClass}">${p.project_type || 'Project'}</span>
              </div>
              <div style="font-size:0.8rem; color:var(--body); margin-top:8px; display:flex; gap:16px;">
                <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:text-bottom; margin-right:4px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Timeline: ${p.start_date || '—'} to ${p.end_date || '—'}</span>
              </div>
            </div>
            <div style="display:flex; gap:12px; align-items:center;">
              <span class="project-priority-badge priority-${(p.priority || 'Medium').toLowerCase()}">${p.priority || 'Medium'}</span>
              <span class="status-badge status-${p.status}">${p.status.replace('_', ' ')}</span>
            </div>
          </div>
          
          <div class="project-info-short" style="margin:20px 0; font-size:0.95rem; color:var(--body); line-height:1.6; width: 100%;">
            ${p.notes || 'No description provided.'}
          </div>

          <div class="main-progress-container" style="margin-bottom:32px; background:#f8fafc; padding:20px; border-radius:16px;">
            <div style="display:flex; justify-content:space-between; font-size:0.8rem; font-weight:700; margin-bottom:10px; color:var(--title);">
              <span>PROJECT OVERALL COMPLETION</span>
              <span>${totalProgress}%</span>
            </div>
            <div class="progress-bar" style="height:12px; background:#e2e8f0; border-radius:6px; overflow:hidden;">
              <div class="progress-fill" style="width:${totalProgress}%; height:100%; background:linear-gradient(90deg, #7864f0, #ff5028); transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);"></div>
            </div>
          </div>

          <div class="milestone-section">
            <h4 style="font-size:0.9rem; font-weight:800; color:var(--title); text-transform:uppercase; letter-spacing:1px; margin-bottom:20px;">Milestone Roadmap</h4>
            <div class="milestone-grid">
                ${milestones.map((m, idx) => `
                    <div class="milestone-card" onclick="viewMilestone(${p.id}, ${idx})">
                        <div class="milestone-card-header">
                            <div class="milestone-card-title">${m.title}</div>
                            ${m.description ? `<div class="milestone-card-desc">${m.description}</div>` : ''}
                        </div>
                        <div class="milestone-card-body">
                            <div style="display:flex; justify-content:space-between; font-size:0.7rem; font-weight:700; margin-bottom:4px;">
                                <span style="color:var(--body); opacity:0.6;">PROGRESS</span>
                                <span style="color:var(--primary);">${m.progress}%</span>
                            </div>
                            <div class="milestone-progress-bar">
                                <div class="milestone-progress-fill" style="width:${m.progress}%"></div>
                            </div>
                        </div>
                        <div class="milestone-card-footer">
                            <span style="font-size:0.65rem; color:var(--body); opacity:0.6; font-weight:600;">${m.end_date ? new Date(m.end_date).toLocaleDateString() : 'TBD'}</span>
                            <div class="milestone-action-links">
                                ${m.link ? `<a href="${m.link}" target="_blank" class="milestone-link-btn" title="Resource Link" onclick="event.stopPropagation()">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                </a>` : ''}
                                ${m.file ? `<span class="milestone-link-btn" title="File: ${m.file}" onclick="event.stopPropagation()">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                                </span>` : ''}
                            </div>
                        </div>
                    </div>
                `).join('') || '<div class="empty-state" style="grid-column: 1/-1;">No milestones defined yet.</div>'}
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:40px; padding-top:24px; border-top:1px solid #f1f5f9;">
            <div style="display:flex; gap:12px;">
              <button class="btn btn-outline" onclick="openProjectFiles(${p.id})">📁 Files Repository</button>
              <button class="btn btn-outline" onclick="openProjectComments(${p.id})">💬 Collaboration Feed</button>
            </div>
          </div>
        </div>
      `;
    }

    window.viewMilestone = (projectId, index) => {
      const proj = projects.find(p => String(p.id) === String(projectId));
      if (!proj) return;
      const ms = proj.milestones[index];
      
      const modal = document.getElementById('milestoneModal');
      if (!modal) return;
      
      modal.querySelector('.modal-title').textContent = 'Milestone Details';
      document.getElementById('msTitleView').textContent = ms.title || 'Untitled';
      document.getElementById('msDateView').textContent = (ms.start_date || '—') + ' to ' + (ms.end_date || '—');
      document.getElementById('msProgressView').textContent = (ms.progress || 0) + '%';
      document.getElementById('msDescView').textContent = ms.description || 'No description provided.';
      
      const links = modal.querySelector('.milestone-action-links');
      links.innerHTML = `
        ${ms.link ? `<a href="${ms.link}" target="_blank" class="btn btn-outline btn-sm">🔗 Resource Link</a>` : ''}
        ${ms.file ? `<span class="btn btn-outline btn-sm">📄 File: ${ms.file}</span>` : ''}
      `;
      
      modal.classList.add('show');
    };

    async function renderProjects() {
      const container = document.getElementById('projectsList');
      if (!container) return;

      if (projects.length === 0) {
        container.innerHTML = '<div class="empty-state">No projects yet</div>';
        return;
      }

      container.innerHTML = projects.map(p => renderProjectCard(p)).join('');
    }

    async function openProjectComments(id) {
      document.getElementById('currentCommentProjectId').value = id;
      document.getElementById('commentsModal').classList.add('show');
      loadComments(id);
    }

    async function loadComments(id) {
      const comments = await apiCall('/api/projects/' + id + '/comments');
      const list = document.getElementById('commentsList');
      if (!list) return;
      list.innerHTML = comments.map(c => `
        <div class="comment-item">
          <div class="comment-avatar">${c.author_name ? c.author_name[0].toUpperCase() : 'U'}</div>
          <div class="comment-bubble">
            <div class="comment-header">
              <span class="comment-author">${c.author_name} <small style="opacity:0.6">(${c.author_role})</small></span>
              <span class="comment-date">${new Date(c.created_at).toLocaleString()}</span>
            </div>
            <div class="comment-text">${c.comment}</div>
          </div>
        </div>
      `).join('') || '<div class="empty-state">No comments yet.</div>';
      list.scrollTop = list.scrollHeight;
    }

    async function postComment() {
      const id = document.getElementById('currentCommentProjectId').value;
      const comment = document.getElementById('commentText').value;
      if (!comment.trim()) return;

      const res = await apiCall('/api/projects/' + id + '/comments', {
        method: 'POST',
        body: JSON.stringify({ comment })
      });

      if (res) {
        document.getElementById('commentText').value = '';
        loadComments(id);
      }
    }

    // Expose to window
    window.openProjectFiles = openProjectFiles;
    window.openProjectComments = openProjectComments;
    window.postComment = postComment;
    window.closeModal = closeModal;
    window.uploadProjectFile = uploadProjectFile;
    window.deleteProjectFile = deleteProjectFile;

    // Project Files
    function openProjectFiles(id) {
      document.getElementById('currentProjectFilesId').value = id;
      document.getElementById('filesModal').classList.add('show');
      loadProjectFiles(id);
    }

    async function loadProjectFiles(id) {
      const files = await apiCall('/api/projects/' + id + '/files');
      const tbody = document.getElementById('projectFilesTable');
      tbody.innerHTML = files.map(f => `
        <tr>
          <td><a href="${f.file_path.startsWith('http') ? f.file_path : '/uploads/' + f.file_path}" target="_blank">${f.original_name}</a></td>
          <td>${f.uploader_name}</td>
          <td>${new Date(f.created_at).toLocaleDateString()}</td>
          <td>
            ${f.uploaded_by === user.id ? `<button class="btn btn-outline btn-sm" onclick="deleteProjectFile(${f.id}, ${id})">Delete</button>` : ''}
          </td>
        </tr>
      `).join('') || '<tr><td colspan="4" class="empty-state">No files uploaded yet</td></tr>';
    }

    async function uploadProjectFile() {
      const id = document.getElementById('currentProjectFilesId').value;
      const fileInput = document.getElementById('fileUploadInput');
      if (!fileInput.files[0]) return alert('Select a file to upload');

      const formData = new FormData();
      formData.append('file', fileInput.files[0]);

      try {
        const res = await fetch(API_URL + '/api/projects/' + id + '/files', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token },
          body: formData
        });
        if (res.ok) {
          fileInput.value = '';
          loadProjectFiles(id);
        } else {
          const err = await res.json();
          alert('Upload failed: ' + err.error);
        }
      } catch (e) {
        alert('Upload failed');
      }
    }

    async function deleteProjectFile(fileId, projectId) {
      if (confirm('Delete this file?')) {
        await apiCall('/api/projects/' + projectId + '/files/' + fileId, { method: 'DELETE' });
        loadProjectFiles(projectId);
      }
    }

    // Change Password
    async function changePassword() {
      const current = document.getElementById('currentPassword').value;
      const newPass = document.getElementById('newPassword').value;
      const confirm = document.getElementById('confirmPassword').value;
      const errorDiv = document.getElementById('passwordError');
      const successDiv = document.getElementById('passwordSuccess');

      errorDiv.classList.remove('show');
      successDiv.classList.remove('show');

      if (!current || !newPass || !confirm) {
        errorDiv.textContent = 'All fields are required';
        errorDiv.classList.add('show');
        return;
      }

      if (newPass.length < 8) {
        errorDiv.textContent = 'Password must be at least 8 characters';
        errorDiv.classList.add('show');
        return;
      }

      if (newPass !== confirm) {
        errorDiv.textContent = 'New passwords do not match';
        errorDiv.classList.add('show');
        return;
      }

      try {
        const result = await apiCall('/api/change-password', {
          method: 'POST',
          body: JSON.stringify({ currentPassword: current, newPassword: newPass })
        });

        if (result.error) {
          errorDiv.textContent = result.error;
          errorDiv.classList.add('show');
        } else {
          successDiv.textContent = 'Password changed successfully!';
          successDiv.classList.add('show');
          document.getElementById('currentPassword').value = '';
          document.getElementById('newPassword').value = '';
          document.getElementById('confirmPassword').value = '';
        }
      } catch (err) {
        errorDiv.textContent = 'Failed to change password';
        errorDiv.classList.add('show');
      }
    }

    // Utilities
    function formatCurrency(amount, currency = 'INR') {
      if (!amount) amount = 0;
      return (currency === 'INR' ? '₹' : '$') + amount.toLocaleString(currency === 'INR' ? 'en-IN' : 'en-US');
    }

    function calculateTotal(services) {
      const sArr = typeof services === 'string' ? JSON.parse(services || '[]') : (services || []);
      return sArr.reduce((sum, s) => sum + (s.price || 0), 0);
    }

    function closeModal(id) {
      document.getElementById(id).classList.remove('show');
    }

    function logout() {
      localStorage.clear();
      window.location.href = 'index.html';
    }

    // Initialize based on current active tab
    const activeNav = document.querySelector('.nav-item.active');
    if (activeNav) {
      loadPageData(activeNav.dataset.page);
    } else {
      loadDashboard();
    }
});
  