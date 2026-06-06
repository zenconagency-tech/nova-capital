/* ============================================================================
   Nova — formatting helpers
   ============================================================================ */
(function (global) {
  const Format = {
    price(value, precision) {
      if (value === null || value === undefined || Number.isNaN(value)) return '—';
      const p = precision !== undefined
        ? precision
        : Math.abs(value) >= 1000 ? 2 : Math.abs(value) >= 1 ? 2 : 4;
      return '$' + Number(value).toLocaleString('en-US', { minimumFractionDigits: p, maximumFractionDigits: p });
    },

    number(value, precision = 2) {
      if (value === null || value === undefined || Number.isNaN(value)) return '—';
      return Number(value).toLocaleString('en-US', { minimumFractionDigits: precision, maximumFractionDigits: precision });
    },

    quantity(value, precision = 4) {
      if (value === null || value === undefined || Number.isNaN(value)) return '—';
      return Number(value).toLocaleString('en-US', { minimumFractionDigits: precision, maximumFractionDigits: precision });
    },

    compact(value) {
      if (value === null || value === undefined || Number.isNaN(value)) return '—';
      const abs = Math.abs(value);
      if (abs >= 1e12) return (value / 1e12).toFixed(2) + 'T';
      if (abs >= 1e9)  return (value / 1e9).toFixed(2)  + 'B';
      if (abs >= 1e6)  return (value / 1e6).toFixed(2)  + 'M';
      if (abs >= 1e3)  return (value / 1e3).toFixed(2)  + 'K';
      return value.toFixed(2);
    },

    pct(value, signed = true) {
      if (value === null || value === undefined || Number.isNaN(value)) return '—';
      const v = Number(value);
      const sign = signed && v > 0 ? '+' : '';
      return `${sign}${v.toFixed(2)}%`;
    },

    changeClass(value) { return Number(value) >= 0 ? 'up' : 'down'; },
    changeColor(value) { return Number(value) >= 0 ? 'var(--profit)' : 'var(--loss)'; },

    relativeTime(iso) {
      if (!iso) return '—';
      const d = new Date(iso);
      const diff = (Date.now() - d.getTime()) / 1000;
      if (diff < 60) return `${Math.floor(diff)}s ago`;
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      return d.toLocaleDateString();
    },

    symbolIcon(sym) {
      const map = { BTC: '₿', ETH: 'Ξ', SOL: '◎', BNB: 'B', XRP: '✕', ADA: '₳', DOGE: 'Ð' };
      return map[sym] || sym.slice(0, 2);
    },
  };

  global.NovaFormat = Format;
})(window);
