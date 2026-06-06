/**
 * Watchlist controller.
 */
const { Watchlist } = require('../models');
const { sendOk, sendCreated, HttpError } = require('../utils/http');

const VALID_CLASSES = new Set(['crypto', 'stock', 'future', 'forex', 'commodity']);

module.exports = {
  /* ------------------------------------------------------------ */
  /*  GET /api/watchlist                                          */
  /* ------------------------------------------------------------ */
  async list(req, res) {
    const items = await Watchlist.listByUser(req.user.id);
    const symbols = items.map((i) => i.symbol);
    const prices = symbols.length
      ? await req.app.locals.market.getPrices(symbols)
      : {};
    const enriched = items.map((i) => ({ ...i, price: prices[i.symbol] ?? null }));
    return sendOk(res, { items: enriched });
  },

  /* ------------------------------------------------------------ */
  /*  POST /api/watchlist                                         */
  /* ------------------------------------------------------------ */
  async add(req, res) {
    const { symbol, assetClass } = req.body;
    if (!symbol || !assetClass) throw new HttpError(400, 'symbol and assetClass are required');
    if (!VALID_CLASSES.has(assetClass)) throw new HttpError(400, 'Invalid asset class');
    const item = await Watchlist.add({
      userId: req.user.id,
      symbol: String(symbol).toUpperCase(),
      assetClass,
    });
    return sendCreated(res, { item }, 'Added to watchlist.');
  },

  /* ------------------------------------------------------------ */
  /*  DELETE /api/watchlist/:symbol                               */
  /* ------------------------------------------------------------ */
  async remove(req, res) {
    await Watchlist.remove(req.user.id, String(req.params.symbol).toUpperCase());
    return sendOk(res, { removed: true }, 'Removed from watchlist.');
  },
};
