/**
 * Status shown to learners and used by the completion counter.
 * A submitted reading is not a pass unless the configured targets were met.
 */
export function assignmentProgressStatus(passState, hasSubmission) {
  const attempted = Boolean(hasSubmission || passState?.hasScore);
  if (passState?.configured) {
    if (passState.passed) return { key: 'passed', complete: true };
    return { key: attempted ? 'attempted' : 'unattempted', complete: false };
  }
  // Assignments without targets cannot truthfully be labelled "PASS".
  // Keep their historical submit-to-complete behavior.
  return attempted
    ? { key: 'submitted', complete: true }
    : { key: 'unattempted', complete: false };
}
