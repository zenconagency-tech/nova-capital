/**
 * Maintenance middleware.
 *
 * If `maintenance_mode` is on in site_settings, block all API
 * requests from non-admin visitors with 503. Admin and public
 * settings endpoints are always allowed.
 */
const { SiteSettings } = require('../models');

let cached = { value: false, ts: 0 };
const CACHE_MS = 5_000;

const read = async () => {
  if (Date.now() - cached.ts < CACHE_MS) return cached.value;
  try {
    cached = { value: !!(await SiteSettings.get('maintenance_mode', false)), ts: Date.now() };
  } catch (_) {
    cached = { value: false, ts: Date.now() };
  }
  return cached.value;
};

const invalidate = () => { cached = { value: false, ts: 0 }; };

const maintenanceGuard = () => async (req, res, next) => {
  // Always allow public + auth + admin + market reads
  if (
    req.path.startsWith('/api/public/') ||
    req.path.startsWith('/api/auth/') ||
    req.path.startsWith('/api/admin/')
  ) {
    return next();
  }
  // Allow admins in (set by adminRequired middleware before this if mounted)
  if (req.admin) return next();

  const on = await read();
  if (!on) return next();

  return res.status(503).json({
    success: false,
    message: 'The site is currently under maintenance. Please try again shortly.',
    data: { maintenance: true },
  });
};

module.exports = { maintenanceGuard, invalidateMaintenanceCache: invalidate };
