const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const logger = require('./utils/logger');
const { AppError } = require('./utils/errors');
const { runMigrations } = require('./db/migrate');
const { apiLimiter } = require('./middleware/rateLimiter');

// Route imports
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const paRoutes = require('./routes/pa');
const userRoutes = require('./routes/users');

// Run migrations on startup (skip in test mode so tests control their own DB)
if (!config.isTest) {
  runMigrations();
}

const app = express();

// ---------------------------------------------------------------------------
// Global Middleware
// ---------------------------------------------------------------------------

// Security headers
app.use(helmet());

// CORS
app.use(cors({ origin: config.cors.origin }));

// Request logging
app.use(morgan(config.isDev ? 'dev' : 'combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Global rate limiter
app.use(apiLimiter);

// Trust proxy (for rate limiting behind reverse proxies)
app.set('trust proxy', 1);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.use('/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/pa', paRoutes);
app.use('/api/users', userRoutes);

// ---------------------------------------------------------------------------
// 404 Handler
// ---------------------------------------------------------------------------

app.use((_req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found',
    },
  });
});

// ---------------------------------------------------------------------------
// Global Error Handler
// ---------------------------------------------------------------------------

app.use((err, _req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
      },
    });
  }

  // Unknown errors
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: config.isDev ? err.message : 'An unexpected error occurred',
    },
  });
});

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------

function start() {
  if (config.isTest) return app; // Don't listen in test mode

  app.listen(config.port, () => {
    logger.info(`AuthFlow PA API running on port ${config.port} [${config.nodeEnv}]`);
  });
  return app;
}

module.exports = { app, start };
