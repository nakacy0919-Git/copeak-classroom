import { evaluatePassCriteria, buildPassingAttemptMap, normalizePassValue } from './pass-criteria.mjs';
import { targetsStudent } from './assignment-labels.mjs';
import { bestMetricMap, effectiveMetric } from './shared-gradebook.mjs';

export const STATUS_LABELS = { unattempted: '未トライ', working: '挑戦中', near: 'あと少し', passed: '合格・完了' };
export const STATUS_ORDER = Object.keys(STATUS_LABELS);
export const NEAR_ACCURACY = 5;
export const NEAR_WPM = 10;

export function buildSubmissionStatus(assignment, students, submissions, manualScores = [], preservedPasses = [], roster = []) {
  const attempts = submissions.filter(row => row.assignment_id === assignment.id);
  const passes = buildPassingAttemptMap([assignment], attempts, preservedPasses);
  const configured = evaluatePassCriteria(assignment, null, null);
  const enrolled = new Set(students.map(student => student.id));
  const audience = students.filter(student => targetsStudent(assignment, student.id));
  // A whole-class assignment includes roster members who have not joined yet.
  if (assignment.audience_type !== 'targeted') {
    for (const entry of roster) {
      if (!entry.linked_student_id || !enrolled.has(entry.linked_student_id)) {
        audience.push({ id: null, student_number: entry.student_number, display_name: entry.display_name, notJoined: true });
      }
    }
  }
  const byStudent = new Map();
  for (const attempt of attempts) {
    if (!byStudent.has(attempt.student_id)) byStudent.set(attempt.student_id, []);
    byStudent.get(attempt.student_id).push(attempt);
  }
  const manual = new Map(manualScores.filter(row => row.assignment_id === assignment.id).map(row => [row.student_id, row]));
  return audience.map(student => {
    const rows = student.id ? byStudent.get(student.id) || [] : [];
    const key = student.id + '|' + assignment.id;
    const score = student.id ? manual.get(student.id) : null;
    const accuracy = effectiveMetric(score, bestMetricMap(rows, 'accuracy').get(key), 'accuracy');
    const wpm = effectiveMetric(score, bestMetricMap(rows, 'wpm').get(key), 'wpm');
    const comprehension = effectiveMetric(score, bestMetricMap(rows, 'comprehension').get(key), 'comprehension');
    const pass = student.id ? passes.get(key) : null;
    const hasRecord = rows.length > 0 || accuracy !== null || wpm !== null || comprehension !== null;
    const near = configured.configured && rows.some(row => {
      const a = normalizePassValue(row.accuracy), w = normalizePassValue(row.wpm);
      const t = configured.targets;
      return (t.accuracy === null || (a !== null && a >= t.accuracy - NEAR_ACCURACY)) &&
        (t.wpm === null || (w !== null && w >= t.wpm - NEAR_WPM));
    });
    const status = pass || (!configured.configured && hasRecord) ? 'passed' :
      !hasRecord ? 'unattempted' : near ? 'near' : 'working';
    const last = rows.reduce((latest, row) => Math.max(latest, Date.parse(row.submitted_at) || 0), 0);
    return { student, status, attempts: rows.length, accuracy, wpm, last, hasRecord,
      manualOnly: rows.length === 0 && hasRecord, legacyPassed: Boolean(pass?.legacy_pass),
      label: status === 'passed' ? (pass ? '合格' : '提出完了（合格基準なし）') :
        status === 'unattempted' && student.notJoined ? '未参加・未トライ' : STATUS_LABELS[status] };
  });
}

export function sortSubmissionStatus(rows, sort = 'status') {
  const byNumber = (a,b) => {
    const x = String(a.student.student_number || ''), y = String(b.student.student_number || '');
    return Number(!x) - Number(!y) || x.localeCompare(y, 'ja', {numeric:true}) ||
      String(a.student.display_name || '').localeCompare(String(b.student.display_name || ''), 'ja');
  };
  const metric = (a,b,key,dir) => {
    if (a[key] == null || b[key] == null) return Number(a[key] == null) - Number(b[key] == null);
    return dir * (a[key]-b[key]);
  };
  return [...rows].sort((a,b) => {
    let diff = 0;
    if (sort === 'status') diff = STATUS_ORDER.indexOf(a.status)-STATUS_ORDER.indexOf(b.status);
    if (sort === 'attempts-desc') diff = b.attempts-a.attempts;
    if (sort === 'attempts-asc') diff = a.attempts-b.attempts;
    if (sort === 'accuracy-desc') diff = metric(a,b,'accuracy',-1);
    if (sort === 'accuracy-asc') diff = metric(a,b,'accuracy',1);
    if (sort === 'wpm-desc') diff = metric(a,b,'wpm',-1);
    if (sort === 'latest') diff = b.last-a.last;
    return diff || byNumber(a,b);
  });
}
