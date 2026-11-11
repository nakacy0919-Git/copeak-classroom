// Gradebook and student pass status share exactly the same policy.
// Reading Performance is a diagnostic score only: never a pass threshold.
export function normalizePassValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function getPassTargets(assignment) {
  return {
    accuracy: normalizePassValue(assignment?.pass_accuracy),
    wpm: normalizePassValue(assignment?.pass_wpm)
  };
}

export function evaluatePassCriteria(assignment, accuracy, wpm) {
  const targets = getPassTargets(assignment);
  const enabled = assignment?.pass_enabled === true;
  const configured = enabled &&
    (targets.accuracy !== null || targets.wpm !== null);
  const actualAccuracy = normalizePassValue(accuracy);
  const actualWpm = normalizePassValue(wpm);

  const passed = configured &&
    (targets.accuracy === null ||
      (actualAccuracy !== null && actualAccuracy >= targets.accuracy)) &&
    (targets.wpm === null ||
      (actualWpm !== null && actualWpm >= targets.wpm));

  return { configured, passed, targets };
}

// A PASS must be backed by one actual reading attempt meeting every enabled
// threshold at once. The separately displayed personal-best metrics are NOT
// evidence of a qualifying attempt and must never be combined here.
export function buildPassingAttemptMap(assignments, submissions) {
  const byAssignment = new Map(
    (assignments || []).map(assignment => [assignment.id, assignment])
  );
  const passingAttempts = new Map();

  for (const attempt of submissions || []) {
    const assignment = byAssignment.get(attempt?.assignment_id);
    if (!assignment || !attempt?.student_id) continue;
    if (!evaluatePassCriteria(assignment, attempt.accuracy, attempt.wpm).passed) continue;
    const key = `${attempt.student_id}|${attempt.assignment_id}`;
    if (!passingAttempts.has(key)) passingAttempts.set(key, attempt);
  }

  return passingAttempts;
}
