/* ============================================================================
   Nova — API client.
   All API responses follow { success, message?, data?, error? }.
   - Success: resolves with { success: true, message, data }
   - Error:   rejects with Error augmented with .data, .status
   ============================================================================ */
(function (global) {
  const TOKEN_KEY = 'nova_token';
  const ADMIN_TOKEN_KEY = 'nova_admin_token';

  const getToken     = () => localStorage.getItem(TOKEN_KEY);
  const setToken     = (t) => t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);
  const getAdminToken = () => localStorage.getItem(ADMIN_TOKEN_KEY);
  const setAdminToken = (t) => t ? localStorage.setItem(ADMIN_TOKEN_KEY, t) : localStorage.removeItem(ADMIN_TOKEN_KEY);

  const request = async (method, path, body, opts = {}) => {
    const headers = { 'Content-Type': 'application/json' };
    const token = opts.admin ? getAdminToken() : (opts.token !== undefined ? opts.token : getToken());
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(path, {
      method, headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });

    let data = null;
    const isJson = (res.headers.get('content-type') || '').includes('application/json');
    if (isJson) {
      data = await res.json();
    } else {
      data = { success: res.ok, message: await res.text() };
    }

    if (!res.ok || (data && data.success === false)) {
      const err = new Error((data && data.message) || res.statusText || 'Request failed');
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;  // { success, message, data }
  };

  const NovaAPI = {
    // ----- token storage -----
    getToken, setToken, getAdminToken, setAdminToken,

    // ----- raw request -----
    request,

    // ----- auth (user) -----
    register: (payload) => request('POST', '/api/auth/register', payload),
    login:    (payload) => request('POST', '/api/auth/login', payload),
    logout:   ()        => request('POST', '/api/auth/logout'),
    resendVerification: (email) => request('POST', '/api/auth/resend-verification', { email }),
    forgotPassword:     (email) => request('POST', '/api/auth/forgot-password', { email }),
    resetPassword: (token, password, confirmPassword) =>
      request('POST', '/api/auth/reset-password', { token, password, confirmPassword }),

    // ----- user -----
    me: ()           => request('GET',  '/api/users/me'),
    updateMe: (p)    => request('PATCH', '/api/users/me', p),
    changePassword: (p) => request('POST', '/api/users/me/change-password', p),

    // ----- portfolio -----
    portfolio: () => request('GET', '/api/portfolio'),

    // ----- watchlist -----
    watchlist: () => request('GET', '/api/watchlist'),
    addWatchlist: (symbol, assetClass) => request('POST', '/api/watchlist', { symbol, assetClass }),
    removeWatchlist: (symbol) => request('DELETE', `/api/watchlist/${encodeURIComponent(symbol)}`),

    // ----- withdrawals -----
    withdrawals: () => request('GET', '/api/withdrawals'),
    createWithdrawal: (p) => request('POST', '/api/withdrawals', p),
    cancelWithdrawal: (id) => request('POST', `/api/withdrawals/${id}/cancel`),

    // ----- market -----
    tickers: (assetClass) => request('GET', `/api/market/tickers${assetClass ? '?assetClass=' + assetClass : ''}`),
    ticker:  (symbol)     => request('GET', `/api/market/ticker/${encodeURIComponent(symbol)}`),
    history: (symbol, range) => request('GET', `/api/market/history/${encodeURIComponent(symbol)}?range=${range || '1M'}`),

    // ----- public -----
    publicSettings: () => request('GET', '/api/public/settings'),

    // ----- admin -----
    adminLogin:  (p) => request('POST', '/api/admin/login', p, { admin: true }),
    adminLogout: ()  => request('POST', '/api/admin/logout', undefined, { admin: true }),
    adminMe:     ()  => request('GET',  '/api/admin/me', undefined, { admin: true }),
    adminChangePassword: (p) => request('POST', '/api/admin/change-password', p, { admin: true }),
    adminStats:  ()  => request('GET',  '/api/admin/stats', undefined, { admin: true }),
    adminListUsers: ({ search = '', tier = '', restricted = '', limit = 100, offset = 0 } = {}) => {
      const qs = new URLSearchParams({ search, tier, restricted, limit, offset });
      return request('GET', `/api/admin/users?${qs}`, undefined, { admin: true });
    },
    adminGetUser: (id) => request('GET', `/api/admin/users/${id}`, undefined, { admin: true }),
    adminGetUserWithdrawals: (id) => request('GET', `/api/admin/users/${id}/withdrawals`, undefined, { admin: true }),
    adminEditUser: (id, p) => request('PATCH', `/api/admin/users/${id}`, p, { admin: true }),
    adminSetBalance:    (id, balance)  => request('PATCH', `/api/admin/users/${id}/balance`,    { balance },   { admin: true }),
    adminVerifyUser:    (id)           => request('PATCH', `/api/admin/users/${id}/verify`,     undefined,    { admin: true }),
    adminSetTier:       (id, tier)     => request('PATCH', `/api/admin/users/${id}/tier`,       { tier },      { admin: true }),
    adminSetRestricted: (id, restricted) => request('PATCH', `/api/admin/users/${id}/restrict`, { restricted }, { admin: true }),
    adminDeleteUser:    (id)           => request('DELETE', `/api/admin/users/${id}`, undefined, { admin: true }),
    adminListWithdrawals: ({ status = null, search = '', limit = 100 } = {}) => {
      const qs = new URLSearchParams({ limit });
      if (status) qs.set('status', status);
      if (search) qs.set('search', search);
      return request('GET', `/api/admin/withdrawals?${qs}`, undefined, { admin: true });
    },
    adminUpdateWithdrawal: (id, p) => request('PATCH', `/api/admin/withdrawals/${id}`, p, { admin: true }),
    adminGetSiteSettings: () => request('GET', '/api/admin/site-settings', undefined, { admin: true }),
    adminUpdateSiteSettings: (p) => request('PATCH', '/api/admin/site-settings', p, { admin: true }),
    adminToggleMaintenance: (enabled) => request('POST', '/api/admin/site-settings/maintenance', { enabled }, { admin: true }),
  };

  global.NovaAPI = NovaAPI;
})(window);
