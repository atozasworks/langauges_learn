# Auth Setup: SMTP OTP + Google Login

This project now includes a simple auth server and a right-side login form panel in the UI.

## 1) Backend Setup (SMTP OTP + Google token verification)

Path: `lan_learn/backend`

1. Install dependencies:
   - `npm.cmd install`
2. Copy env template:
   - copy `.env.example` to `.env`
3. Fill real values in `.env`:
   - `SMTP_PASS` (your mailbox password)
   - `GOOGLE_CLIENT_ID` (from Google Cloud Console)
4. Start server:
   - `npm.cmd start`

Default server URL: `http://localhost:4000`

### Config values used for SMTP

- SMTP host: `mail.atozas.com`
- Port: `465`
- Secure: `true`
- Username: `no-reply@atozas.com`

## 2) Frontend Setup

Path: `lan_learn/index.html`

1. Update the meta tag value for Google client ID:
   - `<meta name="google-signin-client_id" content="YOUR_CLIENT_ID.apps.googleusercontent.com" />`
2. Serve frontend (example):
   - from `lan_learn`: `npm.cmd run serve`
3. Click **Login** in top nav to open the full right-side form.

## 3) Endpoints Included

- `POST /auth/send-otp`
  - body: `{ "email": "user@example.com" }`
- `POST /auth/verify-otp`
  - body: `{ "email": "user@example.com", "otp": "123456" }`
- `POST /auth/google-login`
  - body: `{ "credential": "GOOGLE_ID_TOKEN" }`

## 4) Required Google Setup

1. Open Google Cloud Console: https://console.cloud.google.com/
2. Create/select a project.
3. Configure OAuth consent screen.
4. Create **OAuth 2.0 Client ID** for **Web application**.
5. Add Authorized JavaScript origins:
   - `http://localhost:3000`
   - `http://127.0.0.1:3000`
6. Use that client ID in:
   - `lan_learn/index.html` meta tag
   - `lan_learn/backend/.env` as `GOOGLE_CLIENT_ID`

## 5) Useful Documentation Links

- Nodemailer SMTP docs: https://nodemailer.com/smtp/
- Google Identity Services (Web): https://developers.google.com/identity/gsi/web
- Verify Google ID tokens on backend: https://developers.google.com/identity/sign-in/web/backend-auth

## 6) Notes for Production

- Store OTP in Redis or database instead of memory map.
- Add rate limiting and IP/email throttle for OTP endpoints.
- Use HTTPS and strict CORS in production.
- Replace success response with JWT/session integration.
