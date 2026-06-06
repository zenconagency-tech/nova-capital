/**
 * Public routes — read-only settings exposed to the frontend.
 */
const express = require('express');
const settingsController = require('../controllers/settingsController');
const { asyncHandler } = require('../utils/http');

const router = express.Router();

router.get('/settings', asyncHandler(settingsController.getPublicSettings));

module.exports = router;
