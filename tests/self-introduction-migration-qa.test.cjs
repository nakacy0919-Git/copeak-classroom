const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const root = resolve(__dirname, '..');

const migration = readFileSync(resolve(root,
  'supabase/migrations/20261118211500_self_introduction_drafts.sql'), 'utf8');
const fixture = readFileSync(resolve(root, 'tests/sql/self-introduction-fixture.sql'), 'utf8');
const verify = readFileSync(resolve(root, 'tests/sql/self-introduction-verify.sql'), 'utf8');
const workflow = readFileSync(resolve(root, '.github/workflows/classroom-feedback-tests.yml'), 'utf8');

test('PL/pgSQL migration function has matching dollar-quoted body', () => {
  assert.match(migration, /returns trigger language plpgsql[\s\S]*?\bas \x24\x24[\r\n]+begin/);
  assert.match(migration, /end;[\r\n]+\x24\x24;/);
  assert.doesNotMatch(migration, /\bas \x24[\r\n]+begin/);
});

test('isolated fixture uses valid PL/pgSQL quoting for conditional roles', () => {
  assert.match(fixture, /\bdo \x24\x24[\r\n]+begin/);
  assert.match(fixture, /end;[\r\n]+\x24\x24;/);
  assert.doesNotMatch(fixture, /\bdo \x24[\r\n]+begin/);
});

test('student drafts have explicit RLS and student ownership on read and write', () => {
  assert.match(migration, /alter table public\.student_intro_drafts enable row level security/);
  assert.match(migration, /revoke all on table public\.student_intro_drafts from public, anon, authenticated/);
  assert.match(migration, /grant select, insert, update on table public\.student_intro_drafts to authenticated/);
  assert.equal((migration.match(/student_id = \(select auth\.uid\(\)\)/g) || []).length >= 4, true);
  assert.match(migration, /on public\.student_intro_drafts for update to authenticated[\s\S]*?with check \(/);
  assert.match(migration, /a\.is_published[\s\S]*?a\.lesson_type = 'self_intro'/);
  assert.doesNotMatch(migration, /security definer/i);
});

test('existing Text/Dialogue remain valid, new lesson type and JSONB are supported', () => {
  assert.match(migration, /lesson_type in \('text', 'dialogue', 'self_intro'\)/);
  assert.match(migration, /add column if not exists lesson_template jsonb/);
  assert.match(migration, /updated_at := clock_timestamp\(\)/);
});

test('RLS verification is bound to isolated test database', () => {
  assert.match(workflow, /createdb intro_test/);
  assert.match(workflow, /PGDATABASE=intro_test psql -v ON_ERROR_STOP=1 -f tests\/sql\/self-introduction-verify\.sql/);
  assert.match(verify, /Another student can read a private draft/);
  assert.match(verify, /Unassigned student created a draft/);
  assert.match(verify, /Unauthenticated role read student drafts/);
});


test('production requires complete published teacher templates and stable student draft ownership', () => {
  assert.match(migration, /assignments_published_self_intro_template_valid/);
  assert.match(migration, /lesson_template->>'version' = '1'/);
  assert.match(migration, /lesson_template->>'level' in \('beginner', 'intermediate', 'advanced'\)/);
  assert.match(migration, /new\.assignment_id is distinct from old\.assignment_id/);
  assert.match(migration, /new\.student_id is distinct from old\.student_id/);
  assert.match(verify, /Published assignment accepted malformed template/);
  assert.match(verify, /Student draft owner reassignment was accepted/);
});

test('teacher cannot publish locked Shadowing based on another students sample audio', () => {
  const teacher = readFileSync(resolve(root, 'js/teacher.js'), 'utf8');
  assert.match(teacher, /lessonType === 'self_intro' && practiceMode === 'shadowing'/);
  assert.match(teacher, /Shadowing固定課題にはできません/);
});

test('migration keeps safe ownership grants and never grants drafts to anonymous users', () => {
  assert.match(migration, /revoke all on table public\.student_intro_drafts from public, anon, authenticated/);
  assert.match(migration, /grant select, insert, update on table public\.student_intro_drafts to authenticated/);
  assert.doesNotMatch(migration, /grant\s+(?:all|select|update|insert)\s+on table public\.student_intro_drafts to anon/i);
});
