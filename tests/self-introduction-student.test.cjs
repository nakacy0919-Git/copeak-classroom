const test = require('node:test');
const assert = require('node:assert/strict');
const student = require('../js/self-introduction-student.js');

test('practice is permitted only inside release/deadline window', () => {
  const past = new Date(Date.now() - 3600000).toISOString();
  const future = new Date(Date.now() + 3600000).toISOString();
  assert.equal(student.isWithinPracticeWindow({ release_at: past, due_at: future }), true);
  assert.equal(student.isWithinPracticeWindow({ release_at: future, due_at: future }), false);
  assert.equal(student.isWithinPracticeWindow({ release_at: past, due_at: past }), false);
  assert.equal(student.isWithinPracticeWindow({ release_at: null, due_at: future }), false);
});

test('temporary drafts are scoped to assignment and student identity', () => {
  assert.notEqual(student.keyFor('student1', 'assignmentA'), student.keyFor('student2', 'assignmentA'));
  assert.notEqual(student.keyFor('student1', 'assignmentA'), student.keyFor('student1', 'assignmentB'));
  assert.equal(student.keyFor('student1', 'assignmentA'), student.keyFor('student1', 'assignmentA'));
});
