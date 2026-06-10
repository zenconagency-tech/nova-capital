/**
 * Admin controller — full admin panel: auth, user mgmt,
 * withdrawal mgmt, site settings, account settings.
 */
const config = require('../config');
const { Admin, Users, Withdrawals, SiteSettings, Deposits, InvestmentPlans, UserInvestments } = require('../models');
const { hashPassword, comparePassword, passwordPolicy } = require('../utils/password');
const { signAdminToken } = require('../utils/tokens');
const { sendOk, sendCreated, HttpError } = require('../utils/http');
const { invalidateMaintenanceCache } = require('../middleware/maintenance');

const ADMIN_COOKIE = config.jwt.adminCookieName;
const VALID_TIERS = new Set(['free', 'pro', 'elite']);
const WITHDRAWAL_STATUSES = new Set(['pending', 'approved', 'on_hold', 'rejected', 'restored']);
const WITHDRAWAL_ACTIONS = new Set(['approve', 'reject', 'on_hold', 'restore']);

const setAdminCookie = (res, token) => {
  res.cookie(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.isProduction ? 'strict' : 'lax',
    maxAge: 24 * 60 * 60 * 1000,  // 24h
  });
};

const safeAdmin = (a) => {
  if (!a) return null;
  const { password_hash, ...rest } = a;
  return rest;
};

const isAdminBypass = (path) => path.startsWith('/api/admin/') || path === '/api/auth/login' || path === '/api/auth/register';

