// Deterministic simulated market data engine.
// Generates realistic-looking price walks for a fixed set of symbols so that
// the platform is fully functional out-of-the-box without external APIs.

const SYMBOLS = {
  // crypto
  BTC:   { name: 'Bitcoin',       assetClass: 'crypto',    base: 67500,  vol: 0.018, precision: 2 },
  ETH:   { name: 'Ethereum',      assetClass: 'crypto',    base: 3450,   vol: 0.022, precision: 2 },
  SOL:   { name: 'Solana',        assetClass: 'crypto',    base: 165,    vol: 0.030, precision: 2 },
  BNB:   { name: 'BNB',           assetClass: 'crypto',    base: 590,    vol: 0.020, precision: 2 },
  XRP:   { name: 'XRP',           assetClass: 'crypto',    base: 0.58,   vol: 0.028, precision: 4 },
  ADA:   { name: 'Cardano',       assetClass: 'crypto',    base: 0.42,   vol: 0.030, precision: 4 },
  DOGE:  { name: 'Dogecoin',      assetClass: 'crypto',    base: 0.155,  vol: 0.040, precision: 5 },

  // stocks
  AAPL:  { name: 'Apple Inc.',         assetClass: 'stock',  base: 192.4,  vol: 0.010, precision: 2 },
  MSFT:  { name: 'Microsoft',          assetClass: 'stock',  base: 425.6,  vol: 0.011, precision: 2 },
  GOOGL: { name: 'Alphabet',           assetClass: 'stock',  base: 175.2,  vol: 0.012, precision: 2 },
  AMZN:  { name: 'Amazon',             assetClass: 'stock',  base: 188.7,  vol: 0.014, precision: 2 },
  TSLA:  { name: 'Tesla',              assetClass: 'stock',  base: 248.3,  vol: 0.025, precision: 2 },
  NVDA:  { name: 'NVIDIA',             assetClass: 'stock',  base: 121.5,  vol: 0.028, precision: 2 },
  META:  { name: 'Meta Platforms',     assetClass: 'stock',  base: 502.1,  vol: 0.018, precision: 2 },
  SPY:   { name: 'S&P 500 ETF',        assetClass: 'stock',  base: 562.4,  vol: 0.008, precision: 2 },
  QQQ:   { name: 'Nasdaq 100 ETF',     assetClass: 'stock',  base: 478.9,  vol: 0.010, precision: 2 },
  DIA:   { name: 'Dow Jones ETF',      assetClass: 'stock',  base: 412.7,  vol: 0.007, precision: 2 },

  // futures
  ES:    { name: 'E-mini S&P 500',  assetClass: 'future',  base: 5630,   vol: 0.009, precision: 2 },
  NQ:    { name: 'E-mini Nasdaq',   assetClass: 'future',  base: 19850,  vol: 0.012, precision: 2 },
  CL:    { name: 'Crude Oil',       assetClass: 'future',  base: 77.8,   vol: 0.018, precision: 2 },
  GC:    { name: 'Gold Futures',    assetClass: 'future',  base: 2640,   vol: 0.008, precision: 2 },

  // forex
  EURUSD:{ name: 'Euro / US Dollar',   assetClass: 'forex', base: 1.0842, vol: 0.004, precision: 4 },
  GBPUSD:{ name: 'Pound / US Dollar',  assetClass: 'forex', base: 1.2710, vol: 0.005, precision: 4 },
  USDJPY:{ name: 'US Dollar / Yen',    assetClass: 'forex', base: 154.20, vol: 0.005, precision: 3 },
  AUDUSD:{ name: 'AUD / US Dollar',    assetClass: 'forex', base: 0.6610, vol: 0.005, precision: 4 },

  // commodities
  XAU:   { name: 'Gold',            assetClass: 'commodity', base: 2640,  vol: 0.008, precision: 2 },
  XAG:   { name: 'Silver',          assetClass: 'commodity', base: 31.4,  vol: 0.014, precision: 2 },
  OIL:   { name: 'WTI Crude Oil',   assetClass: 'commodity', base: 77.8,  vol: 0.018, precision: 2 },
  NGAS:  { name: 'Natural Gas',     assetClass: 'commodity', base: 2.85,  vol: 0.025, precision: 3 },
};

class MarketService {
  constructor() {
    this.prices = {};
    this.previousPrices = {};
    this.dailyHigh = {};
    this.dailyLow = {};
    this.dailyOpen = {};
    this.history = {}; // symbol -> [{t,o,h,l,c}, ...]
    this.tickers = {}; // market meta

    for (const [sym, meta] of Object.entries(SYMBOLS)) {
      this.prices[sym] = meta.base;
      this.previousPrices[sym] = meta.base;
      this.dailyOpen[sym] = meta.base;
      this.dailyHigh[sym] = meta.base;
      this.dailyLow[sym] = meta.base;
      this.history[sym] = [];
      this.tickers[sym] = meta;
    }

    this.tickInterval = null;
    this.historyInterval = null;
  }

  start() {
    if (this.tickInterval) return;
    // Seed initial history
    this._seedHistory();

    // Live tick — every 3s
    this.tickInterval = setInterval(() => this._tickAll(), 3000);

    // Candle aggregation — close + new candle every 1m
    this.historyInterval = setInterval(() => this._closeCandle(), 60_000);

    console.log('[market] simulated feed started');
  }

