require('dotenv').config();

const required = (key) => {
  const value = process.env[key];
  if (!value || value.startsWith('replace_me') || value.startsWith('YOUR_')) {
    return null;
  }
  return value;
};

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  appName: process.env.APP_NAME || 'Nova Capital',
  appUrl: process.env.APP_URL || 'http://localhost:3000',

  jwt: {
    secret: required('JWT_SECRET') || 'dev_insecure_secret_change_me_in_production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',          // users
    adminExpiresIn: process.env.ADMIN_JWT_EXPIRES_IN || '24h',  // admin
    cookieName: process.env.JWT_COOKIE_NAME || 'nova_token',
    adminCookieName: process.env.ADMIN_JWT_COOKIE_NAME || 'nova_admin_token',
  },

  supabase: {
    url: process.env.SUPABASE_URL || null,
    anonKey: process.env.SUPABASE_ANON_KEY || null,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || null,
  },

  smtp: {
    host: process.env.SMTP_HOST || null,
    port: parseInt(process.env.SMTP_PORT, 10) || 465,
    secure: (process.env.SMTP_SECURE || 'true') === 'true',
    user: process.env.SMTP_USER || null,
    pass: process.env.SMTP_PASS || null,
    from: process.env.SMTP_FROM || 'Nova Capital <no-reply@nova.capital>',
  },
};

config.isProduction = config.env === 'production';

module.exports = config;
