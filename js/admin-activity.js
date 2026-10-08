import { getClient, isConfigured } from './supabase.js';

const $ = selector => document.querySelector(selector);

let client = null;
let teachers = [];
let lessons = [];
let requestSerial = 0;

const escapeHtml = value => String(value ?? '').replace(
  /[&<>"']/g,
  char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]
);

const number = value =>
  Number(value || 0).toLocaleString('ja-JP');

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function message(text, type = 'info') {
  const root = $('#activityMessage');
  root.textContent = text;
  root.className = `alert ${type}`;
  root.classList.remove('hidden');
}

function hideMessage() {
  $('#activityMessage').classList.add('hidden');
}

async function verifyAdmin() {
  if (!isConfigured()) {
    location.replace('index.html');
    return false;
  }

  client = getClient('teacher');

  const { data: auth, error: authError } =
    await client.auth.getUser();

  if (authError || !auth?.user) {
    location.replace('index.html');
    return false;
  }

  const user = auth.user;

  const [profileResult, adminResult] = await Promise.all([
    client.from('profiles')
      .select('display_name,role,teacher_status')
      .eq('id', user.id)
      .single(),

    client.from('platform_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()
  ]);

  if (profileResult.error) throw profileResult.error;
  if (adminResult.error) throw adminResult.error;

  const profile = profileResult.data;

  if (profile?.role !== 'teacher' ||
      profile.teacher_status !== 'approved' ||
      !adminResult.data) {
    location.replace('teacher.html');
    return false;
  }

  $('#activityAdminName').textContent =
    profile.display_name || user.email || 'Admin';

  return true;
}

function metric(label, value) {
  return `<div class="activity-stat">
    <small>${escapeHtml(label)}</small>
    <strong>${number(value)}</strong>
  </div>`;
}

function renderStats() {
  const total = key => teachers.reduce(
    (sum, teacher) => sum + Number(teacher[key] || 0), 0
  );

  $('#activityStats').innerHTML = [
    metric('登録された先生', teachers.length),
    metric('クラス数', total('class_count')),
    metric('教材・課題数', total('assignment_count')),
    metric('提出記録', total('submission_count'))
  ].join('');
}

function renderTeachers() {
  const query = $('#activitySearch').value.trim().toLowerCase();
  const filter = $('#activityFilter').value;

  const filtered = teachers.filter(teacher => {
    const matches = [
      teacher.teacher_name,
      teacher.school_name
    ].join(' ').toLowerCase().includes(query);

    if (!matches) return false;

    if (filter === 'lessons') {
      return Number(teacher.assignment_count) > 0;
    }

    if (filter === 'submissions') {
      return Number(teacher.submission_count) > 0;
    }

    return true;
  });

  const root = $('#activityTeacherList');

  if (!filtered.length) {
    root.innerHTML =
      '<p class="activity-muted">該当する先生はいません。</p>';
    return;
  }

  root.innerHTML = filtered.map(teacher => `
    <article class="activity-teacher">
      <h3>${escapeHtml(teacher.teacher_name || 'Teacher')}</h3>
      <p>${escapeHtml(teacher.school_name || '学校名未登録')}</p>
      <div class="activity-metrics">
        <div class="activity-metric">
          <strong>${number(teacher.class_count)}</strong>
          <small>クラス</small>
        </div>
        <div class="activity-metric">
          <strong>${number(teacher.assignment_count)}</strong>
          <small>教材・課題</small>
        </div>
        <div class="activity-metric">
          <strong>${number(teacher.submission_count)}</strong>
          <small>提出件数</small>
        </div>
      </div>
      <div class="activity-teacher-footer">
        <span class="activity-muted">
          最終提出：${escapeHtml(formatDate(teacher.last_submission_at))}
        </span>
        <button type="button" class="btn btn-sm btn-primary"
          data-activity-teacher="${escapeHtml(teacher.teacher_id)}">
          教材を見る →
        </button>
      </div>
    </article>
  `).join('');
}

async function loadActivity() {
  hideMessage();

  const { data, error } =
    await client.rpc('admin_get_teacher_activity');

  if (error) throw error;

  teachers = Array.isArray(data) ? data : [];

  teachers.sort(
    (a, b) =>
      Number(b.submission_count || 0) -
      Number(a.submission_count || 0)
  );

  renderStats();
  renderTeachers();

  requestSerial++;
  $('#activityDetail').hidden = true;
  $('#activityPreview').hidden = true;
}

function renderLessons() {
  const root = $('#activityLessonList');

  if (!lessons.length) {
    root.innerHTML =
      '<p class="activity-muted">まだ教材が登録されていません。</p>';
    return;
  }

  root.innerHTML = lessons.map((lesson, index) => {
    const mode = lesson.lesson_type === 'dialogue'
      ? 'Dialogue'
      : 'Text';

    const chips = [
      mode,
      lesson.practice_mode || 'free',
      lesson.has_audio ? '音声あり' : '',
      lesson.has_image ? '画像あり' : '',
      lesson.has_youtube ? '動画あり' : '',
      lesson.is_published ? '公開中' : '下書き'
    ].filter(Boolean);

    return `
      <article class="activity-lesson">
        <div class="activity-muted">
          ${escapeHtml(lesson.class_name || 'クラス')}
          ／ No. ${number(lesson.week_no)}
        </div>
        <h3>${escapeHtml(lesson.title || 'Untitled')}</h3>
        <div>
          ${chips.map(chip =>
            `<span class="activity-chip">${escapeHtml(chip)}</span>`
          ).join('')}
        </div>
        <p>
          提出 ${number(lesson.submission_count)}件
          ／ 作成 ${escapeHtml(formatDate(lesson.created_at))}
        </p>
        <button type="button" class="btn btn-sm btn-light"
          data-activity-lesson="${index}">
          本文を確認 →
        </button>
      </article>
    `;
  }).join('');
}

async function openTeacher(teacherId) {
  const teacher = teachers.find(
    item => item.teacher_id === teacherId
  );

  if (!teacher) return;

  const token = ++requestSerial;
  const detail = $('#activityDetail');

  detail.hidden = false;
  $('#activityPreview').hidden = true;
  $('#activityDetailTitle').textContent =
    `${teacher.teacher_name || 'Teacher'} の教材`;

  $('#activityDetailSub').textContent =
    `${teacher.school_name || '学校名未登録'} ・ 教材を読み込んでいます...`;

  $('#activityLessonList').textContent = '読み込み中...';

  detail.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    const { data, error } =
      await client.rpc('admin_get_teacher_lessons', {
        p_teacher_id: teacherId
      });

    if (error) throw error;
    if (token !== requestSerial) return;

    lessons = Array.isArray(data) ? data : [];

    $('#activityDetailSub').textContent =
      `${teacher.school_name || '学校名未登録'} ・ ${lessons.length}件`;

    renderLessons();
  } catch (error) {
    if (token !== requestSerial) return;
    $('#activityLessonList').textContent =
      '教材を読み込めませんでした。';
    message(error.message || '教材の取得に失敗しました。', 'error');
  }
}

