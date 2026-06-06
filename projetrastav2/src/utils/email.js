const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;
  if (!config.smtp.host || !config.smtp.user || !config.smtp.pass) {
    return null;
  }
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });
  return transporter;
};

const canSend = () => Boolean(getTransporter());

const sendMail = async ({ to, subject, html, text }) => {
  const t = getTransporter();
  if (!t) {
    console.warn('[email] SMTP not configured. Skipping send of:', subject);
    return { skipped: true };
  }
  const info = await t.sendMail({
    from: config.smtp.from,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]+>/g, ''),
  });
  return { messageId: info.messageId, accepted: info.accepted };
};

const templates = {
  welcome({ name }) {
    return {
      subject: `Welcome to ${config.appName}`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;background:#0A0B0E;color:#E6E8EC;padding:32px;">
          <h1 style="color:#00D4FF;margin:0 0 16px;">Welcome aboard, ${name || 'trader'} 🚀</h1>
          <p>Your ${config.appName} account is ready. Markets never sleep — and neither do we.</p>
          <p style="margin:24px 0;">
            <a href="${config.appUrl}/dashboard"
               style="background:#00D4FF;color:#00111A;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
              Open your dashboard →
            </a>
          </p>
          <p style="color:#7B8597;font-size:12px;">If you didn't create this account, please ignore this email.</p>
        </div>`,
    };
  },

  passwordReset({ name, resetUrl }) {
    return {
      subject: `Reset your ${config.appName} password`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;background:#0A0B0E;color:#E6E8EC;padding:32px;">
          <h1 style="color:#00D4FF;margin:0 0 16px;">Password reset</h1>
          <p>Hi ${name || 'there'},</p>
          <p>We received a request to reset your ${config.appName} password. Click the button below to choose a new one. The link expires in 1 hour.</p>
          <p style="margin:24px 0;">
            <a href="${resetUrl}"
               style="background:#00D4FF;color:#00111A;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
              Reset password →
            </a>
          </p>
          <p style="color:#7B8597;font-size:12px;">If you didn't request this, you can safely ignore the email.</p>
        </div>`,
    };
  },

  emailVerification({ name, verifyUrl }) {
    return {
      subject: `Verify your ${config.appName} email`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;background:#0A0B0E;color:#E6E8EC;padding:32px;">
          <h1 style="color:#00D4FF;margin:0 0 16px;">Confirm your email</h1>
          <p>Hi ${name || 'there'},</p>
          <p>Click the button below to verify your email and unlock all ${config.appName} features.</p>
          <p style="margin:24px 0;">
            <a href="${verifyUrl}"
               style="background:#00D4FF;color:#00111A;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
              Verify email →
            </a>
          </p>
        </div>`,
    };
  },
};

module.exports = { sendMail, templates, canSend };
