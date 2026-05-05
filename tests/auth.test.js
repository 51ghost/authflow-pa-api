const request = require('supertest');
const { app, start } = require('../src/index');
const { getDb, closeDb } = require('../src/db/connection');
const { runMigrations } = require('../src/db/migrate');

// Initialize app for testing
const testApp = start();

beforeAll(() => {
  // Ensure migrations run on the in-memory database
  runMigrations();
});

afterAll(() => {
  closeDb();
});

describe('Health Check', () => {
  it('GET /health returns ok', async () => {
    const res = await request(testApp).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.version).toBe('1.0.0');
  });
});

describe('Authentication Flow', () => {
  const testUser = {
    email: 'test@example.com',
    password: 'TestPass123!',
    name: 'Test User',
  };

  let accessToken;
  let refreshTokenValue;

  it('POST /api/auth/signup creates a new user', async () => {
    const res = await request(testApp)
      .post('/api/auth/signup')
      .send(testUser);

    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe(testUser.email);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.password_hash).toBeUndefined();

    accessToken = res.body.data.accessToken;
    refreshTokenValue = res.body.data.refreshToken;
  });

  it('POST /api/auth/signup rejects duplicate email', async () => {
    const res = await request(testApp)
      .post('/api/auth/signup')
      .send(testUser);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('POST /api/auth/login authenticates the user', async () => {
    const res = await request(testApp)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.mfaRequired).toBe(false);

    // Update tokens for subsequent tests
    accessToken = res.body.data.accessToken;
    refreshTokenValue = res.body.data.refreshToken;
  });

  it('POST /api/auth/login rejects wrong password', async () => {
    const res = await request(testApp)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });

  it('POST /api/auth/refresh issues new tokens', async () => {
    const res = await request(testApp)
      .post('/api/auth/refresh')
      .send({ refreshToken: refreshTokenValue });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.refreshToken).not.toBe(refreshTokenValue); // Rotated

    accessToken = res.body.data.accessToken;
    refreshTokenValue = res.body.data.refreshToken;
  });

  it('POST /api/auth/refresh rejects revoked token', async () => {
    // Use old token (already revoked by rotation)
    const res = await request(testApp)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'some-old-token-value' });

    expect(res.status).toBe(401);
  });

  it('GET /api/users/me returns the authenticated user', async () => {
    const res = await request(testApp)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(testUser.email);
    expect(res.body.data.password_hash).toBeUndefined();
  });

  it('GET /api/users/me rejects without auth', async () => {
    const res = await request(testApp).get('/api/users/me');
    expect(res.status).toBe(401);
  });

  it('PATCH /api/users/me updates user profile', async () => {
    const res = await request(testApp)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated Name');
  });

  it('POST /api/auth/passwordless generates a code (dev mode)', async () => {
    const res = await request(testApp)
      .post('/api/auth/passwordless')
      .send({ email: testUser.email });

    expect(res.status).toBe(200);
    expect(res.body.data.code).toBeDefined();
    expect(res.body.data.code.length).toBe(6);
  });

  it('POST /api/auth/passwordless/verify with valid code', async () => {
    // First get a code
    const codeRes = await request(testApp)
      .post('/api/auth/passwordless')
      .send({ email: testUser.email });

    const { code } = codeRes.body.data;

    const res = await request(testApp)
      .post('/api/auth/passwordless/verify')
      .send({ email: testUser.email, code });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
  });

  it('POST /api/auth/logout revokes the refresh token', async () => {
    // Login to get a fresh refresh token
    const loginRes = await request(testApp)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });

    const rt = loginRes.body.data.refreshToken;

    // Logout
    const res = await request(testApp)
      .post('/api/auth/logout')
      .send({ refreshToken: rt });

    expect(res.status).toBe(200);

    // Try to use the revoked token
    const refreshRes = await request(testApp)
      .post('/api/auth/refresh')
      .send({ refreshToken: rt });

    expect(refreshRes.status).toBe(401);
  });

  it('POST /api/auth/forgot-password and reset-password flow', async () => {
    // Request reset
    const forgotRes = await request(testApp)
      .post('/api/auth/forgot-password')
      .send({ email: testUser.email });

    expect(forgotRes.status).toBe(200);
    const { code } = forgotRes.body.data;

    // Reset password
    const newPassword = 'NewPass456!';
    const resetRes = await request(testApp)
      .post('/api/auth/reset-password')
      .send({ email: testUser.email, code, password: newPassword });

    expect(resetRes.status).toBe(200);

    // Login with new password
    const loginRes = await request(testApp)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: newPassword });

    expect(loginRes.status).toBe(200);
  });
});

