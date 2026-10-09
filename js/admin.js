import {
  getClient,
  isConfigured
} from './supabase.js';


const $ =
  selector =>
    document.querySelector(
      selector
    );


let sb =
  null;

let adminUser =
  null;

let teachers =
  [];
let page = 0;
const pageSize = 6;

let statusFilter =
  'all';

let searchQuery =
  '';


function esc(
  value
) {

  return String(
    value ??
    ''
  )
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}


function formatDate(
  value
) {

  if (!value) {
    return '—';
  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return '—';
  }


  return new Intl.DateTimeFormat(
    'ja-JP',
    {
      year:
        'numeric',

      month:
        '2-digit',

      day:
        '2-digit',

      hour:
        '2-digit',

      minute:
        '2-digit'
    }
  )
    .format(
      date
    );
}


function statusInfo(
  status
) {

  const map = {

    pending: {
      label:
        '承認待ち',
      className:
        'pending'
    },

    approved: {
      label:
        '承認済み',
      className:
        'approved'
    },

    suspended: {
      label:
        '停止中',
      className:
        'suspended'
    },

    rejected: {
      label:
        '却下',
      className:
        'rejected'
    }

  };


  return (
    map[status] ||
    map.pending
  );
}


function schoolTypeLabel(
  value
) {

  const map = {

    elementary:
      '小学校',

    junior_high:
      '中学校',

    high_school:
      '高等学校',

    university:
      '大学・短期大学',

    vocational:
      '専門学校',

    other:
      'その他'

  };


  return (
    map[value] ||
    value ||
    '—'
  );
}


function showMessage(
  text,
  type = 'info'
) {

  const root =
    $('#adminMessage');


  root.textContent =
    text;

  root.className =
    `alert ${type}`;

  root.classList
    .remove(
      'hidden'
    );
}


function hideMessage() {

  $('#adminMessage')
    ?.classList
    .add(
      'hidden'
    );
}


async function verifyAdmin() {

  if (!isConfigured()) {

    location.href =
      'index.html';

    return false;
  }


  sb =
    getClient(
      'teacher'
    );


  const {
    data: {
      user
    },
    error: userError
  } =
    await sb.auth
      .getUser();


  if (
    userError ||
    !user
  ) {

    location.href =
      'index.html';

    return false;
  }


  adminUser =
    user;


  const {
    data: profile,
    error: profileError
  } =
    await sb
      .from(
        'profiles'
      )
      .select(
        'display_name,role,teacher_status'
      )
      .eq(
        'id',
        user.id
      )
      .single();


  if (
    profileError ||
    !profile ||
    profile.role !==
      'teacher'
  ) {

    location.href =
      'index.html';

    return false;
  }


  if (
    profile.teacher_status !==
      'approved'
  ) {

    location.href =
      'teacher-pending.html';

    return false;
  }


  const {
    data: admin,
    error: adminError
  } =
    await sb
      .from(
        'platform_admins'
      )
      .select(
        'user_id'
      )
      .eq(
        'user_id',
        user.id
      )
      .maybeSingle();


  if (adminError) {
    throw adminError;
  }


  if (!admin) {

    location.href =
      'teacher.html';

    return false;
  }


  $('#adminUserName')
    .textContent =
      profile.display_name ||
      user.email ||
      'Admin';


  return true;
}


async function loadTeachers() {

  hideMessage();


  const {
    data,
    error
  } =
    await sb.rpc(
      'admin_list_teachers'
    );


  if (error) {
    throw error;
  }


  teachers =
    Array.isArray(
      data
    )
      ? data
      : [];


  render();
}


function renderStats() {

  const count =
    status =>
      teachers.filter(
        teacher =>
          teacher.teacher_status ===
          status
      ).length;


  $('#adminPendingCount').textContent =
    count('pending');

  $('#adminApprovedCount').textContent =
    count('approved');

  $('#adminSuspendedCount').textContent =
    count('suspended');

  $('#adminRejectedCount').textContent =
    count('rejected');
}


