const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
require('dotenv').config();

const { supabase } = require('./database');
const { generateToken, authenticateToken, requireAdmin, requireClient } = require('./auth');
const { sendInvoiceEmail, sendProjectUpdateEmail } = require('./email');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname, { index: false }));

// File uploads will use memory storage for Supabase upload
const upload = multer({ storage: multer.memoryStorage() });

// Serve static files from root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ==================== AUTH ROUTES ====================

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const { data: user, error } = await supabase.from('users').select('*').eq('email', email).single();
  if (error || !user || !user.is_active) return res.status(401).json({ error: 'Invalid credentials or account deactivated' });

  const validPassword = bcrypt.compareSync(password, user.password);
  if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

  const token = generateToken(user);
  res.json({ token, user: { id: user.id, name: user.name, company: user.company, email: user.email, role: user.role } });
});

app.post('/api/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password required' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const { data: user } = await supabase.from('users').select('password').eq('id', req.user.id).single();
  if (!user || !bcrypt.compareSync(currentPassword, user.password)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const hashedPassword = bcrypt.hashSync(newPassword, 10);
  const { error } = await supabase.from('users').update({ password: hashedPassword, updated_at: new Date() }).eq('id', req.user.id);
  if (error) return res.status(500).json({ error: 'Failed to change password' });

  res.json({ message: 'Password changed successfully' });
});

// ==================== ADMIN - USER MANAGEMENT ====================

app.get('/api/clients', authenticateToken, requireAdmin, async (req, res) => {
  const { data: clients, error } = await supabase.from('users').select('id, name, company, email, phone, is_active, created_at').eq('role', 'client').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: 'Failed to fetch clients' });
  res.json(clients);
});

app.post('/api/clients', authenticateToken, requireAdmin, async (req, res) => {
  const { name, company, email, phone, password } = req.body;
  if (!name || !company || !email || !password) return res.status(400).json({ error: 'Required fields missing' });

  const { data: existing } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
  if (existing) return res.status(400).json({ error: 'Email already exists' });

  const hashedPassword = bcrypt.hashSync(password, 10);
  const { data: newUser, error } = await supabase.from('users').insert([{ name, company, email, phone, password: hashedPassword, role: 'client' }]).select('id, name, company, email, phone').single();
  
  if (error) return res.status(500).json({ error: 'Failed to create client' });
  res.json(newUser);
});

app.put('/api/clients/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, company, email, phone, is_active } = req.body;
  
  const { error } = await supabase.from('users').update({ name, company, email, phone, is_active: !!is_active, updated_at: new Date() }).eq('id', id).eq('role', 'client');
  if (error) return res.status(500).json({ error: 'Failed to update client' });
  res.json({ message: 'Client updated successfully' });
});

app.delete('/api/clients/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from('users').delete().eq('id', id).eq('role', 'client');
  if (error) return res.status(500).json({ error: 'Failed to delete client' });
  res.json({ message: 'Client deleted successfully' });
});

app.get('/api/clients/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { data: client, error } = await supabase.from('users').select('id, name, company, email, phone, is_active, created_at').eq('id', id).eq('role', 'client').single();
  if (error || !client) return res.status(404).json({ error: 'Client not found' });
  res.json(client);
});

// ==================== ADMIN - INVOICES ====================

app.get('/api/invoices', authenticateToken, requireAdmin, async (req, res) => {
  const { data: invoices, error } = await supabase.from('invoices').select('*, users!invoices_client_id_fkey(name, company)').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: 'Failed to fetch invoices' });
  
  res.json(invoices.map(inv => ({
    ...inv,
    client_name: inv.users?.name,
    client_company: inv.users?.company,
    users: undefined
  })));
});

