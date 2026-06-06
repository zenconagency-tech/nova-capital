/**
 * Auth middleware.
 *
 *   authRequired      — require a valid user JWT (cookie or Bearer)
 *   authOptional      — attach user if a valid token is present
 *   adminRequired     — require a valid admin JWT (cookie or Bearer)
 *   requireTier       — gate a route by user.account_tier
 */
const config = require('../config');
const { verifyToken } = require('../utils/tokens');
const { Users, Admin } = require('../models');
const { HttpError } = require('../utils/http');

const USER_COOKIE = config.jwt.cookieName;
const ADMIN_COOKIE = config.jwt.adminCookieName;

const extractToken = (req, cookieName) => {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  if (req.cookies && req.cookies[cookieName]) return req.cookies[cookieName];
  return null;
};

const authRequired = async (req, res, next) => {
  try {
    const token = extractToken(req, USER_COOKIE);
    if (!token) throw new HttpError(401, 'Authentication required');

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (_) {
      throw new HttpError(401, 'Invalid or expired token');
    }
    if (decoded.role && decoded.role !== 'user') {
      throw new HttpError(401, 'Invalid token for this resource');
    }

    const user = await Users.findByIdWithSecrets(decoded.sub);
    if (!user) throw new HttpError(401, 'User no longer exists');
    if (user.is_restricted) throw new HttpError(403, 'Your account has been restricted. Contact support.');

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

const authOptional = async (req, res, next) => {
  try {
    const token = extractToken(req, USER_COOKIE);
    if (token) {
      try {
        const decoded = verifyToken(token);
        if (!decoded.role || decoded.role === 'user') {
          const user = await Users.findByIdWithSecrets(decoded.sub);
          if (user && !user.is_restricted) req.user = user;
        }
      } catch (_) {
        /* ignore */
      }
    }
    next();
  } catch (err) {
    next(err);
  }
};

const adminRequired = async (req, res, next) => {
  try {
    const token = extractToken(req, ADMIN_COOKIE);
    if (!token) throw new HttpError(401, 'Admin authentication required');

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (_) {
      throw new HttpError(401, 'Invalid or expired admin token');
    }
    if (decoded.role !== 'admin') throw new HttpError(403, 'Admin privileges required');

    const admin = await Admin.findById(decoded.sub);
    if (!admin) throw new HttpError(401, 'Admin no longer exists');

    req.admin = admin;
    next();
  } catch (err) {
    next(err);
  }
};

const requireTier = (...allowed) => (req, res, next) => {
  if (!req.user) return next(new HttpError(401, 'Authentication required'));
  if (!allowed.includes(req.user.account_tier)) {
    return next(new HttpError(403, `This feature requires the ${allowed.join(' / ')} tier`));
  }
  next();
};

module.exports = { authRequired, authOptional, adminRequired, requireTier };
