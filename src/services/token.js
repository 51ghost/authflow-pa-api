const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { getDb } = require('../db/connection');
const config = require('../config');
const { NotFoundError, UnauthorizedError } = require('../utils/errors');

const REFRESH_TOKEN_BYTES = 48;

class TokenService {
  /**
   * Generate an access token for a user.
   */
  static generateAccessToken(user) {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.accessExpiry }
    );
  }

  /**
   * Verify an access token and return the payload.
   */
  static verifyAccessToken(token) {
    const jwt = require('jsonwebtoken');
    try {
      return jwt.verify(token, config.jwt.secret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Access token expired', 'TOKEN_EXPIRED');
      }
      throw new UnauthorizedError('Invalid access token', 'INVALID_TOKEN');
    }
  }

  /**
   * Generate a refresh token, store its hash in the database.
   * Returns the raw token to give to the client.
   */
  static generateRefreshToken(userId) {
    const db = getDb();
    const rawToken = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const id = uuidv4();

    // Parse expiry string (e.g. "7d") to seconds
    const expirySeconds = parseDuration(config.jwt.refreshExpiry);
    const expiresAt = new Date(Date.now() + expirySeconds * 1000).toISOString();

    db.prepare(`
      INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(id, userId, tokenHash, expiresAt);

    return { id, rawToken, expiresAt };
  }

  /**
   * Verify a refresh token: find by raw token, check expiry and revocation.
   * Returns the token record on success.
   */
  static verifyRefreshToken(rawToken) {
    const db = getDb();
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const record = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(tokenHash);
    if (!record) {
      throw new UnauthorizedError('Refresh token not found', 'INVALID_REFRESH');
    }
    if (record.revoked) {
      throw new UnauthorizedError('Refresh token has been revoked', 'REFRESH_REVOKED');
    }
    if (new Date(record.expires_at) < new Date()) {
      throw new UnauthorizedError('Refresh token has expired', 'REFRESH_EXPIRED');
    }

    return record;
  }

  /**
   * Revoke a refresh token by its raw value.
   */
  static revokeRefreshToken(rawToken) {
    const db = getDb();
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?').run(tokenHash);
  }

  /**
   * Revoke all refresh tokens for a user.
   */
  static revokeAllUserTokens(userId) {
    const db = getDb();
    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?').run(userId);
  }

  /**
   * Generate a passwordless OTP code (6 digits).
   */
  static generatePasswordlessCode(userId, type = 'login') {
    const db = getDb();
    const id = uuidv4();
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

    db.prepare(`
      INSERT INTO passwordless_tokens (id, user_id, code, type, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, userId, code, type, expiresAt);

    return { code, expiresAt };
  }

  /**
   * Verify a passwordless code.
   */
  static verifyPasswordlessCode(userId, code, type = 'login') {
    const db = getDb();
    const record = db.prepare(`
      SELECT * FROM passwordless_tokens
      WHERE user_id = ? AND code = ? AND type = ? AND used = 0
      ORDER BY created_at DESC LIMIT 1
    `).get(userId, code, type);

    if (!record) {
      throw new UnauthorizedError('Invalid or expired code', 'INVALID_CODE');
    }
    if (new Date(record.expires_at) < new Date()) {
      throw new UnauthorizedError('Code has expired', 'CODE_EXPIRED');
    }

    // Mark as used
    db.prepare('UPDATE passwordless_tokens SET used = 1 WHERE id = ?').run(record.id);
    return true;
  }
}

/**
 * Parse a duration string like "15m", "7d", "1h" into seconds.
 */
function parseDuration(str) {
  const match = str.match(/^(\d+)\s*(s|m|h|d)$/);
  if (!match) return 3600; // default 1 hour
  const val = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's': return val;
    case 'm': return val * 60;
    case 'h': return val * 3600;
    case 'd': return val * 86400;
    default: return val;
  }
}

module.exports = TokenService;
