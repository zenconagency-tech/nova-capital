/**
 * Auth routes — thin wrappers that delegate to authController.
 */
const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { HttpError } = require('../utils/http');

const router = express.Router();
const { asyncHandler } = require('../utils/http');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again in 15 minutes.' },
});

const validate = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) return next(new HttpError(400, 'Validation failed', errors.array()));
  next();
};

/* POST /api/auth/register */
router.post(
  '/register',
  authLimiter,
  [
    body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('confirmPassword')
      .custom((v, { req }) => v === req.body.password)
      .withMessage('Passwords do not match'),
    body('fullName').optional().isString().isLength({ min: 1, max: 100 }),
  ],
  validate,
  asyncHandler(authController.register)
);

/* POST /api/auth/login */
router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
    body('password').isString().notEmpty().withMessage('Password required'),
  ],
  validate,
  asyncHandler(authController.login)
);

/* POST /api/auth/logout */
router.post('/logout', asyncHandler(authController.logout));

/* GET /api/auth/verify-email?token=… */
router.get('/verify-email', asyncHandler(authController.verifyEmail));

/* POST /api/auth/resend-verification */
router.post(
  '/resend-verification',
  authLimiter,
  [body('email').isEmail().normalizeEmail()],
  validate,
  asyncHandler(authController.resendVerification)
);

/* POST /api/auth/forgot-password */
router.post(
  '/forgot-password',
  authLimiter,
  [body('email').isEmail().normalizeEmail()],
  validate,
  asyncHandler(authController.forgotPassword)
);

/* POST /api/auth/reset-password */
router.post(
  '/reset-password',
  authLimiter,
  [
    body('token').isString().notEmpty(),
    body('password').isLength({ min: 8 }),
    body('confirmPassword')
      .custom((v, { req }) => v === req.body.password)
      .withMessage('Passwords do not match'),
  ],
  validate,
  asyncHandler(authController.resetPassword)
);

module.exports = router;
