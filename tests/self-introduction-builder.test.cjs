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

test('missing personalized fields never silently use teacher sample data', () => {
  const cfg = builder.normalize({ fields: ['name', 'school', 'hobby'] });
  assert.equal(builder.validateAnswers(cfg, { name: 'Mai', school: 'Example School' }).ok, false);
  assert.throws(() => builder.generateStudentText(cfg, { name: 'Mai', school: 'Example School' }),
    /趣味/);
});

test('personalized preview uses exact student answers, not Yuki or sample school', () => {
  const cfg = builder.normalize({ fields: ['name', 'school', 'goal'] });
  const result = builder.generateStudentText(cfg, {
    name: 'Haruka', school: 'Midori Junior High School', goal: 'study medicine'
  });
  assert.match(result, /Haruka/);
  assert.match(result, /Midori Junior High School/);
  assert.match(result, /study medicine/);
  assert.doesNotMatch(result, /Yuki|Sakura High School/);
});

test('expression selection is ignored unless teacher enables it', () => {
  const params = { fields: ['name', 'hobby'], expressions: { hobby: 'like' }, allowStudentChoice: false };
  const input = { name: 'Sora', hobby: 'drawing' };
  assert.match(builder.generateStudentText(params, input, { hobby: 'free' }), /I like drawing\./);
  assert.match(builder.generateStudentText({ ...params, allowStudentChoice: true }, input, { hobby: 'free' }),
    /In my free time, I love drawing\./);
});

test('grade must come from a safe grade list', () => {
  const cfg = builder.normalize({ fields: ['name', 'grade'] });
  assert.equal(builder.validateAnswers(cfg, { name: 'Tom', grade: 'Grade 7' }).ok, true);
  assert.equal(builder.validateAnswers(cfg, { name: 'Tom', grade: 'Grade 13' }).ok, false);
});

test('reason without hobby is removed automatically', () => {
  const cfg = builder.normalize({ fields: ['name', 'reason', 'school'] });
  assert.equal(cfg.fields.includes('reason'), false);
});

test('student answers strip control characters and enforce short input', () => {
  const data = builder.cleanAnswers({ name: '  Mi\nka ', hobby: 'h'.repeat(150) });
  assert.equal(data.name, 'Mi ka');
  assert.equal(data.hobby.length, 120);
});
