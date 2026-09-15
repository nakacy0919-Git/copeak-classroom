import {
  requireUser,
  getClient
} from './supabase.js';


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


// ==========================================
// LOAD CLASSES
// RLS returns owner + shared classes
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

  const name =
    prompt(
      '新しいクラス名を入力してください。',
      ''
    );


  if (
    name === null ||
    !name.trim()
  ) {

    return;
  }


  const yearText =
    prompt(
      '年度を入力してください。',
      String(
        new Date().getFullYear()
      )
    );


  if (
    yearText === null
  ) {

    return;
  }


  const academicYear =
    Number(yearText);


  if (
    !Number.isInteger(
      academicYear
    )
  ) {

    alert(
      '年度を正しく入力してください。'
    );

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
            name.trim(),

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


  moveToClass(
    data
  );
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
          () =>
            removeTeacher(
              button.dataset
                .removeTeacher
            );
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

    alert(
      '共同担当教員を追加できるのはClass Ownerだけです。'
    );

    return;
  }


  const email =
    $('#shareTeacherEmail')
      .value
      .trim();


  if (!email) {

    alert(
      'Teacher Emailを入力してください。'
    );

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


    alert(
      '共同担当教員を追加しました。'
    );


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
    confirm(
      'この共同担当教員をクラスから外しますか？'
    );


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
      () => {

        createNewClass()
          .catch(
            error => {

              alert(
                error.message ||
                String(error)
              );
            }
          );
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

            alert(
              error.message ||
              String(error)
            );
          }
        }
      };


  if (
    $('#addSharedTeacher')
  ) {

    $('#addSharedTeacher')
      .onclick =
        () => {

          addTeacher()
            .catch(
              error => {

                alert(
                  error.message ||
                  String(error)
                );
              }
            );
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
  error => {

    console.error(
      '[Class Manager]',
      error
    );


    alert(
      `Class Manager Error: ${
        error.message ||
        error
      }`
    );
  }
);