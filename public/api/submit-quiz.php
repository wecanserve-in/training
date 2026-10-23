<?php
/**
 * POST /api/submit-quiz.php
 * Body: { courseId, answers: { questionId: selectedOptionText }, reason?, warningCount? }
 *
 * Grades the final course test on the server and saves the result.
 * Users can no longer write their own final results (see database.rules.json).
 */

declare(strict_types=1);

require_once __DIR__ . '/_lib/quiz.php';

run_endpoint(['POST'], function () {
    $claims = verify_request_token();
    [$profile, $role] = load_requester($claims);
    $uid = $claims['sub'];
    $body = json_body();

    $courseId = require_key($body['courseId'] ?? '', 'course id');
    $answers = is_array($body['answers'] ?? null) ? $body['answers'] : [];
    $reason = substr(preg_replace('/[^a-z_ -]/i', '', (string) ($body['reason'] ?? 'submitted')), 0, 40) ?: 'submitted';
    $warningCount = max(0, min(100, (int) ($body['warningCount'] ?? 0)));

    $course = load_course($courseId);
    assert_can_take_course($uid, $role, $courseId);

    $existing = find_passed_final_attempt($uid, $courseId);

    if ($existing) {
        return [
            'alreadyPassed' => true,
            'passed' => true,
            'percentage' => (int) ($existing['percentage'] ?? $existing['score'] ?? 0),
            'correct' => (int) ($existing['correct'] ?? 0),
            'total' => (int) ($existing['totalMarks'] ?? $existing['total'] ?? 0),
            'quizId' => $existing['quizId'] ?? ($existing['id'] ?? null),
            'legacyAttemptId' => $existing['legacyAttemptId'] ?? ($existing['attemptId'] ?? null),
        ];
    }

    assert_ready_for_final_test($uid, $course);

    $questions = load_final_questions($courseId);
    $total = count($questions);
    $correct = 0;
    $savedAnswers = [];

    foreach ($questions as $question) {
        $selected = $answers[$question['id']] ?? null;
        $selected = is_scalar($selected) ? (string) $selected : null;

        if ($selected !== null) {
            $savedAnswers[$question['id']] = substr($selected, 0, 2000);
        }

        if (is_answer_correct($question, $selected)) {
            $correct++;
        }
    }

    $percentage = $total > 0 ? (int) round($correct / $total * 100) : 100;
    $passingScore = (float) ($course['passingScore'] ?? 70) ?: 70;
    $passed = $total === 0 || $percentage >= $passingScore;

    $nowIso = now_iso();
    $nowMs = now_ms();
    $quizId = "final_{$courseId}_{$nowMs}";
    $legacyAttemptId = "{$uid}_{$courseId}_{$nowMs}";
    $courseTitle = (string) ($course['title'] ?? $course['courseTitle'] ?? '');
    $userName = (string) ($profile['name'] ?? $claims['name'] ?? '');

    $updates = [
        "quizAttempts/{$uid}/{$courseId}/{$quizId}" => [
            'quizId' => $quizId,
            'quizType' => 'final',
            'userId' => $uid,
            'userName' => $userName,
            'courseId' => $courseId,
            'courseTitle' => $courseTitle,
            'score' => $percentage,
            'totalMarks' => $total,
            'correct' => $correct,
            'percentage' => $percentage,
            'passed' => $passed,
            'attemptCount' => 1,
            'legacyAttemptId' => $legacyAttemptId,
            'reason' => $reason,
            'warningCount' => $warningCount,
            'answers' => $savedAnswers ?: null,
            'attemptedAt' => $nowIso,
            'gradedBy' => 'server',
        ],
        // Older result screens still read this path.
        "attempts/{$uid}/{$legacyAttemptId}" => [
            'userId' => $uid,
            'userName' => $userName,
            'courseId' => $courseId,
            'courseTitle' => $courseTitle,
            'score' => $percentage,
            'percentage' => $percentage,
            'total' => $total,
            'totalMarks' => $total,
            'correct' => $correct,
            'passed' => $passed,
            'quizId' => $quizId,
            'reason' => $reason,
            'warningCount' => $warningCount,
            'submittedAt' => $nowIso,
        ],
    ];

    if ($passed) {
        $progressBase = "courseProgress/{$uid}/{$courseId}";

        foreach ([
            'courseId' => $courseId,
            'progressPercentage' => 100,
            'completed' => true,
            'completedAt' => $nowIso,
            'lastAccessedAt' => $nowIso,
            'courseTestCompleted' => true,
            'courseTestPassed' => true,
            'score' => $percentage,
            'percentage' => $percentage,
            'correct' => $correct,
            'totalMarks' => $total,
            'finalQuizAttemptId' => $quizId,
            'legacyAttemptId' => $legacyAttemptId,
        ] as $field => $value) {
            $updates["{$progressBase}/{$field}"] = $value;
        }

        $updates["completedCourses/{$uid}/{$courseId}"] = [
            'courseId' => $courseId,
            'courseTitle' => $courseTitle,
            'passed' => true,
            'score' => $percentage,
            'percentage' => $percentage,
            'correct' => $correct,
            'total' => $total,
            'totalMarks' => $total,
            'attemptId' => $legacyAttemptId,
            'quizId' => $quizId,
            'completedAt' => $nowIso,
        ];

        $updates += notification_update($uid, [
            'type' => 'course_completed',
            'courseId' => $courseId,
            'courseTitle' => $courseTitle,
            'title' => 'Congratulations',
            'message' => "You have successfully completed '{$courseTitle}'.",
        ]);

        $updates += notification_update($uid, [
            'type' => 'certificate_ready',
            'courseId' => $courseId,
            'courseTitle' => $courseTitle,
            'title' => 'Certificate Ready',
            'message' => "Your certificate for '{$courseTitle}' is now available.",
        ]);
    }

    db_update('', $updates);

    return [
        'alreadyPassed' => false,
        'passed' => $passed,
        'percentage' => $percentage,
        'correct' => $correct,
        'total' => $total,
        'quizId' => $quizId,
        'legacyAttemptId' => $legacyAttemptId,
    ];
});