app.post('/api/invoices', authenticateToken, requireAdmin, async (req, res) => {
  const { invoice_number, client_id, invoice_date, services, milestones, payment_received, payment_received_date, currency, status, notes } = req.body;
  if (!invoice_number || !client_id) return res.status(400).json({ error: 'Invoice number and client are required' });

  const { data: newInvoice, error } = await supabase.from('invoices').insert([{
    invoice_number, client_id, invoice_date: invoice_date || null, services: services || [], milestones: milestones || [],
    payment_received: payment_received || 0, payment_received_date: payment_received_date || null, currency: currency || 'INR', status: status || 'draft', notes, created_by: req.user.id
  }]).select().single();

  if (error) return res.status(500).json({ error: 'Failed to create invoice' });
  
  const { data: client } = await supabase.from('users').select('email, name').eq('id', client_id).single();
  if (client) sendInvoiceEmail(client.email, newInvoice, client.name);
  
  res.json(newInvoice);
});

app.get('/api/invoices/:id', authenticateToken, async (req, res) => {
  const { data: invoice, error } = await supabase.from('invoices').select('*, users!invoices_client_id_fkey(name, company, email, phone)').eq('id', req.params.id).single();
  if (error || !invoice) return res.status(404).json({ error: 'Invoice not found' });
  if (req.user.role === 'client' && invoice.client_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
  
  res.json({
    ...invoice,
    client_name: invoice.users?.name,
    client_company: invoice.users?.company,
    client_email: invoice.users?.email,
    client_phone: invoice.users?.phone,
    users: undefined
  });
});

app.put('/api/invoices/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { invoice_number, client_id, invoice_date, services, milestones, payment_received, payment_received_date, currency, status, notes } = req.body;
  
  const { data: updated, error } = await supabase.from('invoices').update({
    invoice_number, client_id, invoice_date: invoice_date || null, services: services || [], milestones: milestones || [],
    payment_received: payment_received || 0, payment_received_date: payment_received_date || null, currency: currency || 'INR', status: status || 'draft', notes, updated_at: new Date()
  }).eq('id', id).select().single();

  if (error) return res.status(500).json({ error: 'Failed to update invoice' });
  res.json(updated);
});

app.delete('/api/invoices/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { error } = await supabase.from('invoices').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'Failed to delete invoice' });
  res.json({ message: 'Invoice deleted successfully' });
});

app.get('/api/my-invoices', authenticateToken, requireClient, async (req, res) => {
  const { data: invoices, error } = await supabase.from('invoices').select('*, users!invoices_client_id_fkey(name, company)').eq('client_id', req.user.id).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: 'Failed to fetch invoices' });
  
  res.json(invoices.map(inv => ({
    ...inv,
    client_name: inv.users?.name,
    client_company: inv.users?.company,
    users: undefined
  })));
});

// ==================== PROJECTS ====================

app.get('/api/projects', authenticateToken, requireAdmin, async (req, res) => {
  const { data: projects, error } = await supabase.from('projects').select('*, users!projects_client_id_fkey(name, company)').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: 'Failed to fetch projects' });
  
  res.json(projects.map(p => ({
    ...p,
    client_name: p.users?.name,
    client_company: p.users?.company,
    users: undefined
  })));
});

app.post('/api/projects', authenticateToken, requireAdmin, async (req, res) => {
  const { client_id, name, project_type, status, progress, milestones, notes, priority, start_date, end_date, external_links } = req.body;
  if (!client_id || !name) return res.status(400).json({ error: 'Client and project name are required' });

  const { data: newProject, error } = await supabase.from('projects').insert([{
    client_id, name, project_type, status: status || 'discovery', progress: progress || 0, milestones: milestones || [], notes,
    priority: priority || 'Medium', start_date, end_date, external_links: external_links || [], created_by: req.user.id
  }]).select().single();

  if (error) return res.status(500).json({ error: 'Failed to create project' });

  // Send Project Initiation Email
  const { data: client } = await supabase.from('users').select('email, name').eq('id', client_id).single();
  if (client) sendProjectUpdateEmail(client.email, newProject, client.name, "Your project has been successfully initiated.");

  res.json(newProject);
});

