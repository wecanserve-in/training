<?php
/**
 * GET /api/quiz.php?courseId=...
 * Returns the final test questions WITHOUT the answers.
 */

declare(strict_types=1);

require_once __DIR__ . '/_lib/quiz.php';

run_endpoint(['GET'], function () {
    $claims = verify_request_token();
    [, $role] = load_requester($claims);
    $courseId = require_key($_GET['courseId'] ?? '', 'course id');

    $course = load_course($courseId);
    assert_can_take_course($claims['sub'], $role, $courseId);

    return [
        'questions' => array_map('question_for_client', load_final_questions($courseId)),
    ];
});
