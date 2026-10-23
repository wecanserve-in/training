<?php
/**
 * Final course test logic, mirrored from QuizPage.jsx so results are decided on the server.
 */

declare(strict_types=1);

require_once __DIR__ . '/firebase.php';

const ANSWER_FIELDS_FOR_CLIENT = ['id', 'question', 'questionText', 'order', 'marks', 'imageUrl', 'image'];

function question_text(array $question): string
{
    return trim((string) ($question['question'] ?? $question['questionText'] ?? ''));
}

function question_options(array $question): array
{
    if (isset($question['options']) && is_array($question['options'])) {
        return array_values($question['options']);
    }

    return array_values(array_filter([
        $question['optionA'] ?? $question['option1'] ?? null,
        $question['optionB'] ?? $question['option2'] ?? null,
        $question['optionC'] ?? $question['option3'] ?? null,
        $question['optionD'] ?? $question['option4'] ?? null,
    ], fn ($option) => $option !== null && $option !== ''));
}

function is_answer_correct(array $question, $selectedAnswer): bool
{
    if ($selectedAnswer === null || $selectedAnswer === '') {
        return false;
    }

    $options = question_options($question);
    $selectedIndex = -1;

    foreach ($options as $index => $option) {
        if ((string) $option === (string) $selectedAnswer) {
            $selectedIndex = $index;
            break;
        }
    }

    if ($selectedIndex < 0) {
        return false;
    }

    foreach (['correctOptionIndex', 'correctAnswerIndex', 'correctIndex'] as $field) {
        $value = $question[$field] ?? null;

        // Like the app: a matching index counts as correct, a mismatch falls through to the other checks.
        if ($value !== null && $value !== '' && is_numeric($value) && (int) $value === $selectedIndex) {
            return true;
        }
    }

    $correctOption = strtoupper(trim((string) ($question['correctOption'] ?? '')));

    if ($correctOption !== '') {
        if ($correctOption === chr(65 + $selectedIndex) || $correctOption === 'OPTION' . ($selectedIndex + 1)) {
            return true;
        }
    }

    foreach (['correctAnswer', 'correctAnswerText', 'answer'] as $field) {
        if (isset($question[$field]) && $question[$field] !== '' && (string) $question[$field] === (string) $selectedAnswer) {
            return true;
        }
    }

    return false;
}

/** Questions of a course's final test, sorted like the app sorts them. */
function load_final_questions(string $courseId): array
{
    $raw = db_get("questions/{$courseId}");
    $questions = [];

    if (is_array($raw)) {
        foreach ($raw as $questionId => $question) {
            if (!is_array($question) || question_text($question) === '') {
                continue;
            }

            $questions[] = ['id' => (string) $questionId] + $question;
        }
    }

    usort($questions, fn ($a, $b) => ((float) ($a['order'] ?? 0)) <=> ((float) ($b['order'] ?? 0)));

    return $questions;
}

/** Strips everything that would reveal the answer. */
function question_for_client(array $question): array
{
    $safe = [];

    foreach (ANSWER_FIELDS_FOR_CLIENT as $field) {
        if (array_key_exists($field, $question)) {
            $safe[$field] = $question[$field];
        }
    }

    $safe['options'] = question_options($question);

    return $safe;
}

/** Loads the course or fails with 404. */
function load_course(string $courseId): array
{
    $course = db_get("courses/{$courseId}");

    if (!is_array($course)) {
        throw new ApiError(404, 'Course not found.');
    }

    return ['id' => $courseId] + $course;
}

function assert_can_take_course(string $uid, string $role, string $courseId): void
{
    if (is_staff_role($role)) {
        return;
    }

    $assignment = db_get("userAssignments/{$uid}/{$courseId}");

    if (!$assignment) {
        throw new ApiError(403, 'This course is not assigned to you.');
    }
}

