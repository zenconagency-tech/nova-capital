const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

const hashPassword = async (plain) => {
  if (!plain || plain.length < 6) {
    throw new Error('Password must be at least 6 characters long');
  }
  return bcrypt.hash(plain, SALT_ROUNDS);
};

const comparePassword = async (plain, hash) => {
  if (!plain || !hash) return false;
  return bcrypt.compare(plain, hash);
};

const passwordPolicy = (password) => {
  const errors = [];
  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password || '')) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password || '')) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password || '')) {
    errors.push('Password must contain at least one number');
  }
  return errors;
};

module.exports = { hashPassword, comparePassword, passwordPolicy };
