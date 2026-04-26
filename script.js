/* ═══════════════════════════════════════════════════════
   WebWynk Proposal Generator — JavaScript
   ═══════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  // ── State ──
  let activeRegion = 'india'; // 'india' | 'worldwide'
  let scopeCounter = 0;
  let milestoneCounter = 0;
  let serviceCounter = 0;

  // ── DOM References ──
  const $ = (id) => document.getElementById(id);
  const proposalDoc = $('proposalDoc');

  // ── Default Scope Items ──
  const defaultScope = [
    { item: 'Number of Pages', desc: '' },
    { item: 'Functionality', desc: '' },
    { item: 'Security Enhancement', desc: '' },
    { item: 'Basic SEO', desc: '' }
  ];

  // ── Default Milestones ──
  const defaultMilestones = [
    { label: '50% Advance', amount: '' },
    { label: '50% On Delivery', amount: '' }
  ];

  // ═══════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════

  function init() {
    // Set today's date
    const today = new Date();
    $('proposalDate').value = formatDateInput(today);
    updatePreviewText('previewDate', formatDateDisplay(today));

    // Add default scope rows
    defaultScope.forEach(s => addScopeRow(s.item, s.desc));

    // Add default milestone rows
    defaultMilestones.forEach(m => addMilestoneRow(m.label, m.amount));

    // Add one default service row
    addServiceRow();

    // Bind all events
    bindInputEvents();
    bindTabEvents();
    bindPrintButton();

    // Initial preview update
    updateScopePreview();
    updateMilestonePreview();
    updateInvoicePreview();
  }

  // ═══════════════════════════════════════
  // INPUT EVENT BINDING
  // ═══════════════════════════════════════

  function bindInputEvents() {
    // Simple text → preview bindings
    const bindings = [
      { input: 'proposalNumber', preview: 'previewProposalNum' },
      { input: 'clientName', preview: 'previewClientName' },
      { input: 'clientCompany', preview: 'previewClientCompany' },
      { input: 'clientEmail', preview: 'previewClientEmail' },
      { input: 'clientPhone', preview: 'previewClientPhone' },
      { input: 'clientAddress', preview: 'previewClientAddress' },
      { input: 'projectTitle', preview: 'previewProjectTitle' },
      { input: 'projectOverview', preview: 'previewOverview' },
      { input: 'growthBlueprint', preview: 'previewGrowthBlueprint' },
    ];

    bindings.forEach(({ input, preview }) => {
      const el = $(input);
      if (!el) return;
      el.addEventListener('input', () => {
        const val = el.value.trim();
        updatePreviewText(preview, val || '—');
      });
    });

    // Timeline calculation
    const calculateDeliveryDate = () => {
      const durationVal = $('timelineDuration').value.trim();
      updatePreviewText('previewDuration', durationVal || '—');

      const matches = durationVal.match(/\d+/g);
      if (matches && matches.length > 0) {
        // Use the highest number if range is given (e.g., 2-4 weeks -> 4)
        const weeks = parseInt(matches[matches.length - 1], 10);
        
        let start = $('startDate').value;
        if (!start) {
          const today = new Date();
          start = formatDateInput(today);
          $('startDate').value = start;
          updatePreviewText('previewStartDate', formatDateDisplay(today));
        }

        const startDateObj = new Date(start + 'T00:00:00');
        const deliveryDateObj = new Date(startDateObj.getTime() + (weeks * 7 * 24 * 60 * 60 * 1000));
        
        const deliveryStr = formatDateInput(deliveryDateObj);
        $('deliveryDate').value = deliveryStr;
        updatePreviewText('previewDeliveryDate', formatDateDisplay(deliveryDateObj));
      }
    };

    $('timelineDuration').addEventListener('input', calculateDeliveryDate);

    // Date fields
    $('proposalDate').addEventListener('input', () => {
      const val = $('proposalDate').value;
      updatePreviewText('previewDate', val ? formatDateDisplay(new Date(val + 'T00:00:00')) : '—');
    });

    $('startDate').addEventListener('input', () => {
      const val = $('startDate').value;
      updatePreviewText('previewStartDate', val ? formatDateDisplay(new Date(val + 'T00:00:00')) : '—');
      // Recalculate delivery date if start date changes
      calculateDeliveryDate();
    });

    $('deliveryDate').addEventListener('input', () => {
      const val = $('deliveryDate').value;
      updatePreviewText('previewDeliveryDate', val ? formatDateDisplay(new Date(val + 'T00:00:00')) : '—');
    });
  }

  function updatePreviewText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
  }

  // ═══════════════════════════════════════
  // TAB SWITCHING
  // ═══════════════════════════════════════

  function bindTabEvents() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeRegion = btn.dataset.region;
        onRegionChange();
      });
    });
  }

  function onRegionChange() {
    const isIndia = activeRegion === 'india';

    // Toggle payment sections
    $('paymentIndia').style.display = isIndia ? 'block' : 'none';
    $('paymentWorldwide').style.display = isIndia ? 'none' : 'block';

    // Update invoice + milestone amounts
    updateInvoicePreview();
    updateMilestonePreview();
  }

  // ═══════════════════════════════════════
  // CURRENCY FORMATTING
  // ═══════════════════════════════════════

  function formatCurrency(amount) {
    if (!amount && amount !== 0) return activeRegion === 'india' ? '₹0' : '$0';
    const num = parseFloat(amount);
    if (isNaN(num)) return activeRegion === 'india' ? '₹0' : '$0';

    if (activeRegion === 'india') {
      return '₹' + num.toLocaleString('en-IN');
    } else {
      return '$' + num.toLocaleString('en-US');
    }
  }

  function getServiceTotal() {
    const rows = document.querySelectorAll('.service-row-item');
    let total = 0;
    rows.forEach(row => {
      const price = parseFloat(row.querySelector('.service-price-input').value) || 0;
      total += price;
    });
    return total;
  }

  function updateInvoicePreview() {
    const rows = document.querySelectorAll('.service-row-item');
    const tbody = $('previewInvoiceBody');
    tbody.innerHTML = '';
    let total = 0;

    rows.forEach((row, index) => {
      const name = row.querySelector('.service-name-input').value.trim() || '—';
      const price = parseFloat(row.querySelector('.service-price-input').value) || 0;
      total += price;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${String(index + 1).padStart(2, '0')}</td>
        <td>${escapeHtml(name)}</td>
        <td>${formatCurrency(price)}</td>
      `;
      tbody.appendChild(tr);
    });

    // Update total in preview
    $('previewTotal').textContent = formatCurrency(total);

    // Update total in editor sidebar
    $('serviceTotalDisplay').textContent = formatCurrency(total);
  }

  // ═══════════════════════════════════════
  // DYNAMIC SCOPE ROWS
  // ═══════════════════════════════════════

  function addScopeRow(itemVal = '', descVal = '') {
    scopeCounter++;
    const id = scopeCounter;

    const row = document.createElement('div');
    row.className = 'scope-row-item';
    row.dataset.scopeId = id;
    row.innerHTML = `
      <input type="text" class="scope-item-input" placeholder="Item name" value="${escapeHtml(itemVal)}">
      <input type="text" class="scope-desc-input" placeholder="Description" value="${escapeHtml(descVal)}">
      <button type="button" class="btn-remove" title="Remove">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
    `;

    // Bind events
    row.querySelector('.scope-item-input').addEventListener('input', updateScopePreview);
    row.querySelector('.scope-desc-input').addEventListener('input', updateScopePreview);
    row.querySelector('.btn-remove').addEventListener('click', () => {
      row.remove();
      updateScopePreview();
    });

    $('scopeRows').appendChild(row);
  }

  function updateScopePreview() {
    const rows = document.querySelectorAll('.scope-row-item');
    const tbody = $('previewScopeBody');
    tbody.innerHTML = '';

    rows.forEach((row, index) => {
      const item = row.querySelector('.scope-item-input').value.trim() || '—';
      const desc = row.querySelector('.scope-desc-input').value.trim() || '—';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${String(index + 1).padStart(2, '0')}</td>
        <td>${escapeHtml(item)}</td>
        <td>${escapeHtml(desc)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  $('addScopeRow').addEventListener('click', () => {
    addScopeRow();
    updateScopePreview();
  });

  // ═══════════════════════════════════════
  // DYNAMIC SERVICE ROWS
  // ═══════════════════════════════════════

  function addServiceRow(nameVal = '', priceVal = '') {
    serviceCounter++;

    const row = document.createElement('div');
    row.className = 'service-row-item';
    row.dataset.serviceId = serviceCounter;
    row.innerHTML = `
      <input type="text" class="service-name-input" placeholder="Service name" value="${escapeHtml(nameVal)}">
      <input type="number" class="service-price-input" placeholder="Price" min="0" value="${escapeHtml(String(priceVal))}">
      <button type="button" class="btn-remove" title="Remove">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
    `;

    row.querySelector('.service-name-input').addEventListener('input', updateInvoicePreview);
    row.querySelector('.service-price-input').addEventListener('input', updateInvoicePreview);
    row.querySelector('.btn-remove').addEventListener('click', () => {
      row.remove();
      updateInvoicePreview();
    });

    $('serviceRows').appendChild(row);
  }

  $('addServiceRow').addEventListener('click', () => {
    addServiceRow();
    updateInvoicePreview();
  });

  // ═══════════════════════════════════════
  // DYNAMIC MILESTONE ROWS
  // ═══════════════════════════════════════

  function addMilestoneRow(labelVal = '', amountVal = '') {
    milestoneCounter++;
    const id = milestoneCounter;

    const row = document.createElement('div');
    row.className = 'milestone-row-item';
    row.dataset.milestoneId = id;
    row.innerHTML = `
      <input type="text" class="milestone-label-input" placeholder="e.g. 50% Advance" value="${escapeHtml(labelVal)}">
      <input type="number" class="milestone-amount-input" placeholder="Amount" min="0" value="${escapeHtml(String(amountVal))}">
      <button type="button" class="btn-remove" title="Remove">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
    `;

    row.querySelector('.milestone-label-input').addEventListener('input', updateMilestonePreview);
    row.querySelector('.milestone-amount-input').addEventListener('input', updateMilestonePreview);
    row.querySelector('.btn-remove').addEventListener('click', () => {
      row.remove();
      updateMilestonePreview();
    });

    $('milestoneRows').appendChild(row);
  }

  function updateMilestonePreview() {
    const rows = document.querySelectorAll('.milestone-row-item');
    const container = $('previewMilestones');
    container.innerHTML = '';

    rows.forEach((row) => {
      const label = row.querySelector('.milestone-label-input').value.trim() || '—';
      const amount = row.querySelector('.milestone-amount-input').value;

      const div = document.createElement('div');
      div.className = 'milestone-preview-row';
      div.innerHTML = `
        <span class="milestone-preview-label">
          <span class="milestone-dot"></span>
          ${escapeHtml(label)}
        </span>
        <span class="milestone-preview-amount">${formatCurrency(amount)}</span>
      `;
      container.appendChild(div);
    });
  }

  $('addMilestone').addEventListener('click', () => {
    addMilestoneRow();
    updateMilestonePreview();
  });


  // ═══════════════════════════════════════
  // PRINT
  // ═══════════════════════════════════════

  function bindPrintButton() {
    $('printBtn').addEventListener('click', async () => {
      const element = $('proposalDoc');
      const clientName = $('clientName').value.trim() || 'Client';
      const proposalNum = $('proposalNumber').value.trim() || 'Proposal';
      const filename = `WebWynk_${proposalNum}_${clientName}.pdf`.replace(/\s+/g, '_');

      const btn = $('printBtn');
      btn.disabled = true;
      btn.textContent = 'Generating PDF…';

      // Show print layout
      document.body.classList.add('generating-pdf');

      // Wait for browser to repaint
      await new Promise(r => setTimeout(r, 400));

      // Calculate the exact CSS pixel height that maps to one A4 page
      const A4_WIDTH_MM = 210;
      const A4_HEIGHT_MM = 297;
      const MARGIN_MM = 2;
      const contentWidthMM = A4_WIDTH_MM - (MARGIN_MM * 2); // 206mm
      const contentHeightMM = A4_HEIGHT_MM - (MARGIN_MM * 2); // 293mm

      const elementWidth = element.offsetWidth; // CSS pixels
      const mmPerPx = contentWidthMM / elementWidth;
      const pageHeightPx = Math.floor(contentHeightMM / mmPerPx);

      // Set each .print-page to exactly one PDF page height
      const pages = element.querySelectorAll('.print-page');
      pages.forEach(page => {
        page.style.height = pageHeightPx + 'px';
        page.style.boxSizing = 'border-box';
      });

      // Wait for layout to settle
      await new Promise(r => setTimeout(r, 400));

      // Scroll to top to prevent html2canvas cutoff (white background bug)
      window.scrollTo(0, 0);

      const opt = {
        margin:       [MARGIN_MM, MARGIN_MM, MARGIN_MM, MARGIN_MM],
        filename:     filename,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, letterRendering: true, logging: false, scrollY: 0, scrollX: 0 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        enableLinks:  true,
        pagebreak:    { mode: ['css', 'legacy'], before: ['.print-page + .print-page'] }
      };

      try {
        await html2pdf().set(opt).from(element).save();
      } catch (e) {
        console.error('PDF generation failed:', e);
      }

      // Clean up
      pages.forEach(page => {
        page.style.height = '';
        page.style.boxSizing = '';
      });

      document.body.classList.remove('generating-pdf');
      btn.disabled = false;
      btn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        Print Proposal
      `;
    });
  }

  // ═══════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════

  function formatDateInput(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function formatDateDisplay(date) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ── Initialize ──
  init();
});
