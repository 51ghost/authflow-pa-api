const bcrypt = require('bcryptjs');
const User = require('../models/User');
const TokenService = require('./token');
const config = require('../config');
const {
  BadRequestError, UnauthorizedError, ConflictError, NotFoundError,
} = require('../utils/errors');

const SALT_ROUNDS = 12;

class AuthService {
  /**
   * Register a new user with email and password.
   */
  static async signup({ email, password, name }) {
    if (!email || !password) {
      throw new BadRequestError('Email and password are required');
    }
    if (password.length < 8) {
      throw new BadRequestError('Password must be at least 8 characters');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = User.create({ email, passwordHash, name });

    const accessToken = TokenService.generateAccessToken(user);
    const refreshToken = TokenService.generateRefreshToken(user.id);

    return {
      user: sanitizeUser(user),
      accessToken,
      refreshToken: refreshToken.rawToken,
      refreshExpiresAt: refreshToken.expiresAt,
    };
  }

  /**
   * Login with email and password.
   */
  static async login({ email, password }) {
    if (!email || !password) {
      throw new BadRequestError('Email and password are required');
    }

    const user = User.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }
    if (!user.is_active) {
      throw new UnauthorizedError('Account is deactivated');
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const accessToken = TokenService.generateAccessToken(user);
    const refreshToken = TokenService.generateRefreshToken(user.id);

    return {
      user: sanitizeUser(user),
      accessToken,
      refreshToken: refreshToken.rawToken,
      refreshExpiresAt: refreshToken.expiresAt,
      mfaRequired: user.mfa_enabled === 1,
    };
  }

  /**
   * Refresh an access token using a valid refresh token.
   */
  static refresh(refreshTokenRaw) {
    if (!refreshTokenRaw) {
      throw new BadRequestError('Refresh token is required');
    }

    const record = TokenService.verifyRefreshToken(refreshTokenRaw);
    const user = User.findById(record.user_id);
    if (!user || !user.is_active) {
      throw new UnauthorizedError('User not found or inactive');
    }

    // Rotate: revoke old, issue new
    TokenService.revokeRefreshToken(refreshTokenRaw);
    const newRefreshToken = TokenService.generateRefreshToken(user.id);
    const newAccessToken = TokenService.generateAccessToken(user);

    return {
      user: sanitizeUser(user),
      accessToken: newAccessToken,
      refreshToken: newRefreshToken.rawToken,
      refreshExpiresAt: newRefreshToken.expiresAt,
    };
  }

  /**
   * Logout: revoke the provided refresh token.
   */
  static logout(refreshTokenRaw) {
    if (refreshTokenRaw) {
      TokenService.revokeRefreshToken(refreshTokenRaw);
    }
    return { message: 'Logged out successfully' };
  }

  /**
   * Request a passwordless login code (sent via email in production).
   */
  static async requestPasswordlessCode(email) {
    const user = User.findByEmail(email);
    if (!user) {
      // Don't reveal whether the email exists
      return { message: 'If the email exists, a code has been sent' };
    }

    const { code } = TokenService.generatePasswordlessCode(user.id, 'login');

    // In production, send via email/SMS. For development, return in response.
    if (config.isDev) {
      return { message: 'Code generated (dev mode)', code, email };
    }

    // TODO: integrate email sender
    return { message: 'If the email exists, a code has been sent' };
  }

  /**
   * Verify a passwordless code and issue tokens.
   */
  static verifyPasswordlessCode(email, code) {
    const user = User.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid verification attempt');
    }

    TokenService.verifyPasswordlessCode(user.id, code, 'login');

    const accessToken = TokenService.generateAccessToken(user);
    const refreshToken = TokenService.generateRefreshToken(user.id);

    return {
      user: sanitizeUser(user),
      accessToken,
      refreshToken: refreshToken.rawToken,
      refreshExpiresAt: refreshToken.expiresAt,
    };
  }

  /**
   * Request a password reset code.
   */
  static async requestPasswordReset(email) {
    const user = User.findByEmail(email);
    if (!user) {
      return { message: 'If the email exists, a reset code has been sent' };
    }

    const { code } = TokenService.generatePasswordlessCode(user.id, 'reset');

    if (config.isDev) {
      return { message: 'Reset code generated (dev mode)', code, email };
    }

    return { message: 'If the email exists, a reset code has been sent' };
  }

  /**
   * Reset password using a reset code.
   */
  static async resetPassword(email, code, newPassword) {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestError('Password must be at least 8 characters');
    }

    const user = User.findByEmail(email);
    if (!user) {
      throw new BadRequestError('Invalid reset attempt');
    }

    TokenService.verifyPasswordlessCode(user.id, code, 'reset');

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    User.update(user.id, { password_hash: passwordHash });

    // Revoke all existing sessions
    TokenService.revokeAllUserTokens(user.id);

    return { message: 'Password reset successfully' };
  }

  /**
   * Setup MFA (TOTP) for a user.
   */
  static setupMfa(userId) {
    const speakeasy = require('speakeasy');
    const user = User.findById(userId);
    if (!user) throw new NotFoundError('User not found');

    const secret = speakeasy.generateSecret({
      name: `AuthFlow:${user.email}`,
      length: 20,
    });

    User.update(userId, { mfa_secret: secret.base32 });

    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
    };
  }

  /**
   * Verify and enable MFA.
   */
  static verifyAndEnableMfa(userId, token) {
    const speakeasy = require('speakeasy');
    const user = User.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    if (!user.mfa_secret) throw new BadRequestError('MFA not initialized');

    const verified = speakeasy.totp.verify({
      secret: user.mfa_secret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!verified) {
      throw new BadRequestError('Invalid TOTP code');
    }

    User.update(userId, { mfa_enabled: 1 });
    return { message: 'MFA enabled successfully' };
  }

  /**
   * Disable MFA.
   */
  static disableMfa(userId) {
    User.update(userId, { mfa_enabled: 0, mfa_secret: null });
    return { message: 'MFA disabled successfully' };
  }
}

function sanitizeUser(user) {
  const { password_hash, mfa_secret, ...safe } = user;
  return safe;
}

module.exports = AuthService;
