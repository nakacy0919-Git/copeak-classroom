import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTeacherPracticeUrl } from '../js/teacher-reading-practice.mjs';

const base = 'https://copeak.pic-speak-story.com/';
const assignment = {
  id: 'a1',
  title: 'Sample reading',
  lesson_text: 'The student is reading aloud.',
  lesson_translation: '生徒が音読しています。',
  lesson_lang: 'en-US',
  practice_mode: 'reading',
  mode_locked: true,
  score_exclusions: ['Tokyo']
};

test('teacher opens the same reading exercise without a student session or submission token', () => {
  const url = buildTeacherPracticeUrl(assignment, base, {}, ['Tokyo']);
  assert.equal(url.searchParams.get('eng'), assignment.lesson_text);
  assert.equal(url.searchParams.get('jpn'), assignment.lesson_translation);
  assert.equal(url.searchParams.get('practice_mode'), 'reading');
  assert.equal(url.searchParams.get('mode_locked'), '1');
  assert.equal(url.searchParams.get('teacher_preview'), '1');
  assert.deepEqual(JSON.parse(url.searchParams.get('score_exclusions')), ['Tokyo']);
  for (const forbidden of ['classroom_student','classroom_assignment',
    'classroom_origin','classroom_launch']) {
    assert.equal(url.searchParams.has(forbidden), false);
  }
});

test('old lesson URL query parameters including another student session are stripped', () => {
  const url = buildTeacherPracticeUrl({
    ...assignment,
    copeak_url: base + '?classroom_student=other&classroom_assignment=assignment-1&form=https://example.org'
  }, base);
  assert.equal(url.searchParams.has('classroom_student'), false);
  assert.equal(url.searchParams.has('classroom_assignment'), false);
  assert.equal(url.searchParams.has('form'), false);
});

test('teacher preview supports draft dialogue, model audio, image and YouTube clip', () => {
  const url = buildTeacherPracticeUrl({
    ...assignment,
    is_published: false,
    lesson_type: 'dialogue',
    lesson_dialogue: [{ speaker: 'A', text: 'Hello!' }],
    youtube_video_id: 'abcdefghijk',
    youtube_start_seconds: 10,
    youtube_end_seconds: 25,
    youtube_loop: true
  }, base, {
    audioUrl: 'https://signed.example.com/audio.mp3',
    imageUrl: 'https://signed.example.com/image.png'
  });
  assert.equal(url.searchParams.get('type'), 'dialogue');
  assert.equal(JSON.parse(url.searchParams.get('dialogue'))[0].speaker, 'A');
  assert.equal(url.searchParams.get('audioUrl'), 'https://signed.example.com/audio.mp3');
  assert.equal(url.searchParams.get('image_url'), 'https://signed.example.com/image.png');
  assert.equal(url.searchParams.get('youtube_id'), 'abcdefghijk');
});

test('untrusted Copeak URL and empty lesson are rejected', () => {
  assert.throws(() => buildTeacherPracticeUrl({
    ...assignment, copeak_url: 'https://evil.example.com/'
  }, base), /起動先URL/);
  assert.throws(() => buildTeacherPracticeUrl({ ...assignment, lesson_text: '  ' }, base),
    /英文が登録/);
});
