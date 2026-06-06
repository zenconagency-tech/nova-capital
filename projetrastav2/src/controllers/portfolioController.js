/**
 * Portfolio controller — current user's holdings + summary.
 */
const { Holdings } = require('../models');
const { sendOk } = require('../utils/http');

const withComputedValues = (holdings, prices) => {
  return (holdings || []).map((h) => {
    const livePrice = prices[h.symbol] ?? Number(h.avg_cost);
    const qty = Number(h.quantity);
    const cost = Number(h.avg_cost);
    const marketValue = qty * livePrice;
    const costBasis = qty * cost;
    const pnl = marketValue - costBasis;
    const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
    return {
      ...h,
      quantity: qty,
      avg_cost: cost,
      live_price: livePrice,
      market_value: marketValue,
      pnl,
      pnl_pct: pnlPct,
    };
  });
};

const summarize = (holdings, cash) => {
  const totalMarketValue = holdings.reduce((s, h) => s + h.market_value, 0);
  const totalCost = holdings.reduce((s, h) => s + h.market_value - h.pnl, 0);
  const totalPnl = totalMarketValue - totalCost;
  const cashNum = Number(cash) || 0;
  return {
    cash: cashNum,
    invested: totalMarketValue,
    holdingsValue: totalMarketValue,
    equity: totalMarketValue + cashNum,
    pnl: totalPnl,
    pnl_pct: totalCost > 0 ? (totalPnl / totalCost) * 100 : 0,
  };
};

module.exports = {
  /* ------------------------------------------------------------ */
  /*  GET /api/portfolio                                          */
  /* ------------------------------------------------------------ */
  async get(req, res) {
    const holdings = await Holdings.listByUser(req.user.id);
    const prices = await req.app.locals.market.getPrices(holdings.map((h) => h.symbol));
    const enriched = withComputedValues(holdings, prices);
    const summary = summarize(enriched, req.user.balance);
    return sendOk(res, { summary, holdings: enriched });
  },
};
