import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { mayDownloadAssignmentMedia } = require('../api/assignment-media-access.js');

const student = 'student-1';
const classIds = new Set(['class-B']);
const base = { class_id: 'class-A', audience_type: 'class' };

test('original class member can access MP3', () => {
  assert.equal(mayDownloadAssignmentMedia(base, ['class-A'], [], student), true);
});
test('student enrolled in a shared class can access MP3', () => {
  assert.equal(mayDownloadAssignmentMedia(base, classIds, ['class-B'], student), true);
});
test('student outside all assigned classes cannot access MP3', () => {
  assert.equal(mayDownloadAssignmentMedia(base, classIds, ['class-C'], student), false);
});
test('targeted assignment only grants audio to its named student', () => {
  const targeted = { ...base, audience_type: 'targeted', target_student_ids: ['student-2'] };
  assert.equal(mayDownloadAssignmentMedia(targeted, ['class-A'], [], student), false);
  assert.equal(mayDownloadAssignmentMedia(targeted, ['class-A'], [], 'student-2'), true);
});
test('missing targets default to deny for individual materials', () => {
  assert.equal(mayDownloadAssignmentMedia({ ...base, audience_type: 'targeted' }, ['class-A'], [], student), false);
});
