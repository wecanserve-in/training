<?php
/**
 * Minimal Firebase helpers without Composer:
 * - verify a user's Firebase ID token
 * - read/write the Realtime Database with admin rights (service account)
 * - delete a Firebase Auth account
 *
 * In emulator mode (config 'emulator') it talks to the local Firebase emulators instead.
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function base64url_decode(string $value): string
{
    $value = strtr($value, '-_', '+/');
    $padding = strlen($value) % 4;

    if ($padding) {
        $value .= str_repeat('=', 4 - $padding);
    }

    $decoded = base64_decode($value, true);

    if ($decoded === false) {
        throw new ApiError(401, 'Invalid token.');
    }

    return $decoded;
}

function base64url_encode(string $value): string
{
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function firebase_project_id(): string
{
    return lms_config()['firebase']['projectId'];
}

/** Google's public certificates for Firebase ID tokens, cached as Google instructs. */
function google_token_certs(): array
{
    $cached = cache_get('securetoken-certs');

    if (is_array($cached)) {
        return $cached;
    }

    $response = http_request(
        'GET',
        'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
    );

    if ($response['status'] !== 200) {
        throw new RuntimeException('Could not load Google token certificates.');
    }

    $certs = json_decode($response['body'], true);
    $ttl = 3600;

    if (preg_match('/max-age=(\d+)/i', $response['headers'], $match)) {
        $ttl = max(60, (int) $match[1]);
    }

    cache_set('securetoken-certs', $certs, $ttl);

    return $certs;
}

/**
 * Verifies the Authorization: Bearer <Firebase ID token> header.
 * Returns the token claims (uid in 'sub').
 */
function verify_request_token(): array
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';

    if ($header === '' && function_exists('getallheaders')) {
        foreach (getallheaders() as $name => $value) {
            if (strtolower($name) === 'authorization') {
                $header = $value;
            }
        }
    }

    if (!preg_match('/^Bearer\s+(\S+)$/i', $header, $match)) {
        throw new ApiError(401, 'Please sign in again.');
    }

    $parts = explode('.', $match[1]);

    if (count($parts) !== 3) {
        throw new ApiError(401, 'Invalid token.');
    }

    [$encodedHeader, $encodedPayload, $encodedSignature] = $parts;
    $tokenHeader = json_decode(base64url_decode($encodedHeader), true);
    $claims = json_decode(base64url_decode($encodedPayload), true);

    if (!is_array($tokenHeader) || !is_array($claims)) {
        throw new ApiError(401, 'Invalid token.');
    }

    if (!is_emulator()) {
        $certs = google_token_certs();
        $kid = $tokenHeader['kid'] ?? '';

        if (($tokenHeader['alg'] ?? '') !== 'RS256' || !isset($certs[$kid])) {
            throw new ApiError(401, 'Invalid token.');
        }

        $valid = openssl_verify(
            $encodedHeader . '.' . $encodedPayload,
            base64url_decode($encodedSignature),
            $certs[$kid],
            OPENSSL_ALGO_SHA256
        );

        if ($valid !== 1) {
            throw new ApiError(401, 'Invalid token.');
        }
    }

    $projectId = firebase_project_id();
    $now = time();
    $leeway = 300;

    if (
        ($claims['aud'] ?? '') !== $projectId ||
        ($claims['iss'] ?? '') !== "https://securetoken.google.com/{$projectId}" ||
        !is_string($claims['sub'] ?? null) || $claims['sub'] === '' ||
        (int) ($claims['exp'] ?? 0) < $now - $leeway ||
        (int) ($claims['iat'] ?? 0) > $now + $leeway
    ) {
        throw new ApiError(401, 'Your session has expired. Please sign in again.');
    }

    return $claims;
}