describe('MFA Flow', () => {
  let userAccessToken;
  let mfaSecret;

  beforeAll(async () => {
    // Create a fresh user for MFA tests
    const res = await request(testApp)
      .post('/api/auth/signup')
      .send({
        email: 'mfa-user@example.com',
        password: 'MfaTestPass1!',
        name: 'MFA User',
      });

    userAccessToken = res.body.data.accessToken;
  });

  it('POST /api/auth/mfa/setup generates a TOTP secret', async () => {
    const res = await request(testApp)
      .post('/api/auth/mfa/setup')
      .set('Authorization', `Bearer ${userAccessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.secret).toBeDefined();
    expect(res.body.data.otpauthUrl).toBeDefined();

    mfaSecret = res.body.data.secret;
  });

  it('POST /api/auth/mfa/verify with invalid token returns error', async () => {
    const res = await request(testApp)
      .post('/api/auth/mfa/verify')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({ token: '000000' });

    expect(res.status).toBe(400);
  });

  it('POST /api/auth/mfa/disable works', async () => {
    const res = await request(testApp)
      .post('/api/auth/mfa/disable')
      .set('Authorization', `Bearer ${userAccessToken}`);

    expect(res.status).toBe(200);
  });
});

describe('Prior-Authorization (PA) Gates', () => {
  let userAccessToken;
  let adminAccessToken;
  let gateId;

  beforeAll(async () => {
    // Create a regular user
    const userRes = await request(testApp)
      .post('/api/auth/signup')
      .send({
        email: 'pa-user@example.com',
        password: 'PaUserPass1!',
        name: 'PA User',
      });
    userAccessToken = userRes.body.data.accessToken;

    // Create an admin user
    const adminRes = await request(testApp)
      .post('/api/auth/signup')
      .send({
        email: 'pa-admin@example.com',
        password: 'AdminPass1!',
        name: 'PA Admin',
      });
    adminAccessToken = adminRes.body.data.accessToken;

    // Manually promote to admin
    const db = getDb();
    db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run('pa-admin@example.com');
  });

  it('POST /api/pa/gate/request creates a PA gate', async () => {
    const res = await request(testApp)
      .post('/api/pa/gate/request')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({
        operation: 'delete_account',
        metadata: { reason: 'User requested deletion' },
      });

    expect(res.status).toBe(201);
    expect(res.body.data.operation).toBe('delete_account');
    expect(res.body.data.status).toBe('pending');

    gateId = res.body.data.id;
  });

  it('GET /api/pa/gate/:id returns gate details', async () => {
    const res = await request(testApp)
      .get(`/api/pa/gate/${gateId}`)
      .set('Authorization', `Bearer ${userAccessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(gateId);
  });

  it('GET /api/pa/gates returns user gates list', async () => {
    const res = await request(testApp)
      .get('/api/pa/gates')
      .set('Authorization', `Bearer ${userAccessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/pa/gate/:id/approve (admin) approves the gate', async () => {
    const res = await request(testApp)
      .post(`/api/pa/gate/${gateId}/approve`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ notes: 'Approved by admin' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('approved');
    expect(res.body.data.notes).toBe('Approved by admin');
  });

  it('POST /api/pa/gate/:id/approve rejects non-admin', async () => {
    const res = await request(testApp)
      .post(`/api/pa/gate/${gateId}/approve`)
      .set('Authorization', `Bearer ${userAccessToken}`);

    expect(res.status).toBe(403);
  });

  it('DELETE /api/users/me deletes account', async () => {
    const res = await request(testApp)
      .delete('/api/users/me')
      .set('Authorization', `Bearer ${userAccessToken}`);

    expect(res.status).toBe(200);
  });
});

describe('Validation & Error Handling', () => {
  it('POST /api/auth/signup with invalid email', async () => {
    const res = await request(testApp)
      .post('/api/auth/signup')
      .send({ email: 'not-an-email', password: 'Test1234!' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/auth/signup with short password', async () => {
    const res = await request(testApp)
      .post('/api/auth/signup')
      .send({ email: 'valid@example.com', password: '123' });

    expect(res.status).toBe(400);
  });

  it('GET /nonexistent returns 404', async () => {
    const res = await request(testApp).get('/nonexistent');
    expect(res.status).toBe(404);
  });

  it('POST /api/auth/login with missing fields', async () => {
    const res = await request(testApp)
      .post('/api/auth/login')
      .send({});

    expect(res.status).toBe(400);
  });
});
