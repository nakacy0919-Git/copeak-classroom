import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDeadlineParts, deadlineNoticeText } from '../js/assignment-deadline-notice.mjs';

test('UTC deadline converts to the correct Japan date, weekday, and minute', () => {
  assert.deepEqual(formatDeadlineParts('2026-11-13T14:59:00Z', 'Asia/Tokyo'), {
    date: '2026年11月13日', weekday: '金', time: '23:59', zone: '日本時間（JST）'
  });
});

test('missing or malformed deadlines do not become invented dates', () => {
  assert.equal(formatDeadlineParts(null, 'Asia/Tokyo'), null);
  assert.equal(formatDeadlineParts('not-a-date', 'Asia/Tokyo'), null);
  assert.match(deadlineNoticeText({ title: 'Lesson 8' }, '3年2組', 'Asia/Tokyo'), /締切日時未設定/);
});

test('notice includes assignment, class, and due time', () => {
  const notice = deadlineNoticeText({
    title: 'Lesson 8', due_at: '2026-11-13T14:59:00Z'
  }, '3年2組', 'Asia/Tokyo');
  assert.match(notice, /3年2組/);
  assert.match(notice, /Lesson 8/);
  assert.match(notice, /23:59/);
});
