import {
  requireUser,
  getClient
} from './supabase.js';

import {
  showConfirmModal,
  showInfoModal,
  showFormModal
} from './ui.js';


const $ =
  selector =>
    document.querySelector(selector);


let ctx = null;
let classes = [];
let activeClass = null;


// ==========================================
// UTIL
// ==========================================

function esc(value = '') {

  return String(value).replace(
    /[&<>'"]/g,
    char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    })[char]
  );
}


function requestedClassId() {

  return (
    new URLSearchParams(
      location.search
    ).get('class')
    ||
    localStorage.getItem(
      'copeak_teacher_class_id'
    )
  );
}


function moveToClass(classId) {

  localStorage.setItem(
    'copeak_teacher_class_id',
    classId
  );

  const url =
    new URL(location.href);

  url.searchParams.set(
    'class',
    classId
  );

  location.href =
    url.toString();
}


async function showClassManagerError(
  title,
  error
) {

  console.error(
    '[Class Manager]',
    error
  );

  await showInfoModal({
    badge: 'Error',
    badgeType: 'danger',
    title,
    message:
      error?.message ||
      String(error)
  });
}


// ==========================================
// LOAD CLASSES
// ==========================================

async function loadClasses() {

  const {
    data,
    error
  } =
    await getClient()
      .from('classes')
      .select('*')
      .order('created_at');


  if (error) {
    throw error;
  }


  classes =
    data || [];


  if (!classes.length) {
    return;
  }


  const preferred =
    requestedClassId();


  activeClass =
    classes.find(
      item =>
        item.id === preferred
    )
    ||
    classes[0];


  localStorage.setItem(
    'copeak_teacher_class_id',
    activeClass.id
  );
}


// ==========================================
// CREATE CLASS
// ==========================================

async function createNewClass() {

  const values =
    await showFormModal({
      badge: 'New Class',
      badgeType: 'info',
      title: '新しいクラスを作成',
      confirmText: 'Create Class',
      cancelText: 'Cancel',
      fields: [
        {
          name: 'className',
          label: 'Class Name',
          placeholder: '例：3年1組',
          required: true
        },
        {
          name: 'academicYear',
          label: 'Academic Year',
          value: String(
            new Date().getFullYear()
          ),
          required: true
        }
      ]
    });


  if (!values) {
    return;
  }


  const academicYear =
    Number(
      values.academicYear
    );


  if (
    !Number.isInteger(
      academicYear
    ) ||
    academicYear < 2000 ||
    academicYear > 2100
  ) {

    await showInfoModal({
      badge: 'Check',
      badgeType: 'danger',
      title: '年度を確認してください',
      message:
        'Academic Yearは4桁の西暦で入力してください。'
    });

    return;
  }


  const {
    data,
    error
  } =
    await getClient()
      .rpc(
        'create_teacher_class',
        {
          p_name:
            values.className,

          p_academic_year:
            academicYear
        }
      );


  if (error) {
    throw error;
  }


  if (!data) {
    throw new Error(
      'クラスを作成できませんでした。'
    );
  }


  moveToClass(data);
}


// ==========================================
// LOAD TEACHERS
// ==========================================

async function loadClassTeachers() {

  if (!activeClass) {
    return;
  }


  const {
    data,
    error
  } =
    await getClient()
      .rpc(
        'get_class_teachers',
        {
          p_class_id:
            activeClass.id
        }
      );


  if (error) {
    throw error;
  }


  renderTeacherList(
    data || []
  );
}


// ==========================================
// RENDER TEACHER LIST
// ==========================================

function renderTeacherList(rows) {

  const body =
    $('#classTeacherList');


  if (!body) {
    return;
  }


  const isOwner =
    activeClass.teacher_id ===
    ctx.user.id;


  body.innerHTML =
    rows
      .map(
        teacher => `
          <div class="class-teacher-row">

            <div>

              <strong>
                ${esc(
                  teacher.display_name
                )}
              </strong>

              <div class="tiny muted">
                ${esc(
                  teacher.email || ''
                )}
              </div>

            </div>


            <div class="class-teacher-actions">

              <span class="${
                teacher.is_owner
                  ? 'teacher-owner-badge'
                  : 'teacher-shared-badge'
              }">

                ${
                  teacher.is_owner
                    ? 'Owner'
                    : 'Co-Teacher'
                }

              </span>

              ${
                isOwner &&
                !teacher.is_owner

                  ? `
                    <button
                      class="btn btn-sm btn-danger"
                      data-remove-teacher="${teacher.teacher_id}">

                      Remove

                    </button>
                  `

                  : ''
              }

            </div>

          </div>
        `
      )
      .join('');


  body
    .querySelectorAll(
      '[data-remove-teacher]'
    )
    .forEach(
      button => {

        button.onclick =
          async () => {

            try {

              await removeTeacher(
                button.dataset
                  .removeTeacher
              );

            } catch (error) {

              await showClassManagerError(
                '教員を削除できませんでした',
                error
              );
            }
          };
      }
    );
}


// ==========================================
// ADD TEACHER
// ==========================================

