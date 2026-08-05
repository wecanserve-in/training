/**
 * Shared training-analytics helpers.
 *
 * Every dashboard, analytics, and certificate page MUST use these
 * functions instead of local re-implementations. This guarantees
 * identical numbers across the entire LMS portal.
 */

// ──────────────────────────────────────────────
// 1. Role helpers
// ──────────────────────────────────────────────

export const getRole = (user) =>
  String(user?.role || "").trim().toLowerCase();

export const isAdminRole = (role) =>
  role === "admin" || role === "superadmin";

export const isSuperAdminRole = (role) => role === "superadmin";

export const isDepartmentAdminRole = (role) =>
  role === "departmentadmin" ||
  role === "deptadmin" ||
  role === "department_admin" ||
  role === "dept admin" ||
  role === "department admin";

/**
 * Returns true for learner roles that should count in
 * completion / zone analytics.
 */
export const isAnalyticsTrainingUser = (user) => {
  const role = getRole(user);
  return (
    role === "" ||
    role === "user" ||
    role === "learner" ||
    role === "employee"
  );
};

/**
 * Deduplicated learner user list.
 * Uses uid || id || email as unique key.
 * Used by BOTH dashboards AND analytics for zone stats.
 * This guarantees the exact same user population everywhere.
 */
export const getUniqueAnalyticsTrainingUsers = (users = []) => {
  const uniqueUsers = new Map();

  users.forEach((user) => {
    if (!isAnalyticsTrainingUser(user)) return;

    const key = String(
      user?.uid ||
      user?.id ||
      user?.email ||
      ""
    ).trim();

    if (!key) return;

    uniqueUsers.set(key, {
      ...(uniqueUsers.get(key) || {}),
      ...user,
    });
  });

  return Array.from(uniqueUsers.values());
};

// ──────────────────────────────────────────────
// 2. User-key merging (id + uid)
// ──────────────────────────────────────────────

/**
 * Returns deduplicated [user.id, user.uid] keys.
 * Works for both user objects and plain string IDs.
 */
export const getUserKeys = (userOrId) => {
  if (!userOrId) return [];
  if (typeof userOrId === "string") return [userOrId];
  return [...new Set([userOrId.id, userOrId.uid].filter(Boolean))];
};

/**
 * Merge Firebase node records under both user.id and user.uid.
 * When the same courseId exists in both, the record with
 * more keys wins (preserves richer data).
 */
export const mergeUserRecords = (root, user) => {
  const a = root?.[user?.id] || {};
  const b = root?.[user?.uid] || {};
  if (user?.id === user?.uid) return a;
  const merged = { ...a };
  Object.entries(b).forEach(([k, v]) => {
    if (
      !merged[k] ||
      (v &&
        typeof v === "object" &&
        Object.keys(v).length >
          Object.keys(merged[k] || {}).length)
    ) {
      merged[k] = v;
    }
  });
  return merged;
};

/**
 * Analytics-style merge: works for both user objects
 * and plain string IDs. Simple spread-merge.
 */
export const mergeUserNode = (root, userOrId) => {
  return getUserKeys(userOrId).reduce(
    (merged, key) => ({
      ...merged,
      ...(root?.[key] || {}),
    }),
    {}
  );
};

// ──────────────────────────────────────────────
// 3. Assignment helpers
// ──────────────────────────────────────────────

export const isAssignmentActive = (assignment) => {
  const status = String(assignment?.status || "")
    .trim()
    .toLowerCase();
  return (
    assignment === true ||
    assignment?.assigned === true ||
    assignment?.active === true ||
    status === "assigned" ||
    status === "active"
  );
};

// ──────────────────────────────────────────────
// 4. Course-completion helpers
// ──────────────────────────────────────────────

/**
 * Check a single completedCourses / completed record.
 */
export const isCompletedRecord = (record) => {
  const status = String(record?.status || "")
    .trim()
    .toLowerCase();
  return (
    record === true ||
    record?.completed === true ||
    record?.passed === true ||
    record?.isCompleted === true ||
    record?.isPassed === true ||
    status === "completed" ||
    status === "passed"
  );
};

/**
 * Determine if a user has completed a specific course
 * by checking all three data sources:
 *   1. completedCourses
 *   2. courseProgress
 *   3. videoProgress
 *
 * Used for completion-rate / status calculations.
 * NOT used for certificate counting.
 */
