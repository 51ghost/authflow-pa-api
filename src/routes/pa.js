const { Router } = require('express');
const PaGate = require('../models/PaGate');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { paGateRequestSchema, paGateReviewSchema } = require('../validators/auth');
const { asyncHandler } = require('../utils/express');

const router = Router();

/**
 * POST /api/pa/gate/request
 * Request prior-authorization for a sensitive operation.
 */
router.post(
  '/gate/request',
  authenticate,
  validate(paGateRequestSchema),
  asyncHandler(async (req, res) => {
    const { operation, metadata } = req.validatedBody;
    const gate = PaGate.create({
      userId: req.user.id,
      operation,
      metadata,
    });
    res.status(201).json({ data: gate });
  })
);

/**
 * GET /api/pa/gate/:id
 * Check the status of a PA request.
 */
router.get(
  '/gate/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const gate = PaGate.findById(req.params.id);
    if (!gate) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'PA gate not found' } });
    }
    // Users can only see their own gates, admins can see all
    if (gate.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }
    res.json({ data: gate });
  })
);

/**
 * GET /api/pa/gates
 * List PA requests for the current user (or all if admin).
 */
router.get(
  '/gates',
  authenticate,
  asyncHandler(async (req, res) => {
    const offset = parseInt(req.query.offset, 10) || 0;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const { status } = req.query;

    let gates;
    if (req.user.role === 'admin' && req.query.all === 'true') {
      gates = PaGate.findAll({ offset, limit, status });
    } else {
      gates = PaGate.findByUser(req.user.id, { offset, limit });
      if (status) {
        gates = gates.filter((g) => g.status === status);
      }
    }

    res.json({ data: gates, offset, limit });
  })
);

/**
 * POST /api/pa/gate/:id/approve
 * Approve a pending PA request (admin only).
 */
router.post(
  '/gate/:id/approve',
  authenticate,
  authorize('admin'),
  validate(paGateReviewSchema),
  asyncHandler(async (req, res) => {
    const gate = PaGate.approve(req.params.id, req.user.id, req.validatedBody.notes);
    res.json({ data: gate });
  })
);

/**
 * POST /api/pa/gate/:id/deny
 * Deny a pending PA request (admin only).
 */
router.post(
  '/gate/:id/deny',
  authenticate,
  authorize('admin'),
  validate(paGateReviewSchema),
  asyncHandler(async (req, res) => {
    const gate = PaGate.deny(req.params.id, req.user.id, req.validatedBody.notes);
    res.json({ data: gate });
  })
);

module.exports = router;