async function addTeacher() {

  if (
    activeClass.teacher_id !==
    ctx.user.id
  ) {

    await showInfoModal({
      badge: 'Owner Only',
      badgeType: 'danger',
      title: 'Ownerのみ操作できます',
      message:
        '共同担当教員を追加できるのはClass Ownerだけです。'
    });

    return;
  }


  const email =
    $('#shareTeacherEmail')
      .value
      .trim();


  if (!email) {

    await showInfoModal({
      badge: 'Check',
      badgeType: 'danger',
      title: 'Teacher Emailを入力してください',
      message:
        '追加する先生の登録済みメールアドレスを入力してください。'
    });

    return;
  }


  const button =
    $('#addSharedTeacher');


  button.disabled =
    true;


  try {

    const {
      error
    } =
      await getClient()
        .rpc(
          'add_class_teacher_by_email',
          {
            p_class_id:
              activeClass.id,

            p_email:
              email
          }
        );


    if (error) {
      throw error;
    }


    $('#shareTeacherEmail')
      .value = '';


    await loadClassTeachers();


    await showInfoModal({
      badge: 'Added',
      badgeType: 'info',
      title: '共同担当教員を追加しました',
      message:
        `${email} をこのクラスのCo-Teacherに追加しました。`
    });


  } finally {

    button.disabled =
      false;
  }
}


// ==========================================
// REMOVE TEACHER
// ==========================================

async function removeTeacher(
  teacherId
) {

  const ok =
    await showConfirmModal({
      badge: 'Remove Teacher',
      badgeType: 'danger',
      title: '共同担当教員を外しますか？',
      message:
        'この先生は、このクラスのRoster・Assignments・Gradebookへアクセスできなくなります。',
      confirmText: 'Remove',
      cancelText: 'Cancel',
      confirmVariant: 'danger'
    });


  if (!ok) {
    return;
  }


  const {
    error
  } =
    await getClient()
      .rpc(
        'remove_class_teacher',
        {
          p_class_id:
            activeClass.id,

          p_teacher_id:
            teacherId
        }
      );


  if (error) {
    throw error;
  }


  await loadClassTeachers();


  await showInfoModal({
    badge: 'Removed',
    badgeType: 'info',
    title: '共同担当教員を外しました',
    message:
      'このクラスへの共同担当アクセスを解除しました。'
  });
}


// ==========================================
// BUILD UI
// ==========================================

function buildClassManager() {

  const main =
    $('#mainApp');


  if (
    !main ||
    !activeClass ||
    $('#classManagerBar')
  ) {
    return;
  }


  const isOwner =
    activeClass.teacher_id ===
    ctx.user.id;


  const section =
    document.createElement(
      'section'
    );


  section.id =
    'classManagerBar';


  section.className =
    'paper class-manager';


  section.innerHTML = `

    <div class="class-manager-main">

      <div class="class-selector-area">

        <div class="eyebrow">
          My Classes
        </div>

        <select
          id="teacherClassSelect"
          class="input class-selector">

          ${classes
            .map(
              item => `
                <option
                  value="${item.id}"
                  ${
                    item.id ===
                    activeClass.id
                      ? 'selected'
                      : ''
                  }>

                  ${esc(item.name)}
                  ${
                    item.teacher_id ===
                    ctx.user.id
                      ? ' — Owner'
                      : ' — Shared'
                  }

                </option>
              `
            )
            .join('')}

        </select>

      </div>


      <div class="class-manager-actions">

        <button
          id="newClassButton"
          class="btn btn-primary">

          ＋ New Class

        </button>

        <button
          id="teachersButton"
          class="btn btn-light">

          Teachers

        </button>

      </div>

    </div>


    <div
      id="classTeacherPanel"
      class="class-teacher-panel hidden">

      <div class="panel-title">

        <div>

          <div class="eyebrow">
            Shared Class
          </div>

          <h3>
            Teachers
          </h3>

        </div>

      </div>


      ${
        isOwner

          ? `
            <div class="class-share-form">

              <input
                id="shareTeacherEmail"
                type="email"
                class="input"
                placeholder="teacher@example.com">

              <button
                id="addSharedTeacher"
                class="btn btn-primary">

                Add Teacher

              </button>

            </div>
          `

          : `
            <div class="small muted">
              このクラスは共同担当として参加しています。
              教員の追加・削除はClass Ownerのみ可能です。
            </div>
          `
      }


      <div
        id="classTeacherList"
        class="class-teacher-list">

        Loading...

      </div>

    </div>
  `;


  main.insertBefore(
    section,
    main.firstChild
  );


  $('#teacherClassSelect')
    .onchange =
      event => {

        moveToClass(
          event.target.value
        );
      };


  $('#newClassButton')
    .onclick =
      async () => {

        try {

          await createNewClass();

        } catch (error) {

          await showClassManagerError(
            'クラスを作成できませんでした',
            error
          );
        }
      };


  $('#teachersButton')
    .onclick =
      async () => {

        const panel =
          $('#classTeacherPanel');


        panel.classList.toggle(
          'hidden'
        );


        if (
          !panel.classList.contains(
            'hidden'
          )
        ) {

          try {

            await loadClassTeachers();

          } catch (error) {

            await showClassManagerError(
              'Teacher一覧を読み込めませんでした',
              error
            );
          }
        }
      };


  if (
    $('#addSharedTeacher')
  ) {

    $('#addSharedTeacher')
      .onclick =
        async () => {

          try {

            await addTeacher();

          } catch (error) {

            await showClassManagerError(
              '共同担当教員を追加できませんでした',
              error
            );
          }
        };
  }
}


// ==========================================
// START
// ==========================================

(async () => {

  ctx =
    await requireUser(
      'teacher'
    );


  if (
    !ctx ||
    ctx.demo
  ) {
    return;
  }


  await loadClasses();


  if (!activeClass) {
    return;
  }


  buildClassManager();

})()
.catch(
  async error => {

    await showClassManagerError(
      'Class Managerを読み込めませんでした',
      error
    );
  }
);