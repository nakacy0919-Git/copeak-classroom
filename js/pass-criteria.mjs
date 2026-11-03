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
