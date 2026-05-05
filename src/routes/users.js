const { Router } = require('express');
const User = require('../models/User');
const AuthService = require('../services/auth');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { updateProfileSchema } = require('../validators/auth');
const { asyncHandler } = require('../utils/express');
const { sanitizeUser } = require('../utils/sanitize');

const router = Router();

/**
 * GET /api/users/me
 * Get the current user's profile.
 */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({ data: sanitizeUser(req.user) });
  })
);

/**
 * PATCH /api/users/me
 * Update the current user's profile.
 */
router.patch(
  '/me',
  authenticate,
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const updates = req.validatedBody;
    const user = User.update(req.user.id, updates);
    res.json({ data: sanitizeUser(user) });
  })
);

/**
 * DELETE /api/users/me
 * Delete the current user's account.
 * NOTE: This is a sensitive operation that could require PA gate approval
 * in production. For simplicity, the user can delete directly.
 */
router.delete(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    User.delete(req.user.id);
    res.json({ data: { message: 'Account deleted successfully' } });
  })
);

module.exports = router;
