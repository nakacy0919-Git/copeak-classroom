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
        'Pending',
      className:
        'pending'
    },

    approved: {
      label:
        'Approved',
      className:
        'approved'
    },

    suspended: {
      label:
        'Suspended',
      className:
        'suspended'
    },

    rejected: {
      label:
        'Rejected',
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
      ✓ Approve
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
      ⏸ Suspend
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
      × Reject
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


function teacherCard(
  teacher
) {

  const status =
    statusInfo(
      teacher.teacher_status
    );


  return `
    <article class="admin-teacher-card">

      <div class="admin-teacher-main">

        <div class="admin-teacher-heading">

          <div>

            <div class="admin-teacher-name">
              ${esc(
                teacher.display_name ||
                'No name'
              )}
            </div>

            <div class="admin-teacher-email">
              ${esc(
                teacher.email ||
                '—'
              )}
            </div>

          </div>


          <span
            class="
              admin-status-badge
              ${status.className}
            ">

            ${status.label}

          </span>

        </div>


        <div class="admin-teacher-school">

          <strong>
            ${esc(
              teacher.school_name ||
              '学校名未登録'
            )}
          </strong>

          <span>
            ${esc(
              teacher.prefecture ||
              '—'
            )}
            /
            ${esc(
              schoolTypeLabel(
                teacher.school_type
              )
            )}
          </span>

        </div>


        <div class="admin-teacher-grid">

          <div>
            <span>SUBJECT</span>
            <strong>
              ${esc(
                teacher.subject ||
                '—'
              )}
            </strong>
          </div>

          <div>
            <span>PLANNED CLASSES</span>
            <strong>
              ${esc(
                teacher.planned_class_count ??
                '—'
              )}
            </strong>
          </div>

          <div>
            <span>PLANNED STUDENTS</span>
            <strong>
              ${esc(
                teacher.planned_student_count ??
                '—'
              )}
            </strong>
          </div>

          <div>
            <span>PHONE</span>
            <strong>
              ${esc(
                teacher.phone ||
                '—'
              )}
            </strong>
          </div>

        </div>


        <div class="admin-teacher-purpose">

          <span>
            USE PURPOSE
          </span>

          <p>
            ${esc(
              teacher.use_purpose ||
              '未記入'
            )}
          </p>

        </div>


        <div class="admin-teacher-meta">

          Registered:
          ${esc(
            formatDate(
              teacher.registered_at
            )
          )}

          ${
            teacher.reviewed_at
              ? `
                <span>
                  Reviewed:
                  ${esc(
                    formatDate(
                      teacher.reviewed_at
                    )
                  )}
                </span>
              `
              : ''
          }

        </div>

      </div>


      <div class="admin-teacher-actions">

        ${actionButtons(
          teacher
        )}

      </div>

    </article>
  `;
}


function render() {

  renderStats();


  const filtered =
    teachers.filter(
      teacher => {

        if (
          statusFilter !==
            'all' &&
          teacher.teacher_status !==
            statusFilter
        ) {

          return false;
        }


        return teacherMatchesSearch(
          teacher
        );
      }
    );


  const root =
    $('#adminTeacherList');


  if (
    filtered.length ===
    0
  ) {

    root.innerHTML = `
      <div class="admin-empty">
        条件に一致するTeacherはいません。
      </div>
    `;

    return;
  }


  root.innerHTML =
    filtered
      .map(
        teacher =>
          teacherCard(
            teacher
          )
      )
      .join('');
}


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