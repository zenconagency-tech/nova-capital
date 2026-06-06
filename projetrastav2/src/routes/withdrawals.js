/**
 * Withdrawals routes — user-facing.
 */
const express = require('express');
const { body } = require('express-validator');
const withdrawalController = require('../controllers/withdrawalController');
const { authRequired } = require('../middleware/auth');
const { HttpError, asyncHandler } = require('../utils/http');

const router = express.Router();

const validate = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) return next(new HttpError(400, 'Validation failed', errors.array()));
  next();
};

router.get('/', authRequired, asyncHandler(withdrawalController.list));

router.post(
  '/',
  authRequired,
  [
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number'),
    body('method').optional().isIn(['bank_transfer', 'crypto', 'paypal', 'other']),
    body('destination').optional().isString().isLength({ max: 240 }),
    body('notes').optional().isString().isLength({ max: 500 }),
  ],
  validate,
  asyncHandler(withdrawalController.create)
);

router.post('/:id/cancel', authRequired, asyncHandler(withdrawalController.cancel));

module.exports = router;
