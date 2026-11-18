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


function fakeDraftClient(initial = null) {
  let record = initial ? { ...initial } : null;
  let tick = 1;
  const observed = [];
  const chain = () => {
    let mode;
    let payload;
    const filters = {};
    const q = {
      insert(value) { mode = 'insert'; payload = value; return q; },
      update(value) { mode = 'update'; payload = value; return q; },
      eq(key, value) { filters[key] = value; return q; },
      select() { return q; },
      async single() { return finish(); },
      async maybeSingle() { return finish(); }
    };
    function finish() {
      observed.push({ mode, filters: { ...filters }, payload: { ...payload } });
      if (mode === 'insert') {
        if (record) return { error: { code: '23505', message: 'duplicate' }, data: null };
        record = { ...payload, updated_at: 'version-' + tick++ };
        return { error: null, data: { updated_at: record.updated_at } };
      }
      if (!record || filters.updated_at !== record.updated_at ||
          filters.student_id !== record.student_id ||
          filters.assignment_id !== record.assignment_id) {
        return { error: null, data: null };
      }
      record = { ...record, ...payload, updated_at: 'version-' + tick++ };
      return { error: null, data: { updated_at: record.updated_at } };
    }
    return q;
  };
  return { from(name) { assert.equal(name, 'student_intro_drafts'); return chain(); },
    get record() { return record; }, observed };
}

test('new student draft is saved with student and assignment scope', async () => {
  const client = fakeDraftClient();
  const updated = await student.saveVersionedDraft({
    client, assignmentId: 'assignment-a', studentId: 'student-a',
    answers: { name: 'Yui' }, expressionChoices: {}, expectedVersion: null
  });
  assert.equal(updated, 'version-1');
  assert.equal(client.record.student_id, 'student-a');
  assert.equal(client.record.answers.name, 'Yui');
});

test('a stale tab cannot silently overwrite a newer introduction', async () => {
  const client = fakeDraftClient();
  const args = { client, assignmentId: 'assignment-a', studentId: 'student-a', expressionChoices: {} };
  const version1 = await student.saveVersionedDraft({ ...args, answers: { name: 'Yui' }, expectedVersion: null });
  const version2 = await student.saveVersionedDraft({ ...args, answers: { name: 'Mika' }, expectedVersion: version1 });
  assert.equal(version2, 'version-2');
  await assert.rejects(
    student.saveVersionedDraft({ ...args, answers: { name: 'Old version' }, expectedVersion: version1 }),
    error => error.kind === 'conflict'
  );
  assert.equal(client.record.answers.name, 'Mika');
});

test('duplicate create from another tab reports a conflict', async () => {
  const client = fakeDraftClient({ assignment_id: 'assignment-a', student_id: 'student-a', updated_at: 'version-old' });
  await assert.rejects(
    student.saveVersionedDraft({
      client, assignmentId: 'assignment-a', studentId: 'student-a',
      answers: { name: 'Different data' }, expressionChoices: {}, expectedVersion: null
    }),
    error => error.kind === 'conflict'
  );
});

test('invalid or absent dates never permit practice', () => {
  const past = new Date(Date.now() - 50000).toISOString();
  const future = new Date(Date.now() + 50000).toISOString();
  for (const value of [undefined, null, '', 'invalid-date']) {
    assert.equal(student.isWithinPracticeWindow({ release_at: value, due_at: future }), false);
    assert.equal(student.isWithinPracticeWindow({ release_at: past, due_at: value }), false);
  }
  assert.equal(student.isWithinPracticeWindow({ release_at: future, due_at: past }), false);
});


test('explicit logout clears all private unsynced drafts, not unrelated session data', () => {
  const data = new Map([
    [student.keyFor('studentA', 'assignment1'), 'personal A'],
    [student.keyFor('studentB', 'assignment2'), 'personal B'],
    ['student-ui-language', 'ja']
  ]);
  const storage = {
    get length() { return data.size; },
    key(index) { return [...data.keys()][index] || null; },
    removeItem(key) { data.delete(key); }
  };
  const cleared = student.clearTemporaryDrafts(storage);
  assert.equal(cleared, 2);
  assert.deepEqual([...data.entries()], [['student-ui-language', 'ja']]);
});

test('student logout closes temporary editor and clears backups before authentication signout', () => {
  const { readFileSync } = require('node:fs');
  const { resolve } = require('node:path');
  const source = readFileSync(resolve(__dirname, '../js/student.js'), 'utf8');
  assert.match(source, /CopeakSelfIntroStudent\?\.clearTemporaryDrafts\?\.\(\)/);
  assert.match(source, /await signOut\(\)/);
});


test('demo shows self-introduction preview but cannot launch without student auth', () => {
  const { readFileSync } = require('node:fs');
  const { resolve } = require('node:path');
  const code = readFileSync(resolve(__dirname, '../js/self-introduction-student.js'), 'utf8');
  assert.match(code, /start\.disabled = demo \|\| !ready \|\| !canPractice \|\| conflicted/);
  assert.match(code, /if \(demo\) \{\s*showStatus\('デモでは音読を開始できません/);
});
