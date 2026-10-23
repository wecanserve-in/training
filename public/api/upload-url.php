<?php
/**
 * POST /api/upload-url.php
 * Body: { folder, fileName, department? }
 * Returns a pre-signed R2 URL the browser can PUT the file to, plus the file's public URL.
 *
 * Only the folders below are allowed. Course content needs a staff role;
 * any signed-in user may upload their own profile photo.
 */

declare(strict_types=1);

require_once __DIR__ . '/_lib/firebase.php';
require_once __DIR__ . '/_lib/r2.php';

const UPLOAD_FOLDERS = [
    'training-portal/videos' => ['staff' => true, 'byDepartment' => true],
    'training-portal/thumbnails' => ['staff' => true, 'byDepartment' => true],
    'training-portal/course-thumbnails' => ['staff' => true, 'byDepartment' => true],
    'lms/thumbnails' => ['staff' => true, 'byDepartment' => true],
    'resources' => ['staff' => true, 'byDepartment' => false],
    'profile-photos' => ['staff' => false, 'byDepartment' => false],
];

function safe_slug(string $value): string
{
    $value = strtolower(trim($value));
    $value = str_replace('&', 'and', $value);
    $value = preg_replace('/[^a-z0-9]+/', '-', $value);

    return trim((string) $value, '-');
}

run_endpoint(['POST'], function () {
    $claims = verify_request_token();
    [, $role] = load_requester($claims);
    $uid = $claims['sub'];
    $body = json_body();

    $folder = (string) ($body['folder'] ?? '');

    if (!isset(UPLOAD_FOLDERS[$folder])) {
        throw new ApiError(400, 'Uploads to this folder are not allowed.');
    }

    $rule = UPLOAD_FOLDERS[$folder];

    if ($rule['staff'] && !is_staff_role($role)) {
        throw new ApiError(403, 'You do not have permission to upload course content.');
    }

    $extension = strtolower((string) pathinfo((string) ($body['fileName'] ?? ''), PATHINFO_EXTENSION));

    if (!preg_match('/^[a-z0-9]{1,10}$/', $extension)) {
        throw new ApiError(400, 'The file needs a valid extension.');
    }

    if ($folder === 'profile-photos') {
        if (!in_array($extension, ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'], true)) {
            throw new ApiError(400, 'Profile photos must be images.');
        }

        // Same naming as before: {uid}-{timestamp}.{ext}
        $key = "profile-photos/{$uid}-" . now_ms() . ".{$extension}";
    } else {
        $fileName = now_ms() . '-' . substr(random_id(6), 0, 7) . ".{$extension}";
        $key = $rule['byDepartment']
            ? $folder . '/' . (safe_slug((string) ($body['department'] ?? '')) ?: 'general') . '/' . $fileName
            : "{$folder}/{$fileName}";
    }

    // Large videos can take a while on slow connections.
    $expires = $folder === 'training-portal/videos' ? 6 * 3600 : 3600;

    return [
        'uploadUrl' => r2_presigned_put_url($key, $expires),
        'publicUrl' => r2_public_url($key),
        'key' => $key,
    ];
});
