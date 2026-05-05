# AuthFlow PA API — Full API Reference

**Base URL:** `http://localhost:4000`

All endpoints return JSON. Successful responses follow: `{ "data": { ... } }`. Error responses follow: `{ "error": { "code": "...", "message": "..." } }`.

---

## Health

### `GET /health`

Returns server health status.

**Response:**
```json
{
  "status": "ok",
  "uptime": 123.45,
  "timestamp": "2026-05-05T12:00:00.000Z",
  "version": "1.0.0"
}
```

---

## Authentication

### `POST /api/auth/signup`

Register a new user.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "Jane Doe"
}
```

**Response `201`:**
```json
{
  "data": {
    "user": { "id": "...", "email": "user@example.com", "name": "Jane Doe", "role": "user", ... },
    "accessToken": "eyJhbG...",
    "refreshToken": "abc123...",
    "refreshExpiresAt": "2026-05-12T12:00:00.000Z"
  }
}
```

### `POST /api/auth/login`

Authenticate with email and password.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response `200`:**
```json
{
  "data": {
    "user": { ... },
    "accessToken": "eyJhbG...",
    "refreshToken": "abc123...",
    "refreshExpiresAt": "2026-05-12T12:00:00.000Z",
    "mfaRequired": false
  }
}
```

### `POST /api/auth/logout`

Revoke the current refresh token.

**Body:**
```json
{
  "refreshToken": "abc123..."
}
```

### `POST /api/auth/refresh`

Exchange a refresh token for new tokens (rotation).

**Body:**
```json
{
  "refreshToken": "abc123..."
}
```

**Response `200`:**
```json
{
  "data": {
    "user": { ... },
    "accessToken": "eyJhbG...",
    "refreshToken": "def456...",
    "refreshExpiresAt": "2026-05-12T12:00:00.000Z"
  }
}
```

### `POST /api/auth/passwordless`

Request a passwordless login code (dev mode returns the code directly).

**Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (dev mode):**
```json
{
  "data": {
    "message": "Code generated (dev mode)",
    "code": "800745",
    "email": "user@example.com"
  }
}
```

### `POST /api/auth/passwordless/verify`

Verify a passwordless code and receive tokens.

**Body:**
```json
{
  "email": "user@example.com",
  "code": "800745"
}
```

### `POST /api/auth/forgot-password`

Request a password reset code.

**Body:**
```json
{
  "email": "user@example.com"
}
```

### `POST /api/auth/reset-password`

Reset password using a verification code.

**Body:**
```json
{
  "email": "user@example.com",
  "code": "640063",
  "password": "NewSecurePass456!"
}
```

### `POST /api/auth/mfa/setup` 🔒

Generate a TOTP MFA secret. Requires authentication.

**Response:**
```json
{
  "data": {
    "secret": "LBUS6L3GIZBD4KTXJZHSK23IJA3WYNRT",
    "otpauthUrl": "otpauth://totp/AuthFlow:user@example.com?secret=..."
  }
}
```

### `POST /api/auth/mfa/verify` 🔒

Verify and enable TOTP MFA.

**Body:**
```json
{
  "token": "123456"
}
```

### `POST /api/auth/mfa/disable` 🔒

Disable TOTP MFA.

---

## Prior-Authorization (PA) Gates

### `POST /api/pa/gate/request` 🔒

Create a PA gate request for a sensitive operation.

**Body:**
```json
{
  "operation": "delete_account",
  "metadata": { "reason": "User requested account deletion" }
}
```

### `GET /api/pa/gate/:id` 🔒

Check the status of a PA gate request. Users see only their own gates; admins see all.

### `GET /api/pa/gates` 🔒

List PA gate requests for the current user.

**Query params:** `?offset=0&limit=50&status=pending`

Admins can use `?all=true` to see all gates.

### `POST /api/pa/gate/:id/approve` 🔒🔐

Approve a pending PA gate request (admin only).

**Body:**
```json
{
  "notes": "Approved after review"
}
```

### `POST /api/pa/gate/:id/deny` 🔒🔐

Deny a pending PA gate request (admin only).

---

## Users

### `GET /api/users/me` 🔒

Get the current authenticated user's profile.

### `PATCH /api/users/me` 🔒

Update profile fields (name only currently).

**Body:**
```json
{
  "name": "New Name"
}
```

### `DELETE /api/users/me` 🔒

Delete the current user's account.

---

## Error Codes

| HTTP Status | Code              | Description                     |
|-------------|-------------------|---------------------------------|
| 400         | VALIDATION_ERROR  | Invalid request body/params     |
| 400         | BAD_REQUEST       | Malformed request               |
| 401         | UNAUTHORIZED      | Missing or invalid auth         |
| 401         | TOKEN_EXPIRED     | Access token expired            |
| 401         | INVALID_TOKEN     | Bad token                       |
| 401         | INVALID_REFRESH   | Refresh token not found         |
| 401         | REFRESH_REVOKED   | Refresh token was revoked       |
| 401         | REFRESH_EXPIRED   | Refresh token expired           |
| 403         | FORBIDDEN         | Insufficient permissions        |
| 404         | NOT_FOUND         | Resource not found              |
| 409         | CONFLICT          | Resource already exists         |
| 429         | RATE_LIMIT        | Too many requests               |
| 500         | INTERNAL_ERROR    | Server error                    |

---

## Authentication

Protected endpoints require a `Bearer` token in the `Authorization` header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

---

## Rate Limiting

| Scope            | Window | Max Requests |
|------------------|--------|-------------|
| Global API       | 15 min | 100         |
| Auth endpoints   | 15 min | 20          |
| Sensitive ops    | 15 min | 5           |
