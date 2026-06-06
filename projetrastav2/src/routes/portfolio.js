/**
 * Portfolio routes.
 */
const express = require('express');
const portfolioController = require('../controllers/portfolioController');
const { authRequired } = require('../middleware/auth');
const { asyncHandler } = require('../utils/http');

const router = express.Router();

router.get('/', authRequired, asyncHandler(portfolioController.get));

module.exports = router;