function previewLesson(index) {
  const lesson = lessons[index];
  if (!lesson) return;

  $('#activityPreviewTitle').textContent =
    lesson.title || 'Untitled';

  $('#activityPreviewMeta').textContent =
    `${lesson.class_name || 'クラス'} / ` +
    `${lesson.lesson_lang || 'en-US'} / ` +
    `${lesson.practice_mode || 'free'} / ` +
    `提出 ${number(lesson.submission_count)}件`;

  $('#activityEnglish').textContent =
    lesson.lesson_text || '英文は登録されていません。';

  $('#activityJapanese').textContent =
    lesson.lesson_translation || '日本語訳は登録されていません。';

  const hasDialogue = lesson.lesson_type === 'dialogue' &&
    Array.isArray(lesson.lesson_dialogue);

  $('#activityDialogueArea').hidden = !hasDialogue;

  if (hasDialogue) {
    $('#activityDialogue').textContent =
      lesson.lesson_dialogue.map(line =>
        `${line.speaker || 'Speaker'}: ${line.text || ''}`
      ).join('\n');
  }

  const root = $('#activityPreview');
  root.hidden = false;
  root.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

$('#activitySearch').addEventListener('input', renderTeachers);
$('#activityFilter').addEventListener('change', renderTeachers);

$('#activityTeacherList').addEventListener('click', event => {
  const button = event.target.closest('[data-activity-teacher]');
  if (button) openTeacher(button.dataset.activityTeacher);
});

$('#activityLessonList').addEventListener('click', event => {
  const button = event.target.closest('[data-activity-lesson]');
  if (button) previewLesson(Number(button.dataset.activityLesson));
});

$('#activityCloseDetail').addEventListener('click', () => {
  requestSerial++;
  $('#activityDetail').hidden = true;
  $('#activityPreview').hidden = true;
});

$('#activityRefresh').addEventListener('click', async () => {
  const button = $('#activityRefresh');
  button.disabled = true;

  try {
    await loadActivity();
  } catch (error) {
    message(error.message || '更新できませんでした。', 'error');
  } finally {
    button.disabled = false;
  }
});

$('#activitySignOut').addEventListener('click', async () => {
  if (client) await client.auth.signOut();
  location.replace('index.html');
});

(async () => {
  if (await verifyAdmin()) {
    await loadActivity();
  }
})().catch(error => {
  console.error('[Admin Activity]', error);
  message(error.message || '利用状況を読み込めませんでした。', 'error');
});
