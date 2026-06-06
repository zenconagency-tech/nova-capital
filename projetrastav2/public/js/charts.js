/* ============================================================================
   Nova — Chart.js wrappers for hero & featured chart
   ============================================================================ */
(function () {
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js not loaded');
    return;
  }

  // Apply global dark theme defaults
  Chart.defaults.color = '#A6ADBB';
  Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.borderColor = 'rgba(255,255,255,0.05)';
  Chart.defaults.plugins.legend.display = false;
  Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(17, 19, 24, 0.95)';
  Chart.defaults.plugins.tooltip.borderColor = 'rgba(0, 212, 255, 0.35)';
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.titleColor = '#FFFFFF';
  Chart.defaults.plugins.tooltip.bodyColor = '#E6E8EC';
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  Chart.defaults.plugins.tooltip.displayColors = true;
  Chart.defaults.plugins.tooltip.boxPadding = 6;

  const buildGradient = (ctx, area, color, opacity) => {
    if (!area) return color;
    const g = ctx.createLinearGradient(0, area.top, 0, area.bottom);
    g.addColorStop(0, color.replace('1)', `${opacity})`));
    g.addColorStop(1, color.replace('1)', '0)'));
    return g;
  };

  // ============================================================
  // Hero mini chart (line, BTC)
  // ============================================================
  const heroCanvas = document.getElementById('heroChart');
  let heroChart = null;
  let heroRange = '1D';

  const renderHero = async () => {
    if (!heroCanvas) return;
    try {
      const { data: { candles } } = await NovaAPI.history('BTC', heroRange);
      const data = candles.map((c) => ({ x: c.t, y: c.c }));
      const ctx = heroCanvas.getContext('2d');

      if (heroChart) heroChart.destroy();

      heroChart = new Chart(ctx, {
        type: 'line',
        data: {
          datasets: [{
            data,
            borderColor: '#00D4FF',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.32,
            fill: {
              target: 'origin',
              above: (context) => buildGradient(context.chart.ctx, context.chart.chartArea, 'rgba(0, 212, 255, 1)', 0.25),
            },
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 600, easing: 'easeOutQuart' },
          interaction: { intersect: false, mode: 'index' },
          plugins: {
            tooltip: {
              callbacks: {
                label: (ctx) => NovaFormat.price(ctx.parsed.y),
              },
            },
          },
          scales: {
            x: {
              type: 'time',
              time: { unit: heroRange === '1D' ? 'hour' : 'day' },
              display: false,
              grid: { display: false },
            },
            y: {
              position: 'right',
              grid: { color: 'rgba(255,255,255,0.04)' },
              ticks: {
                callback: (v) => '$' + Number(v).toLocaleString(),
                maxTicksLimit: 5,
              },
            },
          },
        },
      });

      // also update top price + change
      const { data: { ticker } } = await NovaAPI.ticker('BTC');
      const priceEl = document.getElementById('heroPrice');
      const chgEl = document.getElementById('heroChange');
      const highEl = document.getElementById('heroHigh');
      const lowEl = document.getElementById('heroLow');
      if (priceEl) {
        priceEl.firstChild.nodeValue = NovaFormat.price(ticker.price) + ' ';
      }
      if (chgEl) {
        chgEl.textContent = NovaFormat.pct(ticker.changePct);
        chgEl.className = 'chg ' + (ticker.changePct >= 0 ? 'up' : 'down');
      }
      if (highEl) highEl.textContent = NovaFormat.price(ticker.high);
      if (lowEl) lowEl.textContent = NovaFormat.price(ticker.low);
    } catch (e) {
      console.warn('hero chart failed', e);
    }
  };

  // Range buttons
  document.querySelectorAll('#heroRanges button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#heroRanges button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      heroRange = btn.dataset.range;
      renderHero();
    });
  });

  renderHero();
  setInterval(renderHero, 5000);

  // ============================================================
  // Featured chart (candlestick + line + area)
  // ============================================================
  const featuredCanvas = document.getElementById('featuredChart');
  const symSelect = document.getElementById('featuredSymbolSelect');
  const rangeBtns = document.querySelectorAll('#featuredRanges button');
  const typeBtns = document.querySelectorAll('#featuredChartType button');

  let featuredChart = null;
  let featuredState = { symbol: 'BTC', range: '1M', type: 'candlestick' };

  const formatCandleDate = (range, t) => {
    const d = new Date(t);
    if (range === '1D') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (range === '5D') return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' });
  };

  const renderFeatured = async () => {
    if (!featuredCanvas) return;
    try {
      const { data: { candles } } = await NovaAPI.history(featuredState.symbol, featuredState.range);
      const { data: { ticker } } = await NovaAPI.ticker(featuredState.symbol);

      // update header info
      const nameEl = document.getElementById('featuredName');
      const symEl = document.getElementById('featuredSymbol');
      const iconEl = document.getElementById('featuredIcon');
      const priceEl = document.getElementById('featuredPrice');
      const chgEl = document.getElementById('featuredChange');
      const highEl = document.getElementById('featuredHigh');
      const lowEl = document.getElementById('featuredLow');
      const volEl = document.getElementById('featuredVol');
      const classEl = document.getElementById('featuredClass');

      if (nameEl) nameEl.textContent = ticker.name;
      if (symEl) symEl.textContent = `${ticker.symbol} · ${ticker.assetClass[0].toUpperCase() + ticker.assetClass.slice(1)}`;
      if (iconEl) iconEl.textContent = NovaFormat.symbolIcon(ticker.symbol);
      if (priceEl) {
        priceEl.firstChild.nodeValue = NovaFormat.price(ticker.price) + ' ';
      }
      if (chgEl) {
        chgEl.textContent = NovaFormat.pct(ticker.changePct);
        chgEl.className = 'chg ' + (ticker.changePct >= 0 ? 'up' : 'down');
      }
      if (highEl) highEl.textContent = NovaFormat.price(ticker.high);
      if (lowEl) lowEl.textContent = NovaFormat.price(ticker.low);
      if (volEl) volEl.textContent = NovaFormat.compact(candles.length * 1_000_000);
      if (classEl) classEl.textContent = ticker.assetClass[0].toUpperCase() + ticker.assetClass.slice(1);

      const ctx = featuredCanvas.getContext('2d');
      if (featuredChart) featuredChart.destroy();

      if (featuredState.type === 'candlestick' && window.ChartCandlestickController) {
        // Use chartjs-chart-financial if available
        const data = candles.map((c) => ({ x: c.t, o: c.o, h: c.h, l: c.l, c: c.c }));
        featuredChart = new Chart(ctx, {
          type: 'candlestick',
          data: {
            datasets: [{
              data,
              borderColor: '#A6ADBB',
              color: {
                up: '#00FF88',
                down: '#FF4D6D',
                unchanged: '#7B8597',
              },
              borderColor: {
                up: '#00FF88',
                down: '#FF4D6D',
                unchanged: '#7B8597',
              },
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 500 },
            plugins: {
              tooltip: {
                callbacks: {
                  label: (ctx) => {
                    const r = ctx.raw;
                    return [
                      `O: ${NovaFormat.price(r.o)}`,
                      `H: ${NovaFormat.price(r.h)}`,
                      `L: ${NovaFormat.price(r.l)}`,
                      `C: ${NovaFormat.price(r.c)}`,
                    ];
                  },
                },
              },
            },
            scales: {
              x: {
                type: 'timeseries',
                time: { unit: featuredState.range === '1D' ? 'hour' : 'day' },
                ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
                grid: { display: false },
              },
              y: {
                position: 'right',
                grid: { color: 'rgba(255,255,255,0.04)' },
                ticks: { callback: (v) => '$' + Number(v).toLocaleString(), maxTicksLimit: 6 },
              },
            },
          },
        });
      } else {
        // Line / Area fallback
        const data = candles.map((c) => ({ x: c.t, y: c.c }));
        const isArea = featuredState.type === 'area';
        const lineColor = '#00D4FF';
        featuredChart = new Chart(ctx, {
          type: 'line',
          data: {
            datasets: [{
              data,
              borderColor: lineColor,
              borderWidth: 2,
              pointRadius: 0,
              tension: 0.25,
              fill: isArea ? { target: 'origin', above: (c) => buildGradient(c.chart.ctx, c.chart.chartArea, 'rgba(0, 212, 255, 1)', 0.3) } : false,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 500 },
            interaction: { intersect: false, mode: 'index' },
            plugins: {
              tooltip: { callbacks: { label: (ctx) => NovaFormat.price(ctx.parsed.y) } },
            },
            scales: {
              x: {
                type: 'time',
                time: { unit: featuredState.range === '1D' ? 'hour' : 'day' },
                ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
                grid: { display: false },
              },
              y: {
                position: 'right',
                grid: { color: 'rgba(255,255,255,0.04)' },
                ticks: { callback: (v) => '$' + Number(v).toLocaleString(), maxTicksLimit: 6 },
              },
            },
          },
        });
      }
    } catch (e) {
      console.warn('featured chart failed', e);
    }
  };

  if (symSelect) {
    symSelect.addEventListener('change', () => {
      featuredState.symbol = symSelect.value;
      renderFeatured();
    });
  }
  rangeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      rangeBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      featuredState.range = btn.dataset.range;
      renderFeatured();
    });
  });
  typeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      typeBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      featuredState.type = btn.dataset.type;
      renderFeatured();
    });
  });

  renderFeatured();
  setInterval(renderFeatured, 6000);
})();
