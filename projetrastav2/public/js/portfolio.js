/* ============================================================================
   Nova — portfolio dashboard (donut + holdings table)
   ============================================================================ */
(function () {
  const donutCanvas = document.getElementById('donutChart');
  const legend = document.getElementById('donutLegend');
  const body = document.getElementById('holdingsBody');
  const summaryEls = {
    equity: document.getElementById('pfEquity'),
    pnl: document.getElementById('pfPnl'),
    pnlPct: document.getElementById('pfPnlPct'),
  };

  let donutChart = null;

  const PALETTE = [
    '#00D4FF', '#00FF88', '#A78BFA', '#FFD66B',
    '#FF8A65', '#5EEAD4', '#F472B6', '#FBBF24',
    '#60A5FA', '#34D399', '#F87171', '#C084FC',
  ];

  const renderEmpty = () => {
    if (body) {
      body.innerHTML = `<tr><td colspan="6" class="text-dim center" style="padding:24px;">Sign in to see your live portfolio.</td></tr>`;
    }
    if (legend) legend.innerHTML = '';
    if (donutChart) { donutChart.destroy(); donutChart = null; }
  };

  const render = async () => {
    if (!body) return;

    if (!NovaAPI.getToken()) {
      renderEmpty();
      return;
    }

    try {
      const { data: { holdings = [], summary = {} } } = await NovaAPI.portfolio();
      const invested = holdings.reduce((s, h) => s + h.market_value, 0);
      const total = invested + (summary.cash || 0);

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

      // donut
      if (donutCanvas) {
        const ctx = donutCanvas.getContext('2d');
        if (donutChart) donutChart.destroy();

        const topN = 7;
        const sorted = [...holdings].sort((a, b) => b.market_value - a.market_value);
        const shown = sorted.slice(0, topN);
        const rest = sorted.slice(topN);
        const restVal = rest.reduce((s, h) => s + h.market_value, 0) + (summary.cash || 0);
        const labels = [...shown.map((h) => h.symbol)];
        const data = [...shown.map((h) => h.market_value)];
        if (restVal > 0) { labels.push('Cash & other'); data.push(restVal); }

        if (data.length === 0) {
          if (legend) legend.innerHTML = `<div class="text-dim center">No data yet.</div>`;
        } else {
          donutChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
              labels,
              datasets: [{
                data,
                backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length]),
                borderColor: '#111318',
                borderWidth: 2,
                hoverOffset: 6,
              }],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              cutout: '70%',
              plugins: {
                tooltip: {
                  callbacks: {
                    label: (ctx) => {
                      const pct = total > 0 ? (ctx.parsed / total * 100).toFixed(1) : 0;
                      return `${ctx.label}: ${NovaFormat.price(ctx.parsed)} (${pct}%)`;
                    },
                  },
                },
              },
            },
          });

          if (legend) {
            legend.innerHTML = labels.map((label, i) => {
              const value = data[i];
              const pct = total > 0 ? (value / total * 100).toFixed(1) : 0;
              return `<div class="row">
                <div class="l">
                  <span class="dot" style="background:${PALETTE[i % PALETTE.length]}"></span>
                  <span>${label}</span>
                </div>
                <span class="pct">${pct}%</span>
              </div>`;
            }).join('');
          }
        }
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
  setInterval(render, 12000);
})();
