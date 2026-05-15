const nodemailer = require('nodemailer');
const { supabase } = require('./database');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.hostinger.com',
  port: process.env.SMTP_PORT || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const BASE_URL = process.env.BASE_URL || 'https://proposal.webwynk.com';

// Helper to log emails in the database
const logEmail = async (recipient, subject, type, referenceId = null) => {
  try {
    // Regex to check if referenceId is a valid UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(referenceId));
    
    const { error } = await supabase.from('email_logs').insert([{
      recipient_email: recipient,
      subject: subject,
      email_type: type,
      reference_id: isUUID ? String(referenceId) : null,
      sent_at: new Date().toISOString()
    }]);
    if (error) {
      console.error('[Email Log] Supabase Error:', error.message, error.details);
    }
  } catch (error) {
    console.error('[Email Log] Critical Catch:', error);
  }
};

// Common Email Wrapper Styles
const emailStyles = `
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  line-height: 1.6;
  color: #333;
  max-width: 600px;
  margin: 0 auto;
  border: 1px solid #eee;
  border-radius: 8px;
  overflow: hidden;
`;

const headerStyles = (color = '#2563eb') => `
  background-color: ${color};
  padding: 30px;
  text-align: center;
  color: white;
`;

const buttonStyles = (color = '#2563eb') => `
  display: inline-block;
  padding: 12px 24px;
  background-color: ${color};
  color: #ffffff !important;
  text-decoration: none;
  border-radius: 6px;
  font-weight: bold;
  margin: 20px 0;
`;

const sendInvoiceEmail = async (clientEmail, invoice, clientName) => {
  try {
    const viewUrl = `${BASE_URL}/invoice.html?id=${invoice.id}&view=true`;
    const subject = `New Invoice from WebWynk: #${invoice.invoice_number}`;
    
    await transporter.sendMail({
      from: `"WebWynk" <${process.env.SMTP_USER}>`,
      to: clientEmail,
      subject: subject,
      html: `
        <div style="${emailStyles}">
          <div style="${headerStyles()}">
            <h1 style="margin:0;">WebWynk</h1>
          </div>
          <div style="padding: 30px;">
            <h2>Hello ${clientName},</h2>
            <p>A new invoice has been generated for your project. You can view the details and complete your payment using the link below.</p>
            <div style="background:#f3f4f6; padding:20px; border-radius:8px; margin:20px 0;">
              <p style="margin:5px 0;"><strong>Invoice #:</strong> ${invoice.invoice_number}</p>
              <p style="margin:5px 0;"><strong>Amount:</strong> ${invoice.currency} ${invoice.total_amount || ''}</p>
            </div>
            <center>
              <a href="${viewUrl}" style="${buttonStyles()}">View & Pay Invoice</a>
            </center>
            <p>Thank you for your business!</p>
          </div>
        </div>
      `,
    });
    await logEmail(clientEmail, subject, 'invoice', invoice.id);
  } catch (error) {
    console.error('Error sending invoice email:', error);
  }
};

const sendProposalEmail = async (clientEmail, proposal, clientName) => {
  console.log(`[Email] Attempting to send proposal email to ${clientEmail} for project: ${proposal.project_title}`);
  try {
    const viewUrl = `${BASE_URL}/proposal.html?id=${proposal.id}&view=true`;
    const subject = `Project Proposal from WebWynk: ${proposal.project_title}`;
    
    console.log(`[Email] View URL: ${viewUrl}`);

    await transporter.sendMail({
      from: `"WebWynk" <${process.env.SMTP_USER}>`,
      to: clientEmail,
      subject: subject,
      html: `
        <div style="${emailStyles}">
          <div style="${headerStyles('#10b981')}">
            <h1 style="margin:0;">WebWynk</h1>
          </div>
          <div style="padding: 30px;">
            <h2>Hello ${clientName},</h2>
            <p>We've prepared a detailed proposal for your project: <strong>${proposal.project_title}</strong>.</p>
            <p>Please review the proposal and let us know if you have any questions or would like to move forward.</p>
            <center>
              <a href="${viewUrl}" style="${buttonStyles('#10b981')}">Review Proposal</a>
            </center>
            <p>We look forward to working with you!</p>
          </div>
        </div>
      `,
    });
    console.log(`[Email] Proposal email sent successfully to ${clientEmail}`);
    await logEmail(clientEmail, subject, 'proposal', proposal.id);
  } catch (error) {
    console.error('[Email] Error sending proposal email:', error);
  }
};

const sendProjectUpdateEmail = async (clientEmail, project, clientName, updateContent = null) => {
  try {
    const statusLabel = project.status.charAt(0).toUpperCase() + project.status.slice(1);
    const subject = `Project Update: ${project.name} is now in ${statusLabel}`;
    
    await transporter.sendMail({
      from: `"WebWynk" <${process.env.SMTP_USER}>`,
      to: clientEmail,
      subject: subject,
      html: `
        <div style="${emailStyles}">
          <div style="${headerStyles('#6366f1')}">
            <h1 style="margin:0;">WebWynk</h1>
          </div>
          <div style="padding: 30px;">
            <h2>Hello ${clientName},</h2>
            <p>Your project <strong>"${project.name}"</strong> has a new update.</p>
            <div style="background:#f3f4f6; padding:20px; border-radius:8px; margin:20px 0;">
              <p><strong>Status:</strong> ${statusLabel}</p>
              ${updateContent ? `<p><strong>Latest Update:</strong> ${updateContent}</p>` : ''}
            </div>
            <center>
              <a href="${BASE_URL}/client.html" style="${buttonStyles('#6366f1')}">Track Progress</a>
            </center>
          </div>
        </div>
      `,
    });
    await logEmail(clientEmail, subject, 'project', project.id);
  } catch (error) {
    console.error('Error sending project update email:', error);
  }
};

const sendMilestoneEmail = async (clientEmail, project, clientName, milestoneName, isCompleted = false) => {
  try {
    const subject = isCompleted ? `Milestone Completed! 🎉 - ${milestoneName}` : `New Milestone Added - ${milestoneName}`;
    
    await transporter.sendMail({
      from: `"WebWynk" <${process.env.SMTP_USER}>`,
      to: clientEmail,
      subject: subject,
      html: `
        <div style="${emailStyles}">
          <div style="${headerStyles('#f59e0b')}">
            <h1 style="margin:0;">WebWynk</h1>
          </div>
          <div style="padding: 30px;">
            <h2>Hello ${clientName},</h2>
            <p>${isCompleted ? 'Great news! A milestone has been completed' : 'A new milestone has been added'} to your project <strong>"${project.name}"</strong>.</p>
            <div style="background:#fef3c7; border-left:4px solid #f59e0b; padding:15px; margin:20px 0;">
              <p style="margin:0;"><strong>Milestone:</strong> ${milestoneName}</p>
              <p style="margin:5px 0 0 0;"><strong>Status:</strong> ${isCompleted ? 'Completed' : 'Planned'}</p>
            </div>
            <center>
              <a href="${BASE_URL}/client.html" style="${buttonStyles('#f59e0b')}">View Dashboard</a>
            </center>
          </div>
        </div>
      `,
    });
    await logEmail(clientEmail, subject, 'milestone', project.id);
  } catch (error) {
    console.error('Error sending milestone email:', error);
  }
};

module.exports = {
  sendInvoiceEmail,
  sendProposalEmail,
  sendProjectUpdateEmail,
  sendMilestoneEmail
};
