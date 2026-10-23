<?php
/**
 * Shared setup for every API endpoint.
 *
 * Secrets live in a config file OUTSIDE the deployed site folder:
 *   public_html/lms-private/config.php   (production, next to the "learnings" folder)
 * or the path in the LMS_CONFIG environment variable (local testing).
 * See config.example.php for the format.
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

final class ApiError extends Exception
{
    public int $status;

    public function __construct(int $status, string $message)
    {
        parent::__construct($message);
        $this->status = $status;
    }
}

function lms_config(): array
{
    static $config = null;

    if ($config === null) {
        $path = getenv('LMS_CONFIG') ?: dirname(__DIR__, 3) . '/lms-private/config.php';

        if (!is_file($path)) {
            throw new ApiError(500, 'Server is not configured.');
        }

        $config = require $path;
    }

    return $config;
}

function is_emulator(): bool
{
    return !empty(lms_config()['emulator']);
}

function respond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Runs an endpoint handler with uniform error handling.
 * $methods lists the allowed HTTP methods.
 */
function run_endpoint(array $methods, callable $handler): void
{
    try {
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

        if (!in_array($method, $methods, true)) {
            throw new ApiError(405, 'Method not allowed.');
        }

        $result = $handler();
        respond(200, ['success' => true] + $result);
    } catch (ApiError $error) {
        respond($error->status, ['success' => false, 'message' => $error->getMessage()]);
    } catch (Throwable $error) {
        error_log('[lms-api] ' . $error->getMessage() . ' @ ' . $error->getFile() . ':' . $error->getLine());
        respond(500, ['success' => false, 'message' => 'Unexpected server error.']);
    }
}

function json_body(): array
{
    $raw = file_get_contents('php://input') ?: '';

    if (strlen($raw) > 1_000_000) {
        throw new ApiError(413, 'Request too large.');
    }

    $data = json_decode($raw, true);

    if (!is_array($data)) {
        throw new ApiError(400, 'Invalid JSON body.');
    }

    return $data;
}

/** Firebase keys cannot contain . $ # [ ] / and must be non-empty. */
function require_key($value, string $name): string
{
    $value = is_string($value) ? trim($value) : '';

    if ($value === '' || strlen($value) > 200 || preg_match('/[.$#\[\]\/\x00-\x1F\x7F]/', $value)) {
        throw new ApiError(400, "Invalid {$name}.");
    }

    return $value;
}

function normalize_role($role): string
{
    return preg_replace('/[\s_-]+/', '', strtolower(trim((string) $role)));
}

function is_admin_role(string $role): bool
{
    return in_array($role, ['superadmin', 'admin'], true);
}

function is_staff_role(string $role): bool
{
    return in_array($role, ['superadmin', 'admin', 'departmentadmin'], true);
}

function now_iso(): string
{
    return gmdate('Y-m-d\TH:i:s') . '.' . sprintf('%03d', (int) (microtime(true) * 1000) % 1000) . 'Z';
}

function now_ms(): int
{
    return (int) floor(microtime(true) * 1000);
}

/** Short random id, safe as a Firebase key. */
function random_id(int $bytes = 8): string
{
    return bin2hex(random_bytes($bytes));
}

function http_request(string $method, string $url, array $headers = [], ?string $body = null, int $timeout = 20): array
{
    $curl = curl_init($url);

    curl_setopt_array($curl, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => true,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_HTTPHEADER => $headers,
    ]);

    if ($body !== null) {
        curl_setopt($curl, CURLOPT_POSTFIELDS, $body);
    }

    $response = curl_exec($curl);

    if ($response === false) {
        $message = curl_error($curl);
        curl_close($curl);
        throw new RuntimeException("HTTP request failed: {$message}");
    }

    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $headerSize = (int) curl_getinfo($curl, CURLINFO_HEADER_SIZE);
    curl_close($curl);

    return [
        'status' => $status,
        'headers' => substr($response, 0, $headerSize),
        'body' => substr($response, $headerSize),
    ];
}

/** Tiny file cache in the system temp folder (tokens, Google certs). */
function cache_get(string $key)
{
    $file = sys_get_temp_dir() . '/lms-api-' . sha1($key) . '.json';

    if (!is_file($file)) {
        return null;
    }

    $data = json_decode((string) @file_get_contents($file), true);

    if (!is_array($data) || ($data['expires'] ?? 0) < time()) {
        return null;
    }

    return $data['value'];
}

function cache_set(string $key, $value, int $ttlSeconds): void
{
    $file = sys_get_temp_dir() . '/lms-api-' . sha1($key) . '.json';
    @file_put_contents($file, json_encode(['expires' => time() + $ttlSeconds, 'value' => $value]), LOCK_EX);
    @chmod($file, 0600);
}
