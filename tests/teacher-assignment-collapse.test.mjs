import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isAssignmentEnded,
  isAssignmentCollapsed,
  createTeacherAssignmentCollapseStore
} from '../js/teacher-assignment-collapse.mjs';

const NOW = Date.parse('2026-11-19T07:00:00+09:00');
const assignment = (id, due_at) => ({ id, due_at });

function mockStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    values
  };
}

test('past deadlines start collapsed; active and undated assignments stay expanded', () => {
  const ended = assignment('a', '2026-11-18T23:59:00+09:00');
  assert.equal(isAssignmentEnded(ended, NOW), true);
  assert.equal(isAssignmentCollapsed(ended, {}, NOW), true);
  assert.equal(isAssignmentCollapsed(assignment('b', '2026-11-20T10:00:00+09:00'), {}, NOW), false);
  assert.equal(isAssignmentCollapsed(assignment('c', null), {}, NOW), false);
  assert.equal(isAssignmentEnded(assignment('d', 'not a date'), NOW), false);
  assert.equal(isAssignmentEnded(assignment('e', new Date(NOW).toISOString()), NOW), true);
});

test('explicit open/close choices override deadline defaults', () => {
  const ended = assignment('ended', '2026-11-01T00:00:00+09:00');
  const active = assignment('active', '2026-12-01T00:00:00+09:00');
  assert.equal(isAssignmentCollapsed(ended, { ended: false }, NOW), false);
  assert.equal(isAssignmentCollapsed(active, { active: true }, NOW), true);
});

test('preferences persist between visits and are isolated by class and assignment', () => {
  const storage = mockStorage();
  const firstVisit = createTeacherAssignmentCollapseStore(storage);
  firstVisit.set('class-1', 'ended-1', false);
  firstVisit.set('class-1', 'active-2', true);
  const anotherVisit = createTeacherAssignmentCollapseStore(storage);
  assert.deepEqual({ ...anotherVisit.read('class-1') }, { 'ended-1': false, 'active-2': true });
  assert.deepEqual({ ...anotherVisit.read('class-2') }, {});
});

test('unavailable or malformed storage never breaks manual toggling', () => {
  const blocked = {
    getItem() { throw Error('blocked'); },
    setItem() { throw Error('blocked'); }
  };
  const store = createTeacherAssignmentCollapseStore(blocked);
  store.set('class-1', 'ended-1', false);
  assert.equal(store.read('class-1')['ended-1'], false);
  const storage = mockStorage();
  storage.setItem('copeak_teacher_assignment_collapse_v1:class-1', '{not-json');
  assert.deepEqual({ ...createTeacherAssignmentCollapseStore(storage).read('class-1') }, {});
});
