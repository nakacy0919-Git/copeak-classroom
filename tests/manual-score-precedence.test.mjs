import test from 'node:test';
import assert from 'node:assert/strict';
import { manualMetricOverride } from '../js/manual-score-precedence.mjs';

const oct = '2026-10-16T03:22:33.627Z';
const nov = '2026-11-09T05:30:12.097Z';

test('newer automatic Accuracy supersedes stale 86% manual score', () => {
  assert.equal(manualMetricOverride(
    { score: 86, updated_at: oct },
    { accuracy: 92, submitted_at: nov },
    'accuracy'
  ), null);
});

test('newer teacher correction retains priority over an older reading', () => {
  assert.equal(manualMetricOverride(
    { score: 86, updated_at: nov },
    { accuracy: 92, submitted_at: oct },
    'accuracy'
  ), 86);
});

test('manual score without a timestamp keeps backward-compatible priority', () => {
  assert.equal(manualMetricOverride({ score: 75 }, { accuracy: 92, submitted_at: nov }, 'accuracy'), 75);
});

test('manual WPM also expires after a newer reading', () => {
  assert.equal(manualMetricOverride({ wpm: 150, updated_at: oct }, { wpm: 160, submitted_at: nov }, 'wpm'), null);
});

test('missing manual value and old comprehension format do not override', () => {
  assert.equal(manualMetricOverride({ score: null, updated_at: nov }, { accuracy: 92, submitted_at: oct }, 'accuracy'), null);
  assert.equal(manualMetricOverride({ comprehension: 77, score_version: 'legacy-comprehension', updated_at: nov }, { submitted_at: oct }, 'comprehension'), null);
});

test('equal timestamp retains explicit manual correction', () => {
  assert.equal(manualMetricOverride({ score: 86, updated_at: nov }, { accuracy: 92, submitted_at: nov }, 'accuracy'), 86);
});
