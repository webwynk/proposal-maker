document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '';
    
    let invoices = [];
    let proposals = [];
    let projects = [];

    // Pagination State
    const pagination = {
      dashboard: { page: 1, limit: 3 },
      invoices: { page: 1, limit: 10 },
      proposals: { page: 1, limit: 10 },
      projects: { page: 1, limit: 5 }
    };

    // Check auth
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!token || user.role !== 'client') {
      window.location.href = 'index.html';
      return;
    }

    const userNameEl = document.getElementById('userName');
    const userCompanyEl = document.getElementById('userCompany');
    const welcomeNameEl = document.getElementById('welcomeName');

    if (userNameEl) userNameEl.textContent = user.name;
    if (userCompanyEl) userCompanyEl.textContent = user.company;
    if (welcomeNameEl) welcomeNameEl.textContent = user.name.split(' ')[0];

    async function apiCall(endpoint, options = {}) {
      try {
        const res = await fetch(API_URL + endpoint, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          }
        });
        const data = await res.json();
        
        if (!res.ok) {
          console.error('API Error:', data.error || res.statusText);
          if (res.status === 401 || res.status === 403) {
            localStorage.clear();
            window.location.href = 'index.html';
          }
          return { error: data.error || 'Request failed', status: res.status };
        }
        
        if (!options.method || options.method === 'GET') {
          sessionStorage.setItem('cache_' + endpoint, JSON.stringify(data));
        }
        
        return data;
      } catch (err) {
        console.error('Fetch Error:', err);
        return { error: 'Network error' };
      }
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

    // Pagination Helper
    function getPagedData(data, type) {
      const { page, limit } = pagination[type];
      const start = (page - 1) * limit;
      return data.slice(start, start + limit);
    }

    function renderPaginationUI(containerId, totalItems, type, onPageChange) {
      const container = document.getElementById(containerId);
      if (!container) return;

      const { page, limit } = pagination[type];
      const totalPages = Math.ceil(totalItems / limit);

      if (totalPages <= 1) {
        container.innerHTML = '';
        return;
      }

      container.innerHTML = `
        <button class="pagination-btn" ${page === 1 ? 'disabled' : ''} onclick="window.changeClientPage('${type}', ${page - 1})">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg> Previous
        </button>
        <span class="pagination-info">Page ${page} of ${totalPages}</span>
        <button class="pagination-btn" ${page === totalPages ? 'disabled' : ''} onclick="window.changeClientPage('${type}', ${page + 1})">
          Next <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      `;
    }

    window.changeClientPage = (type, newPage) => {
      pagination[type].page = newPage;
      switch(type) {
        case 'dashboard': renderDashboardProjects(); break;
        case 'invoices': renderInvoices(); break;
        case 'proposals': renderProposals(); break;
        case 'projects': renderProjects(); break;
      }
    };

    // Dashboard
    async function loadDashboard() {
      invoices = await apiCall('/api/my-invoices');
      proposals = await apiCall('/api/my-proposals');
      projects = await apiCall('/api/my-projects');

      const statInvoices = document.getElementById('statInvoices');
      const statProposals = document.getElementById('statProposals');
      const statProjects = document.getElementById('statProjects');

      if (statInvoices) statInvoices.textContent = Array.isArray(invoices) ? invoices.length : 0;
      if (statProposals) statProposals.textContent = Array.isArray(proposals) ? proposals.length : 0;
      if (statProjects) {
        const activeProjects = Array.isArray(projects) ? projects.filter(p => p.status !== 'launched') : [];
        statProjects.textContent = activeProjects.length;
      }

      renderDashboardProjects();
    }

    function renderDashboardProjects() {
      const activeProjects = Array.isArray(projects) ? projects.filter(p => p.status !== 'launched') : [];
      const paged = getPagedData(activeProjects, 'dashboard');
      const container = document.getElementById('recentProjects');
      if (container) {
        container.innerHTML = paged.map(p => renderProjectCard(p)).join('') || '<p style="color:var(--body); text-align:center;">No active projects</p>';
      }
      renderPaginationUI('projectsPagination', activeProjects.length, 'dashboard');
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

      const data = Array.isArray(invoices) ? invoices : [];
      const paged = getPagedData(data, 'invoices');

      tbody.innerHTML = paged.map(inv => {
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

      renderPaginationUI('invoicesPagination', data.length, 'invoices');
    }

    window.openInvoice = (id) => {
      window.open(`invoice.html?id=${id}&view=true`, '_blank');
    };

    window.openProposal = (id) => {
      window.open(`proposal.html?id=${id}&view=true`, '_blank');
    };

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
      
      const data = Array.isArray(proposals) ? proposals : [];
      const paged = getPagedData(data, 'proposals');

      tbody.innerHTML = paged.map(p => {
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

      renderPaginationUI('proposalsPagination', data.length, 'proposals');
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
                <span class="file-count-badge hidden" id="file-badge-${p.id}"></span>
              </button>
              <button class="btn-icon" onclick="openProjectComments(${p.id})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                Comments
                <span class="comment-count-badge hidden" id="comment-badge-${p.id}"></span>
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
      const titleEl = document.getElementById('msTitleView');
      const dateEl = document.getElementById('msDateView');
      const progressEl = document.getElementById('msProgressView');
      const descEl = document.getElementById('msDescView');

      if (titleEl) titleEl.textContent = ms.title || 'Untitled';
      if (dateEl) dateEl.textContent = (ms.start_date || '—') + ' to ' + (ms.end_date || '—');
      if (progressEl) progressEl.textContent = pval + '%';
      if (descEl) descEl.textContent = ms.description || 'No description provided.';

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
      if (links) {
        links.innerHTML = `
          ${ms.link ? `<a href="${ms.link}" target="_blank" class="btn btn-outline btn-sm">🔗 Resource Link</a>` : ''}
          ${ms.file ? `<span class="btn btn-outline btn-sm">📄 File: ${ms.file}</span>` : ''}
        `;
      }

      modal.classList.add('show');
    };

    async function renderProjects() {
      const container = document.getElementById('projectsList');
      if (!container) return;

      const data = Array.isArray(projects) ? projects : [];
      const paged = getPagedData(data, 'projects');

      if (data.length === 0) {
        container.innerHTML = '<div class="empty-state">No projects yet</div>';
        return;
      }

      container.innerHTML = paged.map(p => renderProjectCard(p)).join('');
      attachCardBadges(paged);
      renderPaginationUI('projectsPagination', data.length, 'projects');
    }

    async function attachCardBadges(projectList) {
      await Promise.all(projectList.map(async (p) => {
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

    async function openProjectComments(id) {
      const modal = document.getElementById('commentsModal');
      const input = document.getElementById('currentCommentProjectId');
      if (!modal || !input) return;
      
      input.value = id;
      modal.classList.add('show');
      
      localStorage.setItem('comments_last_viewed_' + id, new Date().toISOString());
      const badge = document.getElementById('comment-badge-' + id);
      if (badge) badge.classList.add('hidden');

      loadComments(id);

      if (window.commentsInterval) clearInterval(window.commentsInterval);
      window.commentsInterval = setInterval(() => {
        if (modal.classList.contains('show')) {
          loadComments(id);
        } else {
          clearInterval(window.commentsInterval);
        }
      }, 15000);
    }

    async function loadComments(id) {
      const comments = await apiCall('/api/projects/' + id + '/comments');
      const list = document.getElementById('commentsList');
      if (!list || !Array.isArray(comments)) return;
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
      const commentText = document.getElementById('commentText');
      if (!commentText || !commentText.value.trim()) return;

      const res = await apiCall('/api/projects/' + id + '/comments', {
        method: 'POST',
        body: JSON.stringify({ comment: commentText.value })
      });

      if (res && !res.error) {
        localStorage.setItem('comments_last_viewed_' + id, new Date().toISOString());
        commentText.value = '';
        loadComments(id);
      }
    };

    window.openProjectFiles = (id) => {
      const modal = document.getElementById('filesModal');
      const input = document.getElementById('currentProjectFilesId');
      if (!modal || !input) return;

      input.value = id;
      modal.classList.add('show');
      switchResourceTab('admin-files');
      loadProjectFiles(id);
      loadProjectLinks(id);
    };

    window.switchResourceTab = (tabName) => {
      document.querySelectorAll('.modal-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick').includes(`'${tabName}'`));
      });
      document.querySelectorAll('.resource-tab-content').forEach(content => {
        content.style.display = content.id === 'tab-' + tabName ? 'block' : 'none';
      });
    };

    async function loadProjectFiles(id) {
      const files = await apiCall('/api/projects/' + id + '/files');
      const adminList = document.getElementById('adminFilesList');
      const clientList = document.getElementById('clientFilesList');
      if (!adminList || !clientList || !Array.isArray(files)) return;

      const getThumb = (f) => {
        const ext = f.original_name.split('.').pop().toLowerCase();
        const isImg = ['jpg','jpeg','png','webp','gif'].includes(ext);
        if (isImg) return `<div class="file-thumb"><img src="${f.file_path}" alt="Thumb"></div>`;
        if (ext === 'pdf') return `<div class="file-thumb"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>`;
        return `<div class="file-thumb"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg></div>`;
      };

      const renderFile = (f) => {
        const isMyFile = String(f.uploaded_by) === String(user.id);
        return `
          <div class="file-list-item">
            ${getThumb(f)}
            <div class="file-info">
              <a href="${f.file_path}" target="_blank" class="file-name">${f.original_name}</a>
              <span class="file-meta">${new Date(f.created_at).toLocaleDateString()} · By ${f.uploader_name}</span>
            </div>
            ${isMyFile ? `
            <button class="btn-icon" style="color:#ef4444;" onclick="deleteProjectFile(${f.id}, ${id})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
            ` : ''}
          </div>
        `;
      };

      const adminFiles = files.filter(f => f.uploader_role === 'admin');
      const clientFiles = files.filter(f => f.uploader_role === 'client');

      adminList.innerHTML = adminFiles.map(renderFile).join('') || '<div class="empty-state">No admin files uploaded</div>';
      clientList.innerHTML = clientFiles.map(renderFile).join('') || '<div class="empty-state">No client files uploaded</div>';
    }

    async function loadProjectLinks(id) {
      const links = await apiCall('/api/projects/' + id + '/links');
      const list = document.getElementById('projectLinksList');
      if (!list || !Array.isArray(links)) return;

      list.innerHTML = links.map(l => `
        <div class="link-item">
          <div class="link-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></div>
          <div class="link-title">
            <a href="${l.url}" target="_blank" style="color:inherit; text-decoration:none;">${l.title}</a>
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
      }
    };

    window.uploadProjectFile = async () => {
      const id = document.getElementById('currentProjectFilesId').value;
      const fileInput = document.getElementById('fileUploadInput');
      const file = fileInput.files[0];
      if (!file) return alert('Select a file to upload');

      const MAX_SIZE = 5 * 1024 * 1024;
      if (file.size > MAX_SIZE) return alert('File exceeds 5MB limit');
      
      const allowedExts = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
      const ext = file.name.split('.').pop().toLowerCase();
      if (!allowedExts.includes(ext)) return alert('Only PDF and Images are allowed');

      const progressWrap = document.getElementById('uploadProgressWrap');
      const progressBar  = document.getElementById('uploadProgressBar');
      const pctLabel     = document.getElementById('uploadProgressPct');
      const statusText   = document.getElementById('uploadStatusText');
      const uploadBtn    = document.getElementById('uploadFileBtn');
      const chip         = document.getElementById('filePreviewChip');

      if (progressWrap) progressWrap.style.display = 'block';
      if (uploadBtn) {
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '⏳ Uploading...';
      }

      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && progressBar && pctLabel) {
          const pct = Math.round((e.loaded / e.total) * 100);
          progressBar.style.width = pct + '%';
          pctLabel.textContent = pct + '%';
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          if (statusText) statusText.textContent = '✓ Upload complete';
          setTimeout(() => {
            if (fileInput) fileInput.value = '';
            if (chip) chip.style.display = 'none';
            if (progressWrap) progressWrap.style.display = 'none';
            if (uploadBtn) {
              uploadBtn.disabled = false;
              uploadBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;vertical-align:middle;"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Upload File';
            }
            loadProjectFiles(id);
          }, 2000);
        } else {
          alert('Upload failed');
          if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = 'Upload File';
          }
        }
      });

      xhr.open('POST', '/api/projects/' + id + '/files');
      xhr.setRequestHeader('Authorization', 'Bearer ' + token);
      xhr.send(formData);
    };

    window.deleteProjectFile = async (fileId, projectId) => {
      if (confirm('Delete this file?')) {
        await apiCall('/api/projects/' + projectId + '/files/' + fileId, { method: 'DELETE' });
        loadProjectFiles(projectId);
      }
    };

    window.changePassword = async () => {
      const current = document.getElementById('currentPassword').value;
      const newPass = document.getElementById('newPassword').value;
      const confirmPass = document.getElementById('confirmPassword').value;
      const errorDiv = document.getElementById('passwordError');
      const successDiv = document.getElementById('passwordSuccess');

      if (errorDiv) errorDiv.classList.remove('show');
      if (successDiv) successDiv.classList.remove('show');

      if (!current || !newPass || !confirmPass) {
        if (errorDiv) { errorDiv.textContent = 'All fields are required'; errorDiv.classList.add('show'); }
        return;
      }

      if (newPass.length < 8) {
        if (errorDiv) { errorDiv.textContent = 'Password must be at least 8 characters'; errorDiv.classList.add('show'); }
        return;
      }

      if (newPass !== confirmPass) {
        if (errorDiv) { errorDiv.textContent = 'New passwords do not match'; errorDiv.classList.add('show'); }
        return;
      }

      try {
        const result = await apiCall('/api/change-password', {
          method: 'POST',
          body: JSON.stringify({ currentPassword: current, newPassword: newPass })
        });

        if (result.error) {
          if (errorDiv) { errorDiv.textContent = result.error; errorDiv.classList.add('show'); }
        } else {
          if (successDiv) { successDiv.textContent = 'Password changed successfully!'; successDiv.classList.add('show'); }
          document.getElementById('currentPassword').value = '';
          document.getElementById('newPassword').value = '';
          document.getElementById('confirmPassword').value = '';
        }
      } catch (err) {
        if (errorDiv) { errorDiv.textContent = 'Failed to change password'; errorDiv.classList.add('show'); }
      }
    };

    function formatCurrency(amount, currency = 'INR') {
      if (!amount) amount = 0;
      return (currency === 'INR' ? '₹' : '$') + amount.toLocaleString(currency === 'INR' ? 'en-IN' : 'en-US');
    }

    function calculateTotal(services) {
      const sArr = typeof services === 'string' ? JSON.parse(services || '[]') : (services || []);
      return sArr.reduce((sum, s) => sum + (s.price || 0), 0);
    }

    window.closeModal = (id) => {
      const modal = document.getElementById(id);
      if (modal) modal.classList.remove('show');
      if (id === 'commentsModal' && window.commentsInterval) {
        clearInterval(window.commentsInterval);
        window.commentsInterval = null;
      }
    };

    window.logout = () => {
      localStorage.clear();
      window.location.href = 'index.html';
    };

    // Initialize based on current active tab
    const activeNav = document.querySelector('.nav-item.active');
    if (activeNav) {
      loadPageData(activeNav.dataset.page);
    } else {
      if (window.location.pathname.includes('client.html') || window.location.pathname.endsWith('/')) {
        loadDashboard();
      }
    }

    // Feature: File input & Drag-and-Drop
    const fileInput = document.getElementById('fileUploadInput');
    const chip      = document.getElementById('filePreviewChip');
    const chipName  = document.getElementById('chipFileName');
    const chipSize  = document.getElementById('chipFileSize');
    const chipRemove = document.getElementById('chipRemoveBtn');
    const dropZone   = document.getElementById('fileDropZone');

    function handleFileSelect(file) {
      if (!file) return;
      
      const allowedExts = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
      const ext = file.name.split('.').pop().toLowerCase();
      if (!allowedExts.includes(ext)) {
        alert('Only PDF and Images are allowed');
        if (fileInput) fileInput.value = '';
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        alert('File size exceeds 5MB limit');
        if (fileInput) fileInput.value = '';
        return;
      }

      if (chipName) chipName.textContent = file.name;
      if (chipSize) chipSize.textContent = (file.size / 1024).toFixed(1) + ' KB';
      if (chip) chip.style.display = 'flex';
    }

    if (fileInput) {
      fileInput.addEventListener('change', () => handleFileSelect(fileInput.files[0]));
    }

    if (chipRemove) {
      chipRemove.addEventListener('click', (e) => {
        e.preventDefault();
        if (fileInput) fileInput.value = '';
        if (chip) chip.style.display = 'none';
        const wrap = document.getElementById('uploadProgressWrap');
        if (wrap) wrap.style.display = 'none';
      });
    }

    if (dropZone) {
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
        dropZone.addEventListener(evt, e => {
          e.preventDefault();
          e.stopPropagation();
        });
      });
      ['dragenter', 'dragover'].forEach(evt => {
        dropZone.addEventListener(evt, () => dropZone.classList.add('drag-over'));
      });
      ['dragleave', 'drop'].forEach(evt => {
        dropZone.addEventListener(evt, () => dropZone.classList.remove('drag-over'));
      });
      dropZone.addEventListener('drop', e => {
        const file = e.dataTransfer.files[0];
        if (file) {
          if (fileInput) {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            fileInput.files = dataTransfer.files;
          }
          handleFileSelect(file);
        }
      });
    }
});