export const isCourseCompletedForUser = (
  user,
  courseId,
  completedCourses,
  courseProgress,
  videoProgress
) => {
  const completedRecord = mergeUserRecords(
    completedCourses,
    user
  )?.[courseId];
  if (isCompletedRecord(completedRecord)) return true;

  const cp = mergeUserRecords(courseProgress, user)?.[
    courseId
  ];
  if (
    cp?.completed === true ||
    cp?.passed === true ||
    cp?.courseTestPassed === true ||
    Number(
      cp?.progressPercentage ?? cp?.progress ?? 0
    ) >= 100
  ) {
    return true;
  }

  const vp = mergeUserRecords(videoProgress, user)?.[
    courseId
  ];
  if (vp && typeof vp === "object") {
    const vals = Object.values(vp);
    if (
      vals.length > 0 &&
      vals.every(
        (v) =>
          v?.completed === true ||
          Number(
            v?.progressPercentage ??
              v?.watchedPercent ??
              v?.progress ??
              0
          ) >= 100
      )
    ) {
      return true;
    }
  }

  return false;
};

// ──────────────────────────────────────────────
// 5. Certificate helpers
// ──────────────────────────────────────────────

/**
 * A certificate exists ONLY when:
 *   completion.passed === true
 *   AND completion.attemptId is non-empty.
 *
 * This is the single source of truth for ALL
 * certificate-count logic across the portal.
 */
export const hasCertificate = (completion) =>
  completion?.passed === true &&
  Boolean(completion?.attemptId);

/**
 * Returns a unique key for a certificate, or null
 * if the record is not a valid certificate.
 *
 * Key format: "userId:courseId:attemptId"
 */
export const getCertificateKey = (
  userId,
  courseId,
  completion
) => {
  if (!hasCertificate(completion)) return null;
  return `${userId}:${courseId}:${completion.attemptId}`;
};

/**
 * Count unique certificates for a single user.
 */
export const getUserCertificateCount = (
  user,
  completedCourses
) => {
  const records = mergeUserRecords(completedCourses, user);
  const uniqueKeys = new Set();

  Object.entries(records).forEach(([courseId, completion]) => {
    const userId =
      user?.id || user?.uid || user?.email || "unknown";
    const key = getCertificateKey(
      userId,
      courseId,
      completion
    );
    if (key) uniqueKeys.add(key);
  });

  return uniqueKeys.size;
};

/**
 * Count unique certificates across a list of users.
 */
export const getGroupCertificateCount = (
  users,
  completedCourses
) => {
  const uniqueKeys = new Set();

  users.forEach((user) => {
    const records = mergeUserRecords(completedCourses, user);
    const userId =
      user?.id || user?.uid || user?.email || "unknown";

    Object.entries(records).forEach(
      ([courseId, completion]) => {
        const key = getCertificateKey(
          userId,
          courseId,
          completion
        );
        if (key) uniqueKeys.add(key);
      }
    );
  });

  return uniqueKeys.size;
};

// ──────────────────────────────────────────────
// 6. Zone helpers
// ──────────────────────────────────────────────

/**
 * Normalize a raw zone string to one of:
 * "East", "West", "North", "South", or "".
 */
export const normalizeZone = (value) => {
  const s = String(value || "").trim().toLowerCase();
  if (s.includes("east")) return "East";
  if (s.includes("west")) return "West";
  if (s.includes("north")) return "North";
  if (s.includes("south")) return "South";
  return "";
};

/**
 * Read the zone field from a user object, checking
 * all common field names.
 */
export const getUserZoneField = (user) => {
  const raw =
    user?.zone ||
    user?.Zone ||
    user?.zoneName ||
    user?.region ||
    user?.regionName ||
    "";
  return String(raw).trim();
};

/**
 * Get the normalized zone for a user.
 * Returns "East" | "West" | "North" | "South" | "".
 */
export const getUserZone = (user) => {
  return normalizeZone(getUserZoneField(user));
};

// ──────────────────────────────────────────────
// 7. Group stats calculator
// ──────────────────────────────────────────────

/**
 * Calculate assigned, completed, and rate for a
 * group of users. Used by both dashboards and
 * analytics to produce identical numbers.
 *
 * Counts every active assignment from userAssignments.
 * Does NOT filter by courseIds — use the same
 * user list to control scope instead.
 *
 * @param {Object}   params
 * @param {Array}    params.users           - list of user objects
 * @param {Object}   params.assignments     - Firebase assignments node
 * @param {Object}   params.completedCourses - Firebase completedCourses node
 * @param {Object}   params.courseProgress  - Firebase courseProgress node
 * @param {Object}   params.videoProgress   - Firebase videoProgress node
 */
export const calculateGroupStats = ({
  users,
  assignments,
  completedCourses,
  courseProgress,
  videoProgress,
}) => {
  let assigned = 0;
  let completed = 0;

  users.forEach((user) => {
    const userAssignments = mergeUserRecords(
      assignments,
      user
    );

    Object.entries(userAssignments).forEach(
      ([courseId, assignment]) => {
        if (!isAssignmentActive(assignment)) return;

        assigned++;

        if (
          isCourseCompletedForUser(
            user,
            courseId,
            completedCourses,
            courseProgress,
            videoProgress
          )
        ) {
          completed++;
        }
      }
    );
  });

  return {
    assigned,
    completed,
    rate:
      assigned > 0
        ? Math.round((completed / assigned) * 100)
        : 0,
  };
};

