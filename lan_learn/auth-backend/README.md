# Auth Backend (PHP)

Authentication for Language Learn: **Google OAuth 2.0** and **Gmail OTP**.

## Requirements

- PHP 7.4+ (with PDO MySQL, JSON, OpenSSL)
- MySQL 5.7+ / MariaDB
- SMTP server for OTP emails

## Setup

### 1. Database

Create a MySQL database and user. Then copy the example config and set credentials:

```bash
cp db-config.example.php db-config.local.php
# Edit db-config.local.php or set env: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
```

The `users` table is created automatically on first use.

### 2. Google OAuth (optional)

1. In [Google Cloud Console](https://console.cloud.google.com/) create a project and enable **Google+ API** / **People API**.
2. Create **OAuth 2.0 Client ID** (Web application).
3. Set **Authorized redirect URI** to: `https://your-domain.com/lan_learn/auth-backend/google-callback.php`
4. Copy Client ID and Client Secret into env or `google-config.local.php`:

```bash
cp google-config.example.php google-config.local.php
# Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (or in .env)
```

### 3. SMTP for OTP

Copy the example and set your SMTP credentials (e.g. Hostinger):

```bash
cp smtp-config.example.php smtp-config.local.php
# Set SMTP_NAME, SMTP_SERVER, SMTP_PORT, SMTP_SECURE, SMTP_EMAIL, SMTP_EMAIL_PASSWORD
```

Example for Hostinger:

- `SMTP_SERVER=smtp.hostinger.com`
- `SMTP_PORT=465`
- `SMTP_SECURE=true`
- `SMTP_EMAIL=no-reply@yourdomain.com`
- `SMTP_EMAIL_PASSWORD=your_password`

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `google-login.php` | GET | Redirects to Google OAuth |
| `google-callback.php` | GET | OAuth callback; creates session |
| `send-otp.php` | POST | Sends OTP to email (JSON: `{ "email": "..." }`) |
| `verify-otp.php` | POST | Verifies OTP and logs in (JSON: `{ "email", "otp" }`) |
| `check-session.php` | GET | Returns `{ logged_in, user }` |
| `logout.php` | GET | Destroys session and redirects to app |

## Sessions

- Session cookie is HttpOnly, SameSite=Lax, optional Secure on HTTPS.
- Session ID is regenerated on login.
- User data stored in session: `user_id`, `user_name`, `user_email`.

## Users table

- `id`, `name`, `email`, `google_id` (nullable), `otp`, `otp_expires_at`, `created_at`
- OTP expires in 10 minutes. Stored hashed or plain per your security policy (current: plain for simplicity).
