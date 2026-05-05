const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/connection');
const { NotFoundError, ForbiddenError } = require('../utils/errors');

class PaGate {
  /**
   * Create a new prior-authorization gate request.
   */
  static create({ userId, operation, metadata = {} }) {
    const db = getDb();
    const id = uuidv4();

    db.prepare(`
      INSERT INTO pa_gates (id, user_id, operation, metadata)
      VALUES (?, ?, ?, ?)
    `).run(id, userId, operation, JSON.stringify(metadata));

    return this.findById(id);
  }

  /**
   * Find a PA gate by ID.
   */
  static findById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM pa_gates WHERE id = ?').get(id) || null;
  }

  /**
   * List PA gates for a user.
   */
  static findByUser(userId, { offset = 0, limit = 50 } = {}) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM pa_gates WHERE user_id = ?
      ORDER BY requested_at DESC LIMIT ? OFFSET ?
    `).all(userId, limit, offset);
  }

  /**
   * List all PA gates (admin).
   */
  static findAll({ offset = 0, limit = 50, status } = {}) {
    const db = getDb();
    let query = 'SELECT * FROM pa_gates';
    const params = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY requested_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return db.prepare(query).all(...params);
  }

  /**
   * Approve a PA gate request (admin action).
   */
  static approve(id, reviewerId, notes = '') {
    const db = getDb();
    const gate = this.findById(id);
    if (!gate) throw new NotFoundError('PA gate not found');
    if (gate.status !== 'pending') {
      throw new ForbiddenError(`Cannot approve a gate with status '${gate.status}'`);
    }

    db.prepare(`
      UPDATE pa_gates
      SET status = 'approved', reviewed_by = ?, reviewed_at = datetime('now'), notes = ?
      WHERE id = ?
    `).run(reviewerId, notes, id);

    return this.findById(id);
  }

  /**
   * Deny a PA gate request (admin action).
   */
  static deny(id, reviewerId, notes = '') {
    const db = getDb();
    const gate = this.findById(id);
    if (!gate) throw new NotFoundError('PA gate not found');
    if (gate.status !== 'pending') {
      throw new ForbiddenError(`Cannot deny a gate with status '${gate.status}'`);
    }

    db.prepare(`
      UPDATE pa_gates
      SET status = 'denied', reviewed_by = ?, reviewed_at = datetime('now'), notes = ?
      WHERE id = ?
    `).run(reviewerId, notes, id);

    return this.findById(id);
  }
}

module.exports = PaGate;
