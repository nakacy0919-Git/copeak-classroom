import test from 'node:test';
import assert from 'node:assert/strict';
import { sortClassAssignments, moveClassAssignment } from '../js/assignment-order.mjs';

const items = [
  { id: 'a', week_no: 1, gradebook_no: 1, class_display_order: 3 },
  { id: 'b', week_no: 2, gradebook_no: 2, class_display_order: 1 },
  { id: 'c', week_no: 3, gradebook_no: 3, class_display_order: 2 }
];
test('sort uses class order, not stable Gradebook number', () => {
  assert.deepEqual(sortClassAssignments(items).map(x => x.id), ['b', 'c', 'a']);
});
test('teacher can move an assignment up without changing grades or identifiers', () => {
  const moved = moveClassAssignment(items, 'c', -1);
  assert.deepEqual(moved.map(x => x.id), ['c', 'b', 'a']);
  assert.deepEqual(moved.map(x => x.gradebook_no), [3, 2, 1]);
  assert.deepEqual(items.map(x => x.id), ['a', 'b', 'c']);
});
test('buttons at list boundaries do nothing', () => {
  assert.deepEqual(moveClassAssignment(items, 'b', -1).map(x => x.id), ['b','c','a']);
  assert.deepEqual(moveClassAssignment(items, 'a', 1).map(x => x.id), ['b','c','a']);
});
test('newly published lessons without order appear after ordered lessons', () => {
  assert.deepEqual(sortClassAssignments([...items,{ id: 'd', week_no: 4, class_display_order: null }]).map(x => x.id),
    ['b','c','a','d']);
});