  stop() {
    if (this.tickInterval) clearInterval(this.tickInterval);
    if (this.historyInterval) clearInterval(this.historyInterval);
    this.tickInterval = null;
    this.historyInterval = null;
  }

  _seedHistory() {
    const now = Date.now();
    const pointsPerDay = 78; // 5-min bars over ~6.5h
    const days = 90;
    for (const [sym, meta] of Object.entries(SYMBOLS)) {
      let price = meta.base;
      const arr = [];
      for (let i = days * pointsPerDay; i > 0; i--) {
        const t = now - i * 5 * 60 * 1000;
        const drift = (Math.random() - 0.5) * meta.vol * 0.4;
        const o = price;
        const c = Math.max(0.0001, o * (1 + drift));
        const h = Math.max(o, c) * (1 + Math.random() * meta.vol * 0.3);
        const l = Math.min(o, c) * (1 - Math.random() * meta.vol * 0.3);
        arr.push({ t, o, h, l, c });
        price = c;
      }
      this.history[sym] = arr;
      this.prices[sym] = price;
      this.dailyOpen[sym] = arr[arr.length - 1].o;
      this.dailyHigh[sym] = price * (1 + Math.random() * 0.01);
      this.dailyLow[sym] = price * (1 - Math.random() * 0.01);
      this.previousPrices[sym] = arr[arr.length - 1].o;
    }
  }

  _tickAll() {
    for (const sym of Object.keys(SYMBOLS)) {
      const meta = SYMBOLS[sym];
      const prev = this.prices[sym];
      const drift = (Math.random() - 0.4985) * meta.vol; // tiny upward bias
      const next = Math.max(0.0001, prev * (1 + drift));
      this.prices[sym] = next;
      this.previousPrices[sym] = prev;
      if (next > this.dailyHigh[sym]) this.dailyHigh[sym] = next;
      if (next < this.dailyLow[sym]) this.dailyLow[sym] = next;

      const hist = this.history[sym];
      if (hist.length) {
        const last = hist[hist.length - 1];
        last.c = next;
        if (next > last.h) last.h = next;
        if (next < last.l) last.l = next;
      }
    }
  }

  _closeCandle() {
    const t = Date.now();
    for (const sym of Object.keys(SYMBOLS)) {
      const price = this.prices[sym];
      this.history[sym].push({ t, o: price, h: price, l: price, c: price });
      // keep memory bounded
      if (this.history[sym].length > 5000) this.history[sym].shift();
      this.dailyOpen[sym] = price;
      this.dailyHigh[sym] = price;
      this.dailyLow[sym] = price;
    }
  }

  getTickers() {
    return Object.entries(SYMBOLS).map(([sym, meta]) => {
      const price = this.prices[sym];
      const open = this.dailyOpen[sym] || price;
      const change = price - open;
      const changePct = open > 0 ? (change / open) * 100 : 0;
      return {
        symbol: sym,
        name: meta.name,
        assetClass: meta.assetClass,
        price: Number(price.toFixed(meta.precision)),
        change: Number(change.toFixed(meta.precision)),
        changePct: Number(changePct.toFixed(2)),
        high: Number(this.dailyHigh[sym].toFixed(meta.precision)),
        low: Number(this.dailyLow[sym].toFixed(meta.precision)),
      };
    });
  }

  getTicker(symbol) {
    const meta = SYMBOLS[symbol];
    if (!meta) return null;
    const price = this.prices[symbol];
    const open = this.dailyOpen[symbol] || price;
    const change = price - open;
    const changePct = open > 0 ? (change / open) * 100 : 0;
    return {
      symbol,
      name: meta.name,
      assetClass: meta.assetClass,
      price: Number(price.toFixed(meta.precision)),
      change: Number(change.toFixed(meta.precision)),
      changePct: Number(changePct.toFixed(2)),
      high: Number(this.dailyHigh[symbol].toFixed(meta.precision)),
      low: Number(this.dailyLow[symbol].toFixed(meta.precision)),
      open: Number(open.toFixed(meta.precision)),
    };
  }

  getPrices(symbols) {
    const out = {};
    for (const s of symbols || []) {
      if (this.prices[s] !== undefined) out[s] = this.prices[s];
    }
    return out;
  }

  getHistory(symbol, range = '1M') {
    if (!SYMBOLS[symbol]) return [];
    const now = Date.now();
    const rangeMs = {
      '1D': 24 * 60 * 60 * 1000,
      '5D': 5 * 24 * 60 * 60 * 1000,
      '1M': 30 * 24 * 60 * 60 * 1000,
      '3M': 90 * 24 * 60 * 60 * 1000,
      '1Y': 365 * 24 * 60 * 60 * 1000,
      ALL: Infinity,
    }[range] || 30 * 24 * 60 * 60 * 1000;

    const all = this.history[symbol] || [];
    if (rangeMs === Infinity) return all;
    const cutoff = now - rangeMs;
    return all.filter((c) => c.t >= cutoff);
  }

  listSymbols() {
    return Object.keys(SYMBOLS);
  }
}

module.exports = new MarketService();
module.exports.SYMBOLS = SYMBOLS;
