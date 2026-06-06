/**
 * Auth controller — user registration, login, email verification,
 * password reset.
 */
const config = require('../config');
const { Users, EmailTokens, Holdings } = require('../models');
const { hashPassword, comparePassword, passwordPolicy } = require('../utils/password');
const { signToken, generateRandomToken } = require('../utils/tokens');
const { sendOk, sendCreated, HttpError } = require('../utils/http');
const { templates, sendMail, canSend } = require('../utils/email');

const USER_COOKIE = config.jwt.cookieName;

const setAuthCookie = (res, token) => {
  res.cookie(USER_COOKIE, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.isProduction ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

const safeUser = (u) => {
  if (!u) return null;
  const { password_hash, ...rest } = u;
  return rest;
};

const issueVerification = async (user) => {
  if (!canSend()) {
    console.warn('[auth] SMTP not configured — auto-verifying', user.email);
    await Users.setEmailVerified(user.id);
    return { sent: false, autoVerified: true };
  }
  const token = generateRandomToken(24);
  await EmailTokens.create({
    userId: user.id,
    token,
    type: 'verification',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
  const verifyUrl = `${config.appUrl}/api/auth/verify-email?token=${token}`;
  const t = templates.emailVerification({ name: user.full_name, verifyUrl });
  await sendMail({ to: user.email, ...t });
  return { sent: true, autoVerified: false };
};

module.exports = {
  /* ------------------------------------------------------------ */
  /*  POST /api/auth/register                                     */
  /* ------------------------------------------------------------ */
  async register(req, res) {
    const { email, password, fullName } = req.body;
    const policyErrors = passwordPolicy(password);
    if (policyErrors.length) throw new HttpError(400, policyErrors.join('. '));

    const existing = await Users.findByEmail(email);
    if (existing) throw new HttpError(409, 'An account with that email already exists');

    const passwordHash = await hashPassword(password);
    const user = await Users.create({ email, passwordHash, fullName, balance: 0 });

    let verification = { sent: false, autoVerified: false };
    try {
      verification = await issueVerification(user);
    } catch (e) {
      console.warn('[auth] verification email failed:', e.message);
    }

    if (canSend() && !verification.autoVerified) {
      try {
        const t = templates.welcome({ name: fullName });
        await sendMail({ to: user.email, ...t });
      } catch (e) {
        console.warn('[auth] welcome email failed:', e.message);
      }
    }

    // Seed a couple of demo holdings for a populated first impression.
    try {
      const demo = [
        { symbol: 'BTC',  asset_class: 'crypto', quantity: 0.15, avg_cost: 42000 },
        { symbol: 'ETH',  asset_class: 'crypto', quantity: 2.5,  avg_cost: 2400 },
        { symbol: 'AAPL', asset_class: 'stock',  quantity: 10,   avg_cost: 178.5 },
      ];
      for (const h of demo) {
        await Holdings.upsert({
          userId: user.id,
          symbol: h.symbol,
          assetClass: h.asset_class,
          quantity: h.quantity,
          avgCost: h.avg_cost,
        });
      }
    } catch (e) {
      console.warn('[auth] demo holdings seed failed:', e.message);
    }

    const message = verification.autoVerified
      ? 'Account created. You can log in now.'
      : 'Account created. Please check your email to verify your account.';

    return sendCreated(res, { user: safeUser(user), verification }, message);
  },

  /* ------------------------------------------------------------ */
  /*  POST /api/auth/login                                        */
  /* ------------------------------------------------------------ */
  async login(req, res) {
    const { email, password } = req.body;
    const user = await Users.findByEmail(email);
    if (!user) throw new HttpError(401, 'Invalid email or password');

    const ok = await comparePassword(password, user.password_hash);
    if (!ok) throw new HttpError(401, 'Invalid email or password');
    if (user.is_restricted) throw new HttpError(403, 'Your account has been restricted. Contact support.');

    if (!user.email_verified) {
      throw new HttpError(
        403,
        'Please verify your email before logging in. Check your inbox for the verification link.',
        { code: 'EMAIL_NOT_VERIFIED' }
      );
    }

    await Users.updateLastLogin(user.id);

    const token = signToken({ sub: user.id, email: user.email, role: 'user', tier: user.account_tier });
    setAuthCookie(res, token);

    return sendOk(res, { user: safeUser(user), token }, 'Logged in.');
  },

  /* ------------------------------------------------------------ */
  /*  POST /api/auth/logout                                       */
  /* ------------------------------------------------------------ */
  async logout(req, res) {
    res.clearCookie(USER_COOKIE);
    return sendOk(res, { loggedOut: true }, 'Logged out.');
  },

  /* ------------------------------------------------------------ */
  /*  GET /api/auth/verify-email?token=…                          */
  /* ------------------------------------------------------------ */
  async verifyEmail(req, res) {
    const token = String(req.query.token || '');
    if (!token) throw new HttpError(400, 'Missing token');
    const record = await EmailTokens.findValid(token, 'verification');
    if (!record) throw new HttpError(400, 'Invalid or already-used verification link');
    if (new Date(record.expires_at) < new Date()) throw new HttpError(400, 'Verification link expired');

    await Users.setEmailVerified(record.user_id);
    await EmailTokens.markUsed(record.id);

    res.redirect(`${config.clientUrl}/login.html?verified=1`);
  },

  /* ------------------------------------------------------------ */
  /*  POST /api/auth/resend-verification                          */
  /* ------------------------------------------------------------ */
  async resendVerification(req, res) {
    const { email } = req.body;
    const user = await Users.findByEmail(email);
    if (user && !user.email_verified) {
      try {
        await EmailTokens.invalidateAllForUser(user.id, 'verification');
        await issueVerification(user);
      } catch (e) {
        console.warn('[auth] resend failed:', e.message);
      }
    }
    return sendOk(
      res,
      null,
      'If your account exists and is unverified, a new verification email has been sent.'
    );
  },

  /* ------------------------------------------------------------ */
  /*  POST /api/auth/forgot-password                              */
  /* ------------------------------------------------------------ */
  async forgotPassword(req, res) {
    const { email } = req.body;
    const user = await Users.findByEmail(email);
    if (user && canSend()) {
      try {
        await EmailTokens.invalidateAllForUser(user.id, 'password_reset');
        const token = generateRandomToken(24);
        await EmailTokens.create({
          userId: user.id,
          token,
          type: 'password_reset',
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        });
        const resetUrl = `${config.appUrl}/reset-password.html?token=${token}`;
        const t = templates.passwordReset({ name: user.full_name, resetUrl });
        await sendMail({ to: user.email, ...t });
      } catch (e) {
        console.warn('[auth] reset email failed:', e.message);
      }
    }
    return sendOk(
      res,
      null,
      'If an account exists for that email, a reset link has been sent.'
    );
  },

  /* ------------------------------------------------------------ */
  /*  POST /api/auth/reset-password                               */
  /* ------------------------------------------------------------ */
  async resetPassword(req, res) {
    const { token, password } = req.body;
    const policyErrors = passwordPolicy(password);
    if (policyErrors.length) throw new HttpError(400, policyErrors.join('. '));

    const record = await EmailTokens.findValid(token, 'password_reset');
    if (!record) throw new HttpError(400, 'Invalid or already-used reset link');
    if (new Date(record.expires_at) < new Date()) throw new HttpError(400, 'Reset link expired');

    const passwordHash = await hashPassword(password);
    await Users.updatePassword(record.user_id, passwordHash);
    await EmailTokens.markUsed(record.id);
    await EmailTokens.invalidateAllForUser(record.user_id, 'password_reset');

    return sendOk(res, null, 'Password updated. You can now log in.');
  },
};
