const { Deposits, SiteSettings, Users } = require('../models');
const { sendOk, sendCreated, HttpError } = require('../utils/http');
const { sendMail } = require('../utils/email');
const config = require('../config');

const DEPOSIT_METHODS = new Set(['bitcoin', 'ethereum', 'usdt', 'paypal', 'payoneer', 'gift_card']);

const methodLabels = {
  bitcoin: 'Bitcoin', ethereum: 'Ethereum', usdt: 'USDT (Tether)',
  paypal: 'PayPal', payoneer: 'Payoneer', gift_card: 'Gift Card',
};

module.exports = {
  async list(req, res) {
    const list = await Deposits.listByUser(req.user.id, 100);
    return sendOk(res, { deposits: list });
  },

  async create(req, res) {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new HttpError(400, 'Amount must be greater than 0');
    }
    const method = req.body.method;
    if (!method || !DEPOSIT_METHODS.has(method)) {
      throw new HttpError(400, 'Invalid deposit method');
    }
    const rounded = Math.round(amount * 100) / 100;

    const wallets = await SiteSettings.get('deposit_wallets', {});
    const user = await Users.findById(req.user.id);

    let methodMeta = req.body.methodMeta || {};
    methodMeta.displayAddress = null;

    const isCrypto = ['bitcoin', 'ethereum', 'usdt'].includes(method);
    const isFiat = ['paypal', 'payoneer'].includes(method);

    if (isCrypto) {
      const addr = wallets[method];
      if (addr) {
        methodMeta.wallet = addr;
        methodMeta.displayAddress = addr;
      }
    } else if (isFiat) {
      const emailKey = method + '_email';
      const payEmail = wallets[emailKey];
      if (payEmail) methodMeta.email = payEmail;
    }

    const dep = await Deposits.create({
      userId: req.user.id,
      amount: rounded,
      method,
      methodMeta,
      notes: req.body.notes || null,
    });

    const methodName = methodLabels[method] || method;
    const userEmail = user?.email || '';

    if (userEmail) {
      const emailHtml = buildDepositEmail({
        name: user.full_name || 'Trader',
        method: methodName,
        amount: rounded,
        methodMeta,
        isCrypto,
        isFiat,
        isGiftCard: method === 'gift_card',
      });
      try {
        await sendMail({
          to: userEmail,
          subject: `Deposit Instructions — ${config.appName}`,
          html: emailHtml,
        });
      } catch (e) {
        console.warn('[deposit] failed to send email:', e.message);
      }
    }

    return sendCreated(res, { deposit: dep }, 'Deposit request submitted. Check your email for payment instructions.');
  },
};

function buildDepositEmail({ name, method, amount, methodMeta, isCrypto, isFiat, isGiftCard }) {
  let instructions = '';
  if (isCrypto && methodMeta.wallet) {
    instructions = `
      <p>Send <strong>$${amount.toFixed(2)}</strong> worth of <strong>${method}</strong> to the following wallet address:</p>
      <div style="background:#111318;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:14px;margin:16px 0;font-family:monospace;font-size:13px;word-break:break-all;color:#E6E8EC;">
        ${methodMeta.wallet}
      </div>
      <p style="color:#7B8597;font-size:12px;">Once the network confirms the transaction, your deposit will be credited after admin approval.</p>`;
  } else if (isFiat && methodMeta.email) {
    instructions = `
      <p>Send <strong>$${amount.toFixed(2)}</strong> via <strong>${method}</strong> to:</p>
      <div style="background:#111318;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:14px;margin:16px 0;font-family:monospace;font-size:13px;color:#E6E8EC;">
        ${methodMeta.email}
      </div>
      <p style="color:#7B8597;font-size:12px;">After sending, reply to this email with your transaction reference ID so we can verify your payment.</p>`;
  } else if (isGiftCard) {
    instructions = `
      <p>We received your gift card deposit request for <strong>$${amount.toFixed(2)}</strong>. Our team will review the card details and credit your account upon approval.</p>
      <p style="color:#7B8597;font-size:12px;">You will receive a confirmation email once the deposit is processed.</p>`;
  } else {
    instructions = `<p>Your deposit request for <strong>$${amount.toFixed(2)}</strong> via <strong>${method}</strong> has been received. We will notify you once it is processed.</p>`;
  }

  return `
    <div style="font-family:Inter,Arial,sans-serif;background:#0A0B0E;color:#E6E8EC;padding:32px;">
      <h1 style="color:#00D4FF;margin:0 0 8px;">Deposit Instructions</h1>
      <p style="color:#A6ADBB;">Hi ${name},</p>
      <p style="color:#A6ADBB;">Thank you for your deposit request.</p>
      ${instructions}
      <p style="margin-top:24px;color:#7B8597;font-size:12px;">
        If you have any questions, contact our support team.
      </p>
      <hr style="border-color:rgba(255,255,255,0.06);margin:24px 0;" />
      <p style="color:#7B8597;font-size:11px;">${config.appName} · ${config.appUrl}</p>
    </div>`;
}
