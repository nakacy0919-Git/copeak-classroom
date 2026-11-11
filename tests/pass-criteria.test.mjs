import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePassCriteria, buildPassingAttemptMap } from '../js/pass-criteria.mjs';

const cases = [
  ['old Reading Performance target does not block PASS',
    { pass_enabled: true, pass_accuracy: 90, pass_wpm: 110, pass_comprehension: 100 }, 90, 110, true, true],
  ['Accuracy below threshold',
    { pass_enabled: true, pass_accuracy: 90, pass_wpm: 110 }, 89, 120, true, false],
  ['WPM below threshold',
    { pass_enabled: true, pass_accuracy: 90, pass_wpm: 110 }, 100, 109, true, false],
  ['Accuracy-only target',
    { pass_enabled: true, pass_accuracy: 90 }, 94, null, true, true],
  ['WPM-only target',
    { pass_enabled: true, pass_wpm: 110 }, null, 120, true, true],
  ['Missing required WPM',
    { pass_enabled: true, pass_accuracy: 90, pass_wpm: 110 }, 100, null, true, false],
  ['Missing required Accuracy',
    { pass_enabled: true, pass_accuracy: 90, pass_wpm: 110 }, null, 120, true, false],
  ['Only legacy Reading Performance target',
    { pass_enabled: true, pass_comprehension: 80 }, 100, 120, false, false],
  ['Pass feature switched off',
    { pass_enabled: false, pass_accuracy: 90, pass_wpm: 110 }, 100, 120, false, false],
  ['No targets configured',
    { pass_enabled: true }, 100, 120, false, false],
  ['Unattempted assignment',
    { pass_enabled: true, pass_accuracy: 90, pass_wpm: 110 }, null, null, true, false],
  ['Empty score is not zero',
    { pass_enabled: true, pass_accuracy: 90 }, '', null, true, false],
  ['Zero threshold is valid',
    { pass_enabled: true, pass_accuracy: 0 }, 0, null, true, true]
];

for (const [name, assignment, accuracy, wpm, configured, passed] of cases) {
  test(name, () => {
    const result = evaluatePassCriteria(assignment, accuracy, wpm);
    assert.equal(result.configured, configured);
    assert.equal(result.passed, passed);
  });
}

test('separate Accuracy and WPM personal bests do not produce PASS', () => {
  const assignments = [{ id: 'a1', pass_enabled: true, pass_accuracy: 90, pass_wpm: 120 }];
  const submissions = [
    { student_id: 's1', assignment_id: 'a1', accuracy: 96, wpm: 85 },
    { student_id: 's1', assignment_id: 'a1', accuracy: 78, wpm: 140 }
  ];
  assert.equal(buildPassingAttemptMap(assignments, submissions).has('s1|a1'), false);
});

test('a later reading meeting both targets produces PASS without changing separate bests', () => {
  const assignments = [{ id: 'a1', pass_enabled: true, pass_accuracy: 90, pass_wpm: 120 }];
  const submissions = [
    { student_id: 's1', assignment_id: 'a1', accuracy: 100, wpm: 90 },
    { student_id: 's1', assignment_id: 'a1', accuracy: 92, wpm: 126 },
    { student_id: 's1', assignment_id: 'a1', accuracy: 88, wpm: 160 }
  ];
  assert.deepEqual(buildPassingAttemptMap(assignments, submissions).get('s1|a1'), submissions[1]);
});

test('attempts from different students or assignments cannot be combined', () => {
  const assignments = [
    { id: 'a1', pass_enabled: true, pass_accuracy: 90, pass_wpm: 120 },
    { id: 'a2', pass_enabled: true, pass_accuracy: 90, pass_wpm: 120 }
  ];
  const submissions = [
    { student_id: 's1', assignment_id: 'a1', accuracy: 95, wpm: 90 },
    { student_id: 's1', assignment_id: 'a2', accuracy: 70, wpm: 150 },
    { student_id: 's2', assignment_id: 'a1', accuracy: 80, wpm: 130 }
  ];
  assert.equal(buildPassingAttemptMap(assignments, submissions).size, 0);
});

test('single configured target is evaluated within an individual attempt', () => {
  const assignments = [
    { id: 'a1', pass_enabled: true, pass_accuracy: 90 },
    { id: 'a2', pass_enabled: true, pass_wpm: 120 },
    { id: 'a3', pass_enabled: false, pass_accuracy: 90, pass_wpm: 120 }
  ];
  const submissions = [
    { student_id: 's1', assignment_id: 'a1', accuracy: 95, wpm: null },
    { student_id: 's1', assignment_id: 'a2', accuracy: null, wpm: 140 },
    { student_id: 's1', assignment_id: 'a3', accuracy: 100, wpm: 200 }
  ];
  const passes = buildPassingAttemptMap(assignments, submissions);
  assert.deepEqual([...passes.keys()], ['s1|a1', 's1|a2']);
});

test('unrounded scores must meet the threshold and empty results never PASS', () => {
  const assignments = [{ id: 'a1', pass_enabled: true, pass_accuracy: 90, pass_wpm: 120 }];
  const submissions = [
    { student_id: 's1', assignment_id: 'a1', accuracy: 89.6, wpm: 120 },
    { student_id: 's2', assignment_id: 'a1', accuracy: null, wpm: 130 },
    { student_id: 's3', assignment_id: 'a1', accuracy: 95, wpm: null }
  ];
  assert.equal(buildPassingAttemptMap(assignments, submissions).size, 0);
});
