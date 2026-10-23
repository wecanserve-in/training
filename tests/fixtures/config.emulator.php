<?php
// Config for local tests against the Firebase emulators. Contains no real secrets.
return [
    'firebase' => [
        'projectId' => 'lms-portal-final',
        'databaseURL' => 'http://127.0.0.1:9000',
        'databaseNamespace' => 'lms-portal-final-default-rtdb',
        'serviceAccount' => null,
    ],
    'r2' => [
        'accountId' => 'testaccount',
        'accessKeyId' => 'TESTKEY',
        'secretAccessKey' => 'TESTSECRET',
        'bucket' => 'test-bucket',
        'publicUrl' => 'https://files.example.com',
    ],
    'emulator' => [
        'database' => 'http://127.0.0.1:9000',
        'auth' => 'http://127.0.0.1:9099',
    ],
];
