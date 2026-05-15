document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '';
    let clients = [];
    let invoices = [];
    let proposals = [];
    let projects = [];

    // Pagination State
    const pagination = {
      dashboardInvoices: { page: 1, limit: 5 },
      dashboardProjects: { page: 1, limit: 3 },
      clients: { page: 1, limit: 10 },
      clientInvoices: { page: 1, limit: 10 },
      clientProposals: { page: 1, limit: 10 },
      clientProjects: { page: 1, limit: 5 },
      emails: { page: 1, limit: 10 }
    };


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
        case 'emails': loadEmailLogs(); break;
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
      if (res.status === 401 || res.status === 403) {
        localStorage.clear();
        window.location.href = 'index.html';
        return { error: 'Authentication failed' };
      }

      const data = await res.json();
      
      if (data.error) {
        console.error('API Error:', data.error);
        // Return empty array/object to prevent .map() crashes
        return Array.isArray(endpoint) ? [] : data; 
      }
      
      // Cache GET requests
      if (!options.method || options.method === 'GET') {
        if (!data.error) {
          sessionStorage.setItem('cache_' + endpoint, JSON.stringify(data));
        }
      } else {
        // Clear relevant cache on mutation
        sessionStorage.removeItem('cache_' + endpoint);
        // Also clear common related caches if needed (e.g. stats)
        if (endpoint.includes('/api/projects')) sessionStorage.removeItem('cache_/api/projects');
        if (endpoint.includes('/api/invoices')) sessionStorage.removeItem('cache_/api/invoices');
        if (endpoint.includes('/api/clients')) sessionStorage.removeItem('cache_/api/clients');
        sessionStorage.removeItem('cache_/api/admin/stats');
      }
      
      return data;
    }


    function showLoading(elementId, colspan = 6) {
      const el = document.getElementById(elementId);
      if (el) {
        el.innerHTML = `<tr><td colspan="${colspan}" class="loading-row"><div class="spinner"></div><span class="loading-text">Fetching latest data...</span></td></tr>`;
      }
    }

    // Pagination Helper
    function getPagedData(data, type) {
      const { page, limit } = pagination[type];
      const start = (page - 1) * limit;
      return data.slice(start, start + limit);
    }

    function renderPaginationUI(containerId, totalItems, type) {
      const container = document.getElementById(containerId);
      if (!container) return;

      const { page, limit } = pagination[type];
      const totalPages = Math.ceil(totalItems / limit);

      if (totalPages <= 1) {
        container.innerHTML = '';
        return;
      }

      container.innerHTML = `
        <button class="pagination-btn" ${page === 1 ? 'disabled' : ''} onclick="window.changeAdminPage('${type}', ${page - 1})">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg> Previous
        </button>
        <span class="pagination-info">Page ${page} of ${totalPages}</span>
        <button class="pagination-btn" ${page === totalPages ? 'disabled' : ''} onclick="window.changeAdminPage('${type}', ${page + 1})">
          Next <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      `;
    }

    window.changeAdminPage = (type, newPage) => {
      pagination[type].page = newPage;
      switch(type) {
        case 'dashboardInvoices': renderDashboardInvoices(); break;
        case 'dashboardProjects': renderDashboardProjects(); break;
        case 'clients': renderClients(); break;
        case 'clientInvoices': renderClientInvoices(); break;
        case 'clientProposals': renderClientProposals(); break;
        case 'clientProjects': renderClientProjects(); break;
        case 'emails': renderEmailLogs(); break;
      }
    };


    // Dashboard
    let dashboardStats = null;
    let dashboardProjects = [];
    async function loadDashboard() {
      const stats = await apiCall('/api/admin/stats');
      dashboardStats = stats;
      const statIds = ['statClients', 'statInvoices', 'statProjects', 'statRevenue'];
      statIds.forEach(id => {
          const el = document.getElementById(id);
          if (el && el.textContent === '...') el.textContent = '...'; // Keep dots if loading
      });

      document.getElementById('statClients').textContent = stats.clientCount;
      document.getElementById('statInvoices').textContent = stats.invoiceCount;
      document.getElementById('statProjects').textContent = stats.projectCount;
      document.getElementById('statRevenue').textContent = formatCurrency(stats.totalRevenue, 'INR');

      renderDashboardInvoices();

      dashboardProjects = await apiCall('/api/projects');
      renderDashboardProjects();
    }

    function renderDashboardInvoices() {
      const tbody = document.getElementById('recentInvoicesTable');
      if (!tbody || !dashboardStats) return;
      
      const data = dashboardStats.recentInvoices || [];
      const paged = getPagedData(data, 'dashboardInvoices');

      tbody.innerHTML = paged.map(inv => `
        <tr>
          <td>${inv.invoice_number}</td>
          <td><a href="admin-client-view.html?id=${inv.client_id}" style="color:var(--secondary); font-weight:600; text-decoration:none;">${inv.client_name}</a></td>
          <td>${formatCurrency(calculateTotal(inv.services), inv.currency)}</td>
          <td><span class="status-badge status-${inv.status}">${inv.status}</span></td>
          <td>${inv.invoice_date || '—'}</td>
        </tr>
      `).join('') || '<tr><td colspan="5" class="empty-state">No recent invoices</td></tr>';

      renderPaginationUI('invoicesPagination', data.length, 'dashboardInvoices');
    }

    function renderDashboardProjects() {
      const container = document.getElementById('recentProjectsContainer');
      if (!container) return;

      const paged = getPagedData(dashboardProjects, 'dashboardProjects');
      container.innerHTML = paged.map(p => renderCompactProjectCard(p)).join('') || '<div class="empty-state">No active projects.</div>';
      
      renderPaginationUI('projectsPagination', dashboardProjects.length, 'dashboardProjects');
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
      if (!tbody || !Array.isArray(clients)) return;

      const paged = getPagedData(clients, 'clients');
      tbody.innerHTML = paged.map(c => `
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

      renderPaginationUI('clientsPagination', clients.length, 'clients');
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
      if (!tbody || !Array.isArray(invoices)) return;
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
      if (!tbody || !Array.isArray(projects)) return;
      tbody.innerHTML = projects.map(p => `
        <tr>
          <td>${p.name}</td>
          <td>${p.client_name}</td>
          <td><span class="priority-badge priority-${(p.priority || 'Medium').toLowerCase()}">${p.priority || 'Medium'}</span></td>
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

    // Email Logs
    let emailLogs = [];
    async function loadEmailLogs(clientId = null) {
      if (clientId) {
        showLoading('clientEmailsTable', 4);
      } else {
        showLoading('emailLogsTable', 5);
      }
      
      const allLogs = await apiCall('/api/admin/email-logs');
      if (clientId) {
        emailLogs = allLogs.filter(log => String(log.reference_id) === String(clientId) || log.recipient_email.includes(clientId)); // Fallback if ref_id isn't user_id
        // Actually, reference_id for 'project'/'invoice'/'proposal' is the object id.
        // We might need to filter by recipient email if we don't have a direct user_id in logs.
        // Let's assume we can filter by recipient email which we get from client data.
        const client = clients.find(c => String(c.id) === String(clientId));
        if (client) {
            emailLogs = allLogs.filter(log => log.recipient_email === client.email);
        }
      } else {
        emailLogs = allLogs;
      }
      
      renderEmailLogs(clientId ? 'clientEmailsTable' : 'emailLogsTable');
    }

    function renderEmailLogs(tableId = 'emailLogsTable') {
      const tbody = document.getElementById(tableId);
      if (!tbody) return;

      const paged = getPagedData(emailLogs, 'emails');
      const isClientView = tableId === 'clientEmailsTable';

      tbody.innerHTML = paged.map(log => `
        <tr>
          ${!isClientView ? `<td>${log.recipient_email}</td>` : ''}
          <td>${log.subject}</td>
          <td><span class="badge" style="background:#e2e8f0; color:#475569; padding:2px 8px; border-radius:4px; font-size:10px; text-transform:uppercase;">${log.email_type}</span></td>
          <td><span class="status-badge status-paid" style="background:#dcfce7; color:#166534;">Sent</span></td>
          <td>${new Date(log.sent_at).toLocaleString()}</td>
        </tr>
      `).join('') || `<tr><td colspan="${isClientView ? 4 : 5}" class="empty-state">No email logs found</td></tr>`;

      renderPaginationUI(isClientView ? 'emailsPagination' : 'emailLogsPagination', emailLogs.length, 'emails');
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
      document.getElementById('projectType').value = proj.project_type || '';
      document.getElementById('projectPriority').value = proj.priority || 'Medium';
      document.getElementById('projectStartDate').value = proj.start_date || '';
      document.getElementById('projectEndDate').value = proj.end_date || '';
      document.getElementById('projectNotes').value = proj.notes || '';

      
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
        milestones: getMilestonesFromForm()
      };

      // Auto-calculate progress based on milestones if editing
      if (data.milestones.length > 0) {
        const total = data.milestones.reduce((acc, m) => acc + (parseInt(m.progress) || 0), 0);
        data.progress = Math.min(100, Math.round(total / data.milestones.length));
      }

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
        document.getElementById('msStatusToggle').checked = ms.status === 'completed';
        document.getElementById('msDesc').value = ms.description || '';
        document.getElementById('msLink').value = ms.link || '';
        document.getElementById('msFile').value = ms.file || '';
      } else {
        document.getElementById('milestoneModalTitle').textContent = 'Add Milestone';
        document.getElementById('msStatusToggle').checked = false; // Default to Started
      }
      
      document.getElementById('milestoneModal').classList.add('show');
    };

    window.saveMilestone = async () => {
      const projectId = document.getElementById('milestoneProjectId').value;
      const index = document.getElementById('milestoneIndex').value;
      const proj = projects.find(p => String(p.id) === String(projectId));
      if (!proj) return;
      
      const isCompleted = document.getElementById('msStatusToggle').checked;
      const milestone = {
        title: document.getElementById('msTitle').value,
        start_date: document.getElementById('msStartDate').value,
        end_date: document.getElementById('msEndDate').value,
        status: isCompleted ? 'completed' : 'started',
        progress: isCompleted ? 100 : 0, // Individual progress is binary now
        description: document.getElementById('msDesc').value,
        link: document.getElementById('msLink').value,
        file: document.getElementById('msFile').value
      };

      let milestones = Array.isArray(proj.milestones) ? [...proj.milestones] : [];
      
      if (index !== '') {
        milestones[parseInt(index)] = milestone;
      } else {
        if (milestones.length >= 4) return alert('Maximum 4 milestones allowed.');
        milestones.push(milestone);
      }

      // Calculate overall progress: each COMPLETED milestone is 25%
      const completedCount = milestones.filter(m => m.status === 'completed').length;
      const totalProgress = Math.min(100, completedCount * 25);
      const status = totalProgress >= 100 ? 'launched' : (totalProgress > 0 ? 'development' : 'discovery');

      await apiCall('/api/projects/' + projectId, {
        method: 'PUT',
        body: JSON.stringify({
          milestones: milestones,
          progress: totalProgress,
          status: status
        })
      });

      closeModal('milestoneModal');
      
      // Update local state to prevent flicker
      proj.milestones = milestones;
      proj.progress = totalProgress;
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

      const totalProgress = Math.min(100, milestones.reduce((acc, m) => acc + (parseInt(m.progress) || 0), 0));
      const status = totalProgress >= 100 ? 'launched' : (totalProgress > 0 ? 'development' : 'discovery');

      await apiCall('/api/projects/' + projectId, {
        method: 'PUT',
        body: JSON.stringify({
          milestones: milestones,
          progress: totalProgress,
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

    function openProjectFiles(id) {
      document.getElementById('currentProjectFilesId').value = id;
      document.getElementById('filesModal').classList.add('show');
      
      // Feature 8: Reset tabs and load everything
      switchResourceTab('admin-files');
      loadProjectFiles(id);
      loadProjectLinks(id);
    }

    window.switchResourceTab = (tabName) => {
      // Buttons
      document.querySelectorAll('.modal-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick').includes(`'${tabName}'`));
      });
      // Contents
      document.querySelectorAll('.resource-tab-content').forEach(content => {
        content.style.display = content.id === 'tab-' + tabName ? 'block' : 'none';
      });
    };

    async function loadProjectFiles(id) {
      const files = await apiCall('/api/projects/' + id + '/files');
      const adminList = document.getElementById('adminFilesList');
      const clientList = document.getElementById('clientFilesList');
      if (!adminList || !clientList) return;

      const getThumb = (f) => {
        const ext = f.original_name.split('.').pop().toLowerCase();
        const isImg = ['jpg','jpeg','png','webp','gif'].includes(ext);
        if (isImg) return `<div class="file-thumb"><img src="${f.file_path}" alt="Thumb"></div>`;
        if (ext === 'pdf') return `<div class="file-thumb"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>`;
        return `<div class="file-thumb"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg></div>`;
      };

      const renderFile = (f) => `
        <div class="file-list-item">
          ${getThumb(f)}
          <div class="file-info">
            <a href="${f.file_path}" target="_blank" class="file-name">${f.original_name}</a>
            <span class="file-meta">${new Date(f.created_at).toLocaleDateString()} · By ${f.uploader_name}</span>
          </div>
          <button class="btn-icon" style="color:#ef4444;" onclick="deleteProjectFile(${f.id}, ${id})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          </button>
        </div>
      `;

      const adminFiles = files.filter(f => f.uploader_role === 'admin');
      const clientFiles = files.filter(f => f.uploader_role === 'client');

      adminList.innerHTML = adminFiles.map(renderFile).join('') || '<div class="empty-state">No admin files uploaded</div>';
      clientList.innerHTML = clientFiles.map(renderFile).join('') || '<div class="empty-state">No client files uploaded</div>';
    }

    async function loadProjectLinks(id) {
      const links = await apiCall('/api/projects/' + id + '/links');
      const list = document.getElementById('projectLinksList');
      if (!list) return;

      list.innerHTML = links.map(l => `
        <div class="link-item">
          <div class="link-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></div>
          <div class="link-title">
            <a href="${l.url}" target="_blank" style="color:inherit; text-decoration:none;">${l.title}</a>
            <div style="font-size:0.7rem; color:var(--muted); margin-top:2px;">Shared by ${l.creator_name} (${l.creator_role})</div>
          </div>
          <div class="link-actions">
            <button class="btn-icon" style="color:#ef4444;" onclick="deleteProjectLink(${l.id}, ${id})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
          </div>
        </div>
      `).join('') || '<div class="empty-state">No links shared yet</div>';
    }

    window.addProjectLink = async () => {
      const id = document.getElementById('currentProjectFilesId').value;
      const title = document.getElementById('linkTitle').value;
      const url = document.getElementById('linkUrl').value;
      if (!title || !url) return alert('Enter title and URL');

      const res = await apiCall('/api/projects/' + id + '/links', {
        method: 'POST',
        body: JSON.stringify({ title, url })
      });
      
      if (res && !res.error) {
        document.getElementById('linkTitle').value = '';
        document.getElementById('linkUrl').value = '';
        loadProjectLinks(id);
      } else {
        alert('Error saving link: ' + (res?.error || 'Unknown error'));
      }
    };


    window.deleteProjectLink = async (linkId, projectId) => {
      if (!confirm('Remove this link?')) return;
      const res = await apiCall(`/api/projects/${projectId}/links/${linkId}`, { method: 'DELETE' });
      if (res && !res.error) {
        loadProjectLinks(projectId);
      } else {
        alert('Error deleting link: ' + (res?.error || 'Unknown error'));
      }
    };


    async function uploadProjectFile() {
      const id = document.getElementById('currentProjectFilesId').value;
      const fileInput = document.getElementById('fileUploadInput');
      const file = fileInput.files[0];
      if (!file) return alert('Select a file to upload');

      // Validation
      const MAX_SIZE = 5 * 1024 * 1024;
      if (file.size > MAX_SIZE) return alert('File exceeds 5MB limit');
      
      const allowedExts = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
      const ext = file.name.split('.').pop().toLowerCase();
      if (!allowedExts.includes(ext)) return alert('Only PDF and Images are allowed');

      // UI refs
      const progressWrap = document.getElementById('uploadProgressWrap');
      const progressBar  = document.getElementById('uploadProgressBar');
      const pctLabel     = document.getElementById('uploadProgressPct');
      const statusText   = document.getElementById('uploadStatusText');
      const uploadBtn    = document.getElementById('uploadFileBtn');
      const chip         = document.getElementById('filePreviewChip');

      // Show progress, lock button
      if (progressWrap) progressWrap.classList.add('show');
      if (uploadBtn) {
        uploadBtn.classList.add('uploading');
        uploadBtn.innerHTML = '⏳ Uploading…';
        uploadBtn.disabled = true;
      }
      if (progressBar) {
        progressBar.style.width = '0%';
        progressBar.classList.remove('success', 'error');
      }
      if (pctLabel) pctLabel.textContent = '0%';
      if (statusText) statusText.textContent = 'Uploading…';

      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();

      // Progress event
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          if (progressBar) progressBar.style.width = pct + '%';
          if (pctLabel) pctLabel.textContent = pct + '%';
        }
      });

      // On complete
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          if (progressBar) {
            progressBar.classList.add('success');
            progressBar.style.width = '100%';
          }
          if (pctLabel) pctLabel.textContent = '100%';
          if (statusText) statusText.textContent = '✓ Upload complete';
          if (uploadBtn) {
            uploadBtn.classList.remove('uploading');
            uploadBtn.classList.add('success');
            uploadBtn.innerHTML = '✓ Uploaded!';
          }

          setTimeout(() => {
            if (fileInput) fileInput.value = '';
            if (chip) chip.classList.remove('show');
            if (progressWrap) progressWrap.classList.remove('show');
            if (progressBar) progressBar.style.width = '0%';
            if (uploadBtn) {
              uploadBtn.classList.remove('success', 'uploading');
              uploadBtn.disabled = false;
              uploadBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;vertical-align:middle;"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Upload File`;
            }
            loadProjectFiles(id);
            updateSingleBadge(id);
          }, 2000);
        } else {
          let errMsg = 'Upload failed';
          try { errMsg = JSON.parse(xhr.responseText).error || errMsg; } catch {}
          if (progressBar) progressBar.classList.add('error');
          if (statusText) statusText.textContent = '✗ ' + errMsg;
          if (pctLabel) pctLabel.textContent = '';
          if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.classList.remove('uploading');
            uploadBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;vertical-align:middle;"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Upload File`;
          }
        }
      });

      xhr.open('POST', API_URL + '/api/projects/' + id + '/files');
      xhr.setRequestHeader('Authorization', 'Bearer ' + token);
      xhr.send(formData);
    }

    // Handle file selection (shared logic for input change and drag-drop)
    function handleFileSelect(file) {
      const chip = document.getElementById('filePreviewChip');
      const chipName = document.getElementById('chipFileName');
      const chipSize = document.getElementById('chipFileSize');
      const fileInput = document.getElementById('fileUploadInput');

      if (!file) return;

      // Local Validation (Max 5MB, PDF/Images)
      const MAX_SIZE = 5 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        alert('File exceeds 5MB limit');
        if (fileInput) fileInput.value = '';
        return;
      }

      const allowedExts = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
      const ext = file.name.split('.').pop().toLowerCase();
      if (!allowedExts.includes(ext)) {
        alert('Only PDF and Images are allowed');
        if (fileInput) fileInput.value = '';
        return;
      }

      if (chipName) chipName.textContent = file.name;
      if (chipSize) {
        chipSize.textContent = file.size > 1024 * 1024
          ? (file.size / 1024 / 1024).toFixed(1) + ' MB'
          : Math.round(file.size / 1024) + ' KB';
      }
      if (chip) chip.classList.add('show');
      
      const progressWrap = document.getElementById('uploadProgressWrap');
      if (progressWrap) progressWrap.classList.remove('show');
    }

    // Wire up listeners
    const initFileListeners = () => {
      const fileInput = document.getElementById('fileUploadInput');
      const chipRemove = document.getElementById('chipRemoveBtn');
      const dropZone = document.getElementById('fileDropZone');

      if (fileInput) {
        fileInput.addEventListener('change', () => {
          handleFileSelect(fileInput.files[0]);
        });
      }

      if (chipRemove) {
        chipRemove.addEventListener('click', (e) => {
          e.preventDefault();
          if (fileInput) fileInput.value = '';
          const chip = document.getElementById('filePreviewChip');
          if (chip) chip.classList.remove('show');
          const progressWrap = document.getElementById('uploadProgressWrap');
          if (progressWrap) progressWrap.classList.remove('show');
        });
      }

      if (dropZone) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
          dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
          }, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
          dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-over'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
          dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'), false);
        });

        dropZone.addEventListener('drop', (e) => {
          const dt = e.dataTransfer;
          const file = dt.files[0];
          if (file) {
            if (fileInput) fileInput.files = dt.files;
            handleFileSelect(file);
          }
        }, false);
      }
    };
    initFileListeners();


    async function deleteProjectFile(fileId, projectId) {
      if (confirm('Delete this file?')) {
        await apiCall('/api/projects/' + projectId + '/files/' + fileId, { method: 'DELETE' });
        loadProjectFiles(projectId);
        updateSingleBadge(projectId);
      }
    }

    async function updateSingleBadge(projectId) {
      const badge = document.getElementById('file-badge-' + projectId);
      if (!badge) return;
      try {
        const files = await apiCall('/api/projects/' + projectId + '/files');
        const count = Array.isArray(files) ? files.length : 0;
        if (count > 0) {
          badge.textContent = count;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      } catch { /* silently skip */ }
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
      if (!tbody || !Array.isArray(proposals)) return;
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
      if (id === 'commentsModal' && window.commentsInterval) {
        clearInterval(window.commentsInterval);
        window.commentsInterval = null;
      }
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

        // Set client initials avatar
        const initials = client.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        if (document.getElementById('clientInitials')) {
          document.getElementById('clientInitials').textContent = initials || client.name.charAt(0).toUpperCase();
        }

        // Load Client Specific Data
        loadClientInvoices(clientId);
        loadClientProposals(clientId);
        loadClientProjects(clientId);
      } catch (err) {
        console.error('Error initializing client view:', err);
      }
    }

    let clientInvoices = [];
    async function loadClientInvoices(clientId) {
      const allInvoices = await apiCall('/api/invoices');
      clientInvoices = allInvoices.filter(inv => inv.client_id == clientId);
      
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

      renderClientInvoices();
    }

    function renderClientInvoices() {
      const tbody = document.getElementById('clientInvoicesTable');
      if (!tbody) return;

      const paged = getPagedData(clientInvoices, 'clientInvoices');
      tbody.innerHTML = paged.map(inv => `
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

      renderPaginationUI('invoicesPagination', clientInvoices.length, 'clientInvoices');
    }


    let clientProposals = [];
    async function loadClientProposals(clientId) {
      const allProposals = await apiCall('/api/proposals');
      clientProposals = allProposals.filter(p => p.client_id == clientId);
      
      renderClientProposals();
    }

    function renderClientProposals() {
      const tbody = document.getElementById('clientProposalsTable');
      if (!tbody) return;

      const paged = getPagedData(clientProposals, 'clientProposals');
      tbody.innerHTML = paged.map(p => `
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

      renderPaginationUI('proposalsPagination', clientProposals.length, 'clientProposals');
    }


    function renderProjectCard(p) {
      const milestones = p.milestones || [];
      // Calculate progress: each COMPLETED milestone is 25%
      const completedCount = milestones.filter(m => m.status === 'completed' || parseInt(m.progress) === 100).length;
      const totalProgress = Math.min(100, completedCount * 25);

      const typeClass = (p.project_type || '').toLowerCase().replace(' ', '-');


      const getStatusIcon = (status) => {
        if (status === 'completed') {
          return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
        }
        return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="3"><circle cx="12" cy="12" r="10"/></svg>`;
      };

      const getStatusLabel = (status) => {
        return status === 'completed' ? 'COMPLETED' : 'STARTED';
      };

      return `
        <div class="project-card-saas status-${p.status || 'discovery'}" data-type="${p.project_type || 'Other'}">
          <div class="project-header">
            <div style="flex:1;">
              <div class="project-name" style="font-size:1.25rem;">
                <span>${p.name}</span>
              </div>
              <div style="font-size:0.8rem; color:var(--body); margin-top:8px; display:flex; gap:16px;">
                <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:text-bottom; margin-right:4px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Timeline: ${p.start_date || '—'} to ${p.end_date || '—'}</span>
              </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:10px; align-items:flex-end;">
              <div style="display:flex; gap:8px; align-items:center;">
                <span class="type-pill ${typeClass}">${p.project_type || 'Project'}</span>
                <span class="priority-badge priority-${(p.priority || 'Medium').toLowerCase()}">${p.priority || 'Medium'}</span>
              </div>
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
              ${milestones.length < 4 ? `
                <button class="btn-icon" onclick="openMilestoneModal(${p.id})" style="padding:6px 12px; font-size:0.75rem;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Add Milestone
                </button>
              ` : ''}
            </div>
            <div class="milestone-grid">
              ${milestones.length === 0 ? `
                <div class="milestone-empty">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.4;"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
                  <h4>No milestones yet</h4>
                  <p>Break this project into phases to track progress</p>
                  <button class="btn btn-primary" onclick="openMilestoneModal(${p.id})" style="padding:8px 16px; font-size:0.8rem;">+ Add First Milestone</button>
                </div>
              ` : `
                ${milestones.map((m, idx) => `
                  <div class="milestone-card status-${m.status || 'started'}" onclick="openMilestoneModal(${p.id}, ${idx})">
                    <span class="milestone-phase-tag">Phase ${String(idx + 1).padStart(2, '0')}</span>
                    <div class="milestone-status-pill">
                      ${getStatusIcon(m.status || 'started')}
                      <span>${getStatusLabel(m.status || 'started')}</span>
                    </div>
                    <div class="milestone-card-title">${m.title}</div>
                    ${m.description ? `<div class="milestone-card-desc">${m.description}</div>` : ''}
                    
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto; padding-top:16px; border-top:1px solid rgba(0,0,0,0.05);">
                      <div style="display:flex; align-items:center; gap:6px; color:var(--muted); font-size:0.75rem; font-weight:500;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <span>${m.end_date ? new Date(m.end_date).toLocaleDateString('en-GB', {day:'numeric', month:'short'}) : 'TBD'}</span>
                      </div>
                      <div style="display:flex; gap:8px;">
                        ${m.link ? `<a href="${m.link}" target="_blank" title="Resource Link" onclick="event.stopPropagation()" style="color:var(--muted); transition:color 0.2s;" onmouseover="this.style.color='var(--secondary)'" onmouseout="this.style.color='var(--muted)'"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>` : ''}
                      </div>
                    </div>
                  </div>
                `).join('')}
                ${milestones.length < 4 ? `
                  <div class="add-milestone-saas" onclick="openMilestoneModal(${p.id})">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                    <span>Add a Milestone</span>
                  </div>
                ` : ''}
              `}
            </div>
          </div>

          <div class="project-footer-bar">
            <div class="project-footer-left">
              <button class="btn-icon" onclick="openProjectFiles(${p.id})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                Files
                <span class="file-count-badge hidden" id="file-badge-${p.id}"></span>
              </button>
              <button class="btn-icon" onclick="openProjectComments(${p.id})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                Comments
                <span class="comment-count-badge hidden" id="comment-badge-${p.id}"></span>
              </button>
            </div>
            <div class="project-footer-right">
              <button class="btn-icon" onclick="editProject(${p.id})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
                Settings
              </button>
              <button class="btn-icon danger" onclick="deleteProject(${p.id})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                Remove
              </button>
            </div>
          </div>
        </div>
      `;
    }

    function renderCompactProjectCard(p) {
      const totalProgress = p.progress || 0;
      return `
        <div class="project-card-compact">
          <div class="project-card-compact-info">
            <h4>${p.name}</h4>
            <div class="project-card-compact-client">${p.client_name || 'No client'}</div>
          </div>
          <div class="project-card-compact-status">
            <div style="width: 100px;">
              <div style="display:flex; justify-content:space-between; font-size:0.7rem; margin-bottom:4px;">
                <span style="color:var(--body);">Progress</span>
                <span style="color:var(--secondary); font-weight:600;">${totalProgress}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" style="width:${totalProgress}%;"></div>
              </div>
            </div>
            <!-- Status badge removed -->
          </div>
        </div>
      `;
    }

    let clientProjectsData = [];
    async function loadClientProjects(clientId) {
      projects = await apiCall('/api/projects');
      clientProjectsData = projects.filter(p => String(p.client_id) === String(clientId));
      document.getElementById('countProjects').textContent = clientProjectsData.length;

      renderClientProjects();
    }

    function renderClientProjects() {
      const container = document.getElementById('clientProjectsList');
      if (!container) return;

      const paged = getPagedData(clientProjectsData, 'clientProjects');
      container.innerHTML = paged.map(p => renderProjectCard(p)).join('') || '<div class="empty-state">No projects active for this client.</div>';
      attachCardBadges(paged);

      renderPaginationUI('projectsPagination', clientProjectsData.length, 'clientProjects');
    }


    // Feature 2 & 5: populate file and unread comment badges in parallel
    async function attachCardBadges(projectList) {
      await Promise.all(projectList.map(async (p) => {
        // File Badge
        const fileBadge = document.getElementById('file-badge-' + p.id);
        if (fileBadge) {
          try {
            const files = await apiCall('/api/projects/' + p.id + '/files');
            const count = Array.isArray(files) ? files.length : 0;
            if (count > 0) {
              fileBadge.textContent = count;
              fileBadge.classList.remove('hidden');
            }
          } catch {}
        }

        // Comment Badge (Unread)
        const commentBadge = document.getElementById('comment-badge-' + p.id);
        if (commentBadge) {
          try {
            const comments = await apiCall('/api/projects/' + p.id + '/comments');
            if (Array.isArray(comments)) {
              const lastViewed = localStorage.getItem('comments_last_viewed_' + p.id) || '1970-01-01T00:00:00Z';
              const unread = comments.filter(c => c.created_at > lastViewed);
              if (unread.length > 0) {
                commentBadge.textContent = unread.length;
                commentBadge.classList.remove('hidden');
              }
            }
          } catch {}
        }
      }));
    }

    window.openProjectComments = async (id) => {
      document.getElementById('currentCommentProjectId').value = id;
      document.getElementById('commentsModal').classList.add('show');
      
      // Update last viewed timestamp and clear badge
      localStorage.setItem('comments_last_viewed_' + id, new Date().toISOString());
      const badge = document.getElementById('comment-badge-' + id);
      if (badge) badge.classList.add('hidden');

      loadComments(id);
      
      // Feature 4: Live Polling (every 15s)
      if (window.commentsInterval) clearInterval(window.commentsInterval);
      window.commentsInterval = setInterval(() => {
        if (document.getElementById('commentsModal').classList.contains('show')) {
          loadComments(id);
        } else {
          clearInterval(window.commentsInterval);
        }
      }, 15000);
    };

    async function loadComments(id) {
      const comments = await apiCall('/api/projects/' + id + '/comments');
      const list = document.getElementById('commentsList');
      if (!list) return;
      const isCommentAdmin = (role) => role && role.toLowerCase() === 'admin';
      list.innerHTML = comments.map(c => {
        const isMe = String(c.user_id) === String(user.id);
        return `
          <div class="comment-item ${isMe ? 'me' : 'them'}">
            <div class="comment-avatar">${c.author_name ? c.author_name[0].toUpperCase() : 'U'}</div>
            <div class="comment-bubble">
              <div class="comment-header">
                <span class="comment-author">${c.author_name}</span>
                <span class="comment-date">${new Date(c.created_at).toLocaleString([], {hour: '2-digit', minute:'2-digit', month:'short', day:'numeric'})}</span>
              </div>
              <div class="comment-text">${c.comment}</div>
            </div>
          </div>
        `;
      }).join('') || '<div class="empty-state">No comments yet.</div>';
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
        localStorage.setItem('comments_last_viewed_' + id, new Date().toISOString());
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

      if (tabId === 'emails') {
        const urlParams = new URLSearchParams(window.location.search);
        const clientId = urlParams.get('id');
        loadEmailLogs(clientId);
      }
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
  