app.put('/api/projects/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { client_id, name, project_type, status, progress, milestones, notes, priority, start_date, end_date, external_links } = req.body;
  
  let linksToSave = external_links;
  if (linksToSave === undefined) {
    const { data: currentProject } = await supabase.from('projects').select('external_links').eq('id', id).single();
    linksToSave = currentProject?.external_links || [];
  }

  const { data: updated, error } = await supabase.from('projects').update({
    client_id, name, project_type, status: status || 'discovery', progress: progress || 0, milestones: milestones || [], notes,
    priority: priority || 'Medium', start_date, end_date, external_links: linksToSave, updated_at: new Date()
  }).eq('id', id).select().single();

  if (error) return res.status(500).json({ error: 'Failed to update project' });

  // Handle Milestone Emails
  const { data: client } = await supabase.from('users').select('email, name').eq('id', client_id).single();
  if (client && milestones && Array.isArray(milestones)) {
    const { data: oldProject } = await supabase.from('projects').select('milestones').eq('id', id).single();
    const oldMilestones = oldProject?.milestones || [];
    
    // Check for newly completed milestones or new milestones
    milestones.forEach(m => {
      const oldM = oldMilestones.find(om => om.id === m.id);
      if (m.completed && (!oldM || !oldM.completed)) {
        sendMilestoneEmail(client.email, updated, client.name, m.title, true);
      } else if (!oldM) {
        sendMilestoneEmail(client.email, updated, client.name, m.title, false);
      }
    });
  }

  res.json(updated);
});


app.delete('/api/projects/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { error } = await supabase.from('projects').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'Failed to delete project' });
  res.json({ message: 'Project deleted successfully' });
});

app.get('/api/my-projects', authenticateToken, requireClient, async (req, res) => {
  const { data: projects, error } = await supabase.from('projects').select('*, users!projects_client_id_fkey(name, company)').eq('client_id', req.user.id).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: 'Failed to fetch projects' });
  
  res.json(projects.map(p => ({
    ...p,
    client_name: p.users?.name,
    client_company: p.users?.company,
    users: undefined
  })));
});

// ==================== PROJECT COMMENTS ====================

app.get('/api/projects/:id/comments', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { data: comments, error } = await supabase.from('project_comments').select('*, users!project_comments_user_id_fkey(name, role)').eq('project_id', id).order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: 'Failed to fetch comments' });
  res.json(comments.map(c => ({ ...c, author_name: c.users?.name, author_role: c.users?.role, users: undefined })));
});

app.post('/api/projects/:id/comments', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { comment } = req.body;
  if (!comment) return res.status(400).json({ error: 'Comment is required' });

  const { data: newComment, error } = await supabase.from('project_comments').insert([{ project_id: id, user_id: req.user.id, comment }]).select('*, users!project_comments_user_id_fkey(name, role)').single();
  if (error) return res.status(500).json({ error: 'Failed to add comment' });
  res.json({ ...newComment, author_name: newComment.users?.name, author_role: newComment.users?.role, users: undefined });
});


// ==================== PROJECT UPDATES & FILES ====================

app.get('/api/projects/:id/updates', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { data: project } = await supabase.from('projects').select('client_id').eq('id', id).single();
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (req.user.role === 'client' && project.client_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });

  const { data: updates, error } = await supabase.from('project_updates').select('*, users!project_updates_created_by_fkey(name)').eq('project_id', id).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: 'Failed to fetch updates' });
  
  res.json(updates.map(u => ({ ...u, author_name: u.users?.name, users: undefined })));
});

app.post('/api/projects/:id/updates', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Content is required' });

  const { data: newUpdate, error } = await supabase.from('project_updates').insert([{ project_id: id, content, created_by: req.user.id }]).select('*, users!project_updates_created_by_fkey(name)').single();
  if (error) return res.status(500).json({ error: 'Failed to add update' });
  
  await supabase.from('projects').update({ updated_at: new Date() }).eq('id', id);

  const formattedUpdate = { ...newUpdate, author_name: newUpdate.users?.name, users: undefined };
  
  const { data: project } = await supabase.from('projects').select('*, users!projects_client_id_fkey(email, name)').eq('id', id).single();
  if (project && project.users) {
    sendProjectUpdateEmail(project.users.email, project, project.users.name, content);
  }
  
  res.json(formattedUpdate);
});

