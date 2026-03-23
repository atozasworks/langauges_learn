<?php
declare(strict_types=1);

require __DIR__ . '/auth/bootstrap.php';
require_auth();

$user = current_user();
$displayName = trim((string) ($user['name'] ?? ''));
if ($displayName === '') {
    $displayName = 'Profile';
}
$initial = strtoupper(substr($displayName, 0, 1));
if ($initial === '') {
    $initial = 'U';
}

$html = file_get_contents(__DIR__ . '/index.html');
if ($html === false) {
    http_response_code(500);
    echo 'Unable to load app.';
    exit;
}

$authStyle = '<style>
.auth-nav-profile{display:inline-flex;align-items:center;gap:10px;background:#fff;padding:6px 10px;border-radius:12px;box-shadow:0 6px 18px rgba(0,0,0,.12);font-family:Segoe UI,sans-serif;font-size:14px;line-height:1}
.auth-nav-profile .avatar{width:30px;height:30px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:#0b6d43;color:#fff;font-weight:700;flex:0 0 30px}
.auth-nav-profile .name{max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.auth-nav-profile .logout{color:#0b6d43;text-decoration:none;font-weight:600}
@media (max-width:900px){.auth-nav-profile{padding:5px 8px;gap:8px;font-size:13px}.auth-nav-profile .name{max-width:90px}}
</style>';

$authBar = '<div class="auth-nav-profile">'
    . '<span class="avatar">' . htmlspecialchars($initial, ENT_QUOTES, 'UTF-8') . '</span>'
    . '<span class="name"><strong>' . htmlspecialchars($displayName, ENT_QUOTES, 'UTF-8') . '</strong></span>'
    . '<a class="logout" href="' . htmlspecialchars(app_base_url() . '/auth/logout.php', ENT_QUOTES, 'UTF-8') . '">Logout</a>'
    . '</div>';

if (strpos($html, '<div id="auth-nav-slot"></div>') !== false) {
    $html = str_replace('<div id="auth-nav-slot"></div>', $authBar, $html);
}

if (strpos($html, '</head>') !== false) {
    $html = str_replace('</head>', $authStyle . '</head>', $html);
} else {
    $html = $authStyle . $html;
}

echo $html;
