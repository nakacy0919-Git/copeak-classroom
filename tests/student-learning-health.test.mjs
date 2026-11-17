import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeLearningHealth } from '../js/student-learning-health.mjs';
const now=Date.parse('2026-11-17T10:00:00Z'),h=3600000;
const row=(opts={})=>({releaseMs:now-96*h,dueMs:now+72*h,complete:false,passed:false,attempted:false,...opts});
test('counts are exclusive, future excluded, no criteria submitted complete distinct from pass',()=>{
 const r=summarizeLearningHealth([row({complete:true,passed:true,attempted:true}),row({complete:true,attempted:true}),row({attempted:true}),row(),row({releaseMs:now+1})],now);
 assert.equal(r.total,4);assert.equal(r.complete,2);assert.equal(r.passed,1);assert.equal(r.submittedComplete,1);assert.equal(r.incomplete,1);assert.equal(r.unsubmitted,1);assert.equal(r.future,1);assert.equal(r.percent,50);
});
test('exact deadline risk, unfinished even if attempted, completed and future not risky',()=>{
 assert.equal(summarizeLearningHealth([row({dueMs:now})],now).level,'danger');
 assert.equal(summarizeLearningHealth([row({dueMs:now-1,attempted:true})],now).overdue,1);
 assert.equal(summarizeLearningHealth([row({dueMs:now,complete:true,passed:true})],now).level,'normal');
 assert.equal(summarizeLearningHealth([row({releaseMs:now+1,dueMs:now})],now).level,'neutral');
 assert.equal(summarizeLearningHealth([row({dueMs:now+48*h})],now).level,'warning');
 assert.equal(summarizeLearningHealth([row({dueMs:now+48*h+1})],now).level,'normal');
 assert.equal(summarizeLearningHealth(Array(3).fill(row({dueMs:now+24*h})),now).level,'danger');
 assert.equal(summarizeLearningHealth(Array(3).fill(row()),now).level,'warning');
 assert.equal(summarizeLearningHealth(Array(3).fill(row({releaseMs:now-1})),now).level,'normal');
 assert.equal(summarizeLearningHealth([],now).percent,null);
});
