<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
logout_user();
redirect_to('/login.php');