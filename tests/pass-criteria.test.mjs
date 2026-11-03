import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePassCriteria } from '../js/pass-criteria.mjs';

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
