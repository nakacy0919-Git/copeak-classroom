import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSubmissionStatus,sortSubmissionStatus} from '../js/teacher-submission-status.mjs';
const assignment={id:'a',pass_enabled:true,pass_accuracy:80,pass_wpm:100};
const students=['u','w','n','p','s','l'].map((id,i)=>({id,student_number:String(i+1),display_name:id}));
const row=(student_id,accuracy,wpm)=>({student_id,assignment_id:'a',accuracy,wpm,submitted_at:'2026-11-26T00:00:00Z'});
test('four states use real same-attempt criteria, preserve historical passes and include unjoined roster',()=>{
 const result=buildSubmissionStatus(assignment,students,[row('w',60,100),row('n',77,95),row('p',80,100),row('s',90,70),row('s',60,120)],[],[{student_id:'l',assignment_id:'a'}],[{student_number:'7',display_name:'not joined'}]);
 assert.deepEqual(result.map(x=>x.status),['unattempted','working','near','passed','working','passed','unattempted']);
 assert.equal(result[4].attempts,2);
 assert.equal(result[5].legacyPassed,true);
 assert.equal(result[6].student.notJoined,true);
 assert.deepEqual(sortSubmissionStatus(result,'status').map(x=>x.student.student_number),['1','7','2','5','3','4','6']);
 assert.equal(sortSubmissionStatus(result,'attempts-desc')[0].student.id,'s');
});
test('targeted assignments exclude non-targets and unjoined students',()=>{
 const result=buildSubmissionStatus({...assignment,audience_type:'targeted',target_student_ids:['w']},students,[row('p',100,120)],[],[],[{student_number:'7'}]);
 assert.deepEqual(result.map(x=>x.student.id),['w']);
});
test('no pass targets: submission complete, manual record complete without inventing attempts',()=>{
 const result=buildSubmissionStatus({...assignment,pass_enabled:false},students,[row('p',60,30)],[{student_id:'w',assignment_id:'a',score:80}],[]);
 assert.equal(result[1].status,'passed');
 assert.equal(result[1].attempts,0);
 assert.equal(result[1].manualOnly,true);
 assert.equal(result[3].label,'提出完了（合格基準なし）');
 assert.equal(result[0].status,'unattempted');
});
test('manual records do not grant configured pass; zero is recorded; missing metrics cannot be near',()=>{
 const result=buildSubmissionStatus(assignment,students,[row('n',79,null),row('p',0,0)],[{student_id:'w',assignment_id:'a',score:100,wpm:120}],[]);
 assert.equal(result[1].status,'working');
 assert.equal(result[2].status,'working');
 assert.equal(result[3].status,'working');
 assert.equal(result[3].accuracy,0);
});
