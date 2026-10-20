import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchGradebookSubmissions } from '../js/gradebook-submissions.mjs';

function fakeSupabase(rows, { failOnPage = -1, malformedOnPage = -1 } = {}) {
  const calls = [];
  const db = {
    calls,
    from(table) {
      assert.equal(table, 'submissions');
      let values = rows;
      const query = {
        select(columns) {
          assert.equal(columns, 'id,assignment_id,student_id,accuracy,wpm,comprehension,submitted_at');
          return this;
        },
        in(field, ids) {
          values = values.filter(r => ids.includes(r[field]));
          return this;
        },
        order(field) {
          assert.ok(['id', 'submitted_at'].includes(field));
          return this;
        },
        range(start, end) {
          assert.equal(end - start + 1, 500);
          const page = calls.length;
          calls.push({ start, end });
          if (page === failOnPage) return Promise.resolve({ data: null, error: { message: 'network failed' } });
          if (page === malformedOnPage) return Promise.resolve({ data: null, error: null });
          return Promise.resolve({ data: values.slice(start, end + 1), error: null });
        },
      };
      return query;
    },
  };
  return db;
}

function rows(n, studentId = 'student-1', assignmentId = 'assignment-1') {
  return Array.from({ length: n }, (_, i) => ({
    id: `submission-${i.toString().padStart(5, '0')}`,
    student_id: studentId,
    assignment_id: assignmentId,
    accuracy: i % 101,
    wpm: i,
    comprehension: i % 100,
    submitted_at: new Date(2026, 9, 1, 0, 0, i).toISOString(),
  }));
}

test('fetches all 1,242 records across three pages (no 1,000-row truncation)', async () => {
  const db = fakeSupabase(rows(1242));
  const result = await fetchGradebookSubmissions(db, ['assignment-1'], ['student-1']);
  assert.equal(result.length, 1242);
  assert.deepEqual(db.calls.map(p => p.start), [0, 500, 1000]);
  assert.equal(Math.max(...result.map(x => x.wpm)), 1241);
});

test('fetches all 1,096 records', async () => {
  const result = await fetchGradebookSubmissions(fakeSupabase(rows(1096)), ['assignment-1'], ['student-1']);
  assert.equal(result.length, 1096);
});

test('exact 1,000-row boundary does not truncate', async () => {
  const db = fakeSupabase(rows(1000));
  const result = await fetchGradebookSubmissions(db, ['assignment-1'], ['student-1']);
  assert.equal(result.length, 1000);
  assert.equal(db.calls.length, 3);
});

test('filters out other class students and assignments before retrieving', async () => {
  const db = fakeSupabase([...rows(994), ...rows(271,'student-else'), ...rows(35,'student-1','unrelated')]);
  const result = await fetchGradebookSubmissions(db, ['assignment-1'], ['student-1']);
  assert.equal(result.length, 994);
  assert.equal(db.calls.length, 2);
});

test('zero students or zero assignments issues no queries', async () => {
  const db = fakeSupabase(rows(1000));
  assert.deepEqual(await fetchGradebookSubmissions(db, [], ['student-1']), []);
  assert.deepEqual(await fetchGradebookSubmissions(db, ['assignment-1'], []), []);
  assert.equal(db.calls.length, 0);
});

test('query errors stop loading instead of silently displaying incomplete grades', async () => {
  const db = fakeSupabase(rows(1242), { failOnPage: 1 });
  await assert.rejects(() => fetchGradebookSubmissions(db, ['assignment-1'], ['student-1']), /network failed/);
});

test('malformed response stops loading instead of displaying incomplete grades', async () => {
  const db = fakeSupabase(rows(1242), { malformedOnPage: 1 });
  await assert.rejects(() => fetchGradebookSubmissions(db, ['assignment-1'], ['student-1']), /取得結果が不正/);
});
