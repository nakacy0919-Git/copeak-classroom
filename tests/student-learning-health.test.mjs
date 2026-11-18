import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeLearningHealth, normalizeLearningNoticeMode, LEARNING_NOTICE_MODES } from '../js/student-learning-health.mjs';

const now=Date.parse('2026-11-19T10:00:00Z');
const H=3600000;
const row=(opts={})=>({
  releaseMs:now-96*H,
  dueMs:now+72*H,
  complete:false,passed:false,attempted:false,...opts
});
const overdue=n=>Array.from({length:n},(_,i)=>row({id:i,dueMs:now-H}));

test('teacher presets are valid and unknown settings safely default to standard',()=>{
  assert.deepEqual(Object.keys(LEARNING_NOTICE_MODES),['strict','standard','gentle']);
  assert.equal(normalizeLearningNoticeMode('other'),'standard');
  assert.equal(normalizeLearningNoticeMode(undefined),'standard');
  assert.equal(normalizeLearningNoticeMode('gentle'),'gentle');
});

test('summary totals and future exclusion remain unchanged',()=>{
 const summary=summarizeLearningHealth([
   row({complete:true,passed:true,attempted:true}),
   row({complete:true,attempted:true}),
   row({attempted:true}),row(),row({releaseMs:now+1})
 ],now);
 assert.equal(summary.total,4);
 assert.equal(summary.complete,2);
 assert.equal(summary.passed,1);
 assert.equal(summary.submittedComplete,1);
 assert.equal(summary.incomplete,1);
 assert.equal(summary.unsubmitted,1);
 assert.equal(summary.future,1);
 assert.equal(summary.percent,50);
});

test('one missed deadline never displays danger or a red alert',()=>{
 for(const mode of ['strict','standard','gentle']){
   const summary=summarizeLearningHealth(overdue(1),now,mode);
   assert.notEqual(summary.level,'danger');
   assert.doesNotMatch(summary.title,/危険|警告/);
   assert.equal(summary.overdue,1);
   assert.equal(summary.overdueUnsubmitted,1);
 }
 assert.equal(summarizeLearningHealth(overdue(1),now,'strict').level,'plan');
 assert.equal(summarizeLearningHealth(overdue(1),now,'standard').level,'reminder');
 assert.equal(summarizeLearningHealth(overdue(1),now,'gentle').level,'reminder');
});

test('same overdue count adapts to teacher preset',()=>{
 const rows=overdue(4);
 assert.equal(summarizeLearningHealth(rows,now,'strict').level,'support');
 assert.equal(summarizeLearningHealth(rows,now,'standard').level,'plan');
 assert.equal(summarizeLearningHealth(rows,now,'gentle').level,'plan');
});

test('ratio prevents an outsized support message for four missed in thirty',()=>{
 const rows=[...overdue(4),...Array.from({length:26},()=>row({complete:true,passed:true}))];
 assert.equal(summarizeLearningHealth(rows,now,'strict').level,'plan');
});

test('near deadlines are gentle and future lessons never count against student',()=>{
 assert.equal(summarizeLearningHealth([row({dueMs:now+48*H})],now,'standard').level,'reminder');
 assert.equal(summarizeLearningHealth([row({dueMs:now+48*H})],now,'gentle').level,'normal');
 assert.equal(summarizeLearningHealth([row({dueMs:now,complete:true,passed:true})],now).overdue,0);
 assert.equal(summarizeLearningHealth([row({releaseMs:now+H,dueMs:now-H})],now).level,'neutral');
 assert.equal(summarizeLearningHealth([],now).percent,null);
});

test('completed or attempted submission is distinguished from missing submission',()=>{
 const complete=summarizeLearningHealth([row({complete:true,passed:true})],now);
 assert.equal(complete.level,'normal');
 assert.equal(complete.title,'順調です！');
 const attempted=summarizeLearningHealth([row({dueMs:now-H,attempted:true})],now);
 assert.equal(attempted.overdue,1);
 assert.equal(attempted.overdueUnsubmitted,0);
 assert.equal(attempted.incomplete,1);
 assert.equal(attempted.unsubmitted,0);
});

test('longer backlog eventually encourages consultation without danger wording',()=>{
 const s=summarizeLearningHealth(overdue(9),now,'gentle');
 assert.equal(s.level,'support');
 assert.equal(s.title,'先生と一緒に考えよう');
 assert.match(s.message,/相談/);
});
