# Authentication System – Setup Guide

## Folder Structure

```
AtoZ_Services/
├── auth/
│   ├── assets/
│   │   ├── auth.css          ← Login/dashboard styling
│   │   └── auth.js           ← Client-side login logic
│   ├── vendor/               ← Composer packages (PHPMailer)
│   ├── config.php            ← DB connection + global settings
│   ├── google-config.php     ← Google Client ID
│   ├── mail-config.php       ← SMTP credentials
│   ├── login.php             ← Login page (entry point)
│   ├── otp-send.php          ← API: generate & email OTP
│   ├── otp-verify.php        ← API: verify OTP & login
│   ├── google-login.php      ← API: verify Google token & login
│   ├── auth-check.php        ← Include guard for protected pages
│   ├── logout.php            ← Destroy session & redirect
│   ├── dashboard.php         ← Sample protected page
│   ├── schema.sql            ← Database schema
│   └── SETUP.md              ← This file
├── lan_learn/
├── lan_editor/
├── mapServices/
└── README.md
```

---

## Step-by-Step Setup on XAMPP

### 1. Prerequisites
- XAMPP installed with Apache + MySQL running
- PHP 7.4+ (XAMPP typically includes 8.x)
- PHP `curl` extension enabled (check `php.ini`)
- Composer installed (https://getcomposer.org/)

### 2. Place Project Files
Copy/clone the project into your XAMPP htdocs:
```
C:\xampp\htdocs\AtoZ_Services\
```
Or create a symlink/virtual host pointing to your workspace.

### 3. Install PHPMailer via Composer
Open terminal in the `auth/` folder:
```bash
cd C:\xampp\htdocs\AtoZ_Services\auth
composer require phpmailer/phpmailer
```
This creates `vendor/` folder with PHPMailer and autoloader.

### 4. Create the Database
1. Open phpMyAdmin: http://localhost/phpmyadmin
2. Click "SQL" tab
3. Paste the contents of `schema.sql` and click "Go"
4. This creates the `atozservices_auth` database with all tables

### 5. Configure Database Connection
Edit `config.php`:
```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'atozservices_auth');
define('DB_USER', 'root');           // your MySQL username
define('DB_PASS', '');               // your MySQL password
```

### 6. Configure SMTP (for sending OTP emails)
Edit `mail-config.php`:
```php
define('SMTP_HOST', 'smtp.gmail.com');
define('SMTP_PORT', 587);
define('SMTP_USERNAME', 'your-email@gmail.com');
define('SMTP_PASSWORD', 'your-app-password');
define('SMTP_ENCRYPTION', 'tls');
define('MAIL_FROM_EMAIL', 'your-email@gmail.com');
define('MAIL_FROM_NAME', 'AtoZ Language Learning');
```

#### Gmail App Password Setup:
1. Go to https://myaccount.google.com/security
2. Enable 2-Step Verification (required)
3. Go to https://myaccount.google.com/apppasswords
4. Select "Mail" → "Other (Custom name)" → enter "AtoZ Auth"
5. Copy the 16-character app password
6. Paste it as `SMTP_PASSWORD` (no spaces)

### 7. Configure Google Sign-In
Edit `google-config.php`:
```php
define('GOOGLE_CLIENT_ID', 'YOUR_CLIENT_ID.apps.googleusercontent.com');
```

#### Google Cloud Console Setup:
1. Go to https://console.cloud.google.com/
2. Create a new project or select existing
3. Go to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Name: `AtoZ Auth`
7. Under **Authorized JavaScript origins**, add:
   - `http://localhost`
   - `http://localhost:80`
8. Click **Create**
9. Copy the **Client ID** and paste into `google-config.php`

> **Note:** You do NOT need a Client Secret for this flow.
> The Google Identity Services library uses only the Client ID.

### 8. Enable PHP cURL Extension
1. Open `C:\xampp\php\php.ini`
2. Find `;extension=curl` and remove the semicolon → `extension=curl`
3. Restart Apache

### 9. Test the Setup
1. Start Apache + MySQL in XAMPP Control Panel
2. Visit: `http://localhost/AtoZ_Services/auth/login.php`
3. You should see the login page with Google button and email OTP form

---

## Configuration Placeholders Summary

| File | Setting | What to fill |
|------|---------|-------------|
| `config.php` | `DB_HOST` | MySQL host (usually `localhost`) |
| `config.php` | `DB_NAME` | Database name (`atozservices_auth`) |
| `config.php` | `DB_USER` | MySQL username |
| `config.php` | `DB_PASS` | MySQL password |
| `config.php` | `SITE_URL` | Your project URL |
| `google-config.php` | `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `mail-config.php` | `SMTP_HOST` | SMTP server host |
| `mail-config.php` | `SMTP_PORT` | SMTP port (587 for TLS) |
| `mail-config.php` | `SMTP_USERNAME` | SMTP login email |
| `mail-config.php` | `SMTP_PASSWORD` | SMTP password / App Password |
| `mail-config.php` | `MAIL_FROM_EMAIL` | Sender email address |
| `mail-config.php` | `MAIL_FROM_NAME` | Sender display name |

---

## Testing Checklist

### Email OTP Flow
- [ ] Login page loads without errors
- [ ] Enter valid email → "Send OTP" → OTP email arrives
- [ ] OTP email has correct format with 6-digit code
- [ ] Enter correct OTP → login succeeds → redirected to dashboard
- [ ] Dashboard shows user info (email, provider: email_otp)
- [ ] Logout works → redirected to login page
- [ ] After logout, visiting dashboard.php redirects to login
- [ ] Enter wrong OTP → error message with remaining attempts
- [ ] After 5 wrong attempts → OTP is burned, must request new one
- [ ] Requesting OTP within 60s → cooldown message shown
- [ ] More than 5 OTP requests in 15 minutes → rate limited
- [ ] Invalid email format → validation error shown
- [ ] Same email login again → same user, no duplicate

### Google Login Flow
- [ ] "Continue with Google" button visible on login page
- [ ] Click → Google account picker appears
- [ ] Select account → login succeeds → redirected to dashboard
- [ ] Dashboard shows name, email, profile picture, provider: google
- [ ] Logout works
- [ ] Login with Google using same email as OTP → account linked (provider: both)

### Session & Security
- [ ] Already logged-in user visiting login.php → redirected to dashboard
- [ ] Session persists across page refreshes
- [ ] CSRF token present in requests
- [ ] OTP is stored as hash in database (not plain text)
- [ ] Direct access to otp-send.php with GET → 405 error
- [ ] Direct access to otp-verify.php with GET → 405 error

---

## Common Errors and Fixes

### 1. "Class 'PHPMailer\PHPMailer\PHPMailer' not found"
**Cause:** Composer packages not installed.
**Fix:** Run `composer require phpmailer/phpmailer` in the `auth/` folder.

### 2. "SMTP connect() failed"
**Cause:** SMTP credentials wrong or cURL/OpenSSL not enabled.
**Fix:**
- Verify SMTP credentials in `mail-config.php`
- For Gmail: ensure 2FA is on and use App Password
- Check `php.ini`: `extension=curl` and `extension=openssl` are uncommented
- Restart Apache after changes

### 3. "SQLSTATE[HY000] [1049] Unknown database"
**Cause:** Database not created.
**Fix:** Run `schema.sql` in phpMyAdmin.

### 4. "SQLSTATE[HY000] [2002] Connection refused"
**Cause:** MySQL not running.
**Fix:** Start MySQL in XAMPP Control Panel.

### 5. Google button not showing
**Cause:** Invalid Client ID or domain not in authorized origins.
**Fix:**
- Check `google-config.php` has correct Client ID
- Ensure `http://localhost` is in Authorized JavaScript origins
- Open browser console for errors

### 6. "Invalid session. Please refresh the page." (CSRF error)
**Cause:** Session expired or cookies blocked.
**Fix:** Refresh the page. If persists, clear browser cookies for localhost.

### 7. Google login returns "Google authentication failed"
**Cause:** Token verification failed.
**Fix:**
- Ensure PHP `curl` extension is enabled
- Ensure the server can reach `https://oauth2.googleapis.com/`
- Check that `GOOGLE_CLIENT_ID` matches exactly

### 8. OTP email goes to spam
**Fix:**
- Use a proper FROM address matching your SMTP account
- For production, use a dedicated email service (SendGrid, Mailgun, etc.)
- Add SPF/DKIM records to your domain

### 9. "Too many OTP requests" immediately
**Cause:** Rate limit table has old entries.
**Fix:** Clear the `otp_rate_limits` table:
```sql
DELETE FROM otp_rate_limits WHERE request_time < NOW() - INTERVAL 1 HOUR;
```

### 10. Session not persisting between requests
**Cause:** Session save path issue or cookies not working.
**Fix:**
- Check `session.save_path` in `php.ini`
- Ensure `C:\xampp\tmp` exists and is writable
- Confirm browser accepts cookies from localhost

---

## Protecting Other Pages in Your Project

To protect any existing page in your project, add this at the very top:

```php
<?php require_once __DIR__ . '/../auth/auth-check.php'; ?>
```

Adjust the relative path based on where your file is located. The include will redirect unauthenticated users to the login page automatically.

---

## How Authentication Works (Summary)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  login.php   │────▶│ otp-send.php │────▶│  PHPMailer   │
│  (frontend)  │     │  (generate)  │     │  (send mail) │
└──────┬───────┘     └──────────────┘     └──────────────┘
       │
       │  user enters OTP
       ▼
┌──────────────┐     ┌──────────────┐
│ otp-verify   │────▶│  Dashboard   │
│  .php        │     │  .php        │
└──────────────┘     └──────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  login.php   │────▶│ google-login │────▶│  Dashboard   │
│  (Google btn)│     │  .php        │     │  .php        │
└──────────────┘     └──────────────┘     └──────────────┘
```

Both flows: verify identity → find/create user → set session → redirect to dashboard.
