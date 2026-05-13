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
      const completedCount = milestones.filter(m => m.completed).length;
      const totalMilestones = milestones.length;
      const progressPercent = totalMilestones > 0 ? Math.round((completedCount / totalMilestones) * 100) : p.progress;

      return `
        <div class="project-card-saas">
          <div class="project-header">
            <div>
              <div class="project-name">${p.name}</div>
              <div style="font-size:0.8rem; color:var(--body); margin-top:4px;">
                Started: ${p.start_date || '—'} | Deadline: ${p.end_date || '—'}
              </div>
            </div>
            <div style="display:flex; gap:12px; align-items:center;">
              <span class="project-priority-badge priority-${(p.priority || 'Medium').toLowerCase()}">${p.priority || 'Medium'}</span>
              <span class="status-badge status-${p.status}">${p.status.replace('_', ' ')}</span>
            </div>
          </div>
          
          <p style="font-size:0.9rem; color:var(--body); margin:16px 0; line-height:1.5;">${p.notes || 'No description provided.'}</p>

          <div class="project-timeline">
            <div class="timeline-track"></div>
            <div class="timeline-progress" style="width:${progressPercent}%"></div>
            ${milestones.map((m, idx) => {
              const left = totalMilestones > 1 ? (idx / (totalMilestones - 1)) * 100 : 50;
              return `
                <div class="milestone-dot ${m.completed ? 'completed' : ''}" style="left:${left}%" title="${m.title} (${m.deadline || 'No deadline'})">
                  <div class="milestone-label">
                    ${m.title}
                    <span class="milestone-date">${m.deadline ? new Date(m.deadline).toLocaleDateString() : ''}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:24px; padding-top:20px; border-top:1px solid var(--border);">
            <div style="display:flex; gap:12px;">
              <button class="btn btn-outline btn-sm" onclick="openProjectFiles(${p.id})">📁 Files</button>
              <button class="btn btn-outline btn-sm" onclick="openProjectComments(${p.id})">💬 Comments</button>
            </div>
          </div>
        </div>
      `;
    }

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
  