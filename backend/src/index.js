require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/companies',    require('./routes/companies'));
app.use('/api/integrations', require('./routes/integrations'));
app.use('/api/schedules',    require('./routes/schedules'));
app.use('/api/logs',         require('./routes/logs'));
app.use('/api/dashboard',    require('./routes/dashboard'));
app.use('/api/execute',      require('./routes/execute'));

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ── Global error handler ───────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── Unhandled rejections — log but DON'T crash ─────────────────────────────
process.on('unhandledRejection', (reason) => {
  console.error('⚠️  Unhandled promise rejection (server kept running):', reason);
});
process.on('uncaughtException', (err) => {
  console.error('⚠️  Uncaught exception (server kept running):', err.message);
});

// ── Startup ────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3001');
const { initializeDatabase } = require('./models/database');

initializeDatabase()
  .then(() => {
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('\n══════════════════════════════════════════════');
      console.log(`🚀  ETL Platform API  →  http://localhost:${PORT}`);
      console.log(`📧  Login: ${process.env.ADMIN_EMAIL || 'admin@etlplatform.com'}`);
      console.log(`🔑  Senha: ${process.env.ADMIN_PASSWORD || 'Admin@123456'}`);
      console.log('══════════════════════════════════════════════\n');
    });

    // Start cron scheduler (non-fatal if it fails)
    setTimeout(async () => {
      try {
        await require('./scheduler/cronManager').startAll();
      } catch (e) {
        console.warn('Cron scheduler did not start:', e.message);
      }
    }, 2000);
  })
  .catch(err => {
    console.error('\n❌  Failed to connect to database:', err.message);
    console.error('   Check your .env DB_SERVER / DB_USER / DB_PASSWORD settings\n');
    process.exit(1);
  });

module.exports = app;