/**
 * Calculate zone-wise stats for a list of users.
 * Returns an array of zone objects.
 *
 * Counts every active assignment from userAssignments.
 * Does NOT filter by courseIds — use the same
 * user list to control scope instead.
 */
export const calculateZoneStats = ({
  users,
  assignments,
  completedCourses,
  courseProgress,
  videoProgress,
}) => {
  const ZONES = ["East", "West", "North", "South"];
  const zoneMap = {};
  ZONES.forEach((z) => {
    zoneMap[z] = {
      zone: z,
      assigned: 0,
      completed: 0,
      users: [],
    };
  });

  users.forEach((user) => {
    const zone = getUserZone(user);
    if (!zone || !zoneMap[zone]) return;

    let userAssigned = 0;
    let userCompleted = 0;

    const userAssignments = mergeUserRecords(
      assignments,
      user
    );

    Object.entries(userAssignments).forEach(
      ([courseId, assignment]) => {
        if (!isAssignmentActive(assignment)) return;

        userAssigned++;

        if (
          isCourseCompletedForUser(
            user,
            courseId,
            completedCourses,
            courseProgress,
            videoProgress
          )
        ) {
          userCompleted++;
        }
      }
    );

    if (userAssigned > 0) {
      zoneMap[zone].users.push({
        ...user,
        _assigned: userAssigned,
        _completed: userCompleted,
      });
      zoneMap[zone].assigned += userAssigned;
      zoneMap[zone].completed += userCompleted;
    }
  });

  return Object.values(zoneMap).map((item) => ({
    ...item,
    userCount: item.users.length,
    percentage:
      item.assigned > 0
        ? Math.round(
            (item.completed / item.assigned) * 100
          )
        : 0,
  }));
};

// ──────────────────────────────────────────────
// 7. Test-attempt helpers (shared by dashboards + AdminResults)
// ──────────────────────────────────────────────

