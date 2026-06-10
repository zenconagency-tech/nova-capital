const app = require('./src/app');
const config = require('./src/config');
const market = require('./src/services/market');
const investmentProcessor = require('./src/services/investmentProcessor');
const { seedAll } = require('./scripts/seed-admin');

const start = async () => {
  // Best-effort: seed default admin + site settings on first boot.
  await seedAll();

  const server = app.listen(config.port, () => {
    console.log(
      `[nova] ${config.appName} listening on http://localhost:${config.port}  (${config.env})`
    );
    market.start();
    investmentProcessor.start();
  });

  const shutdown = (signal) => {
    console.log(`\n[nova] ${signal} received, shutting down...`);
    market.stop();
    investmentProcessor.stop();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (err) => console.error('[nova] unhandledRejection:', err));
  process.on('uncaughtException', (err) => console.error('[nova] uncaughtException:', err));
};

start();
