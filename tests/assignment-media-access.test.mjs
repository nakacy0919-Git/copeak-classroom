import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { mayDownloadAssignmentMedia } = require('../api/assignment-media-access.js');

const classIds = new Set(['class-B']);
const base = { class_id: 'class-A', audience_type: 'class' };

test('original class member can access MP3', () => {
  assert.equal(mayDownloadAssignmentMedia(base, ['class-A'], []), true);
});
test('student enrolled in a shared class can access MP3', () => {
  assert.equal(mayDownloadAssignmentMedia(base, classIds, ['class-B']), true);
});
test('student outside all assigned classes cannot access MP3', () => {
  assert.equal(mayDownloadAssignmentMedia(base, classIds, ['class-C']), false);
});
test('no class membership means access denied', () => {
  assert.equal(mayDownloadAssignmentMedia(base, [], ['class-B']), false);
});
