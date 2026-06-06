/**
 * Market routes.
 */
const express = require('express');
const marketController = require('../controllers/marketController');
const { authOptional } = require('../middleware/auth');
const { asyncHandler } = require('../utils/http');

const router = express.Router();

router.get('/tickers', authOptional, asyncHandler(marketController.tickers));
router.get('/ticker/:symbol', authOptional, asyncHandler(marketController.ticker));
router.get('/history/:symbol', authOptional, asyncHandler(marketController.history));
router.get('/categories', authOptional, asyncHandler(marketController.categories));

module.exports = router;
