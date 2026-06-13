const { hashPassword } = require('../src/utils/password');
const { Admin, SiteSettings, InvestmentPlans } = require('../src/models');

const DEFAULT_ADMIN = {
  username: process.env.ADMIN_USERNAME || 'admin',
  password: process.env.ADMIN_PASSWORD || 'admin123',
};

const DEFAULT_SETTINGS = {
  maintenance_mode: false,
  hero_headline: 'Invest in <span class="grad">everything</span>.<br/>Own your financial future.',
  hero_subtext: 'Trade crypto, stocks, futures, forex and commodities from one premium dashboard. Zero commission. Real-time analytics. AI-powered insights — built for serious investors.',
  market_categories: ['crypto', 'stock', 'future', 'forex', 'commodity'],
  pricing_plans: [
    {
      id: 'free',
      name: 'Free',
      tier: 'For curious investors',
      price: 0,
      period: 'month',
      description: 'Get started with the basics. Trade small, learn fast.',
      features: ['Basic portfolio tracking', 'Market data, 15-min delay', 'Up to 5 watchlist symbols', 'Community support'],
      featured: false,
      cta: 'Get started',
    },
    {
      id: 'pro',
      name: 'Pro',
      tier: 'For active traders',
      price: 29,
      period: 'month',
      description: 'Real-time data, advanced tools, zero commission.',
      features: ['Real-time market data', 'Unlimited watchlist', 'AI-powered insights', 'Advanced charting (50+ indicators)', 'Zero commission trading', 'Priority email support'],
      featured: true,
      cta: 'Start 14-day trial',
    },
    {
      id: 'elite',
      name: 'Elite',
      tier: 'For pros & institutions',
      price: 99,
      period: 'month',
      description: 'Everything in Pro, plus pro-grade tools and concierge service.',
      features: ['Everything in Pro', 'Margin & futures trading', 'Algorithmic order routing', 'Dedicated account manager', 'API access', '24/7 phone support'],
      featured: false,
      cta: 'Contact sales',
    },
  ],
  deposit_wallets: {
    bitcoin: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    ethereum: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
    usdt: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
    paypal: 'admin@novacapital.io',
    payoneer: 'admin@novacapital.io',
  },
  investment_roi: { 30: 8, 60: 15, 90: 25, 180: 45, 365: 70 },
};

const INVESTMENT_PLANS = [
  { name: 'Starter', min_amount: 500, max_amount: 1999, daily_roi: 1.2, duration_days: 30, features: ['Basic support', 'Weekly reports'] },
  { name: 'Silver', min_amount: 2000, max_amount: 4999, daily_roi: 1.8, duration_days: 60, features: ['Priority support', 'Daily reports', 'Auto-compounding'] },
  { name: 'Gold', min_amount: 5000, max_amount: 9999, daily_roi: 2.5, duration_days: 90, features: ['Dedicated manager', 'Daily reports', 'Auto-compounding', 'Referral bonus'] },
  { name: 'Platinum', min_amount: 10000, max_amount: 20000, daily_roi: 3.5, duration_days: 180, features: ['VIP manager', 'Real-time reports', 'Auto-compounding', 'Priority withdrawals', 'Referral bonus'] },
  { name: 'Diamond', min_amount: 20001, max_amount: null, daily_roi: 5.0, duration_days: 365, features: ['VIP manager', 'Real-time reports', 'Auto-compounding', 'Priority withdrawals', 'Referral bonus', 'Exclusive signals'] },
];

const seedAdmin = async () => {
  try {
    const existing = await Admin.findByUsername(DEFAULT_ADMIN.username);
    if (existing) {
      console.log(`[seed] admin "${DEFAULT_ADMIN.username}" already exists — skipping`);
    } else {
      const passwordHash = await hashPassword(DEFAULT_ADMIN.password);
      await Admin.createIfMissing({ username: DEFAULT_ADMIN.username, passwordHash });
      console.log(`[seed] ✓ created default admin  →  username: ${DEFAULT_ADMIN.username}  password: ${DEFAULT_ADMIN.password}`);
    }
  } catch (e) {
    console.warn('[seed] could not seed admin (Supabase not configured?):', e.message);
  }
};

const seedSettings = async () => {
  try {
    const current = await SiteSettings.getAll();
    const missing = Object.entries(DEFAULT_SETTINGS).filter(([k]) => !(k in current));
    if (!missing.length) {
      console.log('[seed] site_settings already populated — skipping');
      return;
    }
    const update = Object.fromEntries(missing);
    await SiteSettings.setMany(update);
    console.log(`[seed] ✓ seeded ${missing.length} site setting(s)`);
  } catch (e) {
    console.warn('[seed] could not seed settings (Supabase not configured?):', e.message);
  }
};

const seedInvestmentPlans = async () => {
  try {
    const existing = await InvestmentPlans.listAll();
    if (existing.length > 0) {
      console.log(`[seed] investment_plans already populated (${existing.length} plans) — skipping`);
      return;
    }
    for (const plan of INVESTMENT_PLANS) {
      await InvestmentPlans.create({ ...plan, isActive: true });
    }
    console.log(`[seed] ✓ seeded ${INVESTMENT_PLANS.length} investment plan(s)`);
  } catch (e) {
    console.warn('[seed] could not seed investment plans (Supabase not configured?):', e.message);
  }
};

const seedAll = async () => {
  await seedAdmin();
  await seedSettings();
  await seedInvestmentPlans();
};

module.exports = { seedAdmin, seedSettings, seedAll };

if (require.main === module) {
  require('dotenv').config();
  seedAll()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}