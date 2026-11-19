const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root=path.join(__dirname, '..');
const teacher=fs.readFileSync(path.join(root,'js/teacher.js'),'utf8');
const html=fs.readFileSync(path.join(root,'teacher.html'),'utf8');
const builder=fs.readFileSync(path.join(root,'js/self-introduction-builder.js'),'utf8');

test('self introduction builder is preview only and cannot write to production database',()=>{
  assert.match(html,/data-lesson-type="self_intro"/);
  assert.match(html,/id="assignmentSelfIntroEditor"/);
  assert.match(html,/id="selfIntroSaveDraft"/);
  assert.match(html,/正式な課題登録・生徒への配布はまだできません/);
  assert.match(teacher,/async function saveAssignment\(\)\s*\{\s*if \(\$\('#assignmentLessonType'\)\?\.value === 'self_intro'\)/);
  assert.match(builder,/publishButton\.disabled = intro/);
  assert.doesNotMatch(teacher,/lesson_template:\s*introTemplate/);
  assert.doesNotMatch(html,/self-introduction-student\.js/);
});
test('existing Text and Dialogue editors and their database paths remain intact',()=>{
  assert.match(html,/data-lesson-type="text"/);
  assert.match(html,/data-lesson-type="dialogue"/);
  assert.match(teacher,/const lessonType =\s*\$\('#assignmentLessonType'\)\.value ===\s*'dialogue'/);
  assert.match(teacher,/window\.CopeakSelfIntro\?\.mount\(\)/);
});