function teacherMatchesSearch(
  teacher
) {

  if (!searchQuery) {
    return true;
  }


  const haystack =
    [
      teacher.display_name,
      teacher.email,
      teacher.school_name,
      teacher.prefecture,
      teacher.subject
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();


  return haystack.includes(
    searchQuery
  );
}


function actionButtons(
  teacher
) {

  const status =
    teacher.teacher_status;


  const approve = `
    <button
      type="button"
      class="btn btn-sm btn-primary"
      data-admin-action="approved"
      data-teacher-id="${esc(
        teacher.teacher_id
      )}">
      ✓ 承認
    </button>
  `;


  const suspend = `
    <button
      type="button"
      class="btn btn-sm btn-light"
      data-admin-action="suspended"
      data-teacher-id="${esc(
        teacher.teacher_id
      )}">
      ⏸ 停止
    </button>
  `;


  const reject = `
    <button
      type="button"
      class="btn btn-sm btn-danger"
      data-admin-action="rejected"
      data-teacher-id="${esc(
        teacher.teacher_id
      )}">
      × 却下
    </button>
  `;


  if (
    status ===
    'pending'
  ) {

    return (
      approve +
      reject
    );
  }


  if (
    status ===
    'approved'
  ) {

    if (
      teacher.teacher_id ===
      adminUser?.id
    ) {

      return `
        <span class="admin-self-label">
          Platform Admin
        </span>
      `;
    }


    return suspend;
  }


  if (
    status ===
      'suspended' ||
    status ===
      'rejected'
  ) {

    return approve;
  }


  return '';
}


function render() {
  renderStats();
  const filtered = teachers.filter(t => (statusFilter === 'all' || t.teacher_status === statusFilter) && teacherMatchesSearch(t));
  page = Math.min(page, Math.max(0, Math.ceil(filtered.length / pageSize) - 1));
  const rows = filtered.slice(page * pageSize, (page + 1) * pageSize);
  $('#adminTeacherList').innerHTML = `<table class="admin-table"><thead><tr><th>先生 / 学校</th><th>メール</th><th>登録日</th><th>状態</th><th>操作</th></tr></thead><tbody>${rows.map(t => `<tr><td>${esc(t.display_name || '氏名未登録')}<small>${esc(t.school_name || '学校未登録')}</small></td><td>${esc(t.email)}</td><td>${esc(formatDate(t.registered_at))}</td><td><span class="admin-badge ${statusInfo(t.teacher_status).className}">${esc(statusInfo(t.teacher_status).label)}</span></td><td><button class="btn btn-sm btn-light" data-detail="${esc(t.teacher_id)}">詳細</button> ${actionButtons(t)}</td></tr>`).join('') || '<tr><td colspan="5">該当する先生はいません。</td></tr>'}</tbody></table>`;
  $('#adminPage').textContent = `${filtered.length}件 · ${page + 1} / ${Math.max(1, Math.ceil(filtered.length / pageSize))}ページ`;
  $('#adminPrevious').disabled = page === 0;
  $('#adminNext').disabled = (page + 1) * pageSize >= filtered.length;
}
$('#adminPrevious').onclick = () => { page--; render(); };
$('#adminNext').onclick = () => { page++; render(); };
$('#adminDetailClose').onclick = () => $('#adminTeacherDetail').close();
$('#adminTeacherList').addEventListener('click', event => {
  const id = event.target.closest('[data-detail]')?.dataset.detail;
  const t = teachers.find(t => t.teacher_id === id);
  if (!t) return;
  const fields = [['氏名',t.display_name],['メール',t.email],['学校',t.school_name],['都道府県',t.prefecture],['校種',schoolTypeLabel(t.school_type)],['教科',t.subject],['予定クラス数',t.planned_class_count],['予定生徒数',t.planned_student_count],['電話',t.phone],['利用目的',t.use_purpose],['管理メモ',t.review_note]];
  $('#adminDetailBody').innerHTML = `<dl class="admin-detail-grid">${fields.map(([k,v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v ?? '—')}</dd></div>`).join('')}</dl>`;
  $('#adminTeacherDetail').showModal();
});


async function changeTeacherStatus(
  teacherId,
  nextStatus
) {

  const teacher =
    teachers.find(
      item =>
        item.teacher_id ===
        teacherId
    );


  if (!teacher) {
    return;
  }


  if (
    teacherId ===
      adminUser?.id &&
    nextStatus !==
      'approved'
  ) {

    alert(
      'Platform Admin自身を停止することはできません。'
    );

    return;
  }


  const label =
    statusInfo(
      nextStatus
    ).label;


  const confirmed =
    confirm(
      `${teacher.display_name || 'Teacher'} を ${label} に変更しますか？`
    );


  if (!confirmed) {
    return;
  }


  let note =
    null;


  if (
    nextStatus ===
      'suspended' ||
    nextStatus ===
      'rejected'
  ) {

    note =
      prompt(
        '管理メモを入力してください（任意）',
        ''
      );
  }


  showMessage(
    'Updating teacher status...',
    'info'
  );


  const {
    error
  } =
    await sb.rpc(
      'admin_set_teacher_status',
      {
        p_teacher_id:
          teacherId,

        p_status:
          nextStatus,

        p_note:
          note || null
      }
    );


  if (error) {
    throw error;
  }


  await loadTeachers();


  showMessage(
    `${teacher.display_name || 'Teacher'} を ${label} に変更しました。`,
    'ok'
  );
}


$('#adminTeacherSearch')
  ?.addEventListener(
    'input',
    event => {

      page = 0;
      searchQuery =
        event.target
          .value
          .trim()
          .toLowerCase();

      render();
    }
  );


$('#adminStatusFilter')
  ?.addEventListener(
    'change',
    event => {

      page = 0;
      statusFilter =
        event.target.value;

      render();
    }
  );


$('#adminTeacherList')
  ?.addEventListener(
    'click',
    async event => {

      const button =
        event.target.closest(
          '[data-admin-action]'
        );


      if (!button) {
        return;
      }


      button.disabled =
        true;


      try {

        await changeTeacherStatus(
          button.dataset.teacherId,
          button.dataset.adminAction
        );

      } catch (error) {

        console.error(
          '[Admin Teacher Status]',
          error
        );


        showMessage(
          error.message ||
          String(error),
          'error'
        );

      } finally {

        button.disabled =
          false;
      }
    }
  );


$('#adminRefresh')
  ?.addEventListener(
    'click',
    async () => {

      const button =
        $('#adminRefresh');


      button.disabled =
        true;

      button.textContent =
        'Refreshing...';


      try {

        await loadTeachers();

      } catch (error) {

        console.error(
          '[Admin Refresh]',
          error
        );


        showMessage(
          error.message ||
          String(error),
          'error'
        );

      } finally {

        button.disabled =
          false;

        button.textContent =
          '↻ Refresh';
      }
    }
  );


$('#adminSignOut')
  ?.addEventListener(
    'click',
    async () => {

      if (sb) {
        await sb.auth
          .signOut();
      }


      location.href =
        'index.html';
    }
  );


(async () => {

  const allowed =
    await verifyAdmin();


  if (!allowed) {
    return;
  }


  await loadTeachers();

})()
.catch(
  error => {

    console.error(
      '[Admin Dashboard]',
      error
    );


    showMessage(
      error.message ||
      'Admin Dashboardを読み込めませんでした。',
      'error'
    );
  }
);