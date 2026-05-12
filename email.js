const nodemailer = require('nodemailer');

// Use environment variables or placeholders for Hostinger SMTP
// Typical Hostinger SMTP: smtp.hostinger.com, port 465 or 587
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.hostinger.com',
  port: process.env.SMTP_PORT || 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || 'contact@webwynk.com', // Replace with your actual email
    pass: process.env.SMTP_PASS || 'your_email_password',  // Replace with your actual password
  },
});

const sendInvoiceEmail = async (clientEmail, invoice, clientName) => {
  try {
    const info = await transporter.sendMail({
      from: `"WebWynk" <${process.env.SMTP_USER || 'contact@webwynk.com'}>`,
      to: clientEmail,
      subject: `New Invoice from WebWynk: #${invoice.invoice_number}`,
      text: `Hello ${clientName},\n\nYou have a new invoice (#${invoice.invoice_number}) from WebWynk.\nPlease log in to your client dashboard to view and download it.\n\nThank you,\nWebWynk Team`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2>Hello ${clientName},</h2>
          <p>You have a new invoice (<strong>#${invoice.invoice_number}</strong>) from WebWynk.</p>
          <p>Please log in to your <a href="http://localhost:3000/client.html">client dashboard</a> to view the details.</p>
          <br>
          <p>Thank you,<br><strong>WebWynk Team</strong></p>
        </div>
      `,
    });
    console.log('Invoice email sent: %s', info.messageId);
  } catch (error) {
    console.error('Error sending invoice email:', error);
  }
};

const sendProjectUpdateEmail = async (clientEmail, project, clientName, updateContent = null) => {
  try {
    const statusLabel = project.status.charAt(0).toUpperCase() + project.status.slice(1);
    const contentHtml = updateContent ? `<p><strong>Latest Update:</strong> ${updateContent}</p>` : '';
    const contentText = updateContent ? `Latest Update: ${updateContent}\n\n` : '';

    const info = await transporter.sendMail({
      from: `"WebWynk" <${process.env.SMTP_USER || 'contact@webwynk.com'}>`,
      to: clientEmail,
      subject: `Project Update: ${project.name} is now in ${statusLabel}`,
      text: `Hello ${clientName},\n\nYour project "${project.name}" has been updated. Current status: ${statusLabel}.\n\n${contentText}Please log in to your client dashboard to view more details.\n\nThank you,\nWebWynk Team`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2>Hello ${clientName},</h2>
          <p>Your project <strong>"${project.name}"</strong> has been updated.</p>
          <p><strong>Current Status:</strong> ${statusLabel}</p>
          ${contentHtml}
          <p>Please log in to your <a href="http://localhost:3000/client.html">client dashboard</a> to view the full progress.</p>
          <br>
          <p>Thank you,<br><strong>WebWynk Team</strong></p>
        </div>
      `,
    });
    console.log('Project update email sent: %s', info.messageId);
  } catch (error) {
    console.error('Error sending project update email:', error);
  }
};

module.exports = {
  sendInvoiceEmail,
  sendProjectUpdateEmail
};
