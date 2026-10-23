<?php
/**
 * POST /api/delete-user.php
 * Body: { uid }
 * Deletes a user's login account and all of their data.
 *
 * Super admins can delete anyone except themselves.
 * Admins can delete normal users and department admins, but not admins or super admins.
 */

declare(strict_types=1);

require_once __DIR__ . '/_lib/firebase.php';

const PER_USER_ROOTS = [
    'users',
    'userAssignments',
    'courseProgress',
    'videoProgress',
    'quizAttempts',
    'certificates',
    'notifications',
    'learningActivity',
    // Older data layouts
    'progress',
    'completedCourses',
    'attempts',
    'results',
    'videoQuizAttempts',
];

run_endpoint(['POST'], function () {
    $claims = verify_request_token();
    [, $requesterRole] = load_requester($claims);
    $body = json_body();
    $uid = require_key($body['uid'] ?? '', 'user id');

    if (!is_admin_role($requesterRole)) {
        throw new ApiError(403, 'Only admins can delete users.');
    }

    if ($uid === $claims['sub']) {
        throw new ApiError(400, 'You cannot delete your own account.');
    }

    $target = db_get("users/{$uid}");
    $targetRole = normalize_role(is_array($target) ? ($target['role'] ?? 'user') : 'user');

    if (is_admin_role($targetRole) && $requesterRole !== 'superadmin') {
        throw new ApiError(403, 'Only a super admin can delete an admin.');
    }

    $updates = [];

    foreach (PER_USER_ROOTS as $root) {
        $updates["{$root}/{$uid}"] = null;
    }

    // Remove discussion messages this user sent.
    $discussions = db_get('courseDiscussions');

    if (is_array($discussions)) {
        foreach ($discussions as $courseId => $course) {
            foreach (($course['channels'] ?? []) as $channelId => $channel) {
                foreach (($channel['messages'] ?? []) as $messageId => $message) {
                    if (is_array($message) && ($message['senderId'] ?? '') === $uid) {
                        $updates["courseDiscussions/{$courseId}/channels/{$channelId}/messages/{$messageId}"] = null;
                    }
                }
            }
        }
    }

    // If they were a department admin, clear them from that department.
    $departments = db_get('departments');

    if (is_array($departments)) {
        foreach ($departments as $departmentId => $department) {
            if (is_array($department) && ($department['departmentAdminId'] ?? '') === $uid) {
                foreach (['departmentAdminId', 'departmentAdminName', 'departmentAdminEmail',
                    'departmentAdminDesignation', 'departmentAdminSeniority', 'departmentAdminPhotoURL'] as $field) {
                    $updates["departments/{$departmentId}/{$field}"] = null;
                }
            }
        }
    }

    db_update('', $updates);
    delete_auth_account($uid);

    return [
        'message' => 'User deleted completely from database and authentication.',
        'pathsRemoved' => count($updates),
    ];
});