export const getAttemptTime = (attempt) => {
  const value =
    attempt.submittedAt ||
    attempt.completedAt ||
    attempt.createdAt ||
    attempt.attemptedAt ||
    attempt.updatedAt ||
    0;
  const timestamp =
    typeof value === "number" ? value : new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export const getAttemptScore = (attempt) => {
  const directScore = Number(
    attempt.percentage ??
      attempt.scorePercentage ??
      attempt.marksPercentage ??
      attempt.score
  );

  if (Number.isFinite(directScore)) {
    if (directScore <= 1 && attempt.score !== undefined) {
      return Math.round(directScore * 100);
    }
    return Math.max(0, Math.min(100, Math.round(directScore)));
  }

  const correct = Number(
    attempt.correct ??
      attempt.correctAnswers ??
      attempt.correctCount ??
      attempt.obtainedMarks
  );
  const total = Number(
    attempt.total ??
      attempt.totalQuestions ??
      attempt.questionCount ??
      attempt.totalMarks
  );

  if (Number.isFinite(correct) && Number.isFinite(total) && total > 0) {
    return Math.round((correct / total) * 100);
  }

  return 0;
};

export const isAttemptPassed = (attempt) => {
  if (typeof attempt.passed === "boolean") return attempt.passed;
  if (typeof attempt.isPassed === "boolean") return attempt.isPassed;

  const status = String(attempt.status || "").trim().toLowerCase();
  if (status === "passed" || status === "pass") return true;
  if (status === "failed" || status === "fail") return false;

  const score = getAttemptScore(attempt);
  const passingMarks = Number(
    attempt.passingMarks ??
      attempt.passPercentage ??
      attempt.passingPercentage ??
      60
  );

  return score >= (Number.isFinite(passingMarks) ? passingMarks : 60);
};

/**
 * Flatten rawAttempts + rawQuizAttempts into a deduplicated array
 * of normalised attempt objects.  This is the SINGLE source of truth
 * used by both dashboards and AdminResults so numbers always match.
 *
 * @param {Object} rawAttempts   - Firebase attempts node
 * @param {Object} rawQuizAttempts - Firebase quizAttempts node
 * @returns {Array} normalised attempt records
 */
export const flattenAttempts = (rawAttempts = {}, rawQuizAttempts = {}) => {
  const records = [];
  const dedupe = new Set();

  const pushAttempt = ({
    source,
    attemptId,
    userId,
    courseId,
    quizId,
    value,
  }) => {
    if (!value || typeof value !== "object") return;

    const resolvedUserId =
      value.userId || value.uid || value.createdBy || userId || "";
    const resolvedCourseId =
      value.courseId || value.courseID || courseId || "";
    const resolvedQuizId =
      value.quizId || value.testId || value.assessmentId || quizId || "";

    const uniqueKey = [
      source,
      resolvedUserId,
      resolvedCourseId,
      resolvedQuizId,
      attemptId,
      getAttemptTime(value),
    ].join("|");

    if (dedupe.has(uniqueKey)) return;
    dedupe.add(uniqueKey);

    records.push({
      id: value.attemptId || value.id || attemptId || uniqueKey,
      source,
      userId: String(resolvedUserId || ""),
      courseId: String(resolvedCourseId || ""),
      quizId: String(resolvedQuizId || ""),
      ...value,
    });
  };

  // Legacy attempts: attempts/{id} | attempts/{uid}/{id} | attempts/{uid}/{courseId}/{id}
  Object.entries(rawAttempts).forEach(([level1Key, level1Value]) => {
    if (!level1Value || typeof level1Value !== "object") return;

    const looksLikeAttempt =
      level1Value.score !== undefined ||
      level1Value.passed !== undefined ||
      level1Value.submittedAt !== undefined ||
      level1Value.correct !== undefined;

    if (looksLikeAttempt) {
      pushAttempt({
        source: "attempts",
        attemptId: level1Key,
        userId: level1Value.userId || level1Value.uid,
        courseId: level1Value.courseId,
        quizId: level1Value.quizId,
        value: level1Value,
      });
      return;
    }

    Object.entries(level1Value).forEach(([level2Key, level2Value]) => {
      if (!level2Value || typeof level2Value !== "object") return;

      const secondLooksLikeAttempt =
        level2Value.score !== undefined ||
        level2Value.passed !== undefined ||
        level2Value.submittedAt !== undefined ||
        level2Value.correct !== undefined;

      if (secondLooksLikeAttempt) {
        pushAttempt({
          source: "attempts",
          attemptId: level2Key,
          userId: level1Key,
          courseId: level2Value.courseId,
          quizId: level2Value.quizId,
          value: level2Value,
        });
        return;
      }

      Object.entries(level2Value).forEach(([level3Key, level3Value]) => {
        pushAttempt({
          source: "attempts",
          attemptId: level3Key,
          userId: level1Key,
          courseId: level2Key,
          quizId: level3Value?.quizId,
          value: level3Value,
        });
      });
    });
  });

  // Normalized quizAttempts: quizAttempts/{uid}/{courseId}/{quizId}
  Object.entries(rawQuizAttempts).forEach(([userId, userCourses]) => {
    if (!userCourses || typeof userCourses !== "object") return;

    Object.entries(userCourses).forEach(([courseId, courseQuizzes]) => {
      if (!courseQuizzes || typeof courseQuizzes !== "object") return;

      Object.entries(courseQuizzes).forEach(([quizId, quizValue]) => {
        if (!quizValue || typeof quizValue !== "object") return;

        const looksLikeAttempt =
          quizValue.score !== undefined ||
          quizValue.passed !== undefined ||
          quizValue.submittedAt !== undefined ||
          quizValue.correct !== undefined ||
          quizValue.status !== undefined;

        if (looksLikeAttempt) {
          pushAttempt({
            source: "quizAttempts",
            attemptId: quizId,
            userId,
            courseId,
            quizId,
            value: quizValue,
          });
          return;
        }

        Object.entries(quizValue).forEach(([attemptId, attemptValue]) => {
          pushAttempt({
            source: "quizAttempts",
            attemptId,
            userId,
            courseId,
            quizId,
            value: attemptValue,
          });
        });
      });
    });
  });

  return records.map((attempt) => ({
    ...attempt,
    score: getAttemptScore(attempt),
    passed: isAttemptPassed(attempt),
    attemptTime: getAttemptTime(attempt),
    submittedAt:
      attempt.submittedAt ||
      attempt.completedAt ||
      attempt.createdAt ||
      attempt.attemptedAt ||
      attempt.updatedAt ||
      "",
  }));
};

/**
 * Compute test performance summary from flattened attempts.
 * Returns { totalAttempts, passed, failed, passRate, average, uniqueUsers }.
 */
export const computeTestPerformance = (flattenedAttempts = []) => {
  const totalAttempts = flattenedAttempts.length;
  const passed = flattenedAttempts.filter((a) => a.passed).length;
  const failed = totalAttempts - passed;
  const uniqueUsers = new Set(
    flattenedAttempts.map((a) => a.userId).filter(Boolean)
  ).size;
  const passRate =
    totalAttempts > 0 ? Math.round((passed / totalAttempts) * 100) : 0;

  const scored = flattenedAttempts.filter(
    (a) => Number.isFinite(a.score) && a.score >= 0
  );
  const average =
    scored.length > 0
      ? Math.round(scored.reduce((sum, a) => sum + a.score, 0) / scored.length)
      : 0;

  return { totalAttempts, passed, failed, passRate, average, uniqueUsers };
};
