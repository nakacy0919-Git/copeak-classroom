/**
 * Launch a teacher's own Copeak reading practice without impersonating a student.
 * The Classroom source enables the same practice-mode and model-audio handling,
 * but no student ID, assignment ID, launch nonce or result callback is attached.
 */
export function buildTeacherPracticeUrl(assignment, copeakBaseUrl, media = {}, scoreExclusions = []) {
  const text = String(assignment?.lesson_text || '').trim();
  if (!text) throw new Error('音読する英文が登録されていません。');

  const canonical = new URL(copeakBaseUrl);
  const url = new URL(assignment.copeak_url || canonical.href, canonical.href);
  if (url.origin !== canonical.origin) {
    throw new Error('Copeakの起動先URLが正しくありません。');
  }

  // Never inherit a student session, assignment submission or existing query.
  url.search = '';
  url.hash = '';
  const params = url.searchParams;
  params.set('source', 'copeak-classroom');
  params.set('teacher_preview', '1');
  params.set('title', assignment.title || 'Reading Assignment');
  params.set('eng', text);
  params.set('jpn', assignment.lesson_translation || '');
  params.set('lang', assignment.lesson_lang || 'en-US');

  const exclusions = Array.isArray(scoreExclusions) ? scoreExclusions : [];
  if (exclusions.length) params.set('score_exclusions', JSON.stringify(exclusions));

  const requestedMode = String(assignment.practice_mode || 'free').toLowerCase();
  const mode = ['free', 'reading', 'paced', 'vanish', 'shadowing'].includes(requestedMode)
    ? requestedMode : 'free';
  params.set('practice_mode', mode);
  params.set('mode_locked', assignment.mode_locked === true ? '1' : '0');

  const targetWpm = Number(assignment.paced_target_wpm);
  if (mode === 'paced' && Number.isInteger(targetWpm) && targetWpm >= 40 && targetWpm <= 300) {
    params.set('paced_target_wpm', String(targetWpm));
  }
  const vanishLevel = Number(assignment.vanish_level);
  if (mode === 'vanish' && Number.isInteger(vanishLevel) && vanishLevel >= 1 && vanishLevel <= 5) {
    params.set('vanish_level', String(vanishLevel));
  }

  if (assignment.lesson_type === 'dialogue' &&
      Array.isArray(assignment.lesson_dialogue) && assignment.lesson_dialogue.length) {
    params.set('type', 'dialogue');
    params.set('dialogue', JSON.stringify(assignment.lesson_dialogue));
  }

  const youtubeId = String(assignment.youtube_video_id || '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(youtubeId)) {
    params.set('youtube_id', youtubeId);
    const start = Number(assignment.youtube_start_seconds);
    const end = Number(assignment.youtube_end_seconds);
    if (Number.isFinite(start) && start >= 0) {
      params.set('youtube_start', String(start));
    }
    if (assignment.youtube_end_seconds != null && Number.isFinite(end) && end > start) {
      params.set('youtube_end', String(end));
    }
    params.set('youtube_loop', assignment.youtube_loop === true ? '1' : '0');
  }

  if (media.audioUrl) params.set('audioUrl', media.audioUrl);
  if (media.imageUrl) params.set('image_url', media.imageUrl);
  return url;
}
