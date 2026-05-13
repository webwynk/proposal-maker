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

    let statusChartInstance = null;

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

      renderCharts(stats.chartData);
    }

    function renderCharts(data) {
      if (!data) return;

      if (statusChartInstance) statusChartInstance.destroy();

      const statCtx = document.getElementById('statusChart').getContext('2d');
      const statuses = data.projectStatusCounts.map(d => d.status.replace('_', ' '));
      const counts = data.projectStatusCounts.map(d => d.count);
      const bgColors = statuses.map((_, i) => ['#4f46e5', '#d97706', '#2563eb', '#db2777', '#059669', '#64748b'][i % 6]);

      statusChartInstance = new Chart(statCtx, {
        type: 'doughnut',
        data: {
          labels: statuses.length ? statuses : ['No Data'],
          datasets: [{
            data: counts.length ? counts : [1],
            backgroundColor: bgColors.length ? bgColors : ['#e2e2f0']
          }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
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
          <td><span class="status-badge status-${p.status}">${p.status.replace('_', ' ')}</span></td>
          <td>
            <div class="progress-bar">
              <div class="progress-fill ${p.progress >= 75 ? 'high' : p.progress >= 50 ? 'medium' : 'low'}" style="width:${p.progress}%"></div>
            </div>
            <span style="font-size:0.75rem;">${p.progress}%</span>
          </td>
          <td>${p.updated_at ? new Date(p.updated_at).toLocaleDateString() : '—'}</td>
          <td>
            <div class="actions-cell">
              <button class="btn btn-outline btn-sm" onclick="openProjectFiles(${p.id})">Files</button>
              <button class="btn btn-outline btn-sm" onclick="editProject(${p.id})">Edit</button>
              <button class="btn btn-outline btn-sm" onclick="deleteProject(${p.id})">Delete</button>
            </div>
          </td>
        </tr>
      `).join('') || '<tr><td colspan="6" class="empty-state">No projects yet</td></tr>';
    }

    function showAddProjectModal() {
      loadClientsForSelect();
      document.getElementById('projectModalTitle').textContent = 'Add Project';
      document.getElementById('projectForm').reset();
      document.getElementById('projectId').value = '';
      document.getElementById('projectProgress').value = 0;
      document.getElementById('projectModal').classList.add('show');
    }

    async function editProject(id) {
      await loadClientsForSelect();
      const proj = projects.find(p => p.id === id);
      document.getElementById('projectModalTitle').textContent = 'Edit Project';
      document.getElementById('projectId').value = proj.id;
      document.getElementById('projectClient').value = proj.client_id;
      document.getElementById('projectName').value = proj.name;
      document.getElementById('projectStatus').value = proj.status;
      document.getElementById('projectProgress').value = proj.progress;
      document.getElementById('projectNotes').value = proj.notes || '';
      document.getElementById('projectModal').classList.add('show');
    }

    async function saveProject() {
      const data = {
        client_id: document.getElementById('projectClient').value,
        name: document.getElementById('projectName').value,
        status: document.getElementById('projectStatus').value,
        progress: parseInt(document.getElementById('projectProgress').value) || 0,
        notes: document.getElementById('projectNotes').value
      };

      const id = document.getElementById('projectId').value;
      if (id) {
        await apiCall('/api/projects/' + id, { method: 'PUT', body: JSON.stringify(data) });
      } else {
        await apiCall('/api/projects', { method: 'POST', body: JSON.stringify(data) });
      }

      closeModal('projectModal');
      loadProjects();
    }

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

    async function loadClientProjects(clientId) {
      const allProjects = await apiCall('/api/projects');
      const clientProjects = allProjects.filter(p => p.client_id == clientId);
      
      document.getElementById('countProjects').textContent = clientProjects.length;

      const tbody = document.getElementById('clientProjectsTable');
      if (tbody) {
        tbody.innerHTML = clientProjects.map(p => `
          <tr>
            <td>${p.name}</td>
            <td><span class="status-badge status-${p.status}">${p.status.replace('_', ' ')}</span></td>
            <td>
              <div class="progress-bar">
                <div class="progress-fill ${p.progress >= 75 ? 'high' : p.progress >= 50 ? 'medium' : 'low'}" style="width:${p.progress}%"></div>
              </div>
              <span style="font-size:0.75rem;">${p.progress}%</span>
            </td>
            <td>${p.updated_at ? new Date(p.updated_at).toLocaleDateString() : '—'}</td>
            <td>
              <div class="actions-cell">
                <button class="btn btn-outline btn-sm" onclick="openProjectFiles(${p.id})">Files</button>
                <button class="btn btn-outline btn-sm" onclick="editProject(${p.id})">Edit</button>
                <button class="btn btn-outline btn-sm" onclick="deleteProject(${p.id})">Delete</button>
              </div>
            </td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="empty-state">No projects yet</td></tr>';
      }
    }

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
    window.editProject = editProject;
    window.deleteProject = deleteProject;
    window.showAddProjectModal = showAddProjectModal;
    window.saveProject = saveProject;
    window.uploadProjectFile = uploadProjectFile;
    window.deleteProjectFile = deleteProjectFile;
    window.closeModal = closeModal;
    window.logout = logout;

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
  