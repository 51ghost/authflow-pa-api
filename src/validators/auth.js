const { z } = require('zod');

const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const passwordlessSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const passwordlessVerifySchema = z.object({
  email: z.string().email('Invalid email address'),
  code: z.string().length(6, 'Code must be 6 digits'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
  code: z.string().length(6, 'Code must be 6 digits'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const mfaVerifySchema = z.object({
  token: z.string().length(6, 'TOTP code must be 6 digits'),
});

const paGateRequestSchema = z.object({
  operation: z.string().min(1, 'Operation is required'),
  metadata: z.record(z.any()).optional(),
});

const paGateReviewSchema = z.object({
  notes: z.string().optional(),
});

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
});

module.exports = {
  signupSchema,
  loginSchema,
  refreshSchema,
  passwordlessSchema,
  passwordlessVerifySchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  mfaVerifySchema,
  paGateRequestSchema,
  paGateReviewSchema,
  updateProfileSchema,
};
