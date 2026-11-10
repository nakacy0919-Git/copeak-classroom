// A manual correction applies until a newer automatic result supersedes it.
// Preserve the teacher's latest correction, but never let an old manual score
// permanently hide a student's later reading improvement.
export function manualMetricOverride(manualRow, automaticRow, metric) {
  if (!manualRow || (metric === 'comprehension' && manualRow.score_version !== 'wcpm-v1')) {
    return null;
  }

  const field = metric === 'accuracy' ? 'score' : metric;
  const rawValue = manualRow[field];
  if (rawValue === null || rawValue === undefined) return null;

  const value = Number(rawValue);
  if (!Number.isFinite(value)) return null;

  const manualTime = Date.parse(manualRow.updated_at || '');
  const autoTime = Date.parse(automaticRow?.submitted_at || '');
  if (Number.isFinite(manualTime) && Number.isFinite(autoTime) && autoTime > manualTime) {
    return null;
  }
  return Math.round(value);
}
