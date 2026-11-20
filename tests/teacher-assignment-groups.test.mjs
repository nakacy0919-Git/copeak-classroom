import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAssignmentFilter, normalizeAssignmentSort, assignmentMatchesSearch,
  sortAssignmentGroup, groupTeacherAssignments, isAssignmentGroupCollapsed,
  moveTeacherAssignmentWithinGroup
} from '../js/teacher-assignment-groups.mjs';

const NOW = Date.parse('2026-11-21T08:00:00+09:00');
const active = (id, number, title, due = '2026-12-01T00:00:00+09:00') =>
  ({ id, title, week_no:number, gradebook_no:number, class_display_order:number, due_at:due });
const ended = (id, number, title) => active(id, number, title, '2026-11-10T00:00:00+09:00');
const items = [active('a',4,'Alpha'), ended('b',5,'Connecting the Dots'),
  active('c',11,'PowerOn'), ended('d',6,'Language')];

test('expired deadlines classify into ended group, and extended deadlines return to active',()=>{
  const initial=groupTeacherAssignments(items,{now:NOW});
  assert.deepEqual(initial.counts,{all:4,active:2,ended:2});
  assert.deepEqual(initial.active.map(x=>x.id),['a','c']);
  assert.deepEqual(initial.ended.map(x=>x.id),['b','d']);
  const newItems=items.map(item=>item.id==='b'?{...item,due_at:'2026-12-12T00:00:00+09:00'}:item);
  const changed=groupTeacherAssignments(newItems,{now:NOW});
  assert.equal(changed.counts.active,3);
  assert.equal(changed.counts.ended,1);
  assert.ok(changed.active.some(x=>x.id==='b'));
});
test('ended group defaults closed and can be reopened without changing assignment rows',()=>{
  assert.equal(isAssignmentGroupCollapsed('ended'),true);
  assert.equal(isAssignmentGroupCollapsed('active'),false);
  assert.equal(isAssignmentGroupCollapsed('ended',{__group_ended:false}),false);
  assert.equal(isAssignmentGroupCollapsed('active',{__group_active:true}),true);
});
test('search matches title, number, category and Japanese Unicode',()=>{
  assert.equal(assignmentMatchesSearch(items[1],'Connecting'),true);
  assert.equal(assignmentMatchesSearch(items[1],'5'),true);
  assert.equal(assignmentMatchesSearch({...items[0],category:'Reading'},'reading'),true);
  assert.equal(assignmentMatchesSearch({...items[3],title:'英語　音読'},'英語 音読'),true);
  assert.equal(assignmentMatchesSearch(items[1],'nonexistent'),false);
});
test('all sorting options stay presentation-only and preserve manual order on ties',()=>{
  const base=[active('a',9,'C','2026-12-09'), active('b',3,'B','2026-12-03'), active('c',4,'A','2026-12-05')];
  assert.deepEqual(sortAssignmentGroup(base,'manual').map(x=>x.id),['b','c','a']);
  assert.deepEqual(sortAssignmentGroup(base,'number-desc').map(x=>x.id),['a','c','b']);
  assert.deepEqual(sortAssignmentGroup(base,'due-asc').map(x=>x.id),['b','c','a']);
  assert.deepEqual(sortAssignmentGroup(base,'title').map(x=>x.id),['c','b','a']);
  assert.deepEqual(base.map(x=>x.id),['a','b','c']);
});
test('reordering swaps only same-status peers without moving expired cards',()=>{
  const moved=moveTeacherAssignmentWithinGroup(items,'c',-1,NOW);
  assert.deepEqual(moved.map(x=>x.id),['c','b','d','a']);
  assert.equal(moved.find(x=>x.id==='c').gradebook_no,11);
  assert.deepEqual(moveTeacherAssignmentWithinGroup(items,'a',-1,NOW).map(x=>x.id),
    ['a','b','c','d']);
  assert.deepEqual(moveTeacherAssignmentWithinGroup(items,'d',-1,NOW).map(x=>x.id),
    ['a','d','b','c']);
});
test('unexpected filter and sort values revert to safe defaults',()=>{
  assert.equal(normalizeAssignmentFilter('active'),'active');
  assert.equal(normalizeAssignmentFilter('not-valid'),'active');
  assert.equal(normalizeAssignmentSort('due-desc'),'due-desc');
  assert.equal(normalizeAssignmentSort('not-valid'),'manual');
});
