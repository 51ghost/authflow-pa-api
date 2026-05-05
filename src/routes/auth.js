const { Router } = require('express');
const AuthService = require('../services/auth');
const { authenticate } = require('../middleware/auth');
const { authLimiter, sensitiveLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validate');
const {
  signupSchema,
  loginSchema,
  refreshSchema,
  passwordlessSchema,
  passwordlessVerifySchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  mfaVerifySchema,
} = require('../validators/auth');
const { asyncHandler } = require('../utils/express');

const router = Router();

/**
 * POST /api/auth/signup
 * Register a new user.
 */
router.post(
  '/signup',
  authLimiter,
  validate(signupSchema),
  asyncHandler(async (req, res) => {
    const result = await AuthService.signup(req.validatedBody);
    res.status(201).json({ data: result });
  })
);

/**
 * POST /api/auth/login
 * Login with email and password.
 */
router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await AuthService.login(req.validatedBody);
    res.json({ data: result });
  })
);

/**
 * POST /api/auth/logout
 * Logout (revoke refresh token).
 */
router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const refreshToken = req.body.refreshToken;
    const result = AuthService.logout(refreshToken);
    res.json({ data: result });
  })
);

/**
 * POST /api/auth/refresh
 * Refresh access token.
 */
router.post(
  '/refresh',
  validate(refreshSchema),
  asyncHandler(async (req, res) => {
    const result = AuthService.refresh(req.validatedBody.refreshToken);
    res.json({ data: result });
  })
);

/**
 * POST /api/auth/passwordless
 * Request a passwordless login code.
 */
router.post(
  '/passwordless',
  sensitiveLimiter,
  validate(passwordlessSchema),
  asyncHandler(async (req, res) => {
    const result = await AuthService.requestPasswordlessCode(req.validatedBody.email);
    res.json({ data: result });
  })
);

/**
 * POST /api/auth/passwordless/verify
 * Verify passwordless code and get tokens.
 */
router.post(
  '/passwordless/verify',
  sensitiveLimiter,
  validate(passwordlessVerifySchema),
  asyncHandler(async (req, res) => {
    const { email, code } = req.validatedBody;
    const result = AuthService.verifyPasswordlessCode(email, code);
    res.json({ data: result });
  })
);

/**
 * POST /api/auth/forgot-password
 * Request password reset code.
 */
router.post(
  '/forgot-password',
  sensitiveLimiter,
  validate(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    const result = await AuthService.requestPasswordReset(req.validatedBody.email);
    res.json({ data: result });
  })
);

/**
 * POST /api/auth/reset-password
 * Reset password with code.
 */
router.post(
  '/reset-password',
  sensitiveLimiter,
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const { email, code, password } = req.validatedBody;
    const result = await AuthService.resetPassword(email, code, password);
    res.json({ data: result });
  })
);

/**
 * POST /api/auth/mfa/setup
 * Setup TOTP MFA (requires auth).
 */
router.post(
  '/mfa/setup',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = AuthService.setupMfa(req.user.id);
    res.json({ data: result });
  })
);

/**
 * POST /api/auth/mfa/verify
 * Verify and enable TOTP MFA.
 */
router.post(
  '/mfa/verify',
  authenticate,
  validate(mfaVerifySchema),
  asyncHandler(async (req, res) => {
    const result = AuthService.verifyAndEnableMfa(req.user.id, req.validatedBody.token);
    res.json({ data: result });
  })
);

/**
 * POST /api/auth/mfa/disable
 * Disable TOTP MFA.
 */
router.post(
  '/mfa/disable',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = AuthService.disableMfa(req.user.id);
    res.json({ data: result });
  })
);

module.exports = router;
