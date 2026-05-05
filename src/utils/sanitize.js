/**
 * Strip sensitive fields from a user object.
 */
function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, mfa_secret, ...safe } = user;
  return safe;
}

module.exports = { sanitizeUser };
