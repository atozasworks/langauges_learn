<?php
/**
 * dashboard.php – Protected page visible only to logged-in users.
 *
 * This is a sample dashboard. Replace or extend it to link to your
 * language learning app pages.
 */

require_once __DIR__ . '/auth-check.php';

$userId    = (int)$_SESSION['user_id'];
$email     = htmlspecialchars($_SESSION['email'] ?? '');
$name      = htmlspecialchars($_SESSION['name'] ?? '');
$provider  = htmlspecialchars($_SESSION['provider'] ?? '');
$picture   = htmlspecialchars($_SESSION['picture'] ?? '');

// Get initials for avatar fallback
$initials = '';
if ($name) {
    $parts = explode(' ', $name);
    $initials = strtoupper(substr($parts[0], 0, 1));
    if (isset($parts[1])) {
        $initials .= strtoupper(substr($parts[1], 0, 1));
    }
} else {
    $initials = strtoupper(substr($email, 0, 1));
}

$displayName = $name ?: $email;
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard – <?php echo htmlspecialchars(SITE_NAME); ?></title>
    <link rel="stylesheet" href="assets/auth.css">
</head>
<body>

<div class="dashboard-container">

    <!-- Navigation bar -->
    <nav class="dashboard-nav">
        <h2><?php echo htmlspecialchars(SITE_NAME); ?></h2>
        <div class="user-info">
            <span style="font-size:14px;color:#64748b;"><?php echo $email; ?></span>
            <div class="user-avatar">
                <?php if ($picture): ?>
                    <img src="<?php echo $picture; ?>" alt="Avatar" referrerpolicy="no-referrer">
                <?php else: ?>
                    <?php echo $initials; ?>
                <?php endif; ?>
            </div>
        </div>
    </nav>

    <!-- Content -->
    <div class="dashboard-content">
        <div class="welcome-card">
            <h1>Welcome<?php echo $name ? ', ' . $name : ''; ?>! 👋</h1>
            <p>You are successfully logged in.</p>

            <div class="user-details">
                <div class="detail-row">
                    <span class="detail-label">User ID</span>
                    <span class="detail-value">#<?php echo $userId; ?></span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Email</span>
                    <span class="detail-value"><?php echo $email; ?></span>
                </div>
                <?php if ($name): ?>
                <div class="detail-row">
                    <span class="detail-label">Name</span>
                    <span class="detail-value"><?php echo $name; ?></span>
                </div>
                <?php endif; ?>
                <div class="detail-row">
                    <span class="detail-label">Auth Provider</span>
                    <span class="detail-value"><?php echo $provider; ?></span>
                </div>
            </div>

            <a href="/spokenenglish/AtoZ_Services/lan_learn/index.php" class="btn btn-primary" style="margin-top:24px;margin-right:12px;width:auto;padding:10px 24px;text-decoration:none;">← Back to App</a>
            <a href="logout.php" class="btn btn-logout">Sign Out</a>
        </div>
    </div>

</div>

</body>
</html>
