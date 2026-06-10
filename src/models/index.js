const { getSupabaseAdmin, getSupabase } = require('../config/supabase');

const useAdmin = () => getSupabaseAdmin() || getSupabase();

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
const Users = {
  async findByEmail(email) {
    const { data, error } = await useAdmin()
      .from('users')
      .select('*')
      .ilike('email', email)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async findById(id) {
    const { data, error } = await useAdmin()
      .from('users')
      .select('id, full_name, email, email_verified, is_restricted, account_tier, balance, avatar_url, last_login_at, created_at')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async findByIdWithSecrets(id) {
    const { data, error } = await useAdmin()
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async create({ email, passwordHash, fullName, balance = 0 }) {
    const { data, error } = await useAdmin()
      .from('users')
      .insert({
        email: email.toLowerCase().trim(),
        password_hash: passwordHash,
        full_name: fullName || null,
        balance,
      })
      .select('id, full_name, email, email_verified, is_restricted, account_tier, balance, created_at')
      .single();
    if (error) throw error;
    return data;
  },

  async updateLastLogin(id) {
    const { error } = await useAdmin()
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async setEmailVerified(id) {
    const { error } = await useAdmin()
      .from('users')
      .update({ email_verified: true })
      .eq('id', id);
    if (error) throw error;
  },

  async updatePassword(id, passwordHash) {
    const { error } = await useAdmin()
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('id', id);
    if (error) throw error;
  },

  async updateProfile(id, { fullName, avatarUrl }) {
    const update = {};
    if (fullName !== undefined) update.full_name = fullName;
    if (avatarUrl !== undefined) update.avatar_url = avatarUrl;
    if (Object.keys(update).length === 0) return;
    const { error } = await useAdmin().from('users').update(update).eq('id', id);
    if (error) throw error;
  },

  async adminSetBalance(id, balance) {
    const { error } = await useAdmin()
      .from('users')
      .update({ balance })
      .eq('id', id);
    if (error) throw error;
  },

  async adminSetRestricted(id, isRestricted) {
    const { error } = await useAdmin()
      .from('users')
      .update({ is_restricted: !!isRestricted })
      .eq('id', id);
    if (error) throw error;
  },

  async adminSetTier(id, tier) {
    const { error } = await useAdmin()
      .from('users')
      .update({ account_tier: tier })
      .eq('id', id);
    if (error) throw error;
  },

  async adminVerify(id) {
    const { error } = await useAdmin()
      .from('users')
      .update({ email_verified: true })
      .eq('id', id);
    if (error) throw error;
  },

  async adminEdit(id, { fullName, email, balance, accountTier }) {
    const update = {};
    if (fullName !== undefined) update.full_name = fullName;
    if (email !== undefined) update.email = String(email).toLowerCase().trim();
    if (balance !== undefined) update.balance = balance;
    if (accountTier !== undefined) update.account_tier = accountTier;
    if (Object.keys(update).length === 0) return await Users.findById(id);
    const { error } = await useAdmin().from('users').update(update).eq('id', id);
    if (error) throw error;
    return await Users.findById(id);
  },

  async delete(id) {
    const { error } = await useAdmin().from('users').delete().eq('id', id);
    if (error) throw error;
  },

  async listAll({ limit = 200, offset = 0, search = '', tier = '', restricted = '' } = {}) {
    let q = useAdmin()
      .from('users')
      .select('id, full_name, email, email_verified, is_restricted, account_tier, balance, last_login_at, created_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (search) q = q.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
    if (tier) q = q.eq('account_tier', tier);
    if (restricted === 'true') q = q.eq('is_restricted', true);
    if (restricted === 'false') q = q.eq('is_restricted', false);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  async countAll() {
    const { count, error } = await useAdmin()
      .from('users')
      .select('*', { count: 'exact', head: true });
    if (error) throw error;
    return count || 0;
  },

  async countVerified() {
    const { count, error } = await useAdmin()
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('email_verified', true);
    if (error) throw error;
    return count || 0;
  },

  async sumBalance() {
    // Use raw SQL via the rpc-less PostgREST API by selecting the column and summing client-side.
    // For accuracy in production, switch to a Postgres function. Here we use a simple aggregate.
    const { data, error } = await useAdmin()
      .from('users')
      .select('balance');
    if (error) throw error;
    return (data || []).reduce((s, r) => s + Number(r.balance || 0), 0);
  },
};

// ---------------------------------------------------------------------------
// Holdings
// ---------------------------------------------------------------------------
const Holdings = {
  async listByUser(userId) {
    const { data, error } = await useAdmin()
      .from('holdings')
      .select('*')
      .eq('user_id', userId)
      .order('symbol', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async upsert({ userId, symbol, assetClass, quantity, avgCost }) {
    const { data, error } = await useAdmin()
      .from('holdings')
      .upsert(
        { user_id: userId, symbol, asset_class: assetClass, quantity, avg_cost: avgCost },
        { onConflict: 'user_id,symbol' }
      )
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async remove(userId, symbol) {
    const { error } = await useAdmin()
      .from('holdings')
      .delete()
      .eq('user_id', userId)
      .eq('symbol', symbol);
    if (error) throw error;
  },
};

// ---------------------------------------------------------------------------
// Watchlist
// ---------------------------------------------------------------------------
const Watchlist = {
  async listByUser(userId) {
    const { data, error } = await useAdmin()
      .from('watchlist')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async add({ userId, symbol, assetClass }) {
    const { data, error } = await useAdmin()
      .from('watchlist')
      .upsert(
        { user_id: userId, symbol, asset_class: assetClass },
        { onConflict: 'user_id,symbol' }
      )
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async remove(userId, symbol) {
    const { error } = await useAdmin()
      .from('watchlist')
      .delete()
      .eq('user_id', userId)
      .eq('symbol', symbol);
    if (error) throw error;
  },
};

// ---------------------------------------------------------------------------
// Withdrawals
// ---------------------------------------------------------------------------
const Withdrawals = {
  async listByUser(userId, limit = 50) {
    const { data, error } = await useAdmin()
      .from('withdrawals')
      .select('*')
      .eq('user_id', userId)
      .order('requested_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  async listAll({ limit = 200, status = null, search = '' } = {}) {
    let q = useAdmin()
      .from('withdrawals')
      .select('*, users:user_id ( id, full_name, email )')
      .order('requested_at', { ascending: false })
      .limit(limit);
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;
    let rows = data || [];
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter(
        (w) =>
          (w.users?.email || '').toLowerCase().includes(s) ||
          (w.users?.full_name || '').toLowerCase().includes(s) ||
          (w.destination || '').toLowerCase().includes(s)
      );
    }
    return rows;
  },

  async findById(id) {
    const { data, error } = await useAdmin()
      .from('withdrawals')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async create({ userId, amount, method = null, destination = null, notes = null }) {
    const { data, error } = await useAdmin()
      .from('withdrawals')
      .insert({
        user_id: userId,
        amount,
        method,
        destination,
        notes,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async setStatus(id, status, notes = null) {
    const update = { status };
    if (notes !== null) update.notes = notes;
    const { data, error } = await useAdmin()
      .from('withdrawals')
      .update(update)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async countAll() {
    const { count, error } = await useAdmin()
      .from('withdrawals')
      .select('*', { count: 'exact', head: true });
    if (error) throw error;
    return count || 0;
  },

  async countByStatus(status) {
    const { count, error } = await useAdmin()
      .from('withdrawals')
      .select('*', { count: 'exact', head: true })
      .eq('status', status);
    if (error) throw error;
    return count || 0;
  },
};

// ---------------------------------------------------------------------------
// Email tokens
// ---------------------------------------------------------------------------
const EmailTokens = {
  async create({ userId, token, type, expiresAt }) {
    const { error } = await useAdmin()
      .from('email_tokens')
      .insert({ user_id: userId, token, type, expires_at: expiresAt });
    if (error) throw error;
  },

  async findValid(token, type) {
    const { data, error } = await useAdmin()
      .from('email_tokens')
      .select('*')
      .eq('token', token)
      .eq('type', type)
      .eq('used', false)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async findByToken(token) {
    const { data, error } = await useAdmin()
      .from('email_tokens')
      .select('*')
      .eq('token', token)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async markUsed(id) {
    const { error } = await useAdmin()
      .from('email_tokens')
      .update({ used: true })
      .eq('id', id);
    if (error) throw error;
  },

  async invalidateAllForUser(userId, type) {
    const { error } = await useAdmin()
      .from('email_tokens')
      .update({ used: true })
      .eq('user_id', userId)
      .eq('type', type)
      .eq('used', false);
    if (error) throw error;
  },
};

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
const Admin = {
  async findByUsername(username) {
    const { data, error } = await useAdmin()
      .from('admin')
      .select('*')
      .ilike('username', username)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async findById(id) {
    const { data, error } = await useAdmin()
      .from('admin')
      .select('id, username, created_at')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async findByIdWithSecrets(id) {
    const { data, error } = await useAdmin()
      .from('admin')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async createIfMissing({ username, passwordHash }) {
    const existing = await this.findByUsername(username);
    if (existing) return existing;
    const { data, error } = await useAdmin()
      .from('admin')
      .insert({ username, password_hash: passwordHash })
      .select('id, username, created_at')
      .single();
    if (error) throw error;
    return data;
  },

  async updatePassword(id, passwordHash) {
    const { error } = await useAdmin()
      .from('admin')
      .update({ password_hash: passwordHash })
      .eq('id', id);
    if (error) throw error;
  },
};

// ---------------------------------------------------------------------------
// Site Settings (key-value store)
// ---------------------------------------------------------------------------
const SiteSettings = {
  async get(key, fallback = null) {
    const { data, error } = await useAdmin()
      .from('site_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error) throw error;
    if (!data) return fallback;
    return data.value;
  },

  async getAll() {
    const { data, error } = await useAdmin()
      .from('site_settings')
      .select('key, value, updated_at');
    if (error) throw error;
    const out = {};
    for (const row of data || []) out[row.key] = row.value;
    return out;
  },

  async set(key, value) {
    const { error } = await useAdmin()
      .from('site_settings')
      .upsert({ key, value });
    if (error) throw error;
    return this.get(key);
  },

  async setMany(obj) {
    const rows = Object.entries(obj).map(([key, value]) => ({ key, value }));
    if (!rows.length) return this.getAll();
    const { error } = await useAdmin()
      .from('site_settings')
      .upsert(rows);
    if (error) throw error;
    return this.getAll();
  },
};

// ---------------------------------------------------------------------------
// Deposits
// ---------------------------------------------------------------------------
const Deposits = {
  async listByUser(userId, limit = 50) {
    const { data, error } = await useAdmin()
      .from('deposits')
      .select('*')
      .eq('user_id', userId)
      .order('requested_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  async listAll({ limit = 200, status = null, search = '' } = {}) {
    let q = useAdmin()
      .from('deposits')
      .select('*, users:user_id ( id, full_name, email )')
      .order('requested_at', { ascending: false })
      .limit(limit);
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;
    let rows = data || [];
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter(
        (d) =>
          (d.users?.email || '').toLowerCase().includes(s) ||
          (d.users?.full_name || '').toLowerCase().includes(s)
      );
    }
    return rows;
  },

  async findById(id) {
    const { data, error } = await useAdmin()
      .from('deposits')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async create({ userId, amount, method, methodMeta = null, notes = null }) {
    const { data, error } = await useAdmin()
      .from('deposits')
      .insert({
        user_id: userId,
        amount,
        method,
        method_meta: methodMeta,
        notes,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async setStatus(id, status, notes = null) {
    const update = { status };
    if (notes !== null) update.notes = notes;
    const { data, error } = await useAdmin()
      .from('deposits')
      .update(update)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async countAll() {
    const { count, error } = await useAdmin()
      .from('deposits')
      .select('*', { count: 'exact', head: true });
    if (error) throw error;
    return count || 0;
  },

  async countByStatus(status) {
    const { count, error } = await useAdmin()
      .from('deposits')
      .select('*', { count: 'exact', head: true })
      .eq('status', status);
    if (error) throw error;
    return count || 0;
  },
};

// ---------------------------------------------------------------------------
// Investment Plans
// ---------------------------------------------------------------------------
const InvestmentPlans = {
  async listAll() {
    const { data, error } = await useAdmin()
      .from('investment_plans')
      .select('*')
      .order('min_amount', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async findById(id) {
    const { data, error } = await useAdmin()
      .from('investment_plans')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async create({ name, minAmount, maxAmount, dailyRoi, durationDays, features, isActive }) {
    const { data, error } = await useAdmin()
      .from('investment_plans')
      .insert({
        name,
        min_amount: minAmount,
        max_amount: maxAmount || null,
        daily_roi: dailyRoi,
        duration_days: durationDays,
        features: features || [],
        is_active: isActive !== false,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, { name, minAmount, maxAmount, dailyRoi, durationDays, features, isActive }) {
    const update = {};
    if (name !== undefined) update.name = name;
    if (minAmount !== undefined) update.min_amount = minAmount;
    if (maxAmount !== undefined) update.max_amount = maxAmount;
    if (dailyRoi !== undefined) update.daily_roi = dailyRoi;
    if (durationDays !== undefined) update.duration_days = durationDays;
    if (features !== undefined) update.features = features;
    if (isActive !== undefined) update.is_active = isActive;
    const { data, error } = await useAdmin()
      .from('investment_plans')
      .update(update)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async toggleActive(id, isActive) {
    const { error } = await useAdmin()
      .from('investment_plans')
      .update({ is_active: !!isActive })
      .eq('id', id);
    if (error) throw error;
  },

  async delete(id) {
    const { error } = await useAdmin()
      .from('investment_plans')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

// ---------------------------------------------------------------------------
// User Investments
// ---------------------------------------------------------------------------
const UserInvestments = {
  async listByUser(userId) {
    const { data, error } = await useAdmin()
      .from('user_investments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async findById(id) {
    const { data, error } = await useAdmin()
      .from('user_investments')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async create({ userId, planId, assetLabel, amount, durationDays, expectedReturn }) {
    const { data, error } = await useAdmin()
      .from('user_investments')
      .insert({
        user_id: userId,
        plan_id: planId || null,
        asset_label: assetLabel,
        amount,
        duration_days: durationDays,
        expected_return: expectedReturn,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, fields) {
    const { data, error } = await useAdmin()
      .from('user_investments')
      .update(fields)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async setStatus(id, status) {
    return UserInvestments.update(id, { status });
  },

  async cancel(id) {
    return UserInvestments.setStatus(id, 'cancelled');
  },

  async listAll({ limit = 100, status, search } = {}) {
    let query = useAdmin()
      .from('user_investments')
      .select('*, users:user_id(id, full_name, email)')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (status) query = query.eq('status', status);
    if (search) {
      query = query.or(`users.full_name.ilike.%${search}%,users.email.ilike.%${search}%`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async listByUserWithPlan(userId) {
    const { data, error } = await useAdmin()
      .from('user_investments')
      .select('*, plan:plan_id(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
};

module.exports = { Users, Holdings, Watchlist, Withdrawals, EmailTokens, Admin, SiteSettings, Deposits, InvestmentPlans, UserInvestments };
