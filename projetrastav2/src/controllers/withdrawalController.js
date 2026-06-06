/**
 * Withdrawal controller — user-facing endpoints.
 */
const { Withdrawals } = require('../models');
const { sendOk, sendCreated, HttpError } = require('../utils/http');

const WITHDRAW_METHODS = new Set(['bank_transfer', 'crypto', 'paypal', 'other']);

module.exports = {
  /* ------------------------------------------------------------ */
  /*  GET /api/withdrawals                                        */
  /* ------------------------------------------------------------ */
  async list(req, res) {
    const list = await Withdrawals.listByUser(req.user.id, 100);
    return sendOk(res, { withdrawals: list });
  },

  /* ------------------------------------------------------------ */
  /*  POST /api/withdrawals                                       */
  /* ------------------------------------------------------------ */
  async create(req, res) {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new HttpError(400, 'Amount must be greater than 0');
    }
    if (amount > Number(req.user.balance)) {
      throw new HttpError(400, 'Insufficient balance for this withdrawal');
    }
    if (req.body.method && !WITHDRAW_METHODS.has(req.body.method)) {
      throw new HttpError(400, 'Invalid withdrawal method');
    }
    const rounded = Math.round(amount * 100) / 100;

    const wd = await Withdrawals.create({
      userId: req.user.id,
      amount: rounded,
      method: req.body.method || null,
      destination: req.body.destination || null,
      notes: req.body.notes || null,
    });
    return sendCreated(res, { withdrawal: wd }, 'Withdrawal request submitted.');
  },

  /* ------------------------------------------------------------ */
  /*  POST /api/withdrawals/:id/cancel                            */
  /* ------------------------------------------------------------ */
  async cancel(req, res) {
    const wd = await Withdrawals.findById(req.params.id);
    if (!wd) throw new HttpError(404, 'Withdrawal not found');
    if (wd.user_id !== req.user.id) throw new HttpError(403, 'Not your withdrawal');
    if (wd.status !== 'pending') throw new HttpError(400, 'Only pending withdrawals can be cancelled');

    const updated = await Withdrawals.setStatus(wd.id, 'rejected', 'Cancelled by user');
    return sendOk(res, { withdrawal: updated }, 'Withdrawal cancelled.');
  },
};
