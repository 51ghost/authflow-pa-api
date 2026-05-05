# AuthFlow PA API

A secure, scalable **authentication flow API** built with Node.js and Express. Supports passwordless authentication, JWT-based sessions, OAuth2 flows, multi-factor authentication (MFA), and prior-authorization (PA) gate checks.

---

## Features

- ✉️ **Email/Password Authentication** — Standard login with bcrypt-hashed passwords
- 🔑 **Passwordless Auth** — Magic link / OTP-based login flows
- 🪪 **JWT Sessions** — Access + Refresh token rotation with secure storage
- 🔐 **MFA / TOTP** — Time-based one-time password support via authenticator apps
- ⏰ **Prior-Authorization (PA) Gate** — Role-based access gates requiring pre-approved auth flows for sensitive operations
- 🛡️ **Rate Limiting & Helmet** — Built-in security headers and request throttling
- 📝 **Request Validation** — Zod schemas on all endpoints
- 📊 **Logging** — Structured Winston logging
- 🧪 **Tested** — Jest + Supertest integration test suite
- 🗄️ **SQLite** — Zero-config database (better-sqlite3), easy to swap for PostgreSQL

---

## Quick Start

```bash
# Clone and install
git clone <repo-url>
cd authflow-pa-api
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

Server starts at **http://localhost:4000** by default.

---

## API Endpoints

### Health

| Method | Path       | Description         |
|--------|------------|---------------------|
| GET    | `/health`  | Server health check |

### Authentication

| Method | Path                        | Description                    |
|--------|-----------------------------|--------------------------------|
| POST   | `/api/auth/signup`          | Register a new user            |
| POST   | `/api/auth/login`           | Login with email/password      |
| POST   | `/api/auth/logout`          | Logout (invalidate refresh)    |
| POST   | `/api/auth/refresh`         | Exchange refresh token for new access token |
| POST   | `/api/auth/passwordless`    | Request a passwordless login link/OTP |
| POST   | `/api/auth/passwordless/verify` | Verify passwordless OTP    |
| POST   | `/api/auth/forgot-password` | Request a password reset email |
| POST   | `/api/auth/reset-password`  | Reset password with token      |
| POST   | `/api/auth/mfa/setup`       | Enable TOTP MFA                |
| POST   | `/api/auth/mfa/verify`      | Verify TOTP code               |
| POST   | `/api/auth/mfa/disable`     | Disable TOTP MFA               |

### Prior-Authorization (PA) Gates

| Method | Path                               | Description                         |
|--------|------------------------------------|-------------------------------------|
| POST   | `/api/pa/gate/request`             | Request prior-authorization for an operation |
| GET    | `/api/pa/gate/:id`                 | Check status of a PA request        |
| GET    | `/api/pa/gates`                    | List all PA requests for the user   |
| POST   | `/api/pa/gate/:id/approve`         | Approve a pending PA request (admin)|
| POST   | `/api/pa/gate/:id/deny`            | Deny a pending PA request (admin)   |

### Users (Protected)

| Method | Path                    | Description                   |
|--------|-------------------------|-------------------------------|
| GET    | `/api/users/me`         | Get current user profile      |
| PATCH  | `/api/users/me`         | Update current user profile   |
| DELETE | `/api/users/me`         | Delete current user account   |

---

## Environment Variables

| Variable                  | Default           | Description                             |
|---------------------------|-------------------|-----------------------------------------|
| `PORT`                    | `4000`            | Server port                             |
| `NODE_ENV`                | `development`     | Environment                             |
| `DATABASE_URL`            | `./data/authflow.db` | SQLite database path                |
| `JWT_SECRET`              | (required)        | Secret for signing access tokens        |
| `JWT_REFRESH_SECRET`      | (required)        | Secret for signing refresh tokens       |
| `JWT_ACCESS_EXPIRY`       | `15m`             | Access token lifetime                   |
| `JWT_REFRESH_EXPIRY`      | `7d`              | Refresh token lifetime                  |
| `SMTP_HOST`               | —                 | SMTP server for email sending           |
| `SMTP_PORT`               | `587`             | SMTP port                               |
| `SMTP_USER`               | —                 | SMTP username                           |
| `SMTP_PASS`               | —                 | SMTP password                           |
| `CORS_ORIGIN`             | `*`               | Allowed CORS origin(s)                  |

---

## Architecture

```
src/
├── index.js           — Express app entry point
├── config/            — Environment & app configuration
├── db/                — Database setup, migrations, seeds
├── middleware/        — Express middleware (auth, rate-limit, validate)
├── models/            — Data access layer (User model)
├── routes/            — Route definitions
├── services/          — Business logic (auth, token, email)
├── utils/             — Shared utilities (errors, logger)
└── validators/        — Zod request schemas
```

---

## Testing

```bash
npm test
```

Tests use an in-memory SQLite database and cover all auth flows, PA gates, and error conditions.

---

## License

MIT
