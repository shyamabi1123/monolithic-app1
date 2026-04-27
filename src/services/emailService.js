const nodemailer = require('nodemailer');
const logger = require('../config/logger');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
  port: parseInt(process.env.SMTP_PORT || 2525),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendEmail({ to, subject, html, text }) {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@app.com',
      to,
      subject,
      html,
      text
    });
    logger.info(`Email sent: ${info.messageId}`);
    return info;
  } catch (err) {
    logger.error('Email send failed:', err);
    throw err;
  }
}

async function sendWelcomeEmail(user) {
  return sendEmail({
    to: user.email,
    subject: 'Welcome to MonolithApp!',
    html: `<h1>Hi ${user.name}!</h1><p>Thanks for registering. Your account is ready.</p>`,
    text: `Hi ${user.name}! Thanks for registering.`
  });
}

async function sendOrderConfirmation(user, order) {
  return sendEmail({
    to: user.email,
    subject: `Order #${order.id.slice(0, 8).toUpperCase()} confirmed`,
    html: `<h2>Order Confirmed</h2><p>Total: $${(order.total / 100).toFixed(2)}</p>`,
    text: `Order confirmed. Total: $${(order.total / 100).toFixed(2)}`
  });
}

module.exports = { sendEmail, sendWelcomeEmail, sendOrderConfirmation };
