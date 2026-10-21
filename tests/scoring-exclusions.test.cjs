const { test } = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/scoring-exclusions.js');
const tokenize = phrase => phrase.toLowerCase().match(/[a-z]+/g) || [];

test('no exclusions preserves all tokens', () => {
  assert.deepEqual(E.selectScoredTokens(['i', 'am', 'here'], [], tokenize).tokens, ['i', 'am', 'here']);
});
test('New York is excluded in its entirety without removing other words', () => {
  const p = E.selectScoredTokens(['i','visited','new','york','with','my','family'], ['New York'], tokenize);
  assert.deepEqual(p.tokens, ['i','visited','with','my','family']);
  assert.equal(p.excludedCount, 2);
});
test('matches exact token boundaries, not substrings', () => {
  const p = E.selectScoredTokens(['new','yorker','new','york'], ['New York'], tokenize);
  assert.deepEqual(p.tokens, ['new','yorker']);
});
test('repeated names are all excluded', () => {
  const p = E.selectScoredTokens(['tom','met','tom','and','tom'], ['Tom'], tokenize);
  assert.deepEqual(p.tokens, ['met','and']);
  assert.deepEqual(p.excludedIndexes, [0,2,4]);
});
test('overlapping names are excluded as union and longest first', () => {
  const p = E.selectScoredTokens(['mr','john','smith','visited','john','smith'], ['John Smith','Mr. John Smith'], tokenize);
  assert.deepEqual(p.tokens, ['visited']);
});
test('all excluded leaves original tokens rather than division-by-zero', () => {
  assert.deepEqual(E.selectScoredTokens(['tokyo'], ['Tokyo'], tokenize).tokens, ['tokyo']);
});
test('validation de-duplicates, trims, and catches too many names', () => {
  assert.deepEqual(E.validateList(' New York\nnew york\nMr. Tanaka'), ['New York','Mr. Tanaka']);
  assert.throws(() => E.validateList(Array.from({length:21},(_,i)=>`Name${i}`)), /最大20/);
  assert.throws(() => E.validateList('a'.repeat(61)), /60文字/);
});
test('safeList rejects invalid metadata without changing scoring', () => {
  assert.deepEqual(E.safeList('a'.repeat(61)), []);
  assert.deepEqual(E.safeList(null), []);
});
test('heuristic proposals include multiword names and are opt-in', () => {
  const suggestions = E.suggestNames('I visited New York with Mr. Tanaka.');
  assert.ok(suggestions.includes('New York'));
  assert.ok(suggestions.includes('Mr. Tanaka'));
  assert.ok(!suggestions.includes('I'));
});
test('handles contraction-like comparison units using caller tokenization', () => {
  const tk = s => s === "I'm" ? ['__i_am__'] : tokenize(s);
  const p = E.selectScoredTokens(['__i_am__','happy'], ["I'm"], tk);
  assert.deepEqual(p.tokens, ['happy']);
});
