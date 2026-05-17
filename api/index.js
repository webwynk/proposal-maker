const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
require('dotenv').config();

const { supabase, hasSupabaseConfig } = require('../database');
const { generateToken, authenticateToken, requireAdmin, requireClient } = require('../auth');
const { sendInvoiceEmail, sendProjectUpdateEmail, sendProposalEmail, sendMilestoneEmail } = require('../email');

const app = express();
const PORT = process.env.PORT || 3000;

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);
const hasJwtSecret = Boolean(process.env.JWT_SECRET);

function isNonEmptyString(value, max = 1000) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
}

function validateEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateUrl(url) {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function logActivity({
  actorId,
  clientId,
  projectId = null,
  invoiceId = null,
  proposalId = null,
  eventType,
  title,
  description = null,
  metadata = {}
}) {
  try {
    if (!clientId || !eventType || !title) return;
    await supabase.from('activity_logs').insert([{
      actor_id: actorId,
      client_id: clientId,
      project_id: projectId,
      invoice_id: invoiceId,
      proposal_id: proposalId,
      event_type: eventType,
      title,
      description,
      metadata,
      created_at: new Date().toISOString()
    }]);
  } catch (err) {
    console.error('[Activity Log] Failed:', err?.message || err);
  }
}

function makeRateLimiter({ windowMs, max, key = (req) => req.ip }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const userKey = key(req) || req.ip || 'unknown';
    const record = hits.get(userKey);
    if (!record || now > record.resetAt) {
      hits.set(userKey, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (record.count >= max) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    record.count += 1;
    hits.set(userKey, record);
    next();
  };
}

const loginRateLimiter = makeRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  key: (req) => `${req.ip}:${(req.body?.email || '').toLowerCase()}`
});
const writeRateLimiter = makeRateLimiter({ windowMs: 60 * 1000, max: 120 });

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      return callback(null, true);
    }
    if (origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api', (req, res, next) => {
  if (!hasSupabaseConfig || !hasJwtSecret) {
    return res.status(503).json({
      error: 'Server configuration is incomplete. Please set SUPABASE_URL, SUPABASE_KEY, and JWT_SECRET in Vercel environment variables.'
    });
  }
  next();
});

// Request Logger for debugging
app.use((req, res, next) => {
  if (req.url.startsWith('/api')) {
    console.log(`[API Request] ${req.method} ${req.url}`);
  }
  next();
});

// Serve static files from public
app.use(express.static(path.join(__dirname, '../public'), { index: false }));

// File uploads will use memory storage for Supabase upload
const upload = multer({ storage: multer.memoryStorage() });

// Serve static files from root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// ==================== AUTH ROUTES ====================

