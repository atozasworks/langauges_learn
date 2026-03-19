<?php
/**
 * index.php – Auth-protected entry point for the language learning app.
 *
 * If the user is not logged in, they get redirected to the login page.
 * If logged in, the original index.html is served with user info injected.
 */

require_once __DIR__ . '/auth/config.php';

startSecureSession();

if (empty($_SESSION['user_id'])) {
    header('Location: ' . appPath('/auth/login.php'));
    exit;
}

// Pass user info to the frontend
$userName = htmlspecialchars($_SESSION['name'] ?? '', ENT_QUOTES, 'UTF-8');
$userEmail = htmlspecialchars($_SESSION['email'] ?? '', ENT_QUOTES, 'UTF-8');
$userPicture = htmlspecialchars($_SESSION['picture'] ?? '', ENT_QUOTES, 'UTF-8');
$userInitial = strtoupper(substr($userEmail, 0, 1));
if ($userName) {
    $parts = explode(' ', $userName);
    $userInitial = strtoupper(substr($parts[0], 0, 1));
}

$dashboardUrl = htmlspecialchars(appPath('/auth/dashboard.php'), ENT_QUOTES, 'UTF-8');
$logoutUrl = htmlspecialchars(appPath('/auth/logout.php'), ENT_QUOTES, 'UTF-8');

// Read the HTML and inject auth UI before </body>
$html = file_get_contents(__DIR__ . '/index.html');

$authUI = <<<HTML

<!-- Auth User Menu (injected by index.php) -->
<style>
.user-menu-container {
    position: relative;
    display: flex;
    align-items: center;
    margin-left: 0.5rem;
}
.user-menu-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 12px 4px 4px;
    border: 1.5px solid #e2e8f0;
    border-radius: 50px;
    background: #fff;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
}
.user-menu-btn:hover {
    border-color: #cbd5e1;
    background: #f8fafc;
}
.user-avatar-sm {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #eef2ff;
    color: #4f46e5;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 14px;
    overflow: hidden;
}
.user-avatar-sm img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}
.user-menu-name {
    font-size: 13px;
    font-weight: 500;
    color: #334155;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.user-dropdown {
    display: none;
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.1);
    min-width: 220px;
    z-index: 9999;
    overflow: hidden;
}
.user-dropdown.show {
    display: block;
}
.user-dropdown-header {
    padding: 14px 16px;
    border-bottom: 1px solid #f1f5f9;
}
.user-dropdown-header .ud-name {
    font-weight: 600;
    font-size: 14px;
    color: #1e293b;
}
.user-dropdown-header .ud-email {
    font-size: 12px;
    color: #64748b;
    margin-top: 2px;
}
.user-dropdown-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    font-size: 14px;
    color: #334155;
    text-decoration: none;
    transition: background 0.15s;
}
.user-dropdown-item:hover {
    background: #f8fafc;
}
.user-dropdown-item.logout {
    color: #ef4444;
    border-top: 1px solid #f1f5f9;
}
.user-dropdown-item.logout:hover {
    background: #fef2f2;
}
.user-dropdown-item svg {
    width: 16px;
    height: 16px;
    stroke: currentColor;
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
}
@media (max-width: 768px) {
    .user-menu-name { display: none; }
    .user-menu-btn { padding: 4px; }
}
</style>

<script>
(function() {
    // Inject user menu into navbar
    var navLinks = document.querySelector('.nav-links');
    if (!navLinks) return;

    var container = document.createElement('div');
    container.className = 'user-menu-container';
    container.innerHTML = '' +
        '<button class="user-menu-btn" id="user-menu-toggle" aria-label="User menu">' +
            '<div class="user-avatar-sm">' +
                ('{$userPicture}' ? '<img src="{$userPicture}" alt="" referrerpolicy="no-referrer">' : '{$userInitial}') +
            '</div>' +
            '<span class="user-menu-name">{$userName}' + ('{$userName}' === '' ? '{$userEmail}' : '') + '</span>' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>' +
        '</button>' +
        '<div class="user-dropdown" id="user-dropdown">' +
            '<div class="user-dropdown-header">' +
                '<div class="ud-name">{$userName}</div>' +
                '<div class="ud-email">{$userEmail}</div>' +
            '</div>' +
            '<a href="{$dashboardUrl}" class="user-dropdown-item">' +
                '<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
                'My Account' +
            '</a>' +
            '<a href="{$logoutUrl}" class="user-dropdown-item logout">' +
                '<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' +
                'Sign Out' +
            '</a>' +
        '</div>';

    navLinks.appendChild(container);

    // Toggle dropdown
    var toggle = document.getElementById('user-menu-toggle');
    var dropdown = document.getElementById('user-dropdown');
    toggle.addEventListener('click', function(e) {
        e.stopPropagation();
        dropdown.classList.toggle('show');
    });
    document.addEventListener('click', function(e) {
        if (!container.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });
})();
</script>
HTML;

// Inject before </body>
$html = str_replace('</body>', $authUI . "\n</body>", $html);

echo $html;
