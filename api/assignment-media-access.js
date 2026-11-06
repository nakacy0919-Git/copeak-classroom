'use strict';

/**
 * Both home-class assignments and assignments shared through assignment_classes
 * may expose media to enrolled students. Individual assignments remain restricted.
 */
function mayDownloadAssignmentMedia(assignment, enrolledClassIds, sharedClassIds, studentId) {
  if (!assignment || !studentId) return false;
  const enrolled = enrolledClassIds instanceof Set
    ? enrolledClassIds : new Set(enrolledClassIds || []);
  const shared = new Set(sharedClassIds || []);
  const inAuthorizedClass = enrolled.has(assignment.class_id) ||
    [...enrolled].some(classId => shared.has(classId));
  if (!inAuthorizedClass) return false;
  if (assignment.audience_type === 'targeted') {
    return Array.isArray(assignment.target_student_ids) &&
      assignment.target_student_ids.includes(studentId);
  }
  return true;
}

module.exports = { mayDownloadAssignmentMedia };
