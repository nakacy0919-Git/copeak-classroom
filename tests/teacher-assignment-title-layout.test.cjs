const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'teacher.html'), 'utf8');

test('teacher assignment title is confined to editor main column', () => {
  const layout = html.includes('class="assignment-editor-layout"');
  const main = html.match(/<main class="assignment-editor-main">([\\s\\S]*?)<\\/main>/);
  assert.equal(layout, true, 'assignment two-column layout should exist');
  assert.ok(main, 'editor main column should exist');
  assert.match(main[1], /id="assignmentTitle"/);
  assert.match(main[1], /id="assignmentLessonTypeLabel"/);
  assert.ok(main[1].indexOf('id="assignmentTitle"') < main[1].indexOf('id="assignmentLessonTypeLabel"'), 'title should precede lesson type');
  assert.equal((html.match(/id="assignmentTitle"/g) || []).length, 1);
  assert.match(main[1], /<label for="assignmentTitle">/);
});

test('sidebar and responsive two-column structure are still present', () => {
  assert.match(html, /<aside class="assignment-editor-sidebar">/);
  assert.match(html, /id="assignmentAudienceClass"/);
  assert.match(html, /id="assignmentSelfIntroEditor"/);
});
