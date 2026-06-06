/**
 * Market controller — tickers, history, categories.
 */
const { sendOk, HttpError } = require('../utils/http');

module.exports = {
  /* ------------------------------------------------------------ */
  /*  GET /api/market/tickers                                     */
  /* ------------------------------------------------------------ */
  async tickers(req, res) {
    const assetClass = req.query.assetClass;
    let tickers = req.app.locals.market.getTickers();
    if (assetClass) tickers = tickers.filter((t) => t.assetClass === assetClass);
    return sendOk(res, { tickers });
  },

  /* ------------------------------------------------------------ */
  /*  GET /api/market/ticker/:symbol                              */
  /* ------------------------------------------------------------ */
  async ticker(req, res) {
    const t = req.app.locals.market.getTicker(req.params.symbol.toUpperCase());
    if (!t) throw new HttpError(404, 'Symbol not found');
    return sendOk(res, { ticker: t });
  },

  /* ------------------------------------------------------------ */
  /*  GET /api/market/history/:symbol?range=…                     */
  /* ------------------------------------------------------------ */
  async history(req, res) {
    const symbol = req.params.symbol.toUpperCase();
    const range = String(req.query.range || '1M').toUpperCase();
    const candles = req.app.locals.market.getHistory(symbol, range);
    return sendOk(res, { symbol, range, candles });
  },

  /* ------------------------------------------------------------ */
  /*  GET /api/market/categories                                  */
  /* ------------------------------------------------------------ */
  async categories(req, res) {
    const tickers = req.app.locals.market.getTickers();
    const groups = {};
    for (const t of tickers) {
      if (!groups[t.assetClass]) groups[t.assetClass] = [];
      groups[t.assetClass].push(t);
    }
    return sendOk(res, { categories: groups });
  },
};
