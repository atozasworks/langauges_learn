# Live Deployment Guide (cPanel) - `lan_learn`

This guide is tailored for your current PHP + MongoDB setup.

## 1. Pre-check in cPanel

1. Open cPanel -> **Select PHP Version** (or **PHP Extensions**).
2. Ensure PHP is 8.x and `mongodb` extension is enabled.
3. Save and restart PHP handler if your host provides that option.

If `mongodb` is not available in cPanel, ask hosting support to enable **ext-mongodb** for your account.

## 2. Upload project files

1. Upload `AtoZ_Services/lan_learn` to your live path (for example `public_html/AtoZ_Services/lan_learn`).
2. Confirm `auth-backend/` is inside the deployed folder.

## 3. Create live DB config (required)

1. In live server file manager, go to:
   - `.../lan_learn/auth-backend/`
2. Copy `db-config.live.example.php` to:
   - `db-config.local.php`
3. Edit `db-config.local.php` and set:
   - `uri` with live username/password/host
   - `dbname` as `lldb`
   - add `'authSource' => 'admin'` if required by your Mongo user

Example:

```php
<?php
return [
    'driver' => 'mongodb',
    'uri' => 'mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/lldb?retryWrites=true&w=majority',
    'dbname' => 'lldb',
    'uriOptions' => [
        // 'authSource' => 'admin',
    ],
];
```

## 4. Configure diagnostic endpoint access (secure default)

Diagnostic endpoints are now blocked in production by default.

To temporarily allow diagnostics, add this env variable in cPanel:

- `ALLOW_DIAGNOSTICS=true`

After testing, remove it (or set false).

## 5. Verify connection on live

Temporarily enable diagnostics (`ALLOW_DIAGNOSTICS=true`) and open:

1. `auth-backend/check-cfg.php`
2. `auth-backend/test-db-live.php`

Expected:
- MongoDB extension loaded
- Ping OK
- Collections listed (or no collections yet)

Then disable diagnostics again.

## 6. Verify CRUD APIs

Test these endpoints from your app UI or API client:

- Read: `auth-backend/get-learners.php?email=you@example.com`
- Create: `auth-backend/add-learner.php`
- Update: `auth-backend/update-learner.php`
- Delete: `auth-backend/delete-learner.php`

## 7. Verify admin panel flow

1. Open `admin-panel.html`
2. If not logged in, app redirects to `login-modal.html?redirect=admin-panel.html`
3. Login and return to admin panel
4. Perform add/edit/delete and confirm records in MongoDB

## 8. Final hardening checklist

1. Keep diagnostics disabled (`ALLOW_DIAGNOSTICS` unset/false).
2. Keep `db-config.local.php` out of git (already covered by `.gitignore`).
3. Use strong MongoDB password and least-privilege DB user.
4. Use HTTPS on live domain.
5. Keep PHP errors hidden in production (`display_errors=0`).

## 9. Troubleshooting quick map

- `MongoDB PHP extension is not loaded`:
  - Enable ext-mongodb in cPanel/hosting support.
- `Authentication failed`:
  - Check URI username/password and `authSource`.
- `Connection timeout`:
  - Check host/port, firewall, Atlas IP whitelist.
- `Works local, fails live`:
  - Verify `db-config.local.php` exists in live `auth-backend/` and path is correct.
