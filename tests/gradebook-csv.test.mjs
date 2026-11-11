import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { manualMetricOverride } from '../js/manual-score-precedence.mjs';
import { evaluatePassCriteria } from '../js/pass-criteria.mjs';
const source=fs.readFileSync(new URL('../js/teacher.js',import.meta.url),'utf8');
const exportSource=source.slice(source.indexOf('function metricManualValue('),source.indexOf('function renderTable()'));
const key='s1|a1';
async function download(mode='class') {
 let blob,link;
 const context={
  gradebookAudienceMode:mode,
  visibleAssignments:()=>[{id:'a1',week_no:1,pass_enabled:true,pass_accuracy:80,pass_wpm:100},{id:'a2',week_no:2}],
  submissions:[],manualScores:[],
  students:[{id:'s1',student_number:'01',display_name:'山田, "花子"'},{id:'s2',student_number:'02',display_name:'佐藤'}],
  bestSubmissionMap:()=>new Map([[key,{accuracy:92,submitted_at:'2026-11-10'}]]),
  bestWpmSubmissionMap:()=>new Map([[key,{wpm:120,submitted_at:'2026-11-10'}]]),
  bestComprehensionSubmissionMap:()=>new Map([[key,{comprehension:87,score_version:'wcpm-v1',submitted_at:'2026-11-10'}]]),
  manualScoreMap:()=>new Map([[key,{score:0,updated_at:'2026-11-11'}]]),
  attemptCountMap:()=>new Map([[key,3]]),
  assignmentNumber:a=>a.week_no,
  targetsStudent:(_,id)=>id==='s1',
  manualMetricOverride,evaluatePassCriteria,
  Blob,URL:{createObjectURL:b=>{blob=b;return 'blob:test';},revokeObjectURL:()=>{}},
  document:{createElement:()=>link={click(){},remove(){}},body:{appendChild(){}}},
 };
 vm.runInNewContext(exportSource+'\nexportGradebookCsv();',context);
 return {text:await blob.text(),bytes:new Uint8Array(await blob.arrayBuffer()),filename:link.download};
}
test('CSV has real CRLF records, UTF-8 BOM, quoted Japanese names, manual zero and reading metrics',async()=>{
 const {text,bytes,filename}=await download();
 assert.deepEqual([...bytes.slice(0,3)],[239,187,191]);
 assert.equal(filename,'copeak-gradebook.csv');
 assert.equal(text,[
  '"Student No.","Student","#1 Accuracy","#1 WPM","#1 Reading Performance","#1 Reads","#1 Pass","#2 Accuracy","#2 WPM","#2 Reading Performance","#2 Reads","#2 Pass"',
  '"01","山田, ""花子""","0","120","87","3","NOT YET","","","","0",""',
  '"02","佐藤","","","","0","NOT YET","","","","0",""'
 ].join('\r\n'));
 assert.ok(!text.includes('`r`n'));
});
test('individual study CSV preserves out-of-scope blanks and uses the same record separators',async()=>{
 const {text,filename}=await download('targeted');
 assert.equal(filename,'copeak-individual-study.csv');
 assert.equal(text.split('\r\n').length,3);
 assert.ok(text.endsWith('"02","佐藤","","","","","","","","","",""'));
});
