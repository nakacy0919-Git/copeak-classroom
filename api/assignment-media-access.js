'use strict';

/**
 * Both home-class assignments and assignments shared through assignment_classes
 * may expose media to enrolled students. Individual assignment recipients
 * are separately checked by the assignments RLS policy using the student JWT.
 */
function mayDownloadAssignmentMedia(assignment, enrolledClassIds, sharedClassIds) {
  if (!assignment) return false;
  const enrolled = enrolledClassIds instanceof Set
    ? enrolledClassIds : new Set(enrolledClassIds || []);
  const shared = new Set(sharedClassIds || []);
  const inAuthorizedClass = enrolled.has(assignment.class_id) ||
    [...enrolled].some(classId => shared.has(classId));
  return inAuthorizedClass;
}

module.exports = { mayDownloadAssignmentMedia };
