/* ============================================================================
   Nova — portfolio holdings table
   ============================================================================ */
(function () {
  const body = document.getElementById('holdingsBody');
  const summaryEls = {
    equity: document.getElementById('pfEquity'),
    pnl: document.getElementById('pfPnl'),
    pnlPct: document.getElementById('pfPnlPct'),
  };

  const renderEmpty = () => {
    if (body) {
      body.innerHTML = `<tr><td colspan="6" class="text-dim center" style="padding:24px;">Sign in to see your live portfolio.</td></tr>`;
    }
  };

  const render = async () => {
    if (!body) return;

    if (!NovaAPI.getToken()) {
      renderEmpty();
      return;
    }

    try {
      const { data: { holdings = [], summary = {} } } = await NovaAPI.portfolio();

      // holdings table
      if (!holdings.length) {
        body.innerHTML = `<tr><td colspan="6" class="text-dim center" style="padding:24px;">No holdings yet.</td></tr>`;
      } else {
        body.innerHTML = holdings.map((h) => {
          const cls = h.pnl >= 0 ? 'up' : 'down';
          return `<tr>
            <td>
              <div class="sym-cell">
                <div class="ic">${NovaFormat.symbolIcon(h.symbol)}</div>
                <div>
                  <div style="color:var(--text-0); font-weight:600;">${h.symbol}</div>
                  <div class="text-dim" style="font-size:11.5px; text-transform:capitalize;">${h.asset_class}</div>
                </div>
              </div>
            </td>
            <td class="num">${NovaFormat.quantity(h.quantity, 4)}</td>
            <td class="num">${NovaFormat.price(h.avg_cost, 4)}</td>
            <td class="num">${NovaFormat.price(h.live_price, 4)}</td>
            <td class="num" style="color:var(--text-0); font-weight:600;">${NovaFormat.price(h.market_value)}</td>
            <td class="num ${cls}">
              <div>${(h.pnl >= 0 ? '+' : '') + NovaFormat.price(h.pnl)}</div>
              <div style="font-size:11.5px;">${NovaFormat.pct(h.pnl_pct)}</div>
            </td>
          </tr>`;
        }).join('');
      }

      // summary
      if (summaryEls.equity) summaryEls.equity.textContent = NovaFormat.price(summary.equity);
      if (summaryEls.pnl) {
        const cls = summary.pnl >= 0 ? 'profit' : 'loss';
        summaryEls.pnl.textContent = (summary.pnl >= 0 ? '+' : '') + NovaFormat.price(summary.pnl);
        summaryEls.pnl.className = 'v mono ' + cls;
      }
      if (summaryEls.pnlPct) {
        const cls = summary.pnl_pct >= 0 ? 'profit' : 'loss';
        summaryEls.pnlPct.textContent = NovaFormat.pct(summary.pnl_pct);
        summaryEls.pnlPct.className = 'v mono ' + cls;
      }
    } catch (e) {
      if (e.status === 401) {
        renderEmpty();
        return;
      }
      console.warn('portfolio render failed', e);
    }
  };

  render();
})();
