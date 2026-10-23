<?php
/**
 * Creates short-lived pre-signed PUT URLs for Cloudflare R2 (S3 Signature V4).
 * The browser uploads straight to R2 with the URL; the secret key never leaves the server.
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function r2_encode_path(string $key): string
{
    return implode('/', array_map('rawurlencode', explode('/', $key)));
}

function r2_presigned_put_url(string $key, int $expiresSeconds = 3600): string
{
    $config = lms_config()['r2'];

    $host = $config['endpointHost'] ?? "{$config['accountId']}.r2.cloudflarestorage.com";
    $scheme = $config['endpointScheme'] ?? 'https';
    $region = 'auto';
    $service = 's3';

    $amzDate = gmdate('Ymd\THis\Z');
    $date = substr($amzDate, 0, 8);
    $scope = "{$date}/{$region}/{$service}/aws4_request";
    $canonicalUri = '/' . rawurlencode($config['bucket']) . '/' . r2_encode_path($key);

    $query = [
        'X-Amz-Algorithm' => 'AWS4-HMAC-SHA256',
        'X-Amz-Credential' => "{$config['accessKeyId']}/{$scope}",
        'X-Amz-Date' => $amzDate,
        'X-Amz-Expires' => (string) $expiresSeconds,
        'X-Amz-SignedHeaders' => 'host',
    ];
    ksort($query);

    $canonicalQuery = implode('&', array_map(
        fn ($name, $value) => rawurlencode($name) . '=' . rawurlencode($value),
        array_keys($query),
        $query
    ));

    $canonicalRequest = implode("\n", [
        'PUT',
        $canonicalUri,
        $canonicalQuery,
        "host:{$host}\n",
        'host',
        'UNSIGNED-PAYLOAD',
    ]);

    $stringToSign = implode("\n", [
        'AWS4-HMAC-SHA256',
        $amzDate,
        $scope,
        hash('sha256', $canonicalRequest),
    ]);

    $signingKey = hash_hmac('sha256', 'aws4_request',
        hash_hmac('sha256', $service,
            hash_hmac('sha256', $region,
                hash_hmac('sha256', $date, 'AWS4' . $config['secretAccessKey'], true),
                true),
            true),
        true);

    $signature = hash_hmac('sha256', $stringToSign, $signingKey);

    return "{$scheme}://{$host}{$canonicalUri}?{$canonicalQuery}&X-Amz-Signature={$signature}";
}

function r2_public_url(string $key): string
{
    return rtrim(lms_config()['r2']['publicUrl'], '/') . '/' . r2_encode_path($key);
}
