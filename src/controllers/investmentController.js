const { InvestmentPlans, UserInvestments, SiteSettings, Users } = require('../models');
const { sendOk, sendCreated, HttpError } = require('../utils/http');

const DEFAULT_ROI = { 30: 5, 60: 12, 90: 22, 180: 40, 365: 60 };

async function getRoiRates() {
  const stored = await SiteSettings.get('investment_roi', DEFAULT_ROI);
  if (stored && typeof stored === 'object') return stored;
  return DEFAULT_ROI;
}

module.exports = {
  async listPlans(req, res) {
    const plans = await InvestmentPlans.listAll();
    return sendOk(res, { plans: plans.filter((p) => p.is_active) });
  },

  async listMyInvestments(req, res) {
    const list = await UserInvestments.listByUserWithPlan(req.user.id);
    return sendOk(res, { investments: list });
  },

  async create(req, res) {
    const { planId, assetLabel, amount, durationDays } = req.body;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      throw new HttpError(400, 'Amount must be greater than 0');
    }
    if (!assetLabel) {
      throw new HttpError(400, 'Asset label is required');
    }
    if (!durationDays || ![30, 60, 90, 180, 365].includes(Number(durationDays))) {
      throw new HttpError(400, 'Invalid duration');
    }

    const user = await Users.findByIdWithSecrets(req.user.id);
    if (!user) throw new HttpError(404, 'User not found');
    if (Number(user.balance) < amt) {
      throw new HttpError(400, 'Insufficient balance');
    }

    if (planId) {
      const plan = await InvestmentPlans.findById(planId);
      if (!plan) throw new HttpError(400, 'Investment plan not found');
      if (!plan.is_active) throw new HttpError(400, 'Investment plan is not active');
      if (amt < Number(plan.min_amount)) {
        throw new HttpError(400, `Minimum investment for this plan is $${Number(plan.min_amount).toLocaleString()}`);
      }
      if (plan.max_amount && amt > Number(plan.max_amount)) {
        throw new HttpError(400, `Maximum investment for this plan is $${Number(plan.max_amount).toLocaleString()}`);
      }
    }

    const roiRates = await getRoiRates();
    const rate = Number(roiRates[String(durationDays)]) || Number(DEFAULT_ROI[String(durationDays)]) || 5;
    const expectedReturn = Math.round(amt * (rate / 100) * 100) / 100;

    const newBalance = Math.round((Number(user.balance) - amt) * 100) / 100;
    await Users.adminSetBalance(user.id, newBalance);

    const inv = await UserInvestments.create({
      userId: req.user.id,
      planId: planId || null,
      assetLabel,
      amount: amt,
      durationDays: Number(durationDays),
      expectedReturn,
    });
    return sendCreated(res, { investment: inv }, 'Investment confirmed. Amount deducted from your balance.');
  },

  async cancel(req, res) {
    const inv = await UserInvestments.findById(req.params.id);
    if (!inv) throw new HttpError(404, 'Investment not found');
    if (inv.user_id !== req.user.id) throw new HttpError(403, 'Not your investment');
    if (inv.status !== 'active') throw new HttpError(400, 'Only active investments can be cancelled');

    await UserInvestments.cancel(inv.id);
    const user = await Users.findByIdWithSecrets(req.user.id);
    const refundBalance = Math.round((Number(user.balance) + Number(inv.amount)) * 100) / 100;
    await Users.adminSetBalance(user.id, refundBalance);

    const fresh = await UserInvestments.findById(inv.id);
    return sendOk(res, { investment: fresh }, 'Investment cancelled. Amount refunded to your balance.');
  },

  async getRoiRates(req, res) {
    const rates = await getRoiRates();
    return sendOk(res, { rates });
  },
};