app.get('/api/projects/:id/files', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { data: project } = await supabase.from('projects').select('client_id').eq('id', id).single();
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (req.user.role === 'client' && project.client_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });

  const { data: files, error } = await supabase.from('project_files').select('*, users!project_files_uploaded_by_fkey(name, role)').eq('project_id', id).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: 'Failed to fetch files' });
  
  res.json(files.map(f => ({ ...f, uploader_name: f.users?.name, uploader_role: f.users?.role, users: undefined })));
});

app.post('/api/projects/:id/files', authenticateToken, upload.single('file'), async (req, res) => {
  const { id } = req.params;
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  const { data: project } = await supabase.from('projects').select('client_id').eq('id', id).single();
  if (!project || (req.user.role === 'client' && project.client_id !== req.user.id)) return res.status(403).json({ error: 'Access denied' });

  // Feature 6: 5MB Size limit & File type validation (PDF/Images)
  const MAX_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_SIZE) return res.status(400).json({ error: 'File size exceeds 5MB limit' });
  
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.mimetype)) {
    return res.status(400).json({ error: 'Invalid file type. Only PDFs and Images are allowed.' });
  }

  try {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const { error: uploadError } = await supabase.storage.from('project-files').upload(uniqueName, file.buffer, { contentType: file.mimetype });
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage.from('project-files').getPublicUrl(uniqueName);
    const fileUrl = publicUrlData.publicUrl;

    const { data: newFile, error: dbError } = await supabase.from('project_files').insert([{
      project_id: id, client_id: project.client_id, original_name: file.originalname, file_path: fileUrl, uploaded_by: req.user.id
    }]).select('*, users!project_files_uploaded_by_fkey(name)').single();
    
    if (dbError) throw dbError;
    
    res.json({ ...newFile, uploader_name: newFile.users?.name, users: undefined });
  } catch (err) {
    console.error('Upload Error:', err);
    res.status(500).json({ error: 'Failed to save file record' });
  }
});

