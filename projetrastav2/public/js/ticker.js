/* ============================================================================
   Nova — live market ticker (auto-scrolling)
   ============================================================================ */
(function () {
  const track = document.getElementById('tickerTrack');
  if (!track) return;

  let tickers = [];

  const render = () => {
    if (!tickers.length) return;
    const html = tickers.map((t) => {
      const cls = t.change >= 0 ? 'up' : 'down';
      const arrow = t.change >= 0 ? '▲' : '▼';
      return `<span class="ticker-item">
        <span class="sym">${t.symbol}</span>
        <span class="px">${NovaFormat.price(t.price)}</span>
        <span class="chg ${cls}">${arrow} ${NovaFormat.pct(t.changePct)}</span>
      </span>`;
    }).join('');
    // duplicate to allow seamless scroll
    track.innerHTML = html + html;
  };

  const update = async () => {
    try {
      const { data: { tickers: t } } = await NovaAPI.tickers();
      tickers = t;
      render();
    } catch (e) {
      console.warn('ticker fetch failed', e);
    }
  };

  update();
  setInterval(update, 8000);
})();
