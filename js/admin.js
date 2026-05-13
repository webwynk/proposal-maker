document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '';
    let clients = [];
    let invoices = [];
    let proposals = [];
    let projects = [];
    let serviceCount = 0;
    let milestoneCount = 0;

    // Check auth
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!token || user.role !== 'admin') {
      window.location.href = 'index.html';
    }

    document.getElementById('userName').textContent = user.name;

    // Navigation is now handled by standard anchor tags

    function loadPageData(page) {
      switch(page) {
        case 'dashboard': loadDashboard(); break;
        case 'clients': loadClients(); break;
        case 'invoices': loadInvoices(); break;
        case 'proposals': loadProposals(); break;
        case 'projects': loadProjects(); break;
      }
    }

    async function apiCall(endpoint, options = {}) {
      const res = await fetch(API_URL + endpoint, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        }
      });
      const data = await res.json();
      
      // Cache GET requests
      if (!options.method || options.method === 'GET') {
        if (!data.error) {
          sessionStorage.setItem('cache_' + endpoint, JSON.stringify(data));
        }
      }
      
      return data;
    }


    function showLoading(elementId, colspan = 6) {
      const el = document.getElementById(elementId);
      if (el) {
        el.innerHTML = `<tr><td colspan="${colspan}" class="loading-row"><div class="spinner"></div><span class="loading-text">Fetching latest data...</span></td></tr>`;
      }
    }

    // Dashboard
    async function loadDashboard() {
      const stats = await apiCall('/api/admin/stats');
      const statIds = ['statClients', 'statInvoices', 'statProjects', 'statRevenue'];
      statIds.forEach(id => {
          const el = document.getElementById(id);
          if (el && el.textContent === '...') el.textContent = '...'; // Keep dots if loading
      });

      document.getElementById('statClients').textContent = stats.clientCount;
      document.getElementById('statInvoices').textContent = stats.invoiceCount;
      document.getElementById('statProjects').textContent = stats.projectCount;
      document.getElementById('statRevenue').textContent = formatCurrency(stats.totalRevenue, 'INR');

      // Render Recent Projects on Dashboard
      const projectsContainer = document.getElementById('recentProjectsContainer');
      if (projectsContainer) {
        const allProjects = await apiCall('/api/projects');
        projectsContainer.innerHTML = allProjects.slice(0, 3).map(p => renderProjectCard(p)).join('') || '<div class="empty-state">No active projects.</div>';
      }

      const tbody = document.getElementById('recentInvoicesTable');
      tbody.innerHTML = stats.recentInvoices.map(inv => `
        <tr>
          <td>${inv.invoice_number}</td>
          <td><a href="admin-client-view.html?id=${inv.client_id}" style="color:var(--secondary); font-weight:600; text-decoration:none;">${inv.client_name}</a></td>
          <td>${formatCurrency(calculateTotal(inv.services), inv.currency)}</td>
          <td><span class="status-badge status-${inv.status}">${inv.status}</span></td>
          <td>${inv.invoice_date || '—'}</td>
        </tr>
      `).join('');

    }


    // Clients
    async function loadClients() {
      const cached = sessionStorage.getItem('cache_/api/clients');
      if (cached) {
        clients = JSON.parse(cached);
        renderClients();
      } else {
        showLoading('clientsTable', 6);
      }
      
      clients = await apiCall('/api/clients');
      renderClients();
    }

    function renderClients() {
      const tbody = document.getElementById('clientsTable');
      if (!tbody) return;
      tbody.innerHTML = clients.map(c => `
        <tr>
          <td>${c.name}</td>
          <td>${c.company}</td>
          <td>${c.email}</td>
          <td>${c.phone || '—'}</td>
          <td><span class="status-badge ${c.is_active ? 'status-paid' : 'status-draft'}">${c.is_active ? 'Active' : 'Inactive'}</span></td>
          <td>
            <div class="actions-cell">
              <button class="btn btn-primary btn-sm" onclick="viewClientProfile(${c.id})">View</button>
              <button class="btn btn-outline btn-sm" onclick="editClient(${c.id})">Edit</button>
              <button class="btn btn-outline btn-sm" onclick="deleteClient(${c.id})">Delete</button>
            </div>
          </td>
        </tr>
      `).join('') || '<tr><td colspan="6" class="empty-state">No clients yet</td></tr>';
    }

    window.viewClientProfile = (id) => {
      window.location.href = `admin-client-view.html?id=${id}`;
    };

    function showAddClientModal() {
      document.getElementById('clientModalTitle').textContent = 'Add Client';
      document.getElementById('clientForm').reset();
      document.getElementById('clientId').value = '';
      document.getElementById('passwordGroup').style.display = 'block';
      document.getElementById('clientModal').classList.add('show');
    }

    function editClient(id) {
      const client = clients.find(c => String(c.id) === String(id));
      if (!client) return alert('Client data not loaded. Please wait a moment.');
      
      document.getElementById('clientModalTitle').textContent = 'Edit Client';
      document.getElementById('clientId').value = client.id;
      document.getElementById('clientName').value = client.name;
      document.getElementById('clientCompany').value = client.company;
      document.getElementById('clientEmail').value = client.email;
      document.getElementById('clientPhone').value = client.phone || '';
      document.getElementById('clientStatus').value = client.is_active ? 1 : 0;
      document.getElementById('passwordGroup').style.display = 'none';
      document.getElementById('clientModal').classList.add('show');
    }

    async function saveClient() {
      const id = document.getElementById('clientId').value;
      const data = {
        name: document.getElementById('clientName').value,
        company: document.getElementById('clientCompany').value,
        email: document.getElementById('clientEmail').value,
        phone: document.getElementById('clientPhone').value,
        is_active: document.getElementById('clientStatus').value
      };

      if (!id) {
        data.password = document.getElementById('clientPassword').value || Math.random().toString(36).slice(-8);
      }

      if (id) {
        await apiCall('/api/clients/' + id, { method: 'PUT', body: JSON.stringify(data) });
      } else {
        const result = await apiCall('/api/clients', { method: 'POST', body: JSON.stringify(data) });
        if (result.password) {
          alert(`Client created!\n\nLogin credentials:\nEmail: ${result.email}\nPassword: ${result.password}\n\nShare these with the client.`);
        }
      }

      closeModal('clientModal');
      if (window.location.pathname.includes('admin-client-view.html')) {
        initClientView();
      } else {
        loadClients();
      }
    }

    async function deleteClient(id) {
      if (confirm('Delete this client and all related data?')) {
        await apiCall('/api/clients/' + id, { method: 'DELETE' });
        loadClients();
      }
    }

    window.deleteClient = deleteClient;
    window.editClient = editClient;
    window.saveClient = saveClient;
    window.showAddClientModal = showAddClientModal;

    // Invoices
    async function loadInvoices() {
      const cached = sessionStorage.getItem('cache_/api/invoices');
      if (cached) {
        invoices = JSON.parse(cached);
        renderInvoices();
      } else {
        showLoading('invoicesTable', 6);
      }

      invoices = await apiCall('/api/invoices');
      renderInvoices();
    }

    function renderInvoices() {
      const tbody = document.getElementById('invoicesTable');
      if (!tbody) return;
      tbody.innerHTML = invoices.map(inv => `
        <tr>
          <td>${inv.invoice_number}</td>
          <td>${inv.client_name}</td>
          <td>${formatCurrency(calculateTotal(inv.services), inv.currency)}</td>
          <td><span class="status-badge status-${inv.status}">${inv.status}</span></td>
          <td>${inv.invoice_date || '—'}</td>
          <td>
            <div class="actions-cell">
              <button class="btn btn-outline btn-sm" onclick="viewInvoice(${inv.id})">View</button>
              <button class="btn btn-outline btn-sm" onclick="editInvoice(${inv.id})">Edit</button>
              <button class="btn btn-outline btn-sm" onclick="printInvoice(${inv.id})">Print</button>
              <button class="btn btn-outline btn-sm" onclick="deleteInvoice(${inv.id})">Delete</button>
            </div>
          </td>
        </tr>
      `).join('') || '<tr><td colspan="6" class="empty-state">No invoices yet</td></tr>';
    }

    async function loadClientsForSelect() {
      clients = await apiCall('/api/clients');
      const select = document.getElementById('invoiceClient');
      select.innerHTML = clients.filter(c => c.is_active).map(c => `<option value="${c.id}">${c.name} - ${c.company}</option>`).join('');
      document.getElementById('projectClient').innerHTML = select.innerHTML;
    }

    function showCreateInvoice() {
      const urlParams = new URLSearchParams(window.location.search);
      const clientId = urlParams.get('id');
      if (clientId && window.location.pathname.includes('admin-client-view.html')) {
        window.location.href = `invoice.html?clientId=${clientId}`;
      } else {
        window.location.href = 'invoice.html';
      }
    }

    window.showCreateInvoice = showCreateInvoice;

    async function editInvoice(id) {
      window.location.href = 'invoice.html?id=' + id;
    }



    async function viewInvoice(id) {
      window.open(`invoice.html?id=${id}&view=true`, '_blank');
    }

    async function printInvoice(id) {
      window.location.href = 'invoice.html?id=' + id + '&print=true';
    }

    async function deleteInvoice(id) {
      if (confirm('Delete this invoice?')) {
        await apiCall('/api/invoices/' + id, { method: 'DELETE' });
        loadInvoices();
      }
    }

    // Projects
    async function loadProjects() {
      const cached = sessionStorage.getItem('cache_/api/projects');
      if (cached) {
        projects = JSON.parse(cached);
        renderProjects();
      } else {
        showLoading('projectsTable', 6);
      }

      projects = await apiCall('/api/projects');
      renderProjects();
    }

    function renderProjects() {
      const tbody = document.getElementById('projectsTable');
      if (!tbody) return;
      tbody.innerHTML = projects.map(p => `
        <tr>
          <td>${p.name}</td>
          <td>${p.client_name}</td>
          <td><span class="project-priority-badge priority-${(p.priority || 'Medium').toLowerCase()}">${p.priority || 'Medium'}</span></td>
          <td><span class="status-badge status-${p.status}">${p.status.replace('_', ' ')}</span></td>
          <td>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${p.progress}%"></div>
            </div>
            <span style="font-size:0.75rem;">${p.progress}%</span>
          </td>
          <td>
            <div class="actions-cell">
              <button class="btn btn-outline btn-sm" onclick="editProject(${p.id})">Edit</button>
              <button class="btn btn-outline btn-sm" onclick="deleteProject(${p.id})">Delete</button>
            </div>
          </td>
        </tr>
      `).join('') || '<tr><td colspan="6" class="empty-state">No projects yet</td></tr>';
    }

    window.addMilestoneRow = (m = {}) => {
      const container = document.getElementById('milestoneContainer');
      if (!container) return;
      const div = document.createElement('div');
      div.className = 'milestone-input-row';
      div.style.padding = '12px';
      div.style.background = '#f8f8ff';
      div.style.borderRadius = '8px';
      div.style.marginBottom = '12px';
      div.style.border = '1px solid #e2e2f0';
      
      div.innerHTML = `
        <div class="form-row" style="margin-bottom:8px;">
          <div style="flex:2">
            <label style="font-size:0.7rem; color:var(--body);">Milestone Name</label>
            <input type="text" class="milestone-title" placeholder="e.g. Initial Design" value="${m.title || ''}" style="width:100%; padding:8px; border:1px solid #e2e2f0; border-radius:6px;">
          </div>
          <div style="flex:1">
            <label style="font-size:0.7rem; color:var(--body);">Progress (%)</label>
            <input type="number" class="milestone-progress" value="${m.progress || 0}" min="0" max="100" style="width:100%; padding:8px; border:1px solid #e2e2f0; border-radius:6px;">
          </div>
        </div>
        <div class="form-row" style="margin-bottom:8px;">
          <div style="flex:1">
            <label style="font-size:0.7rem; color:var(--body);">Start Date</label>
            <input type="date" class="milestone-start" value="${m.start_date || m.deadline || ''}" style="width:100%; padding:8px; border:1px solid #e2e2f0; border-radius:6px;">
          </div>
          <div style="flex:1">
            <label style="font-size:0.7rem; color:var(--body);">End Date</label>
            <input type="date" class="milestone-end" value="${m.end_date || ''}" style="width:100%; padding:8px; border:1px solid #e2e2f0; border-radius:6px;">
          </div>
        </div>
        <div class="form-row" style="align-items:center;">
          <div style="flex:2">
            <label style="font-size:0.7rem; color:var(--body);">Link / File Ref</label>
            <input type="text" class="milestone-link" placeholder="http://..." value="${m.link || ''}" style="width:100%; padding:8px; border:1px solid #e2e2f0; border-radius:6px;">
          </div>
          <button type="button" onclick="this.parentElement.parentElement.remove()" style="background:none; border:none; color:red; cursor:pointer; margin-left:12px; font-weight:600;">&times; Remove</button>
        </div>
      `;
      container.appendChild(div);
    };

    function getMilestonesFromForm() {
      const rows = document.querySelectorAll('.milestone-input-row');
      const milestones = [];
      rows.forEach(row => {
        const title = row.querySelector('.milestone-title').value.trim();
        if (title) {
          milestones.push({
            title,
            progress: parseInt(row.querySelector('.milestone-progress').value) || 0,
            start_date: row.querySelector('.milestone-start').value,
            end_date: row.querySelector('.milestone-end').value,
            link: row.querySelector('.milestone-link').value
          });
        }
      });
      return milestones;
    }

    function showAddProjectModal() {
      loadClientsForSelect();
      document.getElementById('projectModalTitle').textContent = 'Add Project';
      document.getElementById('projectForm').reset();
      document.getElementById('projectId').value = '';
      const container = document.getElementById('milestoneContainer');
      if (container) container.innerHTML = '';
      document.getElementById('projectModal').classList.add('show');
    }

    async function editProject(id) {
      await loadClientsForSelect();
      const proj = projects.find(p => String(p.id) === String(id));
      document.getElementById('projectModalTitle').textContent = 'Edit Project';
      document.getElementById('projectId').value = proj.id;
      document.getElementById('projectClient').value = proj.client_id;
      document.getElementById('projectName').value = proj.name;
      document.getElementById('projectType').value = proj.project_type || 'Web Development';
      document.getElementById('projectPriority').value = proj.priority || 'Medium';
      document.getElementById('projectStartDate').value = proj.start_date || '';
      document.getElementById('projectEndDate').value = proj.end_date || '';
      document.getElementById('projectNotes').value = proj.notes || '';
      document.getElementById('projectLinks').value = Array.isArray(proj.external_links) ? JSON.stringify(proj.external_links) : (proj.external_links || '');
      
      const container = document.getElementById('milestoneContainer');
      if (container) {
        container.innerHTML = '';
        if (proj.milestones && Array.isArray(proj.milestones)) {
          proj.milestones.forEach(m => window.addMilestoneRow(m));
        }
      }
      
      document.getElementById('projectModal').classList.add('show');
    }

    async function saveProject() {
      const data = {
        client_id: document.getElementById('projectClient').value,
        name: document.getElementById('projectName').value,
        project_type: document.getElementById('projectType').value,
        priority: document.getElementById('projectPriority').value,
        start_date: document.getElementById('projectStartDate').value,
        end_date: document.getElementById('projectEndDate').value,
        notes: document.getElementById('projectNotes').value,
        external_links: document.getElementById('projectLinks').value
      };

      const id = document.getElementById('projectId').value;
      if (id) {
        await apiCall('/api/projects/' + id, { method: 'PUT', body: JSON.stringify(data) });
      } else {
        // New project starts with empty milestones
        data.milestones = [];
        data.progress = 0;
        data.status = 'discovery';
        await apiCall('/api/projects', { method: 'POST', body: JSON.stringify(data) });
      }

      closeModal('projectModal');
      loadProjects();
      const urlParams = new URLSearchParams(window.location.search);
      const clientId = urlParams.get('id');
      if (clientId) loadClientProjects(clientId);
    }

    window.openMilestoneModal = (projectId, milestoneIndex = null) => {
      const proj = projects.find(p => String(p.id) === String(projectId));
      if (!proj) return;

      document.getElementById('milestoneProjectId').value = projectId;
      document.getElementById('milestoneIndex').value = milestoneIndex !== null ? milestoneIndex : '';
      document.getElementById('milestoneForm').reset();
      
      if (milestoneIndex !== null) {
        const ms = proj.milestones[milestoneIndex];
        document.getElementById('milestoneModalTitle').textContent = 'Edit Milestone';
        document.getElementById('msTitle').value = ms.title || '';
        document.getElementById('msStartDate').value = ms.start_date || '';
        document.getElementById('msEndDate').value = ms.end_date || '';
        document.getElementById('msProgress').value = ms.progress || 0;
        document.getElementById('msDesc').value = ms.description || '';
        document.getElementById('msLink').value = ms.link || '';
        document.getElementById('msFile').value = ms.file || '';
      } else {
        document.getElementById('milestoneModalTitle').textContent = 'Add Milestone';
      }
      
      document.getElementById('milestoneModal').classList.add('show');
    };

    window.saveMilestone = async () => {
      const projectId = document.getElementById('milestoneProjectId').value;
      const index = document.getElementById('milestoneIndex').value;
      const proj = projects.find(p => String(p.id) === String(projectId));
      if (!proj) return;
      
      const milestone = {
        title: document.getElementById('msTitle').value,
        start_date: document.getElementById('msStartDate').value,
        end_date: document.getElementById('msEndDate').value,
        progress: parseInt(document.getElementById('msProgress').value) || 0,
        description: document.getElementById('msDesc').value,
        link: document.getElementById('msLink').value,
        file: document.getElementById('msFile').value
      };

      let milestones = Array.isArray(proj.milestones) ? [...proj.milestones] : [];
      
      if (index !== '') {
        milestones[parseInt(index)] = milestone;
      } else {
        milestones.push(milestone);
      }

      // Calculate overall progress
      const sum = milestones.reduce((acc, m) => acc + (parseInt(m.progress) || 0), 0);
      const avgProgress = milestones.length > 0 ? Math.round(sum / milestones.length) : 0;
      const status = avgProgress >= 100 ? 'launched' : (avgProgress > 0 ? 'development' : 'discovery');

      await apiCall('/api/projects/' + projectId, {
        method: 'PUT',
        body: JSON.stringify({
          milestones: milestones,
          progress: avgProgress,
          status: status
        })
      });

      closeModal('milestoneModal');
      
      // Update local state to prevent flicker
      proj.milestones = milestones;
      proj.progress = avgProgress;
      proj.status = status;

      loadProjects();
      const urlParams = new URLSearchParams(window.location.search);
      const clientId = urlParams.get('id');
      if (clientId) loadClientProjects(clientId);
    };

    window.deleteMilestone = async (projectId, index) => {
      if (!confirm('Delete this milestone?')) return;
      const proj = projects.find(p => String(p.id) === String(projectId));
      if (!proj) return;

      let milestones = Array.isArray(proj.milestones) ? [...proj.milestones] : [];
      milestones.splice(index, 1);

      const sum = milestones.reduce((acc, m) => acc + (parseInt(m.progress) || 0), 0);
      const avgProgress = milestones.length > 0 ? Math.round(sum / milestones.length) : 0;
      const status = avgProgress >= 100 ? 'launched' : (avgProgress > 0 ? 'development' : 'discovery');

      await apiCall('/api/projects/' + projectId, {
        method: 'PUT',
        body: JSON.stringify({
          milestones: milestones,
          progress: avgProgress,
          status: status
        })
      });

      loadProjects();
      const urlParams = new URLSearchParams(window.location.search);
      const clientId = urlParams.get('id');
      if (clientId) loadClientProjects(clientId);
    };

    async function deleteProject(id) {
      if (confirm('Delete this project and all updates?')) {
        await apiCall('/api/projects/' + id, { method: 'DELETE' });
        loadProjects();
      }
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
          <td><button class="btn btn-outline btn-sm" onclick="deleteProjectFile(${f.id}, ${id})">Delete</button></td>
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

    // Proposals (placeholder - same structure as invoices)
    async function loadProposals() {
      const cached = sessionStorage.getItem('cache_/api/proposals');
      if (cached) {
        proposals = JSON.parse(cached);
        renderProposals();
      } else {
        showLoading('proposalsTable', 6);
      }

      proposals = await apiCall('/api/proposals');
      renderProposals();
    }

    function renderProposals() {
      const tbody = document.getElementById('proposalsTable');
      if (!tbody) return;
      tbody.innerHTML = proposals.map(p => `
        <tr>
          <td>${p.proposal_number}</td>
          <td>${p.client_name}</td>
          <td>${p.project_title || '—'}</td>
          <td>${formatCurrency(calculateTotal(p.services), p.currency)}</td>
          <td><span class="status-badge status-${p.status}">${p.status}</span></td>
          <td>
            <div class="actions-cell">
              <button class="btn btn-outline btn-sm" onclick="viewProposal(${p.id})">View</button>
              <button class="btn btn-outline btn-sm" onclick="editProposal(${p.id})">Edit</button>
              <button class="btn btn-outline btn-sm" onclick="deleteProposal(${p.id})">Delete</button>
            </div>
          </td>
        </tr>
      `).join('') || '<tr><td colspan="6" class="empty-state">No proposals yet</td></tr>';
    }

    function showCreateProposal() {
      const urlParams = new URLSearchParams(window.location.search);
      const clientId = urlParams.get('id');
      if (clientId && window.location.pathname.includes('admin-client-view.html')) {
        window.location.href = `proposal.html?clientId=${clientId}`;
      } else {
        window.location.href = 'proposal.html';
      }
    }
    window.showCreateProposal = showCreateProposal;
    async function viewProposal(id) { window.open(`proposal.html?id=${id}&view=true`, '_blank'); }
    async function editProposal(id) { window.location.href = 'proposal.html?id=' + id; }
    async function deleteProposal(id) { await apiCall('/api/proposals/' + id, { method: 'DELETE' }); loadProposals(); }

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

    // Client View / Dossier Logic
    async function initClientView() {
      const urlParams = new URLSearchParams(window.location.search);
      const clientId = urlParams.get('id');
      if (!clientId) {
        window.location.href = 'admin-clients.html';
        return;
      }

      // Hide client selection in modals if on this page
      const invoiceClientGroup = document.getElementById('invoiceClientGroup');
      const projectClientGroup = document.getElementById('projectClientGroup');
      if (invoiceClientGroup) invoiceClientGroup.style.display = 'none';
      if (projectClientGroup) projectClientGroup.style.display = 'none';

      try {
        // Load all clients first to populate the global 'clients' array (needed for Edit button)
        clients = await apiCall('/api/clients');
        
        // Use the client from the already loaded array
        const client = clients.find(c => String(c.id) === String(clientId));
        
        if (!client) {
          alert('Client not found');
          window.location.href = 'admin-clients.html';
          return;
        }

        document.getElementById('viewClientName').textContent = client.name;
        document.getElementById('viewClientCompany').textContent = client.company;
        document.getElementById('viewClientEmail').textContent = client.email;
        document.getElementById('viewClientPhone').textContent = client.phone || '—';

        // Load Client Specific Data
        loadClientInvoices(clientId);
        loadClientProposals(clientId);
        loadClientProjects(clientId);
      } catch (err) {
        console.error('Error initializing client view:', err);
      }
    }

    async function loadClientInvoices(clientId) {
      const allInvoices = await apiCall('/api/invoices');
      const clientInvoices = allInvoices.filter(inv => inv.client_id == clientId);
      
      document.getElementById('countInvoices').textContent = clientInvoices.length;
      
      let ltv = 0;
      let balance = 0;
      clientInvoices.forEach(inv => {
        const total = calculateTotal(inv.services);
        ltv += total;
        if (inv.status !== 'paid') {
          balance += (total - (inv.payment_received || 0));
        }
      });
      
      document.getElementById('clientLTV').textContent = formatCurrency(ltv, 'INR');
      document.getElementById('clientBalance').textContent = formatCurrency(balance, 'INR');

      const tbody = document.getElementById('clientInvoicesTable');
      if (tbody) {
        tbody.innerHTML = clientInvoices.map(inv => `
          <tr>
            <td>${inv.invoice_number}</td>
            <td>${formatCurrency(calculateTotal(inv.services), inv.currency)}</td>
            <td><span class="status-badge status-${inv.status}">${inv.status}</span></td>
            <td>${inv.invoice_date || '—'}</td>
            <td>
              <div class="actions-cell">
                <button class="btn btn-outline btn-sm" onclick="viewInvoice(${inv.id})">View</button>
                <button class="btn btn-outline btn-sm" onclick="editInvoice(${inv.id})">Edit</button>
                <button class="btn btn-outline btn-sm" onclick="deleteInvoice(${inv.id})">Delete</button>
              </div>
            </td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="empty-state">No invoices yet</td></tr>';
      }
    }

    async function loadClientProposals(clientId) {
      const allProposals = await apiCall('/api/proposals');
      const clientProposals = allProposals.filter(p => p.client_id == clientId);
      
      const tbody = document.getElementById('clientProposalsTable');
      if (tbody) {
        tbody.innerHTML = clientProposals.map(p => `
          <tr>
            <td>${p.proposal_number}</td>
            <td>${p.project_title || '—'}</td>
            <td>${formatCurrency(calculateTotal(p.services), p.currency)}</td>
            <td><span class="status-badge status-${p.status}">${p.status}</span></td>
            <td>
              <div class="actions-cell">
                <button class="btn btn-outline btn-sm" onclick="viewProposal(${p.id})">View</button>
                <button class="btn btn-outline btn-sm" onclick="editProposal(${p.id})">Edit</button>
                <button class="btn btn-outline btn-sm" onclick="deleteProposal(${p.id})">Delete</button>
              </div>
            </td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="empty-state">No proposals yet</td></tr>';
      }
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
                ${p.client_name ? `<small style="font-weight:400; opacity:0.6; display:block; margin-top:4px;">${p.client_name}</small>` : ''}
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
          
          <div class="project-info-short" style="margin:20px 0; font-size:0.95rem; color:var(--body); line-height:1.6; max-width:800px;">
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
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h4 style="font-size:0.9rem; font-weight:800; color:var(--title); text-transform:uppercase; letter-spacing:1px;">Milestone Roadmap</h4>
            </div>
            <div class="milestone-grid">
                ${milestones.map((m, idx) => `
                    <div class="milestone-card" onclick="openMilestoneModal(${p.id}, ${idx})">
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
                `).join('')}
                <div class="milestone-card add-milestone-card" onclick="openMilestoneModal(${p.id})">
                    <div class="add-milestone-icon">+</div>
                    <div class="add-milestone-text">Add Milestone</div>
                </div>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:40px; padding-top:24px; border-top:1px solid #f1f5f9;">
            <div style="display:flex; gap:12px;">
              <button class="btn btn-outline" onclick="openProjectFiles(${p.id})">📁 Files Repository</button>
              <button class="btn btn-outline" onclick="openProjectComments(${p.id})">💬 Collaboration Feed</button>
            </div>
            <div style="display:flex; gap:12px;">
              <button class="btn btn-outline" onclick="editProject(${p.id})">Project Settings</button>
              <button class="btn btn-outline" style="color:#ef4444; border-color:#fee2e2;" onclick="deleteProject(${p.id})">Remove Project</button>
            </div>
          </div>
        </div>
      `;
    }

    async function loadClientProjects(clientId) {
      projects = await apiCall('/api/projects');
      const clientProjects = projects.filter(p => String(p.client_id) === String(clientId));
      document.getElementById('countProjects').textContent = clientProjects.length;

      const container = document.getElementById('clientProjectsTable'); 
      if (container) {
        container.innerHTML = clientProjects.map(p => renderProjectCard(p)).join('') || '<div class="empty-state">No projects active for this client.</div>';
      }
    }

    window.openProjectComments = async (id) => {
      document.getElementById('currentCommentProjectId').value = id;
      document.getElementById('commentsModal').classList.add('show');
      loadComments(id);
    };

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

    window.postComment = async () => {
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
    };

    window.switchTab = (tabId) => {
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      const targetContent = document.getElementById(tabId);
      const targetBtn = document.getElementById('tab-' + tabId);
      if (targetContent) targetContent.classList.add('active');
      if (targetBtn) targetBtn.classList.add('active');
    };

    // Global exposures for dossier actions
    window.viewInvoice = viewInvoice;
    window.editInvoice = editInvoice;
    window.deleteInvoice = deleteInvoice;
    window.viewProposal = viewProposal;
    window.editProposal = editProposal;
    window.deleteProposal = deleteProposal;
    window.openProjectFiles = openProjectFiles;
    window.openProjectComments = openProjectComments;
    window.postComment = postComment;
    window.editProject = editProject;
    window.deleteProject = deleteProject;
    window.showAddProjectModal = showAddProjectModal;
    window.saveProject = saveProject;
    window.uploadProjectFile = uploadProjectFile;
    window.deleteProjectFile = deleteProjectFile;
    window.closeModal = closeModal;
    window.logout = logout;
    window.addMilestoneRow = addMilestoneRow;

    // Initialize based on page
    if (window.location.pathname.includes('admin-client-view.html')) {
      initClientView();
    } else {
      const activeNav = document.querySelector('.nav-item.active');
      if (activeNav) {
        loadPageData(activeNav.dataset.page);
      } else {
        loadDashboard();
      }
    }
});
  