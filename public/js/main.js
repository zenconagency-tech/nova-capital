/* ============================================================================
   Nova — main entry: navbar, market category meta, market cards
   ============================================================================ */
(function () {
  // ----- Navbar scroll state + mobile menu -----
  const navbar = document.getElementById('navbar');
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');

  const onScroll = () => {
    if (!navbar) return;
    if (window.scrollY > 12) navbar.classList.add('scrolled');
    else navbar.classList.remove('scrolled');
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => navLinks.classList.toggle('open'));
    navLinks.querySelectorAll('a').forEach((a) =>
      a.addEventListener('click', () => navLinks.classList.remove('open'))
    );
  }

  // ----- Smooth scroll for in-page anchors (offset for fixed navbar) -----
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const offset = 130;
      const y = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    });
  });

  // ----- Market category cards: live meta + click handler -----
  const labels = {
    crypto:    { name: 'Crypto',   sample: 'BTC',  unit: 'tokens' },
    stock:     { name: 'Stocks',   sample: 'AAPL', unit: 'equities' },
    future:    { name: 'Futures',  sample: 'ES',   unit: 'contracts' },
    forex:     { name: 'Forex',    sample: 'EURUSD', unit: 'pairs' },
    commodity: { name: 'Commodities', sample: 'XAU', unit: 'assets' },
  };

  const refreshMarketMeta = async () => {
    const cards = document.querySelectorAll('.market-card');
    if (!cards.length) return;
    try {
      const { data: { tickers } } = await NovaAPI.tickers();
      const groups = {};
      for (const t of tickers) {
        if (!groups[t.assetClass]) groups[t.assetClass] = [];
        groups[t.assetClass].push(t);
      }
      cards.forEach((card) => {
        const cls = card.dataset.class;
        const group = groups[cls] || [];
        const meta = card.querySelector('[data-cat-meta]');
        if (!group.length || !meta) {
          if (meta) meta.textContent = '—';
          return;
        }
        const gainers = group.filter((t) => t.changePct > 0).length;
        const sample = group.find((t) => t.changePct > 0) || group[0];
        const sign = sample.changePct >= 0 ? '+' : '';
        meta.innerHTML = `<span style="color:var(--text-1)">${group.length} ${labels[cls]?.unit || ''}</span> · <span style="color:${sample.changePct >= 0 ? 'var(--profit)' : 'var(--loss)'}">${sign}${sample.changePct.toFixed(2)}%</span>`;
      });
    } catch (e) {
      console.warn('market meta failed', e);
    }
  };

  // Click on a category card: scroll to the chart and pre-select an asset
  document.querySelectorAll('.market-card').forEach((card) => {
    card.addEventListener('click', () => {
      const cls = card.dataset.class;
      const select = document.getElementById('featuredSymbolSelect');
      if (select) {
        // Find the first option in the matching optgroup
        const group = select.querySelector(`optgroup[label="${cls[0].toUpperCase() + cls.slice(1)}${cls === 'forex' ? '' : 's'}"]`)
          || select.querySelector(`optgroup[label="${cls === 'forex' ? 'Forex' : cls[0].toUpperCase() + cls.slice(1) + 's'}"]`);
        const opt = group ? group.querySelector('option') : null;
        if (opt) {
          select.value = opt.value;
          select.dispatchEvent(new Event('change'));
        }
      }
      const target = document.getElementById('chart');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  refreshMarketMeta();
  setInterval(refreshMarketMeta, 15000);

  // ----- Auth-aware navbar -----
  const updateNavAuth = async () => {
    if (!NovaAPI.getToken()) return;
    try {
      const { data: { user } } = await NovaAPI.me();
      const actions = document.querySelector('.nav-actions');
      if (!actions) return;
      actions.innerHTML = `
        <a href="/dashboard" class="btn btn-ghost">${user.full_name ? user.full_name.split(' ')[0] : 'Dashboard'}</a>
        <button id="navLogout" class="btn btn-secondary btn-sm">Logout</button>
      `;
      document.getElementById('navLogout')?.addEventListener('click', async () => {
        try { await NovaAPI.logout(); } catch (_) {}
        NovaAPI.setToken(null);
        location.reload();
      });
    } catch (e) {
      if (e.status === 401) NovaAPI.setToken(null);
    }
  };
  updateNavAuth();

  // ----- Dynamic site settings (hero, categories, pricing) -----
  const applySettings = async () => {
    let settings;
    try {
      const { data } = await NovaAPI.publicSettings();
      settings = data && data.settings;
    } catch (_) { return; }
    if (!settings) return;

    // Hero copy
    if (settings.hero_headline) {
      const el = document.getElementById('heroHeadline');
      if (el) el.innerHTML = settings.hero_headline;
    }
    if (settings.hero_subtext) {
      const el = document.getElementById('heroSubtext');
      if (el) el.textContent = settings.hero_subtext;
    }

    // Market categories — hide cards not in the list
    const enabled = Array.isArray(settings.market_categories) ? settings.market_categories : null;
    if (enabled) {
      document.querySelectorAll('.market-card').forEach((card) => {
        card.style.display = enabled.includes(card.dataset.class) ? '' : 'none';
      });
    }

    // Pricing plans — replace the static grid
    const grid = document.getElementById('pricingGrid');
    if (grid && Array.isArray(settings.pricing_plans) && settings.pricing_plans.length) {
      const check = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>';
      grid.innerHTML = settings.pricing_plans.map((p) => `
        <div class="card pricing-card ${p.featured ? 'featured' : ''}">
          ${p.featured ? '<div class="badge">MOST POPULAR</div>' : ''}
          <h3>${escapeHtml(p.name)}</h3>
          <div class="tier">${escapeHtml(p.tier || '')}</div>
          <div class="price"><span class="amt">$${Number(p.price || 0)}</span><span class="per">/ ${escapeHtml(p.period || 'month')}</span></div>
          <div class="desc">${escapeHtml(p.description || '')}</div>
          <ul>
            ${(p.features || []).map((f) => `<li>${check} ${escapeHtml(f)}</li>`).join('')}
          </ul>
          <a href="/register" class="btn ${p.featured ? 'btn-primary' : 'btn-secondary'} btn-block">${escapeHtml(p.cta || 'Get started')}</a>
        </div>
      `).join('');
    }
  };
  applySettings();

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
})();
