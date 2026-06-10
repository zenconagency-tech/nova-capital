const express = require('express');
const { body } = require('express-validator');
const depositController = require('../controllers/depositController');
const { authRequired } = require('../middleware/auth');
const { HttpError, asyncHandler } = require('../utils/http');

const router = express.Router();

const validate = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) return next(new HttpError(400, 'Validation failed', errors.array()));
  next();
};

router.get('/', authRequired, asyncHandler(depositController.list));

router.post(
  '/',
  authRequired,
  [
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number'),
    body('method').isIn(['bitcoin', 'ethereum', 'usdt', 'paypal', 'payoneer', 'gift_card']),
    body('methodMeta').optional(),
    body('notes').optional().isString().isLength({ max: 500 }),
  ],
  validate,
  asyncHandler(depositController.create)
);

module.exports = router;
