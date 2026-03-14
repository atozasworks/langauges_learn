<?php
/**
 * Lightweight .env loader for plain PHP projects (no Composer needed).
 *
 * Parses a .env file and loads each KEY=VALUE pair into:
 *   - $_ENV
 *   - $_SERVER
 *   - putenv()  (so getenv() also works)
 *
 * Usage:
 *   require_once __DIR__ . '/env-loader.php';
 *   loadEnv(__DIR__ . '/../.env');
 *   $secret = env('GOOGLE_CLIENT_SECRET');
 */

/**
 * Parse and load a .env file into the environment.
 *
 * @param string $path Absolute path to the .env file.
 * @return void
 */
function loadEnv(string $path): void
{
    if (!file_exists($path)) {
        // Silently skip — the server may set real env vars instead of a file.
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

    foreach ($lines as $line) {
        // Skip comments
        $line = trim($line);
        if ($line === '' || $line[0] === '#') {
            continue;
        }

        // Split on the first '=' only
        $eqPos = strpos($line, '=');
        if ($eqPos === false) {
            continue;
        }

        $key   = trim(substr($line, 0, $eqPos));
        $value = trim(substr($line, $eqPos + 1));

        // Remove surrounding quotes if present
        if (
            (str_starts_with($value, '"') && str_ends_with($value, '"')) ||
            (str_starts_with($value, "'") && str_ends_with($value, "'"))
        ) {
            $value = substr($value, 1, -1);
        }

        // Don't overwrite existing real env vars (server-set vars take priority)
        if (getenv($key) !== false) {
            continue;
        }

        putenv("$key=$value");
        $_ENV[$key]    = $value;
        $_SERVER[$key] = $value;
    }
}

/**
 * Retrieve an environment variable with an optional default.
 *
 * @param string $key     Variable name.
 * @param string $default Fallback value if the variable is not set.
 * @return string
 */
function env(string $key, string $default = ''): string
{
    // Check putenv / getenv first, then superglobals
    $value = getenv($key);
    if ($value !== false && $value !== '') {
        return $value;
    }
    return $_ENV[$key] ?? $_SERVER[$key] ?? $default;
}
