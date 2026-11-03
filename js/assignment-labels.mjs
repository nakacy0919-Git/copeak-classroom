// Stable teacher-facing class number, independent of internal week_no.
// Individual study assignments deliberately have no displayed assignment number.
export function assignmentNumber(assignment) {
  if (!assignment || assignment.audience_type === 'targeted') return null;
  const value = Number(assignment.gradebook_no ?? assignment.week_no);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export function assignmentLabel(assignment, language = 'ja') {
  const japanese = language === 'ja' || String(language).startsWith('ja-');
  if (assignment?.audience_type === 'targeted') {
    return japanese ? '自習教材' : 'SELF-STUDY';
  }
  const value = assignmentNumber(assignment);
  if (!value) return japanese ? 'クラス課題' : 'CLASS ASSIGNMENT';
  return japanese
    ? '課題 #' + String(value).padStart(2, '0')
    : 'ASSIGNMENT #' + String(value).padStart(2, '0');
}

export function nextClassNumber(assignments, primaryClassId) {
  const values = (assignments || [])
    .filter(row => row.class_id === primaryClassId && row.audience_type !== 'targeted')
    .map(assignmentNumber)
    .filter(value => Number.isInteger(value) && value > 0);
  return (values.length ? Math.max(...values) : 0) + 1;
}

export function targetsStudent(assignment, studentId) {
  return assignment?.audience_type !== 'targeted' ||
    (Array.isArray(assignment.target_student_ids) &&
      assignment.target_student_ids.includes(studentId));
}
