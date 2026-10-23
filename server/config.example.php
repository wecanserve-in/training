<?php
/**
 * Copy to the server as:  public_html/lms-private/config.php
 * (next to the "learnings" folder, NOT inside it, so site deploys never touch it).
 * Also add public_html/lms-private/.htaccess containing "Require all denied".
 *
 * Never commit the real file.
 */

return [
    'firebase' => [
        'projectId' => 'lms-portal-final',
        'databaseURL' => 'https://YOUR-DB.firebaseio.com',
        // Paste the downloaded service-account JSON here as a PHP array:
        // json_decode(file_get_contents(__DIR__ . '/service-account.json'), true)
        'serviceAccount' => json_decode((string) file_get_contents(__DIR__ . '/service-account.json'), true),
    ],

    'r2' => [
        'accountId' => '',
        'accessKeyId' => '',
        'secretAccessKey' => '',
        'bucket' => '',
        'publicUrl' => 'https://pub-xxxx.r2.dev',
    ],

    // Local testing only. Remove in production.
    // 'emulator' => ['database' => 'http://127.0.0.1:9000', 'auth' => 'http://127.0.0.1:9099'],
];