module.exports = {
  /* ============================================================
   *                       AUTH
   * ============================================================ */

  /* POST /api/admin/login */
  async login(req, res) {
    const { username, password } = req.body;
    const admin = await Admin.findByUsername(username);
    if (!admin) throw new HttpError(401, 'Invalid admin credentials');
    const ok = await comparePassword(password, admin.password_hash);
    if (!ok) throw new HttpError(401, 'Invalid admin credentials');

    const token = signAdminToken({ sub: admin.id, username: admin.username, role: 'admin' });
    setAdminCookie(res, token);
    return sendOk(res, { admin: safeAdmin(admin), token }, 'Signed in.');
  },

  /* POST /api/admin/logout */
  async logout(req, res) {
    res.clearCookie(ADMIN_COOKIE);
    return sendOk(res, { loggedOut: true }, 'Signed out.');
  },

  /* GET /api/admin/me */
  async me(req, res) {
    return sendOk(res, { admin: req.admin });
  },

  /* POST /api/admin/change-password */
  async changePassword(req, res) {
    const { currentPassword, newPassword } = req.body;
    const admin = await Admin.findByIdWithSecrets(req.admin.id);
    if (!admin) throw new HttpError(404, 'Admin not found');

    const ok = await comparePassword(currentPassword, admin.password_hash);
    if (!ok) throw new HttpError(400, 'Current password is incorrect');

    const policyErrors = passwordPolicy(newPassword);
    if (policyErrors.length) throw new HttpError(400, policyErrors.join('. '));

    const passwordHash = await hashPassword(newPassword);
    await Admin.updatePassword(admin.id, passwordHash);
    return sendOk(res, null, 'Admin password updated.');
  },

  /* ============================================================
   *                       OVERVIEW
   * ============================================================ */

  /* GET /api/admin/stats */
  async stats(req, res) {
    const [usersCount, verifiedCount, totalBalance, totalWithdrawals, pending, approved, rejected, onHold, restored, depPending, depApproved, depRejected] =
      await Promise.all([
        Users.countAll(),
        Users.countVerified(),
        Users.sumBalance(),
        Withdrawals.countAll(),
        Withdrawals.countByStatus('pending'),
        Withdrawals.countByStatus('approved'),
        Withdrawals.countByStatus('rejected'),
        Withdrawals.countByStatus('on_hold'),
        Withdrawals.countByStatus('restored'),
        Deposits.countByStatus('pending'),
        Deposits.countByStatus('approved'),
        Deposits.countByStatus('rejected'),
      ]);
    return sendOk(res, {
      stats: {
        usersCount,
        verifiedCount,
        totalBalance: Math.round(totalBalance * 100) / 100,
        withdrawals: { total: totalWithdrawals, pending, approved, rejected, on_hold: onHold, restored },
        deposits: { pending: depPending, approved: depApproved, rejected: depRejected },
      },
    });
  },

  /* GET /api/admin/investments */
  async listInvestments(req, res) {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const status = req.query.status && ['active','completed','cancelled'].includes(req.query.status) ? req.query.status : null;
    const search = String(req.query.search || '').trim();
    const list = await UserInvestments.listAll({ limit, status, search });
    return sendOk(res, { investments: list });
  },

  /* GET /api/admin/users/:id/investments */
  async getUserInvestments(req, res) {
    const user = await Users.findById(req.params.id);
    if (!user) throw new HttpError(404, 'User not found');
    const list = await UserInvestments.listByUser(req.params.id);
    return sendOk(res, { user, investments: list });
  },

  /* ============================================================
   *                       USERS
   * ============================================================ */

  /* GET /api/admin/users */
  async listUsers(req, res) {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const search = String(req.query.search || '').trim();
    const tier = req.query.tier && VALID_TIERS.has(req.query.tier) ? req.query.tier : '';
    const restricted = ['true', 'false'].includes(req.query.restricted) ? req.query.restricted : '';
    const [list, total] = await Promise.all([
      Users.listAll({ limit, offset, search, tier, restricted }),
      Users.countAll(),
    ]);
    return sendOk(res, { users: list, total });
  },

  /* GET /api/admin/users/:id */
  async getUser(req, res) {
    const user = await Users.findById(req.params.id);
    if (!user) throw new HttpError(404, 'User not found');
    return sendOk(res, { user });
  },

  /* GET /api/admin/users/:id/withdrawals */
  async getUserWithdrawals(req, res) {
    const user = await Users.findById(req.params.id);
    if (!user) throw new HttpError(404, 'User not found');
    const list = await Withdrawals.listByUser(req.params.id, 200);
    return sendOk(res, { user, withdrawals: list });
  },

  /* PATCH /api/admin/users/:id */
  async editUser(req, res) {
    const { fullName, email, balance, accountTier } = req.body;
    if (accountTier && !VALID_TIERS.has(accountTier)) {
      throw new HttpError(400, 'Invalid account tier');
    }
    if (balance !== undefined && (Number.isNaN(Number(balance)) || Number(balance) < 0)) {
      throw new HttpError(400, 'Balance must be a non-negative number');
    }
    const user = await Users.findById(req.params.id);
    if (!user) throw new HttpError(404, 'User not found');
    const updated = await Users.adminEdit(req.params.id, {
      fullName,
      email,
      balance: balance !== undefined ? Math.round(Number(balance) * 100) / 100 : undefined,
      accountTier,
    });
    return sendOk(res, { user: updated }, 'User updated.');
  },

  /* PATCH /api/admin/users/:id/balance */
  async setBalance(req, res) {
    const { balance } = req.body;
    if (Number.isNaN(Number(balance)) || Number(balance) < 0) {
      throw new HttpError(400, 'Balance must be a non-negative number');
    }
    const user = await Users.findById(req.params.id);
    if (!user) throw new HttpError(404, 'User not found');
    await Users.adminSetBalance(req.params.id, Math.round(Number(balance) * 100) / 100);
    const fresh = await Users.findById(req.params.id);
    return sendOk(res, { user: fresh }, 'Balance updated.');
  },

  /* PATCH /api/admin/users/:id/verify */
  async verifyUser(req, res) {
    const user = await Users.findById(req.params.id);
    if (!user) throw new HttpError(404, 'User not found');
    await Users.adminVerify(req.params.id);
    const fresh = await Users.findById(req.params.id);
    return sendOk(res, { user: fresh }, 'User manually verified.');
  },

  /* PATCH /api/admin/users/:id/tier */
  async setTier(req, res) {
    const { tier } = req.body;
    if (!VALID_TIERS.has(tier)) throw new HttpError(400, 'Invalid tier');
    const user = await Users.findById(req.params.id);
    if (!user) throw new HttpError(404, 'User not found');
    await Users.adminSetTier(req.params.id, tier);
    const fresh = await Users.findById(req.params.id);
    return sendOk(res, { user: fresh }, 'Tier updated.');
  },

  /* PATCH /api/admin/users/:id/restrict */
  async setRestricted(req, res) {
    const { restricted } = req.body;
    const user = await Users.findById(req.params.id);
    if (!user) throw new HttpError(404, 'User not found');
    await Users.adminSetRestricted(req.params.id, !!restricted);
    const fresh = await Users.findById(req.params.id);
    return sendOk(res, { user: fresh }, restricted ? 'User restricted.' : 'User restored.');
  },

  /* DELETE /api/admin/users/:id */
  async deleteUser(req, res) {
    const user = await Users.findById(req.params.id);
    if (!user) throw new HttpError(404, 'User not found');
    await Users.delete(req.params.id);
    return sendOk(res, { deleted: true, id: req.params.id }, 'User deleted.');
  },

  /* ============================================================
   *                       WITHDRAWALS
   * ============================================================ */

  /* GET /api/admin/withdrawals */
  async listWithdrawals(req, res) {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const status = req.query.status && WITHDRAWAL_STATUSES.has(req.query.status) ? req.query.status : null;
    const search = String(req.query.search || '').trim();
    const list = await Withdrawals.listAll({ limit, status, search });
    return sendOk(res, { withdrawals: list });
  },

  /* PATCH /api/admin/withdrawals/:id */
  async updateWithdrawal(req, res) {
    const { action, notes } = req.body;
    if (!WITHDRAWAL_ACTIONS.has(action)) {
      throw new HttpError(400, 'Invalid action. Use approve | reject | on_hold | restore.');
    }
    const wd = await Withdrawals.findById(req.params.id);
    if (!wd) throw new HttpError(404, 'Withdrawal not found');

    const prev = wd.status;
    const amount = Number(wd.amount);

    // Apply balance side-effects on the appropriate transitions.
    if (action === 'approve' && prev !== 'approved') {
      const user = await Users.findById(wd.user_id);
      if (!user) throw new HttpError(404, 'Owner not found');
      const newBalance = Math.max(0, Number(user.balance) - amount);
      await Users.adminSetBalance(user.id, Math.round(newBalance * 100) / 100);
    } else if (action === 'restore') {
      // restore = move on_hold back to pending. No balance change.
    } else if (action === 'approve' && prev === 'restored') {
      // Allow re-approving after a previous restore (refund was undone).
      const user = await Users.findById(wd.user_id);
      if (!user) throw new HttpError(404, 'Owner not found');
      const newBalance = Math.max(0, Number(user.balance) - amount);
      await Users.adminSetBalance(user.id, Math.round(newBalance * 100) / 100);
    }

    let newStatus;
    if (action === 'approve')  newStatus = 'approved';
    if (action === 'reject')   newStatus = 'rejected';
    if (action === 'on_hold')  newStatus = 'on_hold';
    if (action === 'restore')  newStatus = 'pending';

    const updated = await Withdrawals.setStatus(wd.id, newStatus, notes || null);
    const user = await Users.findById(wd.user_id);
    return sendOk(res, { withdrawal: updated, user }, `Withdrawal ${newStatus}.`);
  },

  /* ============================================================
   *                       SITE SETTINGS
   * ============================================================ */

  /* GET /api/admin/site-settings */
  async getSiteSettings(req, res) {
    const all = await SiteSettings.getAll();
    return sendOk(res, { settings: all });
  },

  /* PATCH /api/admin/site-settings */
  async updateSiteSettings(req, res) {
    const allowed = ['maintenance_mode', 'hero_headline', 'hero_subtext', 'market_categories', 'pricing_plans', 'deposit_wallets', 'investment_roi'];
    const update = {};
    for (const k of allowed) {
      if (k in req.body) update[k] = req.body[k];
    }
    if (Object.keys(update).length === 0) {
      throw new HttpError(400, 'No valid settings supplied');
    }
    const all = await SiteSettings.setMany(update);
    if ('maintenance_mode' in update) invalidateMaintenanceCache();
    return sendOk(res, { settings: all }, 'Settings updated.');
  },

  /* POST /api/admin/site-settings/maintenance */
  async toggleMaintenance(req, res) {
    const { enabled } = req.body;
    await SiteSettings.set('maintenance_mode', !!enabled);
    invalidateMaintenanceCache();
    return sendOk(res, { maintenance_mode: !!enabled }, enabled ? 'Maintenance enabled.' : 'Maintenance disabled.');
  },

  /* ============================================================
   *                       DEPOSITS (admin)
   * ============================================================ */

  /* GET /api/admin/deposits */
  async listDeposits(req, res) {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const status = req.query.status && ['pending','approved','rejected'].includes(req.query.status) ? req.query.status : null;
    const search = String(req.query.search || '').trim();
    const list = await Deposits.listAll({ limit, status, search });
    return sendOk(res, { deposits: list });
  },

  /* PATCH /api/admin/deposits/:id */
  async updateDeposit(req, res) {
    const { action } = req.body;
    if (!['approve','reject'].includes(action)) {
      throw new HttpError(400, 'Invalid action. Use approve | reject.');
    }
    const dep = await Deposits.findById(req.params.id);
    if (!dep) throw new HttpError(404, 'Deposit not found');
    if (dep.status !== 'pending') throw new HttpError(400, 'Only pending deposits can be updated');

    let newStatus;
    if (action === 'approve') {
      newStatus = 'approved';
      const { Users } = require('../models');
      const user = await Users.findById(dep.user_id);
      if (!user) throw new HttpError(404, 'Owner not found');
      const newBalance = Math.round((Number(user.balance) + Number(dep.amount)) * 100) / 100;
      await Users.adminSetBalance(user.id, newBalance);
    }
    if (action === 'reject') newStatus = 'rejected';

    const updated = await Deposits.setStatus(dep.id, newStatus, req.body.notes || null);
    return sendOk(res, { deposit: updated }, `Deposit ${newStatus}.`);
  },

  /* ============================================================
   *                  INVESTMENT PLANS (admin)
   * ============================================================ */

  /* GET /api/admin/investment-plans */
  async listInvestmentPlans(req, res) {
    const plans = await InvestmentPlans.listAll();
    return sendOk(res, { plans });
  },

  /* POST /api/admin/investment-plans */
  async createInvestmentPlan(req, res) {
    const { name, minAmount, maxAmount, dailyRoi, durationDays, features, isActive } = req.body;
    if (!name || !name.trim()) throw new HttpError(400, 'Plan name is required');
    if (!Number.isFinite(Number(minAmount)) || Number(minAmount) <= 0) throw new HttpError(400, 'Min amount must be > 0');
    if (!Number.isFinite(Number(dailyRoi)) || Number(dailyRoi) <= 0) throw new HttpError(400, 'Daily ROI must be > 0');
    if (!Number.isFinite(Number(durationDays)) || Number(durationDays) <= 0) throw new HttpError(400, 'Duration must be > 0');
    const plan = await InvestmentPlans.create({
      name: name.trim(),
      minAmount: Number(minAmount),
      maxAmount: maxAmount ? Number(maxAmount) : null,
      dailyRoi: Number(dailyRoi),
      durationDays: Number(durationDays),
      features: Array.isArray(features) ? features : [],
      isActive: isActive !== false,
    });
    return sendCreated(res, { plan }, 'Plan created.');
  },

  /* PATCH /api/admin/investment-plans/:id */
  async updateInvestmentPlan(req, res) {
    const existing = await InvestmentPlans.findById(req.params.id);
    if (!existing) throw new HttpError(404, 'Plan not found');
    const plan = await InvestmentPlans.update(req.params.id, req.body);
    return sendOk(res, { plan }, 'Plan updated.');
  },

  /* PATCH /api/admin/investment-plans/:id/toggle */
  async toggleInvestmentPlan(req, res) {
    const existing = await InvestmentPlans.findById(req.params.id);
    if (!existing) throw new HttpError(404, 'Plan not found');
    await InvestmentPlans.toggleActive(req.params.id, !existing.is_active);
    const fresh = await InvestmentPlans.findById(req.params.id);
    return sendOk(res, { plan: fresh }, fresh.is_active ? 'Plan activated.' : 'Plan deactivated.');
  },

  /* DELETE /api/admin/investment-plans/:id */
  async deleteInvestmentPlan(req, res) {
    const existing = await InvestmentPlans.findById(req.params.id);
    if (!existing) throw new HttpError(404, 'Plan not found');
    await InvestmentPlans.delete(req.params.id);
    return sendOk(res, { deleted: true }, 'Plan deleted.');
  },
};