app.delete('/api/projects/:projectId/files/:fileId', authenticateToken, async (req, res) => {
  const { projectId, fileId } = req.params;
  const { data: fileRecord } = await supabase.from('project_files').select('*').eq('id', fileId).eq('project_id', projectId).single();
  
  if (!fileRecord) return res.status(404).json({ error: 'File not found' });
  if (req.user.role !== 'admin' && fileRecord.uploaded_by !== req.user.id) return res.status(403).json({ error: 'Access denied' });

  try {
    if (fileRecord.file_path && fileRecord.file_path.includes('supabase.co')) {
      const fileName = fileRecord.file_path.split('/').pop();
      if (fileName) await supabase.storage.from('project-files').remove([fileName]);
    }
    
    await supabase.from('project_files').delete().eq('id', fileId);
    res.json({ message: 'File deleted successfully' });
  } catch (err) {
    console.error('Delete Error:', err);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// ==================== PROPOSALS ====================

app.get('/api/proposals', authenticateToken, requireAdmin, async (req, res) => {
  const { data: proposals, error } = await supabase.from('proposals').select('*, users!proposals_client_id_fkey(name, company)').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: 'Failed to fetch proposals' });
  
  res.json(proposals.map(p => ({
    ...p,
    client_name: p.users?.name,
    client_company: p.users?.company,
    users: undefined
  })));
});

app.post('/api/proposals', authenticateToken, requireAdmin, async (req, res) => {
  const { proposal_number, client_id, proposal_date, project_title, project_overview, scope, growth_blueprint, timeline_duration, start_date, delivery_date, services, milestones, currency, status } = req.body;
  if (!proposal_number || !client_id) return res.status(400).json({ error: 'Proposal number and client required' });

  const { data: newProposal, error } = await supabase.from('proposals').insert([{
    proposal_number, client_id, proposal_date: proposal_date || null, project_title, project_overview, scope: scope || [], growth_blueprint, timeline_duration, start_date: start_date || null, delivery_date: delivery_date || null, services: services || [], milestones: milestones || [], currency: currency || 'INR', status: status || 'draft', created_by: req.user.id
  }]).select().single();

  if (error) return res.status(500).json({ error: 'Failed to create proposal' });

  // Send Proposal Email
  const { data: client } = await supabase.from('users').select('email, name').eq('id', client_id).single();
  if (client) sendProposalEmail(client.email, newProposal, client.name);

  res.json(newProposal);
});

app.get('/api/proposals/:id', authenticateToken, async (req, res) => {
  const { data: proposal, error } = await supabase.from('proposals').select('*, users!proposals_client_id_fkey(name, company, email, phone)').eq('id', req.params.id).single();
  if (error || !proposal) return res.status(404).json({ error: 'Proposal not found' });
  if (req.user.role === 'client' && proposal.client_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
  
  res.json({
    ...proposal,
    client_name: proposal.users?.name,
    client_company: proposal.users?.company,
    client_email: proposal.users?.email,
    client_phone: proposal.users?.phone,
    users: undefined
  });
});

app.put('/api/proposals/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { proposal_number, client_id, proposal_date, project_title, project_overview, scope, growth_blueprint, timeline_duration, start_date, delivery_date, services, milestones, currency, status } = req.body;
  
  const { data: updated, error } = await supabase.from('proposals').update({
    proposal_number, client_id, proposal_date: proposal_date || null, project_title, project_overview, scope: scope || [], growth_blueprint, timeline_duration, start_date: start_date || null, delivery_date: delivery_date || null, services: services || [], milestones: milestones || [], currency: currency || 'INR', status: status || 'draft', updated_at: new Date()
  }).eq('id', req.params.id).select().single();

  if (error) return res.status(500).json({ error: 'Failed to update proposal' });
  res.json(updated);
});

app.delete('/api/proposals/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { error } = await supabase.from('proposals').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'Failed to delete proposal' });
  res.json({ message: 'Proposal deleted successfully' });
});

app.get('/api/my-proposals', authenticateToken, requireClient, async (req, res) => {
  const { data: proposals, error } = await supabase.from('proposals').select('*, users!proposals_client_id_fkey(name, company)').eq('client_id', req.user.id).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: 'Failed to fetch proposals' });
  
  res.json(proposals.map(p => ({
    ...p,
    client_name: p.users?.name,
    client_company: p.users?.company,
    users: undefined
  })));
});

// ==================== DASHBOARD STATS ====================

app.get('/api/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { count: clientCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'client');
    const { count: invoiceCount } = await supabase.from('invoices').select('*', { count: 'exact', head: true });
    const { count: projectCount } = await supabase.from('projects').select('*', { count: 'exact', head: true });
    const { count: proposalCount } = await supabase.from('proposals').select('*', { count: 'exact', head: true });

    const { data: pendingInvoices } = await supabase.from('invoices').select('services, payment_received').neq('status', 'paid');
    let totalRevenue = 0;
    if (pendingInvoices) {
      pendingInvoices.forEach(inv => {
        let servicesTotal = 0;
        if (inv.services && Array.isArray(inv.services)) {
          inv.services.forEach(s => { if (s && s.price && !isNaN(s.price)) servicesTotal += parseFloat(s.price); });
        }
        totalRevenue += (servicesTotal - (inv.payment_received || 0));
      });
    }

    const { data: recentInvoicesData } = await supabase.from('invoices').select('*, users!invoices_client_id_fkey(name, company)').order('created_at', { ascending: false }).limit(5);
    const recentInvoices = (recentInvoicesData || []).map(i => ({ ...i, client_name: i.users?.name, client_company: i.users?.company, users: undefined }));

    res.json({ clientCount, invoiceCount, projectCount, proposalCount, totalRevenue, recentInvoices });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.get('/api/admin/email-logs', authenticateToken, requireAdmin, async (req, res) => {
  const { data: logs, error } = await supabase.from('email_logs').select('*').order('sent_at', { ascending: false });
  if (error) return res.status(500).json({ error: 'Failed to fetch email logs' });
  res.json(logs);
});

// Feature 7: Project Links API
app.get('/api/projects/:id/links', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { data: project, error } = await supabase.from('projects').select('external_links, client_id').eq('id', id).single();
  
  if (error || !project) return res.status(404).json({ error: 'Project not found' });
  if (req.user.role === 'client' && project.client_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });

  let links = project.external_links;
  if (typeof links === 'string') {
    try { links = JSON.parse(links); } catch { links = []; }
  }
  res.json(Array.isArray(links) ? links : []);
});




