const express = require('express');
const { body } = require('express-validator');
const investmentController = require('../controllers/investmentController');
const { authRequired } = require('../middleware/auth');
const { HttpError, asyncHandler } = require('../utils/http');

const router = express.Router();

const validate = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) return next(new HttpError(400, 'Validation failed', errors.array()));
  next();
};

router.get('/plans', asyncHandler(investmentController.listPlans));
router.get('/roi-rates', asyncHandler(investmentController.getRoiRates));
router.get('/', authRequired, asyncHandler(investmentController.listMyInvestments));
router.post(
  '/',
  authRequired,
  [
    body('amount').isFloat({ gt: 0 }),
    body('assetLabel').isString().notEmpty(),
    body('durationDays').isIn([30, 60, 90, 180, 365]),
    body('planId').optional().isString(),
  ],
  validate,
  asyncHandler(investmentController.create)
);
router.post('/:id/cancel', authRequired, asyncHandler(investmentController.cancel));

module.exports = router;
