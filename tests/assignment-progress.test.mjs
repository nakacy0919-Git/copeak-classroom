import test from 'node:test';
import assert from 'node:assert/strict';
import { assignmentProgressStatus } from '../js/assignment-progress.mjs';

const table = [
  ['pass reached', { configured: true, passed: true, hasScore: true }, true, 'passed', true],
  ['tried but below threshold', { configured: true, passed: false, hasScore: true }, true, 'attempted', false],
  ['submission without parseable score', { configured: true, passed: false, hasScore: false }, true, 'attempted', false],
  ['not attempted', { configured: true, passed: false, hasScore: false }, false, 'unattempted', false],
  ['submission with no pass targets', { configured: false, passed: false, hasScore: false }, true, 'submitted', true],
  ['manual score present without submission', { configured: true, passed: false, hasScore: true }, false, 'attempted', false]
];
for (const [name, state, submitted, key, complete] of table) {
  test(name, () => assert.deepEqual(assignmentProgressStatus(state, submitted), { key, complete }));
}
