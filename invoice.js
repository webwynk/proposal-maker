/* ═══════════════════════════════════════════════════════
   WebWynk Invoice Generator — JavaScript
   ═══════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  // ── State ──
  let activeRegion = 'india'; // 'india' | 'worldwide'
  let milestoneCounter = 0;
  let serviceCounter = 0;

  // ── DOM References ──
  const $ = (id) => document.getElementById(id);

  // ═══════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════

  function init() {
    // Set today's date
    const today = new Date();
    $('invoiceDate').value = formatDateInput(today);
    updatePreviewText('previewInvoiceDate', formatDateDisplay(today));

    // Add one default service row
    addServiceRow();

    // Bind all events
    bindInputEvents();
    bindTabEvents();
    bindPrintButton();

    // Initial preview update
    updateMilestonePreview();
    updateInvoicePreview();
  }

  // ═══════════════════════════════════════
  // INPUT EVENT BINDING
  // ═══════════════════════════════════════

  function bindInputEvents() {
    // Simple text → preview bindings
    const bindings = [
      { input: 'invoiceNumber', preview: 'previewInvoiceNum' },
      { input: 'clientName', preview: 'previewClientName' },
      { input: 'clientCompany', preview: 'previewClientCompany' },
      { input: 'clientEmail', preview: 'previewClientEmail' },
      { input: 'clientPhone', preview: 'previewClientPhone' },
      { input: 'clientAddress', preview: 'previewClientAddress' },
    ];

    bindings.forEach(({ input, preview }) => {
      const el = $(input);
      if (!el) return;
      el.addEventListener('input', () => {
        const val = el.value.trim();
        updatePreviewText(preview, val || '—');
      });
    });

    // Date fields
    $('invoiceDate').addEventListener('input', () => {
      const val = $('invoiceDate').value;
      updatePreviewText('previewInvoiceDate', val ? formatDateDisplay(new Date(val + 'T00:00:00')) : '—');
    });

    $('paymentReceived').addEventListener('input', updateInvoicePreview);
    $('paymentReceivedDate').addEventListener('input', updateInvoicePreview);
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

  // ═══════════════════════════════════════
  // CALCULATION & UPDATES
  // ═══════════════════════════════════════

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
        <td>${escapeHtml(name)}</td>
        <td>${formatCurrency(price)}</td>
      `;
      tbody.appendChild(tr);
    });

    const received = parseFloat($('paymentReceived').value) || 0;
    const balance = Math.max(0, total - received);

    $('previewSubtotal').textContent = formatCurrency(total);
    $('previewReceived').textContent = formatCurrency(received);
    $('previewBalanceDue').textContent = formatCurrency(balance);
    $('previewSummaryBalance').textContent = formatCurrency(balance);

    const receivedDate = $('paymentReceivedDate').value;
    if (receivedDate && received > 0) {
        $('previewReceivedDateLabel').textContent = `(on ${formatDateDisplay(new Date(receivedDate + 'T00:00:00'))})`;
    } else {
        $('previewReceivedDateLabel').textContent = '';
    }

    if (received > 0) {
      $('previewReceivedRow').style.display = 'flex';
    } else {
      $('previewReceivedRow').style.display = 'none';
    }
  }

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
    const section = $('milestonesSection');
    container.innerHTML = '';

    if (rows.length === 0) {
      section.style.display = 'none';
      return;
    } else {
      section.style.display = 'block';
    }

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
      const element = $('invoiceDoc');
      const clientName = $('clientName').value.trim() || 'Client';
      const invoiceNum = $('invoiceNumber').value.trim() || 'Invoice';
      const filename = `WebWynk_${invoiceNum}_${clientName}.pdf`.replace(/\s+/g, '_');

      const btn = $('printBtn');
      btn.disabled = true;
      btn.textContent = 'Generating PDF…';

      // Show print layout
      document.body.classList.add('generating-pdf');
      element.classList.add('generating-pdf'); // Crucial: add to element so html2canvas sees it

      await new Promise(r => setTimeout(r, 400));

      const A4_WIDTH_MM = 210;
      const A4_HEIGHT_MM = 297;

      // Force the page to act as a perfect A4 container
      const pages = element.querySelectorAll('.print-page');
      pages.forEach(page => {
        page.style.boxSizing = 'border-box';
      });

      await new Promise(r => setTimeout(r, 400));
      window.scrollTo(0, 0);

      const opt = {
        margin:       0,
        filename:     filename,
        image:        { type: 'jpeg', quality: 1.0 },
        html2canvas:  { scale: 4, useCORS: true, letterRendering: true, logging: false, scrollY: 0, scrollX: 0 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        enableLinks:  true
      };

      try {
        await html2pdf().set(opt).from(element).save();
      } catch (e) {
        console.error('PDF generation failed:', e);
      }

      // Clean up
      pages.forEach(page => {
        page.style.boxSizing = '';
      });

      document.body.classList.remove('generating-pdf');
      element.classList.remove('generating-pdf');
      btn.disabled = false;
      btn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        Print Invoice
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
