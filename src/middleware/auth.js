const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');

/**
 * Middleware: require a valid access token.
 */
function authenticate(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or invalid authorization header'));
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, config.jwt.secret);
    const user = User.findById(payload.sub);
    if (!user) {
      return next(new UnauthorizedError('User not found'));
    }
    if (!user.is_active) {
      return next(new UnauthorizedError('Account is deactivated'));
    }
    req.user = user;
    req.tokenPayload = payload;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Access token expired', 'TOKEN_EXPIRED'));
    }
    return next(new UnauthorizedError('Invalid access token', 'INVALID_TOKEN'));
  }
}

/**
 * Middleware: require a specific role.
 */
function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }
    next();
  };
}

/**
 * Middleware: optional authentication (doesn't fail if no token).
 */
function optionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, config.jwt.secret);
    const user = User.findById(payload.sub);
    if (user && user.is_active) {
      req.user = user;
      req.tokenPayload = payload;
    }
  } catch {
    // Silently ignore invalid tokens for optional auth
  }
  next();
}

module.exports = { authenticate, authorize, optionalAuth };
