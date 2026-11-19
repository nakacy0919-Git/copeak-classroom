const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'teacher.html'),'utf8');
const css=fs.readFileSync(path.join(root,'css/self-introduction-builder.css'),'utf8');
const builder=require('../js/self-introduction-builder.js');

test('lesson type uses a labelled dropdown instead of three horizontal buttons',()=>{
 assert.match(html,/<label for="assignmentLessonType" id="assignmentLessonTypeLabel">Lesson Type<\/label>/);
 assert.match(html,/<select id="assignmentLessonType" class="input" aria-describedby="assignmentLessonTypeHint">/);
 for(const value of ['text','dialogue','self_intro'])assert.match(html,new RegExp('<option value="'+value+'">'));
 assert.doesNotMatch(html, /data-lesson-type=/);
 assert.equal((html.match(/id="assignmentLessonType"/g)||[]).length,1);
});

test('Expression Bank sentence case is preserved instead of uppercasing whole sentences',()=>{
 assert.match(css,/\.selfintro-panel label\.selfintro-expression-row[\s\S]+text-transform:\s*none;/);
 const closing=builder.fields.find(item=>item.id==='closing').options.map(entry=>entry[1]);
 assert.deepEqual(closing,['Nice to meet you!','Thank you for listening.',"I'm looking forward to learning with you."]);
});

test('builder and sample preview have larger vertical limits on desktop and mobile',()=>{
 assert.match(css,/\.selfintro-panel-frame\s*\{\s*max-height:440px;\s*min-height:310px;/);
 assert.match(css,/\.selfintro-preview-text\s*\{[^}]*max-height:170px;/);
 assert.match(css, /\.selfintro-panel-frame\s*\{\s*max-height:355px;\s*min-height:245px;/);
});

test('the preview-only student delivery block remains in place',()=>{
 const teacher=fs.readFileSync(path.join(root,'js/teacher.js'),'utf8');
 assert.match(teacher,/Self-Introductionの正式登録はまだ未公開です/);
 assert.match(html,/Self-Introductionの正式な課題登録・生徒への配布はまだできません/);
 assert.match(html,/生徒（Test生徒を含む）には配信されません/);
});
