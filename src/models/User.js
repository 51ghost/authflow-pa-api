const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/connection');
const { NotFoundError, ConflictError } = require('../utils/errors');

class User {
  /**
   * Find a user by id.
   */
  static findById(id) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    return row || null;
  }

  /**
   * Find a user by email.
   */
  static findByEmail(email) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
    return row || null;
  }

  /**
   * Create a new user.
   */
  static create({ email, passwordHash, name, role = 'user' }) {
    const db = getDb();
    const id = uuidv4();
    const normalizedEmail = email.toLowerCase().trim();

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existing) {
      throw new ConflictError('A user with this email already exists');
    }

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, normalizedEmail, passwordHash || null, name || null, role);

    return this.findById(id);
  }

  /**
   * Update user fields.
   */
  static update(id, fields) {
    const db = getDb();
    const user = this.findById(id);
    if (!user) throw new NotFoundError('User not found');

    const allowed = ['name', 'password_hash', 'mfa_secret', 'mfa_enabled', 'is_active', 'role'];
    const updates = [];
    const values = [];

    for (const [key, value] of Object.entries(fields)) {
      if (allowed.includes(key)) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (updates.length === 0) return user;

    updates.push("updated_at = datetime('now')");
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values, id);
    return this.findById(id);
  }

  /**
   * Delete a user and all related data (cascade).
   */
  static delete(id) {
    const db = getDb();
    const user = this.findById(id);
    if (!user) throw new NotFoundError('User not found');
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return true;
  }

  /**
   * List all users (admin).
   */
  static findAll({ offset = 0, limit = 50 } = {}) {
    const db = getDb();
    return db.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
  }

  /**
   * Count total users.
   */
  static count() {
    const db = getDb();
    const row = db.prepare('SELECT COUNT(*) as count FROM users').get();
    return row.count;
  }
}

module.exports = User;
