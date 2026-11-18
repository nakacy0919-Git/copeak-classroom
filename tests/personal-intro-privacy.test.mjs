import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const student = readFileSync(new URL('../js/student.js', import.meta.url), 'utf8');
const handoff = readFileSync(new URL('../js/personal-intro-handoff.mjs', import.meta.url), 'utf8');

test('personalized text is never put into navigated URL params', () => {
  assert.match(student, /if \(!isPersonalizedIntroduction\)\s*\{\s*url\.searchParams\.set\('eng', lessonText\)/);
  assert.match(student, /if \(isPersonalizedIntroduction\)\s*\{\s*url\.searchParams\.delete\('eng'\)/);
  assert.match(student, /url\.searchParams\.set\('self_intro_handoff', '1'\)/);
  assert.match(student, /text:\s*lessonText/);
  assert.match(student, /if \(privateHandoff\) await privateHandoff\.done/);
});

test('legacy Text and Dialogue still use shared URL transport', () => {
  assert.match(student, /if \(!isPersonalizedIntroduction\)\s*\{\s*url\.searchParams\.set\('jpn'/);
  assert.match(student, /assignment\.lesson_type ===\s*'dialogue'/);
});

test('private student transport verifies window identity and restricts destination', () => {
  assert.match(handoff, /event\.source !== popup/);
  assert.match(handoff, /event\.origin !== targetOrigin/);
  assert.match(handoff, /message\.studentId !== studentId/);
  assert.match(handoff, /popup\.postMessage\(\{/);
  assert.match(handoff, /\}, targetOrigin\)/);
});
