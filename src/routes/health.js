const { Router } = require('express');

const router = Router();

/**
 * GET /health
 * Simple health check endpoint.
 */
router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

module.exports = router;
