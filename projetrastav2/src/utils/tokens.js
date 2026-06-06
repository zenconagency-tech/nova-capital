const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');

const signToken = (payload, options = {}) => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: options.expiresIn || config.jwt.expiresIn,
    ...options,
  });
};

const signAdminToken = (payload, options = {}) => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: options.expiresIn || config.jwt.adminExpiresIn,
    ...options,
  });
};

const verifyToken = (token) => {
  return jwt.verify(token, config.jwt.secret);
};

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const generateRandomToken = (bytes = 32) => {
  return crypto.randomBytes(bytes).toString('hex');
};

const generateVerificationCode = (length = 6) => {
  const max = 10 ** length;
  const min = 10 ** (length - 1);
  return String(crypto.randomInt(min, max));
};

module.exports = {
  signToken,
  signAdminToken,
  verifyToken,
  hashToken,
  generateRandomToken,
  generateVerificationCode,
};
