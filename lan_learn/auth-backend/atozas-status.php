<?php
// { enabled, silent } for the login modal and the silent check (no secrets).
require_once __DIR__ . '/atozas-lib.php';
header('Content-Type: application/json');
header('Cache-Control: no-store');
echo json_encode(['enabled' => atozasReady(), 'silent' => atozasSilentSupported()]);
