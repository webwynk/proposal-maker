const fs = require('fs');

function extractModals(html) {
  // Simple hacky parser to extract and remove modals
  // All modals start with <div class="modal" id="somethingModal"> and end with </div> (with nested divs)
  // We can just rely on the comment blocks above them since we wrote this HTML!
  
  // The modals have comments above them:
  // <!-- Add/Edit Client Modal -->
  // <!-- Add/Edit Project Modal -->
  // <!-- Project Files Modal -->
  // <!-- Create/Edit Invoice Modal -->
  // <!-- Invoice View Modal -->

  const modalMarkers = [
    { id: 'clientModal', comment: '<!-- Add/Edit Client Modal -->' },
    { id: 'projectModal', comment: '<!-- Add/Edit Project Modal -->' },
    { id: 'filesModal', comment: '<!-- Project Files Modal -->' },
    { id: 'invoiceModalAdmin', comment: '<!-- Create/Edit Invoice Modal -->' },
    { id: 'invoiceModalClient', comment: '<!-- Invoice View Modal -->' }
  ];

  let modifiedHtml = html;
  const extracted = {};

  modalMarkers.forEach(marker => {
    const startIdx = modifiedHtml.indexOf(marker.comment);
    if (startIdx !== -1) {
      // Find the end of this modal. Modals usually end right before the next modal comment, or right before <!-- scripts --> or <script>
      let endIdx = modifiedHtml.length;
      for(let m of modalMarkers) {
        if(m.id !== marker.id) {
          const mIdx = modifiedHtml.indexOf(m.comment, startIdx + 1);
          if (mIdx !== -1 && mIdx < endIdx) endIdx = mIdx;
        }
      }
      
      const scriptIdx = modifiedHtml.indexOf('<script', startIdx);
      if (scriptIdx !== -1 && scriptIdx < endIdx) endIdx = scriptIdx;

      extracted[marker.id] = modifiedHtml.substring(startIdx, endIdx);
      modifiedHtml = modifiedHtml.substring(0, startIdx) + modifiedHtml.substring(endIdx);
    }
  });

  return { html: modifiedHtml, extracted };
}

function processAdminFiles() {
  const files = ['admin.html', 'admin-clients.html', 'admin-invoices.html', 'admin-projects.html', 'admin-proposals.html'];
  
  files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    const { html, extracted } = extractModals(content);
    
    let finalHtml = html;
    
    // Add back the required modals
    // Note: invoiceModalAdmin is completely removed from everywhere.
    let modalsToInject = '';
    
    if (file === 'admin-clients.html') {
      if (extracted.clientModal) modalsToInject += extracted.clientModal;
    }
    
    if (file === 'admin-projects.html') {
      if (extracted.projectModal) modalsToInject += extracted.projectModal;
      if (extracted.filesModal) modalsToInject += extracted.filesModal;
    }

    if (modalsToInject) {
      finalHtml = finalHtml.replace('  <script', modalsToInject + '  <script');
    }

    fs.writeFileSync(file, finalHtml);
    console.log('Cleaned ' + file);
  });
}

function processClientFiles() {
  const files = ['client.html', 'client-invoices.html', 'client-projects.html', 'client-proposals.html', 'client-settings.html'];
  
  files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    const { html, extracted } = extractModals(content);
    
    let finalHtml = html;
    let modalsToInject = '';
    
    if (file === 'client-invoices.html') {
      if (extracted.invoiceModalClient) modalsToInject += extracted.invoiceModalClient;
    }
    
    if (file === 'client-projects.html') {
      if (extracted.filesModal) modalsToInject += extracted.filesModal;
    }

    if (modalsToInject) {
      finalHtml = finalHtml.replace('  <script', modalsToInject + '  <script');
    }

    fs.writeFileSync(file, finalHtml);
    console.log('Cleaned ' + file);
  });
}

processAdminFiles();
processClientFiles();
