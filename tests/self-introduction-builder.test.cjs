const test = require('node:test');
const assert = require('node:assert/strict');
const builder = require('../js/self-introduction-builder.js');

test('Self-Introduction provides 12 optional/required content units and 3 expressions each', () => {
  assert.equal(builder.fields.length, 12);
  assert.ok(builder.fields.every(field => field.options.length === 3));
  assert.ok(builder.defaultConfig().fields.includes('name'));
});

test('level recommendations progressively add age-appropriate content', () => {
  const beginner = builder.defaultConfig('beginner');
  const intermediate = builder.defaultConfig('intermediate');
  const advanced = builder.defaultConfig('advanced');
  assert.ok(beginner.fields.length < intermediate.fields.length);
  assert.ok(intermediate.fields.length < advanced.fields.length);
});

test('invalid or legacy configuration cannot remove the required name', () => {
  const cfg = builder.normalize({ level: 'unexpected', fields: ['school', 'fake'], expressions: { school: 'unknown' } });
  assert.equal(cfg.level, 'intermediate');
  assert.ok(cfg.fields.includes('name'));
  assert.ok(!cfg.fields.includes('fake'));
  assert.equal(cfg.expressions.school, 'attend');
});

test('the preview substitutes personal information without changing its structure', () => {
  const cfg = builder.normalize({ fields: ['name', 'school', 'goal'], expressions: { name: 'hi', goal: 'dream' } });
  const preview = builder.generatePreview(cfg, { name: 'Mari', school: 'Example Junior High School', goal: 'visit Australia' });
  assert.match(preview, /Hi, I'm Mari\./);
  assert.match(preview, /I attend Example Junior High School\./);
  assert.match(preview, /My dream is to visit Australia\./);
});

test('the teacher can switch naturally among expression variants', () => {
  const cfg = builder.normalize({ fields: ['name', 'hobby'], expressions: { hobby: 'free' } });
  assert.match(builder.generatePreview(cfg), /In my free time, I love playing basketball\./);
});

test('a blank or single-field draft cannot be validated for publishing', () => {
  assert.equal(builder.validate({ fields: ['name'] }).ok, false);
  assert.equal(builder.validate({ fields: ['name', 'school'] }).ok, true);
});

test('serialized teacher template contains no generated student values', () => {
  const json = JSON.stringify(builder.normalize(builder.defaultConfig()));
  assert.doesNotMatch(json, /Sakura High School|Yuki|playing basketball/);
});
