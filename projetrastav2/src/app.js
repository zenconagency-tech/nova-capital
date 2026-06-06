/**
 * Express app.
 *
 * Wires middleware, mounts route modules, and serves the
 * frontend (static assets in /public, HTML pages in /views).
 */
const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const market = require('./services/market');
const { notFound, errorHandler } = require('./utils/http');
const { maintenanceGuard } = require('./middleware/maintenance');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const portfolioRoutes = require('./routes/portfolio');
const watchlistRoutes = require('./routes/watchlist');
const marketRoutes = require('./routes/market');
const withdrawalRoutes = require('./routes/withdrawals');
const adminRoutes = require('./routes/admin');
const publicRoutes = require('./routes/public');

const app = express();

// attach shared services to app
app.locals.market = market;
app.locals.config = config;

app.set('trust proxy', 1);

// security & perf middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://cdn.jsdelivr.net',
          'https://cdnjs.cloudflare.com',
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://fonts.googleapis.com',
          'https://cdn.jsdelivr.net',
        ],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://cdn.jsdelivr.net'],
        frameAncestors: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: config.clientUrl,
    credentials: true,
  })
);

app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan(config.isProduction ? 'combined' : 'dev'));

// global rate limit
app.use(
  '/api',
  rateLimit({
    windowMs: 60_000,
    max: 240,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please slow down.' },
  })
);

// health
app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'healthy', service: config.appName, time: new Date().toISOString() } });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);

// Maintenance middleware — runs after API routes so that auth/admin still work
app.use(maintenanceGuard());

// Static assets in /public
const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
app.use(express.static(publicDir, { maxAge: '1d' }));

// HTML pages in /views
const viewsDir = path.join(__dirname, '..', 'views');
if (!fs.existsSync(viewsDir)) fs.mkdirSync(viewsDir, { recursive: true });

const sendView = (rel) => (req, res, next) => {
  const filePath = path.join(viewsDir, rel);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return res.sendFile(filePath);
  }
  next();
};

// Clean-URL routes for HTML pages
const viewMap = {
  '/':                   'index.html',
  '/login':              'login.html',
  '/register':           'register.html',
  '/forgot-password':    'forgot-password.html',
  '/reset-password':     'reset-password.html',
  '/dashboard':          'dashboard.html',
  '/maintenance':        'maintenance.html',
  '/admin/login':        'admin/login.html',
  '/admin/dashboard':    'admin/dashboard.html',
};

for (const [route, file] of Object.entries(viewMap)) {
  app.get(route, sendView(file));
}

// SPA fallback for anything else (HTML requests only)
app.get(/^\/(?!api).*/, (req, res, next) => {
  if (req.method !== 'GET') return next();
  // Try the .html variant of the path
  const cleanPath = req.path.replace(/^\//, '');
  const candidate = path.join(viewsDir, cleanPath);
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return res.sendFile(candidate);
  }
  res.sendFile(path.join(viewsDir, 'index.html'));
});

// 404 + error handlers
app.use('/api', notFound);
app.use(errorHandler);

module.exports = app;
