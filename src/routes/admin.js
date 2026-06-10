/**
 * Admin routes — full admin panel.
 */
const express = require('express');
const { body, param } = require('express-validator');
const rateLimit = require('express-rate-limit');
const adminController = require('../controllers/adminController');
const { adminRequired } = require('../middleware/auth');
const { HttpError, asyncHandler } = require('../utils/http');

const router = express.Router();

const validate = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) return next(new HttpError(400, 'Validation failed', errors.array()));
  next();
};

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many admin attempts. Please try again later.' },
});

/* ============================================================
 *                          AUTH
 * ============================================================ */

router.post(
  '/login',
  loginLimiter,
  [body('username').isString().notEmpty(), body('password').isString().notEmpty()],
  validate,
  asyncHandler(adminController.login)
);

router.post('/logout', asyncHandler(adminController.logout));

router.get('/me', adminRequired, asyncHandler(adminController.me));

router.post(
  '/change-password',
  adminRequired,
  [
    body('currentPassword').isString().notEmpty(),
    body('newPassword').isLength({ min: 8 }),
    body('confirmPassword')
      .custom((v, { req }) => v === req.body.newPassword)
      .withMessage('Passwords do not match'),
  ],
  validate,
  asyncHandler(adminController.changePassword)
);

/* ============================================================
 *                        OVERVIEW
 * ============================================================ */

router.get('/stats', adminRequired, asyncHandler(adminController.stats));

/* ============================================================
 *                          USERS
 * ============================================================ */

router.get('/users', adminRequired, asyncHandler(adminController.listUsers));

router.get(
  '/users/:id',
  adminRequired,
  [param('id').isUUID()],
  validate,
  asyncHandler(adminController.getUser)
);

router.get(
  '/users/:id/withdrawals',
  adminRequired,
  [param('id').isUUID()],
  validate,
  asyncHandler(adminController.getUserWithdrawals)
);

router.patch(
  '/users/:id',
  adminRequired,
  [
    param('id').isUUID(),
    body('fullName').optional().isString().isLength({ min: 1, max: 100 }),
    body('email').optional().isEmail(),
    body('balance').optional().isFloat({ min: 0 }),
    body('accountTier').optional().isIn(['free', 'pro', 'elite']),
  ],
  validate,
  asyncHandler(adminController.editUser)
);

router.patch(
  '/users/:id/balance',
  adminRequired,
  [param('id').isUUID(), body('balance').isFloat({ min: 0 })],
  validate,
  asyncHandler(adminController.setBalance)
);

router.patch(
  '/users/:id/verify',
  adminRequired,
  [param('id').isUUID()],
  validate,
  asyncHandler(adminController.verifyUser)
);

router.patch(
  '/users/:id/tier',
  adminRequired,
  [param('id').isUUID(), body('tier').isIn(['free', 'pro', 'elite'])],
  validate,
  asyncHandler(adminController.setTier)
);

router.patch(
  '/users/:id/restrict',
  adminRequired,
  [param('id').isUUID(), body('restricted').isBoolean()],
  validate,
  asyncHandler(adminController.setRestricted)
);

router.delete(
  '/users/:id',
  adminRequired,
  [param('id').isUUID()],
  validate,
  asyncHandler(adminController.deleteUser)
);

/* ============================================================
 *                       WITHDRAWALS
 * ============================================================ */

router.get('/withdrawals', adminRequired, asyncHandler(adminController.listWithdrawals));

router.patch(
  '/withdrawals/:id',
  adminRequired,
  [
    param('id').isUUID(),
    body('action').isIn(['approve', 'reject', 'on_hold', 'restore']),
    body('notes').optional().isString().isLength({ max: 500 }),
  ],
  validate,
  asyncHandler(adminController.updateWithdrawal)
);

/* ============================================================
 *                       SITE SETTINGS
 * ============================================================ */

router.get('/site-settings', adminRequired, asyncHandler(adminController.getSiteSettings));

router.patch(
  '/site-settings',
  adminRequired,
  [
    body('maintenance_mode').optional().isBoolean(),
    body('hero_headline').optional().isString().isLength({ max: 1000 }),
    body('hero_subtext').optional().isString().isLength({ max: 2000 }),
    body('market_categories').optional().isArray(),
    body('pricing_plans').optional().isArray(),
    body('deposit_wallets').optional().isObject(),
    body('investment_roi').optional().isObject(),
  ],
  validate,
  asyncHandler(adminController.updateSiteSettings)
);

router.post(
  '/site-settings/maintenance',
  adminRequired,
  [body('enabled').isBoolean()],
  validate,
  asyncHandler(adminController.toggleMaintenance)
);

/* ============================================================
 *                       DEPOSITS (admin)
 * ============================================================ */

router.get('/deposits', adminRequired, asyncHandler(adminController.listDeposits));

router.patch(
  '/deposits/:id',
  adminRequired,
  [
    param('id').isUUID(),
    body('action').isIn(['approve', 'reject']),
    body('notes').optional().isString().isLength({ max: 500 }),
  ],
  validate,
  asyncHandler(adminController.updateDeposit)
);

/* ============================================================
 *                  USER INVESTMENTS (admin)
 * ============================================================ */

router.get('/investments', adminRequired, asyncHandler(adminController.listInvestments));

router.get(
  '/users/:id/investments',
  adminRequired,
  [param('id').isUUID()],
  validate,
  asyncHandler(adminController.getUserInvestments)
);

/* ============================================================
 *                  INVESTMENT PLANS (admin)
 * ============================================================ */

router.get('/investment-plans', adminRequired, asyncHandler(adminController.listInvestmentPlans));

router.post(
  '/investment-plans',
  adminRequired,
  [
    body('name').isString().notEmpty(),
    body('minAmount').isFloat({ gt: 0 }),
    body('maxAmount').optional({ values: 'null' }).isFloat({ gt: 0 }),
    body('dailyRoi').isFloat({ gt: 0 }),
    body('durationDays').isInt({ gt: 0 }),
    body('features').optional().isArray(),
    body('isActive').optional().isBoolean(),
  ],
  validate,
  asyncHandler(adminController.createInvestmentPlan)
);

router.patch(
  '/investment-plans/:id',
  adminRequired,
  [param('id').isUUID()],
  validate,
  asyncHandler(adminController.updateInvestmentPlan)
);

router.patch(
  '/investment-plans/:id/toggle',
  adminRequired,
  [param('id').isUUID()],
  validate,
  asyncHandler(adminController.toggleInvestmentPlan)
);

router.delete(
  '/investment-plans/:id',
  adminRequired,
  [param('id').isUUID()],
  validate,
  asyncHandler(adminController.deleteInvestmentPlan)
);

module.exports = router;
