import test from 'node:test';
import assert from 'node:assert/strict';
import { assignmentNumber, assignmentLabel, nextClassNumber } from '../js/assignment-labels.mjs';

test('the same cross-posted assignment uses its receiving class No.', () => {
  const sameSource = { id: 'shared', week_no: 12, gradebook_no: 10, audience_type: 'class' };
  const inClassA = { ...sameSource, class_assignment_no: 10 };
  const inClassB = { ...sameSource, class_assignment_no: 12 };
  assert.equal(assignmentNumber(inClassA), 10);
  assert.equal(assignmentNumber(inClassB), 12);
  assert.equal(assignmentLabel(inClassB, 'ja'), '課題 #12');
  assert.equal(assignmentLabel(inClassB, 'en'), 'ASSIGNMENT #12');
});

test('class-local numbers take precedence over an old duplicate source No.', () => {
  const entries = [
    { week_no: 10, gradebook_no: 10, class_assignment_no: 10 },
    { week_no: 11, gradebook_no: 11, class_assignment_no: 11 },
    { week_no: 12, gradebook_no: 10, class_assignment_no: 12 },
    { week_no: 13, gradebook_no: 11, class_assignment_no: 13 }
  ];
  assert.deepEqual(entries.map(assignmentNumber), [10, 11, 12, 13]);
});

test('legacy assignments can still show their original number before migration', () => {
  assert.equal(assignmentNumber({ gradebook_no: 4, week_no: 5 }), 4);
  assert.equal(assignmentNumber({ week_no: 5 }), 5);
});

test('individual self-study assignments always remain unnumbered', () => {
  assert.equal(assignmentNumber({ audience_type: 'targeted', class_assignment_no: 23, week_no: 7 }), null);
  assert.equal(assignmentLabel({ audience_type: 'targeted' }, 'ja'), '自習教材');
});

test('source gradebook allocation stays scoped to the originating class', () => {
  const assignments = [
    { class_id: 'A', gradebook_no: 5 },
    { class_id: 'B', gradebook_no: 90 },
    { class_id: 'A', audience_type: 'targeted', week_no: 6 }
  ];
  assert.equal(nextClassNumber(assignments, 'A'), 6);
});
