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
      const completedCount = milestones.filter(m => parseInt(m.progress) === 100).length;
      const totalProgress = milestones.length > 0
        ? Math.min(100, milestones.reduce((acc, m) => acc + (parseInt(m.progress) || 0), 0))
        : (p.progress || 0);

      const typeClass = (p.project_type || '').toLowerCase().replace(' ', '-');

      const getMilestoneStatusClass = (progress) => {
        const pval = parseInt(progress) || 0;
        if (pval === 0) return 'ms-pending';
        if (pval >= 100) return 'ms-done';
        return 'ms-active';
      };

      const getStatusIcon = (progress) => {
        const pval = parseInt(progress) || 0;
        if (pval === 0) {
          return `<svg class="ms-status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`;
        }
        if (pval >= 100) {
          return `<svg class="ms-status-icon" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
        }
        return `<svg class="ms-status-icon" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
      };

      const getStatusLabel = (progress) => {
        const pval = parseInt(progress) || 0;
        if (pval === 0) return 'PENDING';
        if (pval >= 100) return 'DONE';
        return 'IN PROGRESS';
      };

      return `
        <div class="project-card-saas status-${p.status || 'discovery'}" data-type="${p.project_type || 'Other'}">
          <div class="project-header">
            <div style="flex:1;">
              <div class="project-name" style="font-size:1.25rem;">
                ${p.name}
              </div>
              <span class="type-pill ${typeClass}" style="margin-top:6px; display:inline-block;">${p.project_type || 'Project'}</span>
              <div style="font-size:0.8rem; color:var(--body); margin-top:8px; display:flex; gap:16px;">
                <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:text-bottom; margin-right:4px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Timeline: ${p.start_date || '—'} to ${p.end_date || '—'}</span>
              </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end;">
              <span class="project-priority-badge priority-${(p.priority || 'Medium').toLowerCase()}">${p.priority || 'Medium'}</span>
              <span class="status-badge status-${p.status}">${(p.status || 'discovery').replace('_', ' ')}</span>
            </div>
          </div>

          <div class="project-info-short" style="margin:20px 0; font-size:0.95rem; color:var(--body); line-height:1.6; width: 100%;">
            ${p.notes || 'No description provided.'}
          </div>

          <div class="project-progress-section">
            <div class="project-progress-meta">
              <span class="project-progress-label">Overall Completion</span>
              <span class="project-progress-value">${totalProgress}%</span>
            </div>
            <div class="progress-bar" style="height:8px; border-radius:4px;">
              <div class="progress-fill" style="width:${totalProgress}%; height:100%;"></div>
            </div>
            <div class="project-progress-sub">${completedCount} of ${milestones.length} milestones complete</div>
          </div>

          <div class="milestone-section">
            <div class="milestone-section-header">
              <span class="milestone-section-title">Milestone Roadmap</span>
            </div>
            <div class="milestone-grid">
              ${milestones.length === 0 ? `
                <div class="milestone-empty">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.4;"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
                  <h4>No milestones yet</h4>
                  <p>Milestones will appear here once added by the project manager.</p>
                </div>
              ` : milestones.map((m, idx) => `
                <div class="milestone-card ${getMilestoneStatusClass(m.progress)}" onclick="viewMilestone(${p.id}, ${idx})">
                  <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                    ${getStatusIcon(m.progress)}
                    <span style="font-size:0.65rem; font-weight:700; letter-spacing:0.05em; color:var(--muted);">${getStatusLabel(m.progress)}</span>
                  </div>
                  <div class="milestone-card-title">${m.title}</div>
                  ${m.description ? `<div class="milestone-card-desc">${m.description}</div>` : ''}
                  <div style="display:flex; align-items:center; gap:8px; margin-top:auto; padding-top:12px;">
                    <div style="flex:1; height:6px; background:var(--border); border-radius:3px; overflow:hidden;">
                      <div style="width:${m.progress}%; height:100%; background:${parseInt(m.progress) === 100 ? '#22c55e' : 'var(--secondary)'}; border-radius:3px;"></div>
                    </div>
                    <span style="font-size:0.75rem; font-weight:600; color:var(--body); min-width:36px;">${m.progress}%</span>
                  </div>
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding-top:12px; border-top:1px solid var(--border);">
                    <span style="font-size:0.7rem; color:var(--muted);">Due: ${m.end_date ? new Date(m.end_date).toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'}) : 'TBD'}</span>
                    <div style="display:flex; gap:6px;">
                      ${m.link ? `<a href="${m.link}" target="_blank" title="Resource Link" onclick="event.stopPropagation()" style="color:var(--body);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>` : ''}
                      ${m.file ? `<span title="File: ${m.file}" onclick="event.stopPropagation()" style="color:var(--body);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>` : ''}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="project-footer-bar">
            <div class="project-footer-left">
              <button class="btn-icon" onclick="openProjectFiles(${p.id})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                Files
              </button>
              <button class="btn-icon" onclick="openProjectComments(${p.id})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                Comments
              </button>
            </div>
          </div>
        </div>
      `;
    }

    window.viewMilestone = (projectId, index) => {
      const proj = projects.find(p => String(p.id) === String(projectId));
      if (!proj) return;
      const ms = proj.milestones[index];
      const pval = parseInt(ms.progress) || 0;

      let statusClass = 'pending';
      let statusLabel = 'PENDING';
      if (pval === 0) { statusClass = 'pending'; statusLabel = 'PENDING'; }
      else if (pval >= 100) { statusClass = 'done'; statusLabel = 'DONE'; }
      else { statusClass = 'active'; statusLabel = 'IN PROGRESS'; }

      const modal = document.getElementById('milestoneModal');
      if (!modal) return;

      modal.querySelector('.modal-title').textContent = 'Milestone Details';
      document.getElementById('msTitleView').textContent = ms.title || 'Untitled';
      document.getElementById('msDateView').textContent = (ms.start_date || '—') + ' to ' + (ms.end_date || '—');
      document.getElementById('msProgressView').textContent = pval + '%';
      document.getElementById('msDescView').textContent = ms.description || 'No description provided.';

      const statusEl = document.getElementById('msStatusView');
      if (statusEl) {
        statusEl.textContent = statusLabel;
        statusEl.className = 'status-badge-view ' + statusClass;
      }
      const fillEl = document.getElementById('msProgressFill');
      if (fillEl) {
        fillEl.style.width = pval + '%';
        fillEl.className = 'progress-bar-fill ' + statusClass;
      }

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
      const container = document.getElementById('projectFilesTable');

      const getFileExtension = (filename) => {
        const ext = filename.split('.').pop().toLowerCase();
        if (['pdf'].includes(ext)) return 'pdf';
        if (['doc', 'docx', 'txt'].includes(ext)) return 'doc';
        if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) return 'img';
        return 'default';
      };

      const isAdmin = (name) => name && (name.toLowerCase().includes('admin') || name.toLowerCase() === 'webwynke');

      container.innerHTML = files.map(f => `
        <div class="file-list-item">
          <div class="file-icon ${getFileExtension(f.original_name)}">${f.original_name.split('.').pop().toUpperCase()}</div>
          <div class="file-info">
            <div class="file-name"><a href="${f.file_path.startsWith('http') ? f.file_path : '/uploads/' + f.file_path}" target="_blank">${f.original_name}</a></div>
            <div class="file-meta">${new Date(f.created_at).toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'})}</div>
          </div>
          <span class="file-uploader-badge ${isAdmin(f.uploader_name) ? 'admin' : 'client'}">${f.uploader_name}</span>
        </div>
      `).join('') || '<div class="empty-state" style="padding:40px;">No files uploaded yet</div>';
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
  