app.post('/api/login', loginRateLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!validateEmail(email) || !isNonEmptyString(password, 200)) {
      return res.status(400).json({ error: 'Valid email and password are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (error || !user || !user.is_active) return res.status(401).json({ error: 'Invalid credentials or account deactivated' });
    if (!isNonEmptyString(user.password, 500)) return res.status(401).json({ error: 'Invalid credentials' });

    let validPassword = false;
    try {
      validPassword = bcrypt.compareSync(password, user.password);
    } catch (compareErr) {
      console.error('[Login Compare Error]', compareErr);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

    const token = generateToken(user);
    res.json({ token, user: { id: user.id, name: user.name, company: user.company, email: user.email, role: user.role } });
  } catch (err) {
    console.error('[Login Error]', err);
    res.status(500).json({ error: 'Login failed due to a server error' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    hasSupabaseConfig,
    hasJwtSecret,
    nodeEnv: process.env.NODE_ENV || 'unknown',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/change-password', authenticateToken, writeRateLimiter, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!isNonEmptyString(currentPassword, 200) || !isNonEmptyString(newPassword, 200)) {
    return res.status(400).json({ error: 'Current and new password required' });
  }
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

app.post('/api/clients', authenticateToken, requireAdmin, writeRateLimiter, async (req, res) => {
  const { name, company, email, phone, password } = req.body;
  if (!isNonEmptyString(name, 120) || !isNonEmptyString(company, 120) || !validateEmail(email) || !isNonEmptyString(password, 200)) {
    return res.status(400).json({ error: 'Required fields missing or invalid' });
  }
  if (phone && !isNonEmptyString(phone, 30)) return res.status(400).json({ error: 'Invalid phone number' });

  const { data: existing } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
  if (existing) return res.status(400).json({ error: 'Email already exists' });

  const hashedPassword = bcrypt.hashSync(password, 10);
  const { data: newUser, error } = await supabase.from('users').insert([{ name, company, email, phone, password: hashedPassword, role: 'client' }]).select('id, name, company, email, phone').single();
  
  if (error) return res.status(500).json({ error: 'Failed to create client' });
  res.json(newUser);
});

app.put('/api/clients/:id', authenticateToken, requireAdmin, writeRateLimiter, async (req, res) => {
  const { id } = req.params;
  const { name, company, email, phone, is_active } = req.body;
  
  if (!isNonEmptyString(name, 120) || !isNonEmptyString(company, 120) || !validateEmail(email)) {
    return res.status(400).json({ error: 'Invalid client payload' });
  }
  if (phone && !isNonEmptyString(phone, 30)) return res.status(400).json({ error: 'Invalid phone number' });

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
  
  createNotification(client_id, 'New Invoice', `Invoice ${invoice_number} has been generated.`, 'invoice', `/invoice.html?id=${newInvoice.id}&view=true`);
  await logActivity({
    actorId: req.user.id,
    clientId: client_id,
    invoiceId: newInvoice.id,
    eventType: 'invoice_created',
    title: `Invoice ${invoice_number} created`,
    description: `Status: ${newInvoice.status || 'draft'}`
  });
  
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
  await logActivity({
    actorId: req.user.id,
    clientId: updated.client_id,
    invoiceId: updated.id,
    eventType: updated.status === 'paid' ? 'invoice_paid' : 'invoice_updated',
    title: `Invoice ${updated.invoice_number} ${updated.status === 'paid' ? 'marked paid' : 'updated'}`,
    description: `Status: ${updated.status || 'draft'}`
  });
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

app.post('/api/projects', authenticateToken, requireAdmin, writeRateLimiter, async (req, res) => {
  const { client_id, name, project_type, status, progress, milestones, notes, priority, start_date, end_date, external_links } = req.body;
  if (!client_id || !isNonEmptyString(name, 150)) return res.status(400).json({ error: 'Client and project name are required' });
  if (notes && !isNonEmptyString(notes, 5000)) return res.status(400).json({ error: 'Notes too long or invalid' });
  if (milestones && (!Array.isArray(milestones) || milestones.length > 4)) {
    return res.status(400).json({ error: 'Milestones must be an array with at most 4 items' });
  }

  const { data: newProject, error } = await supabase.from('projects').insert([{
    client_id, name, project_type, status: status || 'discovery', progress: progress || 0, milestones: milestones || [], notes,
    priority: priority || 'Medium', start_date, end_date, external_links: external_links || [], created_by: req.user.id
  }]).select().single();

  if (error) return res.status(500).json({ error: 'Failed to create project' });

  // Send Project Initiation Email
  const { data: client } = await supabase.from('users').select('email, name').eq('id', client_id).single();
  if (client) sendProjectUpdateEmail(client.email, newProject, client.name, "Your project has been successfully initiated.");
  
  createNotification(client_id, 'New Project Assigned', `You have been assigned to: ${name}`, 'project', `/client-projects.html`);
  await logActivity({
    actorId: req.user.id,
    clientId: client_id,
    projectId: newProject.id,
    eventType: 'project_created',
    title: `Project created: ${name}`,
    description: `Status: ${newProject.status || 'discovery'}`
  });

  res.json(newProject);
});

app.put('/api/projects/:id', authenticateToken, requireAdmin, writeRateLimiter, async (req, res) => {
  const { id } = req.params;
  const { client_id, name, project_type, status, progress, milestones, notes, priority, start_date, end_date, external_links } = req.body;
  if (!client_id || !isNonEmptyString(name, 150)) return res.status(400).json({ error: 'Client and project name are required' });
  if (notes && !isNonEmptyString(notes, 5000)) return res.status(400).json({ error: 'Notes too long or invalid' });
  if (milestones && (!Array.isArray(milestones) || milestones.length > 4)) {
    return res.status(400).json({ error: 'Milestones must be an array with at most 4 items' });
  }
  if (external_links && !Array.isArray(external_links)) return res.status(400).json({ error: 'Invalid links payload' });

  let linksToSave = external_links;
  if (linksToSave === undefined) {
    const { data: currentProject } = await supabase.from('projects').select('external_links').eq('id', id).single();
    linksToSave = currentProject?.external_links || [];
  }

  // Fetch old project state BEFORE update for status and milestone comparison
  const { data: oldProject } = await supabase.from('projects').select('status, milestones').eq('id', id).single();
  const oldMilestones = oldProject?.milestones || [];

  const { data: updated, error } = await supabase.from('projects').update({
    client_id, name, project_type, status: status || 'discovery', progress: progress || 0, milestones: milestones || [], notes,
    priority: priority || 'Medium', start_date, end_date, external_links: linksToSave, updated_at: new Date()
  }).eq('id', id).select().single();

  if (error) return res.status(500).json({ error: 'Failed to update project' });

  // Handle Milestone Emails
  try {
    const { data: client } = await supabase.from('users').select('email, name').eq('id', client_id).single();
    if (client && milestones && Array.isArray(milestones)) {
      milestones.forEach(m => {
        // Find existing milestone by ID or Title
        const oldM = oldMilestones.find(om => (om.id && m.id && om.id === m.id) || (om.title === m.title));
        
        const isNowCompleted = m.status === 'completed' || parseInt(m.progress) === 100;
        const wasCompleted = oldM && (oldM.status === 'completed' || parseInt(oldM.progress) === 100);

        if (isNowCompleted && !wasCompleted) {
          console.log(`[Server] Triggering milestone completed email for: ${m.title}`);
          sendMilestoneEmail(client.email, updated, client.name, m.title, true).catch(err => console.error('[Server] Milestone email failed:', err));
          createNotification(client_id, 'Milestone Completed', `Milestone "${m.title}" is now completed!`, 'milestone', `/client-projects.html`);
        } else if (!oldM) {
          // New milestone created (Started)
          console.log(`[Server] Triggering new milestone email for: ${m.title}`);
          sendMilestoneEmail(client.email, updated, client.name, m.title, false).catch(err => console.error('[Server] Milestone email failed:', err));
          createNotification(client_id, 'Milestone Started', `Work has started on: "${m.title}"`, 'milestone', `/client-projects.html`);
        }
      });
    }
  } catch (err) {
    console.error('[Server] Failed to process milestone notifications:', err);
  }

  // Project Status Change Notification
  if (status && oldProject && status !== oldProject.status) {
    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
    createNotification(client_id, 'Project Status Updated', `${name} is now: ${statusLabel}`, 'project', `/client-projects.html`);
    await logActivity({
      actorId: req.user.id,
      clientId: client_id,
      projectId: updated.id,
      eventType: 'project_status_changed',
      title: `Project status changed: ${name}`,
      description: `${oldProject.status || 'unknown'} -> ${status}`
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
  const { data: project } = await supabase.from('projects').select('client_id').eq('id', id).single();
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (req.user.role === 'client' && project.client_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });

  const { data: comments, error } = await supabase.from('project_comments').select('*, users!project_comments_user_id_fkey(name, role)').eq('project_id', id).order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: 'Failed to fetch comments' });
  res.json(comments.map(c => ({ ...c, author_name: c.users?.name, author_role: c.users?.role, users: undefined })));
});

app.post('/api/projects/:id/comments', authenticateToken, writeRateLimiter, async (req, res) => {
  const { id } = req.params;
  const { comment } = req.body;
  if (!isNonEmptyString(comment, 3000)) return res.status(400).json({ error: 'Comment is required' });
  const { data: project } = await supabase.from('projects').select('client_id').eq('id', id).single();
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (req.user.role === 'client' && project.client_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });

  const { data: newComment, error } = await supabase.from('project_comments').insert([{ project_id: id, user_id: req.user.id, comment: comment.trim() }]).select('*, users!project_comments_user_id_fkey(name, role)').single();
  if (error) return res.status(500).json({ error: 'Failed to add comment' });
  await logActivity({
    actorId: req.user.id,
    clientId: project.client_id,
    projectId: Number(id),
    eventType: 'comment_added',
    title: 'New project comment',
    description: comment.trim().slice(0, 160)
  });
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

app.post('/api/projects/:id/updates', authenticateToken, requireAdmin, writeRateLimiter, async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  if (!isNonEmptyString(content, 5000)) return res.status(400).json({ error: 'Content is required' });

  const { data: newUpdate, error } = await supabase.from('project_updates').insert([{ project_id: id, content, created_by: req.user.id }]).select('*, users!project_updates_created_by_fkey(name)').single();
  if (error) return res.status(500).json({ error: 'Failed to add update' });
  
  await supabase.from('projects').update({ updated_at: new Date() }).eq('id', id);

  const formattedUpdate = { ...newUpdate, author_name: newUpdate.users?.name, users: undefined };
  
  const { data: project } = await supabase.from('projects').select('*, users!projects_client_id_fkey(email, name)').eq('id', id).single();
  if (project && project.users) {
    sendProjectUpdateEmail(project.users.email, project, project.users.name, content);
  }
  
  createNotification(project.client_id, 'Project Update', `New update for project: ${project.name}`, 'project', `/client-projects.html`);
  await logActivity({
    actorId: req.user.id,
    clientId: project.client_id,
    projectId: Number(id),
    eventType: 'project_update_posted',
    title: `Update posted for ${project.name}`,
    description: content.slice(0, 160)
  });

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
    
    await logActivity({
      actorId: req.user.id,
      clientId: project.client_id,
      projectId: Number(id),
      eventType: 'file_uploaded',
      title: `File uploaded: ${file.originalname}`
    });

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
    await logActivity({
      actorId: req.user.id,
      clientId: fileRecord.client_id,
      projectId: Number(projectId),
      eventType: 'file_deleted',
      title: `File deleted: ${fileRecord.original_name || 'file'}`
    });
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

  if (error) {
    console.error('Proposal Creation Error:', error);
    return res.status(500).json({ error: 'Failed to create proposal' });
  }

  // Send Proposal Email (Async)
  if (newProposal) {
    try {
      const { data: client } = await supabase.from('users').select('email, name').eq('id', client_id).single();
      if (client) {
        // We don't await the email so the response stays fast, but we catch errors
        sendProposalEmail(client.email, newProposal, client.name).catch(err => console.error('[Server] Proposal email failed:', err));
        createNotification(client_id, 'New Proposal Ready', `Review your proposal for: ${project_title}`, 'proposal', `/proposal.html?id=${newProposal.id}&view=true`);
        await logActivity({
          actorId: req.user.id,
          clientId: client_id,
          proposalId: newProposal.id,
          eventType: 'proposal_created',
          title: `Proposal ${proposal_number} created`,
          description: `Status: ${newProposal.status || 'draft'}`
        });
      } else {
        console.warn(`[Server] Could not find client with ID ${client_id} for proposal email`);
      }
    } catch (err) {
      console.error('[Server] Failed to fetch client for proposal email:', err);
    }
  }

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
  await logActivity({
    actorId: req.user.id,
    clientId: updated.client_id,
    proposalId: updated.id,
    eventType: updated.status === 'accepted' ? 'proposal_accepted' : (updated.status === 'rejected' ? 'proposal_rejected' : 'proposal_updated'),
    title: `Proposal ${updated.proposal_number} ${updated.status || 'updated'}`,
    description: `Status: ${updated.status || 'draft'}`
  });
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




app.post('/api/projects/:id/links', authenticateToken, writeRateLimiter, async (req, res) => {
  const { id } = req.params;
  const { title, url } = req.body;
  if (!isNonEmptyString(title, 120) || !validateUrl(url)) return res.status(400).json({ error: 'Valid title and URL required' });

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
    title: title.trim(),
    url: url.trim(),
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

// ==================== NOTIFICATIONS ====================

const createNotification = async (userId, title, message, type, link = null) => {
  try {
    const { error } = await supabase.from('notifications').insert([{
      user_id: userId,
      title,
      message,
      type,
      link,
      created_at: new Date().toISOString()
    }]);
    if (error) console.error('[Notification] Error:', error.message);
  } catch (err) {
    console.error('[Notification] Critical Error:', err);
  }
};

app.get('/api/notifications', authenticateToken, async (req, res) => {
  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return res.status(500).json({ error: 'Failed to fetch notifications' });
  res.json(notifications);
});

app.put('/api/notifications/read-all', authenticateToken, async (req, res) => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', req.user.id)
    .eq('is_read', false);

  if (error) return res.status(500).json({ error: 'Failed to update notifications' });
  res.json({ message: 'All notifications marked as read' });
});

app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);

  if (error) return res.status(500).json({ error: 'Failed to mark notification as read' });
  res.json({ message: 'Notification marked as read' });
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err);
  if (req.originalUrl && req.originalUrl.startsWith('/api')) {
    return res.status(500).json({ error: 'Internal server error' });
  }
  next(err);
});

// ==================== ACTIVITY TIMELINE ====================

app.get('/api/projects/:id/activity', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { data: project } = await supabase.from('projects').select('id, client_id').eq('id', id).single();
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (req.user.role === 'client' && project.client_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });

  const { data, error } = await supabase
    .from('activity_logs')
    .select('*, users!activity_logs_actor_id_fkey(name, role)')
    .eq('project_id', id)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return res.status(500).json({ error: 'Failed to fetch project activity' });

  res.json((data || []).map(a => ({
    ...a,
    actor_name: a.users?.name || 'System',
    actor_role: a.users?.role || 'system',
    users: undefined
  })));
});

app.get('/api/clients/:id/activity', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*, users!activity_logs_actor_id_fkey(name, role)')
    .eq('client_id', id)
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) return res.status(500).json({ error: 'Failed to fetch client activity' });

  res.json((data || []).map(a => ({
    ...a,
    actor_name: a.users?.name || 'System',
    actor_role: a.users?.role || 'system',
    users: undefined
  })));
});

module.exports = app;
