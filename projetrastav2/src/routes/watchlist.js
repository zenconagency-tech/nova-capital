/**
 * Watchlist routes.
 */
const express = require('express');
const watchlistController = require('../controllers/watchlistController');
const { authRequired } = require('../middleware/auth');
const { asyncHandler } = require('../utils/http');

const router = express.Router();

router.get('/', authRequired, asyncHandler(watchlistController.list));
router.post('/', authRequired, asyncHandler(watchlistController.add));
router.delete('/:symbol', authRequired, asyncHandler(watchlistController.remove));

module.exports = router;
