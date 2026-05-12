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
      return res.json();
    }

    function loadPageData(page) {
      switch(page) {
        case 'dashboard': loadDashboard(); break;
        case 'invoices': loadInvoices(); break;
        case 'proposals': loadProposals(); break;
        case 'projects': loadProjects(); break;
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
      document.getElementById('recentProjects').innerHTML = recent.map(p => `
        <div class="project-card">
          <div class="project-header">
            <div>
              <div class="project-name">${p.name}</div>
              <div style="font-size:0.8rem; color:var(--body); margin-top:4px;">${p.client_name}</div>
            </div>
            <span class="status-badge status-${p.status}">${p.status.replace('_', ' ')}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill ${p.progress >= 75 ? 'high' : p.progress >= 50 ? 'medium' : 'low'}" style="width:${p.progress}%"></div>
          </div>
          <div style="font-size:0.75rem; color:var(--body); margin-top:4px;">${p.progress}% complete</div>
        </div>
      `).join('') || '<p style="color:var(--body); text-align:center;">No active projects</p>';
    }

    // Invoices
    async function loadInvoices() {
      invoices = await apiCall('/api/my-invoices');
      const tbody = document.getElementById('invoicesTable');
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
      proposals = await apiCall('/api/my-proposals');
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
      projects = await apiCall('/api/my-projects');
      const container = document.getElementById('projectsList');

      if (projects.length === 0) {
        container.innerHTML = '<div class="empty-state">No projects yet</div>';
        return;
      }

      container.innerHTML = await Promise.all(projects.map(async p => {
        const updates = await apiCall('/api/projects/' + p.id + '/updates');
        return `
          <div class="project-card">
            <div class="project-header">
              <div>
                <div class="project-name">${p.name}</div>
                <div style="font-size:0.8rem; color:var(--body); margin-top:4px;">${p.client_name}</div>
              </div>
              <span class="status-badge status-${p.status}">${p.status.replace('_', ' ')}</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill ${p.progress >= 75 ? 'high' : p.progress >= 50 ? 'medium' : 'low'}" style="width:${p.progress}%"></div>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px; margin-bottom:16px;">
              <div style="font-size:0.75rem; color:var(--body);">${p.progress}% complete</div>
              <button class="btn btn-outline btn-sm" onclick="openProjectFiles(${p.id})">Project Files</button>
            </div>
            ${p.notes ? `<div style="font-size:0.85rem; color:var(--body); padding:12px; background:var(--bg); border-radius:8px; margin-bottom:16px;">${p.notes}</div>` : ''}
            ${updates.length > 0 ? `
              <div class="project-updates">
                <div style="font-size:0.75rem; font-weight:700; color:var(--title); margin-bottom:12px;">Project Updates</div>
                ${updates.map(u => `
                  <div class="update-item">
                    <div class="update-date">${new Date(u.created_at).toLocaleDateString()} by ${u.author_name}</div>
                    <div class="update-content">${u.content}</div>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        `;
      }));
    }

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
  