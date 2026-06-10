/* ============================================================================
   Nova — admin dashboard
   Sidebar layout: Overview · Users · Withdrawals · Settings · Account
   ============================================================================ */
(function () {
  if (!NovaAPI.getAdminToken()) location.replace('/admin/login.html');

  // ----- state -----
  const state = {
    users: [],
    withdrawals: [],
    deposits: [],
    investments: [],
    plans: [],
    userSearch: '',
    userTier: '',
    userRestricted: '',
    wdStatus: '',
    wdSearch: '',
    invStatus: '',
    invSearch: '',
    settings: null,
  };

  // ----- helpers -----
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const fmtPrice = (n) => NovaFormat.price(Number(n || 0));
  const fmtCount = (n) => Number(n || 0).toLocaleString();
  const fmtRelative = (iso) => NovaFormat.relativeTime(iso);

  const statusPill = (s) => {
    const labels = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', on_hold: 'On hold', restored: 'Restored' };
    return `<span class="status-pill status-${s}"><span class="dot"></span>${labels[s] || s}</span>`;
  };
  const tierBadge = (t) => `<span class="tier-pill tier-${t}">${t.toUpperCase()}</span>`;

  // Close any open dropdowns
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.row-actions .dropdown')) {
      $$('.row-actions .dropdown-menu.open').forEach((m) => m.classList.remove('open'));
    }
  });

  // ----- mobile sidebar -----
  const sidebar = $('#adminSidebar');
  $('#sidebarToggle')?.addEventListener('click', () => sidebar.classList.toggle('open'));

  // ----- sidebar nav -----
  $$('.admin-nav button').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.admin-nav button').forEach((b) => b.classList.remove('active'));
      $$('.admin-section').forEach((s) => s.classList.remove('active'));
      btn.classList.add('active');
      const id = 'sec-' + btn.dataset.section;
      document.getElementById(id).classList.add('active');
      sidebar.classList.remove('open');
      if (btn.dataset.section === 'users') loadUsers();
      if (btn.dataset.section === 'withdrawals') loadWithdrawals();
      if (btn.dataset.section === 'deposits') loadDeposits();
      if (btn.dataset.section === 'plans') loadPlans();
      if (btn.dataset.section === 'user-investments') loadUserInvestments();
      if (btn.dataset.section === 'settings') loadSettings();
    });
  });

  // ----- logout -----
  $('#adminLogout')?.addEventListener('click', async () => {
    try { await NovaAPI.adminLogout(); } catch (_) {}
    NovaAPI.setAdminToken(null);
    location.replace('/admin/login.html');
  });

  // ----- admin info -----
  (async () => {
    try {
      const { data: { admin } } = await NovaAPI.adminMe();
      $('#adminUserName').textContent = admin.username;
    } catch (e) {
      if (e.status === 401) { NovaAPI.setAdminToken(null); location.replace('/admin/login.html'); }
    }
  })();

  /* ============================================================
     OVERVIEW
     ============================================================ */
  const renderOverview = async () => {
    try {
      const { data: { stats } } = await NovaAPI.adminStats();
      $('#sUsers').textContent = fmtCount(stats.usersCount);
      $('#sVerified').textContent = fmtCount(stats.verifiedCount);
      $('#sBalance').textContent = fmtPrice(stats.totalBalance);
      $('#sTotalWd').textContent = fmtCount(stats.withdrawals.total);
      $('#sPending').textContent = fmtCount(stats.withdrawals.pending);
      $('#sApproved').textContent = fmtCount(stats.withdrawals.approved);
      $('#sRejected').textContent = fmtCount(stats.withdrawals.rejected);
      $('#sOnHold').textContent = fmtCount(stats.withdrawals.on_hold);
      $('#sRestored').textContent = fmtCount(stats.withdrawals.restored);

      // Deposit stats
      if (stats.deposits) {
        $('#sDepPending').textContent = fmtCount(stats.deposits.pending);
        $('#sDepApproved').textContent = fmtCount(stats.deposits.approved);
        $('#sDepRejected').textContent = fmtCount(stats.deposits.rejected);
      }

      // Sidebar counts
      $('#navUsersCount').textContent = fmtCount(stats.usersCount);
      $('#navWdCount').textContent = fmtCount(stats.withdrawals.pending);
      $('#navDepCount').textContent = stats.deposits ? fmtCount(stats.deposits.pending) : '—';
    } catch (e) {
      if (e.status === 401) { NovaAPI.setAdminToken(null); location.replace('/admin/login.html'); }
    }
  };

  /* ============================================================
     USERS
     ============================================================ */
  const loadUsers = async () => {
    const list = $('#usersList');
    list.innerHTML = `<div class="row body"><div style="grid-column: 1 / -1;" class="text-dim center" style="padding:24px;">Loading…</div></div>`;
    try {
      const { data: { users, total } } = await NovaAPI.adminListUsers({
        search: state.userSearch, tier: state.userTier, restricted: state.userRestricted, limit: 200,
      });
      state.users = users;
      $('#usersTotal').textContent = `${fmtCount(users.length)} of ${fmtCount(total)} users`;

      if (!users.length) {
        list.innerHTML = `<div class="row body"><div style="grid-column: 1 / -1;" class="text-dim center" style="padding:24px;">No users found.</div></div>`;
        return;
      }

      list.innerHTML = users.map((u) => {
        const verified = u.email_verified ? '' : '<span class="text-dim" style="font-size:11px;"> · unverified</span>';
        const restricted = u.is_restricted ? ' <span class="restricted-flag">RESTRICTED</span>' : '';
        return `<div class="row user body" data-uid="${u.id}">
          <div style="color:var(--text-0); font-weight:600;">${escapeHtml(u.full_name || '(no name)')}${verified}${restricted}</div>
          <div class="email">${escapeHtml(u.email)}</div>
          <div>${tierBadge(u.account_tier)}</div>
          <div>${u.is_restricted ? '<span class="status-pill status-rejected"><span class="dot"></span>Disabled</span>' : '<span class="status-pill status-approved"><span class="dot"></span>Active</span>'}</div>
          <div class="num mono" style="color:var(--text-0); font-weight:600;">${fmtPrice(u.balance)}</div>
          <div class="row-actions">
            <button class="btn btn-ghost" data-act="view">View</button>
            <button class="btn btn-ghost" data-act="balance">Balance</button>
            <div class="dropdown" style="position:relative;">
              <button class="btn btn-ghost dropdown" data-act="more">⋯</button>
              <div class="dropdown-menu">
                <button class="item" data-act="edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z"/></svg> Edit details</button>
                ${!u.email_verified ? '<button class="item" data-act="verify"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><polyline points="20 6 9 17 4 12"/></svg> Verify email</button>' : ''}
                <button class="item" data-act="tier"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><polygon points="12 2 15 8.5 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 9 8.5 12 2"/></svg> Change tier</button>
                <button class="item" data-act="restrict"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg> ${u.is_restricted ? 'Restore access' : 'Restrict access'}</button>
                <div class="divider"></div>
                <button class="item danger" data-act="delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Delete account</button>
              </div>
            </div>
          </div>
        </div>`;
      }).join('');

      list.querySelectorAll('.row.user').forEach((row) => {
        const uid = row.dataset.uid;
        const user = state.users.find((u) => u.id === uid);
        if (!user) return;
        row.querySelectorAll('[data-act]').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const act = btn.dataset.act;
            if (act === 'more') {
              const menu = btn.nextElementSibling;
              $$('.row-actions .dropdown-menu.open').forEach((m) => { if (m !== menu) m.classList.remove('open'); });
              menu.classList.toggle('open');
              return;
            }
            if (act === 'view')    return openViewUser(user);
            if (act === 'balance') return openBalanceModal(user);
            if (act === 'edit')    return openEditUserModal(user);
            if (act === 'verify')  return doVerifyUser(user);
            if (act === 'tier')    return openTierModal(user);
            if (act === 'restrict')return doToggleRestrict(user);
            if (act === 'delete')  return doDeleteUser(user);
          });
        });
      });
    } catch (e) {
      if (e.status === 401) { NovaAPI.setAdminToken(null); location.replace('/admin/login.html'); return; }
      NovaToast.error(e.message);
      list.innerHTML = `<div class="row body"><div style="grid-column: 1 / -1;"><div class="alert error">${escapeHtml(e.message)}</div></div></div>`;
    }
  };

  // Toolbar wiring
  $('#userSearchBtn')?.addEventListener('click', () => { state.userSearch = $('#userSearch').value.trim(); loadUsers(); });
  $('#userSearch')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { state.userSearch = e.target.value.trim(); loadUsers(); } });
  $('#userTierFilter')?.addEventListener('change', (e) => { state.userTier = e.target.value; loadUsers(); });
  $('#userRestrictedFilter')?.addEventListener('change', (e) => { state.userRestricted = e.target.value; loadUsers(); });

  /* ============================================================
     WITHDRAWALS
     ============================================================ */
  const loadWithdrawals = async () => {
    const list = $('#wdList');
    list.innerHTML = `<div class="row body"><div style="grid-column: 1 / -1;" class="text-dim center" style="padding:24px;">Loading…</div></div>`;
    try {
      const { data: { withdrawals } } = await NovaAPI.adminListWithdrawals({
        status: state.wdStatus || null, search: state.wdSearch, limit: 200,
      });
      state.withdrawals = withdrawals;
      $('#wdTotal').textContent = `${fmtCount(withdrawals.length)} withdrawal(s)`;

      if (!withdrawals.length) {
        list.innerHTML = `<div class="row body"><div style="grid-column: 1 / -1;" class="text-dim center" style="padding:24px;">No withdrawals.</div></div>`;
        return;
      }

      list.innerHTML = withdrawals.map((w) => {
        const user = w.users || {};
        return `<div class="row wd body" data-wid="${w.id}">
          <div class="text-dim">${new Date(w.requested_at).toLocaleString()}</div>
          <div>
            <div style="color:var(--text-0); font-weight:600;">${escapeHtml(user.full_name || '(no name)')}</div>
            <div class="email">${escapeHtml(user.email || '—')}</div>
          </div>
          <div class="num mono" style="color:var(--text-0); font-weight:600;">${fmtPrice(w.amount)}</div>
          <div style="text-transform:capitalize; color:var(--text-2);">${escapeHtml((w.method || '—').replace('_', ' '))}</div>
          <div class="text-dim" style="font-family:var(--font-mono); font-size:11.5px;">${escapeHtml(w.destination || '—')}</div>
          <div>${statusPill(w.status)}</div>
          <div class="row-actions">
            ${w.status === 'pending' || w.status === 'on_hold' ? `<button class="btn btn-secondary" data-act="approve">Approve</button>` : ''}
            ${w.status === 'approved' ? `<button class="btn btn-ghost" data-act="restore">Restore</button>` : ''}
            ${w.status === 'on_hold' ? `<button class="btn btn-ghost" data-act="restore-from-hold">Restore to pending</button>` : ''}
            ${w.status !== 'rejected' && w.status !== 'restored' && w.status !== 'approved' ? `<button class="btn btn-ghost" data-act="on_hold">Hold</button>` : ''}
            ${w.status !== 'rejected' ? `<button class="btn btn-ghost" data-act="reject">Reject</button>` : ''}
          </div>
        </div>`;
      }).join('');

      list.querySelectorAll('.row.wd').forEach((row) => {
        const wid = row.dataset.wid;
        row.querySelectorAll('[data-act]').forEach((btn) => {
          btn.addEventListener('click', () => doWithdrawalAction(wid, btn.dataset.act));
        });
      });
    } catch (e) {
      if (e.status === 401) { NovaAPI.setAdminToken(null); location.replace('/admin/login.html'); return; }
      NovaToast.error(e.message);
    }
  };

  const doWithdrawalAction = async (id, action) => {
    const labels = { approve: 'Approve', reject: 'Reject', on_hold: 'Put on hold', restore: 'Restore funds (refund)', 'restore-from-hold': 'Restore from hold to pending' };
    if (!confirm(`${labels[action]} this withdrawal?`)) return;
    try {
      const { message } = await NovaAPI.adminUpdateWithdrawal(id, { action });
      NovaToast.success(message || 'Updated.');
      loadWithdrawals();
      renderOverview();
    } catch (e) { NovaToast.error(e.message); }
  };

  $('#wdFilterBtn')?.addEventListener('click', () => { state.wdStatus = $('#wdFilter').value; loadWithdrawals(); });
  $('#wdSearch')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { state.wdSearch = e.target.value.trim(); loadWithdrawals(); } });

  /* ============================================================
     SETTINGS
     ============================================================ */
  const loadSettings = async () => {
    try {
      const { data: { settings } } = await NovaAPI.adminGetSiteSettings();
      state.settings = settings;
      // Maintenance toggle
      $('#maintToggle').checked = !!settings.maintenance_mode;
      // Hero
      $('#heroHeadline').value = settings.hero_headline || '';
      $('#heroSubtext').value = settings.hero_subtext || '';
      // Categories
      const allCats = ['crypto', 'stock', 'future', 'forex', 'commodity'];
      const enabled = settings.market_categories || allCats;
      $('#catsList').innerHTML = allCats.map((c) => `
        <div class="toggle-row">
          <div class="lbl">
            <div class="t">${c[0].toUpperCase() + c.slice(1)}</div>
            <div class="d">Show "${c}" category on the homepage</div>
          </div>
          <label class="switch">
            <input type="checkbox" data-cat="${c}" ${enabled.includes(c) ? 'checked' : ''} />
            <span class="slider"></span>
          </label>
        </div>
      `).join('');
      // Pricing
      renderPricingEditor(settings.pricing_plans || []);

      // Deposit wallets
      const wallets = settings.deposit_wallets || {};
      $('#walletBitcoin').value = wallets.bitcoin || '';
      $('#walletEthereum').value = wallets.ethereum || '';
      $('#walletPaypal').value = wallets.paypal_email || '';
      $('#walletPayoneer').value = wallets.payoneer_email || '';

      // ROI rates
      const roi = settings.investment_roi || {};
      $('#roi30').value = roi['30'] || '';
      $('#roi60').value = roi['60'] || '';
      $('#roi90').value = roi['90'] || '';
      $('#roi180').value = roi['180'] || '';
      $('#roi365').value = roi['365'] || '';
    } catch (e) {
      if (e.status === 401) { NovaAPI.setAdminToken(null); location.replace('/admin/login.html'); }
      NovaToast.error(e.message);
    }
  };

  const renderPricingEditor = (plans) => {
    $('#pricingList').innerHTML = plans.map((p) => `
      <div class="pricing-form ${p.featured ? 'featured' : ''}" data-pid="${p.id}">
        <h4>${escapeHtml(p.name)} ${p.featured ? '<span class="tier-pill tier-pro">FEATURED</span>' : ''}</h4>
        <div class="form-group"><label>Name</label><input class="input" data-field="name" value="${escapeHtml(p.name || '')}" /></div>
        <div class="form-group"><label>Tagline</label><input class="input" data-field="tier" value="${escapeHtml(p.tier || '')}" /></div>
        <div class="form-group"><label>Price (USD)</label><input class="input" type="number" min="0" step="1" data-field="price" value="${Number(p.price) || 0}" /></div>
        <div class="form-group"><label>Period</label><input class="input" data-field="period" value="${escapeHtml(p.period || 'month')}" /></div>
        <div class="form-group"><label>Description</label><textarea class="input" rows="2" data-field="description">${escapeHtml(p.description || '')}</textarea></div>
        <div class="form-group"><label>CTA button</label><input class="input" data-field="cta" value="${escapeHtml(p.cta || '')}" /></div>
      </div>
    `).join('');
  };

  const collectPricingFromForm = () => {
    return $$('#pricingList .pricing-form').map((form) => {
      const get = (f) => form.querySelector(`[data-field="${f}"]`).value;
      return {
        id: form.dataset.pid,
        name: get('name'),
        tier: get('tier'),
        price: Number(get('price')) || 0,
        period: get('period'),
        description: get('description'),
        features: state.settings.pricing_plans.find((p) => p.id === form.dataset.pid)?.features || [],
        featured: state.settings.pricing_plans.find((p) => p.id === form.dataset.pid)?.featured || false,
        cta: get('cta'),
      };
    });
  };

  $('#saveSettingsBtn')?.addEventListener('click', async () => {
    const maintenance = $('#maintToggle').checked;
    const hero_headline = $('#heroHeadline').value;
    const hero_subtext = $('#heroSubtext').value;
    const market_categories = $$('#catsList input[type="checkbox"]').filter((c) => c.checked).map((c) => c.dataset.cat);
    const pricing_plans = collectPricingFromForm();
    const deposit_wallets = {
      bitcoin: $('#walletBitcoin').value.trim(),
      ethereum: $('#walletEthereum').value.trim(),
      paypal_email: $('#walletPaypal').value.trim(),
      payoneer_email: $('#walletPayoneer').value.trim(),
    };
    const investment_roi = {
      '30': Number($('#roi30').value) || 5,
      '60': Number($('#roi60').value) || 12,
      '90': Number($('#roi90').value) || 22,
      '180': Number($('#roi180').value) || 40,
      '365': Number($('#roi365').value) || 60,
    };

    try {
      await NovaAPI.adminUpdateSiteSettings({ maintenance_mode: maintenance, hero_headline, hero_subtext, market_categories, pricing_plans, deposit_wallets, investment_roi });
      NovaToast.success('Site settings saved.');
      state.settings = null;
      loadSettings();
    } catch (e) { NovaToast.error(e.message); }
  });

  /* ============================================================
     ACCOUNT — change admin password
     ============================================================ */
  $('#accountForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = $('#apCurrent').value;
    const newPassword = $('#apNew').value;
    const confirmPassword = $('#apConfirm').value;
    if (newPassword.length < 8) return NovaToast.warning('New password must be at least 8 characters.');
    if (newPassword !== confirmPassword) return NovaToast.error('New passwords do not match.');
    try {
      await NovaAPI.adminChangePassword({ currentPassword, newPassword, confirmPassword });
      NovaToast.success('Admin password updated.');
      e.target.reset();
    } catch (err) { NovaToast.error(err.message); }
  });

  /* ============================================================
     ACTIONS
     ============================================================ */
  const doVerifyUser = async (user) => {
    try {
      const { message } = await NovaAPI.adminVerifyUser(user.id);
      NovaToast.success(message || 'User verified.');
      loadUsers(); renderOverview();
    } catch (e) { NovaToast.error(e.message); }
  };

  const doToggleRestrict = async (user) => {
    if (!confirm(`${user.is_restricted ? 'Restore access for' : 'Restrict'} ${user.email}?`)) return;
    try {
      const { message } = await NovaAPI.adminSetRestricted(user.id, !user.is_restricted);
      NovaToast.success(message || 'Updated.');
      loadUsers(); renderOverview();
    } catch (e) { NovaToast.error(e.message); }
  };

  const doDeleteUser = async (user) => {
    if (!confirm(`Permanently delete ${user.email}? This cannot be undone.`)) return;
    if (!confirm('Are you absolutely sure? All holdings, withdrawals, and watchlist entries will be deleted.')) return;
    try {
      const { message } = await NovaAPI.adminDeleteUser(user.id);
      NovaToast.success(message || 'User deleted.');
      loadUsers(); renderOverview();
    } catch (e) { NovaToast.error(e.message); }
  };

  const openTierModal = (user) => {
    const next = user.account_tier === 'free' ? 'pro' : user.account_tier === 'pro' ? 'elite' : 'free';
    if (confirm(`Change ${user.email}'s tier from ${user.account_tier.toUpperCase()} to ${next.toUpperCase()}?`)) {
      NovaAPI.adminSetTier(user.id, next)
        .then(({ message }) => { NovaToast.success(message || 'Tier updated.'); loadUsers(); })
        .catch((e) => NovaToast.error(e.message));
    }
  };

  /* ============================================================
     MODALS
     ============================================================ */
  const balanceModal = $('#balanceModal');
  const openBalanceModal = (user) => {
    $('#balUserLabel').textContent = `User: ${user.email} · current balance ${fmtPrice(user.balance)}`;
    $('#balAmount').value = user.balance;
    balanceModal.dataset.uid = user.id;
    balanceModal.classList.add('open');
  };
  $('#balCancel')?.addEventListener('click', () => balanceModal.classList.remove('open'));
  $('#balanceForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = balanceModal.dataset.uid;
    const balance = Number($('#balAmount').value);
    if (!Number.isFinite(balance) || balance < 0) return NovaToast.warning('Enter a non-negative number.');
    try {
      const { message } = await NovaAPI.adminSetBalance(id, balance);
      NovaToast.success(message || 'Balance updated.');
      balanceModal.classList.remove('open');
      loadUsers(); renderOverview();
    } catch (e) { NovaToast.error(e.message); }
  });

  const editModal = $('#editModal');
  const openEditUserModal = (user) => {
    $('#editUid').value = user.id;
    $('#editName').value = user.full_name || '';
    $('#editEmail').value = user.email;
    $('#editTier').value = user.account_tier;
    $('#editBalance').value = user.balance;
    editModal.classList.add('open');
  };
  $('#editCancel')?.addEventListener('click', () => editModal.classList.remove('open'));
  $('#editForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('#editUid').value;
    const payload = {
      fullName: $('#editName').value.trim(),
      email: $('#editEmail').value.trim(),
      accountTier: $('#editTier').value,
      balance: Number($('#editBalance').value),
    };
    try {
      const { message } = await NovaAPI.adminEditUser(id, payload);
      NovaToast.success(message || 'User updated.');
      editModal.classList.remove('open');
      loadUsers(); renderOverview();
    } catch (e) { NovaToast.error(e.message); }
  });

  const viewModal = $('#viewModal');
  const openViewUser = async (user) => {
    $('#viewName').textContent = user.full_name || '—';
    $('#viewEmail').textContent = user.email;
    $('#viewTier').textContent = user.account_tier.toUpperCase();
    $('#viewStatus').textContent = user.is_restricted ? 'RESTRICTED' : (user.email_verified ? 'Active' : 'Unverified');
    $('#viewBalance').textContent = fmtPrice(user.balance);
    $('#viewCreated').textContent = new Date(user.created_at).toLocaleString();
    $('#viewLastLogin').textContent = user.last_login_at ? new Date(user.last_login_at).toLocaleString() : '—';
    $('#viewUserWdBody').innerHTML = `<tr><td colspan="4" class="text-dim center" style="padding:16px;">Loading…</td></tr>`;
    $('#viewUserInvBody').innerHTML = `<tr><td colspan="5" class="text-dim center" style="padding:16px;">Loading…</td></tr>`;
    viewModal.classList.add('open');
    try {
      const { data: { withdrawals } } = await NovaAPI.adminGetUserWithdrawals(user.id);
      if (!withdrawals.length) {
        $('#viewUserWdBody').innerHTML = `<tr><td colspan="4" class="text-dim center" style="padding:16px;">No withdrawals.</td></tr>`;
      } else {
        $('#viewUserWdBody').innerHTML = withdrawals.map((w) => `<tr>
          <td class="text-dim">${new Date(w.requested_at).toLocaleDateString()}</td>
          <td class="num mono" style="color:var(--text-0); font-weight:600;">${fmtPrice(w.amount)}</td>
          <td>${statusPill(w.status)}</td>
          <td class="text-dim" style="font-size:12px;">${escapeHtml(w.notes || '—')}</td>
        </tr>`).join('');
      }
    } catch (e) { NovaToast.error(e.message); }
    try {
      const { data: { investments } } = await NovaAPI.adminGetUserInvestments(user.id);
      if (!investments.length) {
        $('#viewUserInvBody').innerHTML = `<tr><td colspan="5" class="text-dim center" style="padding:16px;">No investments.</td></tr>`;
      } else {
        const statusPillInv = (s) => {
          const labels = { active: 'Active', completed: 'Completed', cancelled: 'Cancelled' };
          return `<span class="status-pill status-${s === 'active' ? 'approved' : s === 'completed' ? 'pending' : 'rejected'}"><span class="dot"></span>${labels[s] || s}</span>`;
        };
        $('#viewUserInvBody').innerHTML = investments.map((inv) => `<tr>
          <td class="text-dim">${new Date(inv.created_at).toLocaleDateString()}</td>
          <td style="color:var(--text-0);">${escapeHtml(inv.asset_label)}</td>
          <td class="num mono" style="color:var(--text-0); font-weight:600;">${fmtPrice(inv.amount)}</td>
          <td class="num mono" style="color:var(--profit);">+ ${fmtPrice(inv.roi_earned_so_far || 0)}</td>
          <td class="num mono" style="color:var(--profit);">+ ${fmtPrice(inv.expected_return)}</td>
          <td>${statusPillInv(inv.status)}</td>
        </tr>`).join('');
      }
    } catch (e) { NovaToast.error(e.message); }
  };
  $('#viewClose')?.addEventListener('click', () => viewModal.classList.remove('open'));
  $('#viewUserBtn')?.addEventListener('click', () => {
    viewModal.classList.remove('open');
    if (viewModal.dataset.uid) {
      const u = state.users.find((x) => x.id === viewModal.dataset.uid);
      if (u) openEditUserModal(u);
    }
  });

  // Close modals on backdrop click
  $$('.modal-backdrop').forEach((m) => {
    m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('open'); });
  });

  /* ============================================================
     UTILS
     ============================================================ */
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ============================================================
     BOOT
     ============================================================ */
  /* ============================================================
     DEPOSITS (admin)
     ============================================================ */
  const loadDeposits = async () => {
    const list = $('#depList');
    list.innerHTML = `<div class="row body"><div style="grid-column: 1 / -1;" class="text-dim center" style="padding:24px;">Loading…</div></div>`;
    try {
      const { data: { deposits } } = await NovaAPI.adminListDeposits({
        status: state.wdStatus || null, search: state.wdSearch, limit: 200,
      });
      state.deposits = deposits;
      $('#depTotal').textContent = `${fmtCount(deposits.length)} deposit(s)`;

      if (!deposits.length) {
        list.innerHTML = `<div class="row body"><div style="grid-column: 1 / -1;" class="text-dim center" style="padding:24px;">No deposits.</div></div>`;
        return;
      }

      const methodLabels = { bitcoin: 'Bitcoin', ethereum: 'Ethereum', usdt: 'USDT', paypal: 'PayPal', payoneer: 'Payoneer', gift_card: 'Gift Card' };
      list.innerHTML = deposits.map((d) => {
        const user = d.users || {};
        return `<div class="row dep body" data-did="${d.id}">
          <div class="text-dim">${new Date(d.requested_at).toLocaleString()}</div>
          <div>
            <div style="color:var(--text-0); font-weight:600;">${escapeHtml(user.full_name || '(no name)')}</div>
            <div class="email">${escapeHtml(user.email || '—')}</div>
          </div>
          <div class="num mono" style="color:var(--text-0); font-weight:600;">${fmtPrice(d.amount)}</div>
          <div style="text-transform:capitalize; color:var(--text-2);">${methodLabels[d.method] || d.method.replace('_', ' ')}</div>
          <div>${statusPill(d.status)}</div>
          <div class="row-actions">
            ${d.status === 'pending' ? `<button class="btn btn-secondary" data-act="approve">Approve</button><button class="btn btn-ghost" data-act="reject">Reject</button>` : ''}
          </div>
        </div>`;
      }).join('');

      list.querySelectorAll('.row.dep').forEach((row) => {
        const did = row.dataset.did;
        row.querySelectorAll('[data-act]').forEach((btn) => {
          btn.addEventListener('click', () => doDepositAction(did, btn.dataset.act));
        });
      });
    } catch (e) {
      if (e.status === 401) { NovaAPI.setAdminToken(null); location.replace('/admin/login.html'); return; }
      NovaToast.error(e.message);
    }
  };

  const doDepositAction = async (id, action) => {
    if (!confirm(`${action === 'approve' ? 'Approve' : 'Reject'} this deposit? This will ${action === 'approve' ? 'credit the user\'s balance' : 'reject the request'} immediately.`)) return;
    try {
      const { message } = await NovaAPI.adminUpdateDeposit(id, { action });
      NovaToast.success(message || 'Updated.');
      loadDeposits();
      renderOverview();
    } catch (e) { NovaToast.error(e.message); }
  };

  $('#depFilterBtn')?.addEventListener('click', () => { state.wdStatus = $('#depFilter').value; loadDeposits(); });
  $('#depSearch')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { state.wdSearch = e.target.value.trim(); loadDeposits(); } });

  /* ============================================================
     USER INVESTMENTS (admin)
     ============================================================ */
  const loadUserInvestments = async () => {
    const list = $('#invList');
    list.innerHTML = `<div class="row body"><div style="grid-column: 1 / -1;" class="text-dim center" style="padding:24px;">Loading…</div></div>`;
    try {
      const { data: { investments } } = await NovaAPI.adminListInvestments({
        status: state.invStatus || null, search: state.invSearch, limit: 200,
      });
      state.investments = investments;
      $('#invTotal').textContent = `${fmtCount(investments.length)} investment(s)`;

      if (!investments.length) {
        list.innerHTML = `<div class="row body"><div style="grid-column: 1 / -1;" class="text-dim center" style="padding:24px;">No user investments.</div></div>`;
        return;
      }

      const statusPillInv = (s) => {
        const labels = { active: 'Active', completed: 'Completed', cancelled: 'Cancelled' };
        return `<span class="status-pill status-${s === 'active' ? 'approved' : s === 'completed' ? 'pending' : 'rejected'}"><span class="dot"></span>${labels[s] || s}</span>`;
      };

      list.innerHTML = investments.map((inv) => {
        const user = inv.users || {};
        return `<div class="row inv body">
          <div class="text-dim">${new Date(inv.created_at).toLocaleDateString()}</div>
          <div>
            <div style="color:var(--text-0); font-weight:600;">${escapeHtml(user.full_name || '(no name)')}</div>
            <div class="email">${escapeHtml(user.email || '—')}</div>
          </div>
          <div class="num mono" style="color:var(--text-0); font-weight:600;">${fmtPrice(inv.amount)}</div>
          <div class="num mono" style="color:var(--profit);">+ ${fmtPrice(inv.roi_earned_so_far || 0)}</div>
          <div class="num mono" style="color:var(--profit);">+ ${fmtPrice(inv.expected_return)}</div>
          <div style="color:var(--text-2);">${escapeHtml(inv.asset_label)}</div>
          <div class="text-dim">${inv.duration_days}d</div>
          <div>${statusPillInv(inv.status)}</div>
        </div>`;
      }).join('');
    } catch (e) {
      if (e.status === 401) { NovaAPI.setAdminToken(null); location.replace('/admin/login.html'); return; }
      NovaToast.error(e.message);
    }
  };

  $('#invFilterBtn')?.addEventListener('click', () => { state.invStatus = $('#invFilter').value; loadUserInvestments(); });
  $('#invSearch')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { state.invSearch = e.target.value.trim(); loadUserInvestments(); } });

  /* ============================================================
     INVESTMENT PLANS (admin)
     ============================================================ */
  const loadPlans = async () => {
    const list = $('#planList');
    list.innerHTML = `<div class="row body"><div style="grid-column: 1 / -1;" class="text-dim center" style="padding:24px;">Loading…</div></div>`;
    try {
      const { data: { plans } } = await NovaAPI.adminListInvestmentPlans();
      state.plans = plans;

      if (!plans.length) {
        list.innerHTML = `<div class="row body"><div style="grid-column: 1 / -1;" class="text-dim center" style="padding:24px;">No investment plans. Create one.</div></div>`;
        return;
      }

      list.innerHTML = plans.map((p) => `<div class="row plan body" data-pid="${p.id}">
        <div style="color:var(--text-0); font-weight:600;">${escapeHtml(p.name)}</div>
        <div class="num mono">$${Number(p.min_amount).toLocaleString()}</div>
        <div class="num mono">${p.max_amount ? '$' + Number(p.max_amount).toLocaleString() : '<span class="text-dim">∞</span>'}</div>
        <div class="num mono" style="color:var(--profit);">${p.daily_roi}%</div>
        <div class="num mono">${p.duration_days}d</div>
        <div>${p.is_active ? '<span class="status-pill status-approved"><span class="dot"></span>Active</span>' : '<span class="status-pill status-rejected"><span class="dot"></span>Inactive</span>'}</div>
        <div class="row-actions">
          <button class="btn btn-ghost" data-act="edit">Edit</button>
          <button class="btn btn-ghost" data-act="toggle">${p.is_active ? 'Deactivate' : 'Activate'}</button>
          <button class="btn btn-ghost danger" data-act="delete">Delete</button>
        </div>
      </div>`).join('');

      list.querySelectorAll('.row.plan').forEach((row) => {
        const pid = row.dataset.pid;
        const plan = state.plans.find((p) => p.id === pid);
        if (!plan) return;
        row.querySelectorAll('[data-act]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const act = btn.dataset.act;
            if (act === 'edit') return openPlanModal(plan);
            if (act === 'toggle') return doTogglePlan(plan);
            if (act === 'delete') return doDeletePlan(plan);
          });
        });
      });
    } catch (e) {
      if (e.status === 401) { NovaAPI.setAdminToken(null); location.replace('/admin/login.html'); return; }
      NovaToast.error(e.message);
    }
  };

  const planModal = $('#planModal');
  const openPlanModal = (plan) => {
    const isEdit = !!plan;
    $('#planModalTitle').textContent = isEdit ? 'Edit Investment Plan' : 'Add Investment Plan';
    $('#planId').value = isEdit ? plan.id : '';
    $('#planName').value = isEdit ? plan.name : '';
    $('#planMin').value = isEdit ? plan.min_amount : '';
    $('#planMax').value = isEdit && plan.max_amount ? plan.max_amount : '';
    $('#planRoi').value = isEdit ? plan.daily_roi : '';
    $('#planDuration').value = isEdit ? plan.duration_days : '';
    $('#planFeatures').value = isEdit && Array.isArray(plan.features) ? plan.features.join('\n') : '';
    $('#planActive').checked = isEdit ? plan.is_active : true;
    planModal.classList.add('open');
  };

  $('#addPlanBtn')?.addEventListener('click', () => openPlanModal(null));
  $('#planCancel')?.addEventListener('click', () => planModal.classList.remove('open'));

  $('#planForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('#planId').value;
    const payload = {
      name: $('#planName').value.trim(),
      minAmount: Number($('#planMin').value),
      maxAmount: $('#planMax').value ? Number($('#planMax').value) : null,
      dailyRoi: Number($('#planRoi').value),
      durationDays: Number($('#planDuration').value),
      features: $('#planFeatures').value.split('\n').filter((l) => l.trim()).map((l) => l.trim()),
      isActive: $('#planActive').checked,
    };
    try {
      if (id) {
        await NovaAPI.adminUpdateInvestmentPlan(id, payload);
        NovaToast.success('Plan updated.');
      } else {
        await NovaAPI.adminCreateInvestmentPlan(payload);
        NovaToast.success('Plan created.');
      }
      planModal.classList.remove('open');
      loadPlans();
    } catch (e) { NovaToast.error(e.message); }
  });

  const doTogglePlan = async (plan) => {
    try {
      const { message } = await NovaAPI.adminToggleInvestmentPlan(plan.id);
      NovaToast.success(message || 'Toggled.');
      loadPlans();
    } catch (e) { NovaToast.error(e.message); }
  };

  const doDeletePlan = async (plan) => {
    if (!confirm(`Are you sure you want to delete "${plan.name}"?`)) return;
    try {
      const { message } = await NovaAPI.adminDeleteInvestmentPlan(plan.id);
      NovaToast.success(message || 'Deleted.');
      loadPlans();
    } catch (e) { NovaToast.error(e.message); }
  };

  /* ============================================================
     BOOT
     ============================================================ */
  renderOverview();
  loadUsers();
  setInterval(renderOverview, 30000);
  setInterval(() => {
    const sec = $('.admin-section.active');
    if (!sec) return;
    if (sec.id === 'sec-users') loadUsers();
    if (sec.id === 'sec-withdrawals') loadWithdrawals();
    if (sec.id === 'sec-deposits') loadDeposits();
    if (sec.id === 'sec-plans') loadPlans();
    if (sec.id === 'sec-user-investments') loadUserInvestments();
  }, 20000);
})();