/** OAuth access token for the service account (admin access). */
function google_access_token(): string
{
    $cached = cache_get('google-access-token');

    if (is_string($cached)) {
        return $cached;
    }

    $account = lms_config()['firebase']['serviceAccount'];
    $now = time();

    $jwtHeader = base64url_encode(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
    $jwtClaims = base64url_encode(json_encode([
        'iss' => $account['client_email'],
        'scope' => implode(' ', [
            'https://www.googleapis.com/auth/firebase.database',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/identitytoolkit',
            'https://www.googleapis.com/auth/cloud-platform',
        ]),
        'aud' => 'https://oauth2.googleapis.com/token',
        'iat' => $now,
        'exp' => $now + 3600,
    ]));

    $signature = '';

    if (!openssl_sign($jwtHeader . '.' . $jwtClaims, $signature, $account['private_key'], OPENSSL_ALGO_SHA256)) {
        throw new RuntimeException('Could not sign service account token.');
    }

    $response = http_request(
        'POST',
        'https://oauth2.googleapis.com/token',
        ['Content-Type: application/x-www-form-urlencoded'],
        http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion' => $jwtHeader . '.' . $jwtClaims . '.' . base64url_encode($signature),
        ])
    );

    $data = json_decode($response['body'], true);

    if ($response['status'] !== 200 || empty($data['access_token'])) {
        throw new RuntimeException('Could not get Google access token: ' . $response['body']);
    }

    cache_set('google-access-token', $data['access_token'], max(60, (int) ($data['expires_in'] ?? 3600) - 300));

    return $data['access_token'];
}

function db_url(string $path, array $query = []): string
{
    $config = lms_config()['firebase'];
    $segments = array_filter(explode('/', trim($path, '/')), 'strlen');
    $encodedPath = implode('/', array_map('rawurlencode', $segments));

    if (is_emulator()) {
        $base = rtrim(lms_config()['emulator']['database'], '/');
        $query['ns'] = $config['databaseNamespace'] ?? $config['projectId'];
    } else {
        $base = rtrim($config['databaseURL'], '/');
    }

    $url = $base . '/' . $encodedPath . '.json';

    return $query ? $url . '?' . http_build_query($query) : $url;
}

function db_auth_headers(): array
{
    return [
        'Authorization: Bearer ' . (is_emulator() ? 'owner' : google_access_token()),
        'Content-Type: application/json',
    ];
}

function db_request(string $method, string $path, $data = null, array $query = [])
{
    $body = $data === null ? null : json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $response = http_request($method, db_url($path, $query), db_auth_headers(), $body);

    if ($response['status'] < 200 || $response['status'] >= 300) {
        throw new RuntimeException("Database {$method} {$path} failed ({$response['status']}): {$response['body']}");
    }

    return json_decode($response['body'], true);
}

function db_get(string $path, array $query = [])
{
    return db_request('GET', $path, null, $query);
}

/** Atomic multi-path update. Keys are paths relative to $path. Null values delete. */
function db_update(string $path, array $updates): void
{
    if ($updates) {
        db_request('PATCH', $path, $updates);
    }
}

/** Loads users/{uid} and returns [profile, normalizedRole]. */
function load_requester(array $claims): array
{
    $profile = db_get('users/' . require_key($claims['sub'], 'user'));
    $profile = is_array($profile) ? $profile : [];

    return [$profile, normalize_role($profile['role'] ?? 'user')];
}

function delete_auth_account(string $uid): void
{
    $projectId = firebase_project_id();

    if (is_emulator()) {
        $url = rtrim(lms_config()['emulator']['auth'], '/') .
            "/identitytoolkit.googleapis.com/v1/projects/{$projectId}/accounts:delete";
        $token = 'owner';
    } else {
        $url = "https://identitytoolkit.googleapis.com/v1/projects/{$projectId}/accounts:delete";
        $token = google_access_token();
    }

    $response = http_request(
        'POST',
        $url,
        ['Authorization: Bearer ' . $token, 'Content-Type: application/json'],
        json_encode(['localId' => $uid])
    );

    if ($response['status'] === 200) {
        return;
    }

    // An account that is already gone counts as deleted.
    if (strpos($response['body'], 'USER_NOT_FOUND') !== false) {
        return;
    }

    throw new RuntimeException('Auth deletion failed: ' . $response['body']);
}