/** The course's videos as [['id' => ..., 'mappingId' => ...], ...]. */
function course_video_refs(array $course): array
{
    $courseId = $course['id'];
    $mappings = db_get("courseVideos/{$courseId}");

    if (is_array($mappings) && $mappings) {
        $refs = [];

        foreach ($mappings as $mappingId => $mapped) {
            $mapped = is_array($mapped) ? $mapped : [];
            $refs[] = ['id' => (string) ($mapped['videoId'] ?? $mappingId), 'mappingId' => (string) $mappingId];
        }

        return $refs;
    }

    if (isset($course['videoIds']) && is_array($course['videoIds']) && $course['videoIds']) {
        $library = db_get('videoLibrary', ['shallow' => 'true']) ?: [];
        $legacy = db_get('videos', ['shallow' => 'true']) ?: [];
        $refs = [];

        foreach ($course['videoIds'] as $videoId) {
            $videoId = (string) $videoId;

            if (isset($library[$videoId]) || isset($legacy[$videoId])) {
                $refs[] = ['id' => $videoId, 'mappingId' => null];
            }
        }

        return $refs;
    }

    $legacy = db_get('videos') ?: [];
    $refs = [];

    foreach ($legacy as $videoId => $video) {
        if (is_array($video) && ($video['courseId'] ?? null) === $courseId) {
            $refs[] = ['id' => (string) $videoId, 'mappingId' => null];
        }
    }

    return $refs;
}

/**
 * Same checks the quiz page runs before the final test:
 * every video watched and every video revision quiz passed.
 */
function assert_ready_for_final_test(string $uid, array $course): void
{
    $courseId = $course['id'];
    $videos = course_video_refs($course);

    if (!$videos) {
        return;
    }

    $progress = db_get("videoProgress/{$uid}/{$courseId}") ?: [];

    foreach ($videos as $video) {
        $record = $progress[$video['id']] ?? null;

        $done = is_array($record) &&
            (($record['completed'] ?? false) === true || (float) ($record['watchedPercent'] ?? 0) >= 100);

        if (!$done) {
            throw new ApiError(409, 'Please complete all course videos before taking the final test.');
        }
    }

    $videoQuizzes = db_get('videoQuizzes') ?: [];
    $attempts = db_get("quizAttempts/{$uid}/{$courseId}") ?: [];
    $practiceAttempts = array_filter($attempts, fn ($a) => is_array($a) && ($a['quizType'] ?? '') === 'practice');

    foreach ($videos as $video) {
        $keys = array_values(array_filter([$video['id'], $video['mappingId']]));
        $hasRevisionQuiz = false;

        foreach ($keys as $key) {
            $sources = [$videoQuizzes[$key] ?? [], $videoQuizzes[$courseId][$key] ?? []];

            foreach ($sources as $source) {
                foreach ((is_array($source) ? $source : []) as $question) {
                    if (is_array($question) && question_text($question) !== '') {
                        $hasRevisionQuiz = true;
                    }
                }
            }
        }

        if (!$hasRevisionQuiz) {
            continue;
        }

        $passed = false;

        foreach ($practiceAttempts as $attempt) {
            $attemptVideo = $attempt['videoId'] ?? $attempt['mappingId'] ?? null;
            $score = (float) ($attempt['correct'] ?? $attempt['score'] ?? 0);
            $total = (float) ($attempt['totalMarks'] ?? $attempt['total'] ?? 0);

            if (in_array($attemptVideo, $keys, true) &&
                (($attempt['passed'] ?? false) === true || ($total > 0 && $score >= ceil($total * 0.7)))) {
                $passed = true;
                break;
            }
        }

        if (!$passed) {
            throw new ApiError(409, 'Please pass every required revision quiz before taking the final test.');
        }
    }
}

/** Returns the user's earlier passing final attempt for this course, if any. */
function find_passed_final_attempt(string $uid, string $courseId): ?array
{
    $attempts = db_get("quizAttempts/{$uid}/{$courseId}") ?: [];

    foreach ($attempts as $attemptId => $attempt) {
        if (is_array($attempt) && ($attempt['quizType'] ?? '') === 'final' && ($attempt['passed'] ?? false) === true) {
            return ['id' => (string) $attemptId] + $attempt;
        }
    }

    $completed = db_get("completedCourses/{$uid}/{$courseId}");

    if (is_array($completed) && ($completed['passed'] ?? false) === true) {
        return $completed;
    }

    return null;
}

function notification_update(string $uid, array $data): array
{
    $notificationId = 'n' . now_ms() . random_id(4);

    return [
        "notifications/{$uid}/{$notificationId}" => [
            'notificationId' => $notificationId,
            'type' => $data['type'],
            'courseId' => $data['courseId'] ?? null,
            'courseTitle' => $data['courseTitle'] ?? '',
            'channelId' => null,
            'videoId' => null,
            'title' => $data['title'],
            'message' => $data['message'],
            'read' => false,
            'createdAt' => now_iso(),
        ],
    ];
}