app.post('/api/projects/:id/links', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { title, url } = req.body;
  if (!title || !url) return res.status(400).json({ error: 'Title and URL required' });

  // Fetch current links
  const { data: project, error: fetchError } = await supabase.from('projects').select('external_links, client_id').eq('id', id).single();
  if (fetchError || !project) return res.status(404).json({ error: 'Project not found' });
  if (req.user.role === 'client' && project.client_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });

  let links = project.external_links;
  if (typeof links === 'string') {
    try { links = JSON.parse(links); } catch { links = []; }
  }
  if (!Array.isArray(links)) links = [];

  const newLink = {
    id: Date.now(),
    title,
    url,
    creator_name: req.user.name,
    creator_role: req.user.role,
    created_by: req.user.id,
    created_at: new Date().toISOString()
  };

  const updatedLinks = [newLink, ...links];
  const { error: updateError } = await supabase.from('projects').update({ external_links: updatedLinks }).eq('id', id);

  if (updateError) {
    console.error('Link Save Error:', updateError);
    return res.status(500).json({ error: 'Failed to save link' });
  }

  res.json(newLink);
});



app.delete('/api/projects/:projectId/links/:linkId', authenticateToken, async (req, res) => {
  const { projectId, linkId } = req.params;
  
  const { data: project, error: fetchError } = await supabase.from('projects').select('external_links, client_id').eq('id', projectId).single();
  if (fetchError || !project) return res.status(404).json({ error: 'Project not found' });

  let links = project.external_links;
  if (typeof links === 'string') {
    try { links = JSON.parse(links); } catch { links = []; }
  }
  if (!Array.isArray(links)) links = [];

  const linkToDelete = links.find(l => String(l.id) === String(linkId));

  
  if (!linkToDelete) return res.status(404).json({ error: 'Link not found' });

  // Permissions
  if (req.user.role !== 'admin' && String(linkToDelete.created_by) !== String(req.user.id)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const updatedLinks = links.filter(l => String(l.id) !== String(linkId));
  const { error: updateError } = await supabase.from('projects').update({ external_links: updatedLinks }).eq('id', projectId);

  if (updateError) return res.status(500).json({ error: 'Failed to delete link' });
  res.json({ message: 'Link deleted' });
});



// ==================== SEED ADMIN USER ====================

async function seedAdmin() {
  const { data: existingAdmin } = await supabase.from('users').select('id').eq('role', 'admin').maybeSingle();
  if (!existingAdmin) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    await supabase.from('users').insert([{ name: 'Admin', company: 'WebWynk', email: 'admin@webwynk.com', phone: '+91 9083895364', password: hashedPassword, role: 'admin' }]);
    console.log('Admin user created: admin@webwynk.com / admin123');
  }
}

// Start server
if (process.env.NODE_ENV !== 'production') {
  seedAdmin().then(() => {
    app.listen(PORT, () => {
      console.log(`\n🚀 WebWynk CRM running at http://localhost:${PORT}`);
      console.log(`   Admin Login: http://localhost:${PORT}/index.html`);
    });
  }).catch(console.error);
} else {
  seedAdmin().catch(console.error);
}

module.exports = app;