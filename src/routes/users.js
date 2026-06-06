/**
 * User routes.
 */
const express = require('express');
const { body } = require('express-validator');
const userController = require('../controllers/userController');
const { authRequired } = require('../middleware/auth');
const { HttpError, asyncHandler } = require('../utils/http');

const router = express.Router();

const validate = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) return next(new HttpError(400, 'Validation failed', errors.array()));
  next();
};

router.get('/me', authRequired, asyncHandler(userController.me));

router.patch(
  '/me',
  authRequired,
  [
    body('fullName').optional().isString().isLength({ min: 1, max: 100 }),
    body('avatarUrl').optional().isURL(),
  ],
  validate,
  asyncHandler(userController.updateMe)
);

router.post(
  '/me/change-password',
  authRequired,
  [
    body('currentPassword').isString().notEmpty(),
    body('newPassword').isLength({ min: 8 }),
    body('confirmPassword')
      .custom((v, { req }) => v === req.body.newPassword)
      .withMessage('Passwords do not match'),
  ],
  validate,
  asyncHandler(userController.changePassword)
);

module.exports = router;
