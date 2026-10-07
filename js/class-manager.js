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

let classPickerGrade =
  null;


// ==========================================
// STRUCTURED CLASS METADATA
// ==========================================

function classMetadata(
  item
) {

  const name =
    String(
      item?.name ||
      ''
    );


  const nameMatch =
    name.match(
      /([123])年\s*([0-9]{1,2})組/
    );


  const storedGrade =
    Number(
      item?.grade_level
    );


  const storedNumber =
    Number(
      item?.class_number
    );


  const grade =
    Number.isInteger(
      storedGrade
    ) &&
    storedGrade >= 1 &&
    storedGrade <= 3

      ? storedGrade

      : (
          nameMatch
            ? Number(
                nameMatch[1]
              )
            : null
        );


  const number =
    Number.isInteger(
      storedNumber
    ) &&
    storedNumber >= 1

      ? storedNumber

      : (
          nameMatch
            ? Number(
                nameMatch[2]
              )
            : null
        );


  let type =
    String(
      item?.class_type ||
      ''
    );


  if (
    ![
      'regular',
      'english_course',
      'tutor',
      'other'
    ].includes(type)
  ) {

    if (
      /english/i.test(
        name
      )
    ) {

      type =
        'english_course';

    } else if (
      /tutor/i.test(
        name
      )
    ) {

      type =
        'tutor';

    } else if (
      grade &&
      number
    ) {

      type =
        'regular';

    } else {

      type =
        'other';
    }
  }


  return {
    grade,
    number,
    type
  };
}


function classGradeKey(
  item
) {

  const meta =
    classMetadata(
      item
    );


  return meta.grade
    ? String(
        meta.grade
      )
    : 'other';
}


function classTypeOrder(
  type
) {

  return {
    regular: 1,
    english_course: 2,
    tutor: 3,
    other: 4
  }[type] || 9;
}


function compareClasses(
  a,
  b
) {

  const aMeta =
    classMetadata(a);

  const bMeta =
    classMetadata(b);


  const aGrade =
    aMeta.grade ??
    99;

  const bGrade =
    bMeta.grade ??
    99;


  if (
    aGrade !==
    bGrade
  ) {

    return (
      aGrade -
      bGrade
    );
  }


  const aNumber =
    aMeta.number ??
    999;

  const bNumber =
    bMeta.number ??
    999;


  if (
    aNumber !==
    bNumber
  ) {

    return (
      aNumber -
      bNumber
    );
  }


  const typeDifference =
    classTypeOrder(
      aMeta.type
    ) -
    classTypeOrder(
      bMeta.type
    );


  if (
    typeDifference !== 0
  ) {

    return typeDifference;
  }


  return String(
    a.name ||
    ''
  ).localeCompare(
    String(
      b.name ||
      ''
    ),
    'ja'
  );
}


function classPickerLabel(
  item
) {

  const meta =
    classMetadata(
      item
    );


  if (
    meta.grade &&
    meta.number
  ) {

    if (
      meta.type ===
      'english_course'
    ) {

      return `${meta.number}組 · English`;
    }


    return `${meta.number}組`;
  }


  return (
    item?.name ||
    'Class'
  );
}


function gradeTabLabel(
  key
) {

  return key ===
    'other'

      ? 'その他'

      : `${key}年`;
}



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
    await getClient(
      'teacher'
    )
      .from(
        'classes'
      )
      .select(
        '*'
      );


  if (error) {
    throw error;
  }


  classes =
    (
      data ||
      []
    )
      .slice()
      .sort(
        compareClasses
      );


  if (!classes.length) {
    return;
  }


  const preferred =
    requestedClassId();


  activeClass =
    classes.find(
      item =>
        item.id ===
        preferred
    )
    ||
    classes[0];


  classPickerGrade =
    classGradeKey(
      activeClass
    );


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

      badge:
        'New Class',

      badgeType:
        'info',

      title:
        '新しいクラスを作成',

      confirmText:
        'Create Class',

      cancelText:
        'Cancel',

      fields: [

        {
          name:
            'gradeLevel',

          label:
            '学年',

          type:
            'select',

          value:
            '1',

          options: [
            {
              value: '1',
              label: '1年'
            },
            {
              value: '2',
              label: '2年'
            },
            {
              value: '3',
              label: '3年'
            },
            {
              value: 'other',
              label: 'その他'
            }
          ],

          required:
            true
        },

        {
          name:
            'classNumber',

          label:
            '組',

          type:
            'number',

          min:
            1,

          max:
            99,

          placeholder:
            '例：12'
        },

        {
          name:
            'classType',

          label:
            'クラスの種類',

          type:
            'select',

          value:
            'regular',

          options: [
            {
              value: 'regular',
              label: '通常クラス'
            },
            {
              value: 'english_course',
              label: 'English Course'
            },
            {
              value: 'tutor',
              label: 'Tutor'
            },
            {
              value: 'other',
              label: 'その他'
            }
          ],

          required:
            true
        },

        {
          name:
            'className',

          label:
            '表示名（任意）',

          placeholder:
            '通常クラスなら空欄でOK'
        },

        {
          name:
            'academicYear',

          label:
            'Academic Year',

          type:
            'number',

          min:
            2000,

          max:
            2100,

          value:
            String(
              new Date()
                .getFullYear()
            ),

          required:
            true
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

      badge:
        'Check',

      badgeType:
        'danger',

      title:
        '年度を確認してください',

      message:
        'Academic Yearは4桁の西暦で入力してください。'

    });

    return;
  }


  const gradeLevel =
    values.gradeLevel ===
      'other'

      ? null

      : Number(
          values.gradeLevel
        );


  const classNumber =
    values.classNumber

      ? Number(
          values.classNumber
        )

      : null;


  const classType =
    values.classType;


  if (
    classNumber !== null &&
    (
      !Number.isInteger(
        classNumber
      ) ||
      classNumber < 1 ||
      classNumber > 99
    )
  ) {

    await showInfoModal({

      badge:
        'Check',

      badgeType:
        'danger',

      title:
        '組を確認してください',

      message:
        '組は1〜99の数字で入力してください。'

    });

    return;
  }


  if (
    [
      'regular',
      'english_course'
    ].includes(
      classType
    ) &&
    (
      !gradeLevel ||
      !classNumber
    )
  ) {

    await showInfoModal({

      badge:
        'Check',

      badgeType:
        'danger',

      title:
        '学年と組を入力してください',

      message:
        '通常クラスとEnglish Courseでは、学年と組が必要です。'

    });

    return;
  }


  let className =
    values.className
      .trim();


  if (
    !className &&
    gradeLevel &&
    classNumber
  ) {

    className =
      `${gradeLevel}年${classNumber}組`;


    if (
      classType ===
      'english_course'
    ) {

      className +=
        ' English Course';
    }
  }


  if (
    !className &&
    classType ===
      'tutor'
  ) {

    className =
      gradeLevel
        ? `${gradeLevel}年 Tutor Room`
        : 'Tutor Room';
  }


  if (!className) {

    await showInfoModal({

      badge:
        'Check',

      badgeType:
        'danger',

      title:
        '表示名を入力してください',

      message:
        '「その他」のクラスでは表示名を入力してください。'

    });

    return;
  }


  const {
    data,
    error
  } =
    await getClient(
      'teacher'
    )
      .rpc(
        'create_teacher_class_structured',
        {

          p_name:
            className,

          p_academic_year:
            academicYear,

          p_grade_level:
            gradeLevel,

          p_class_number:
            classNumber,

          p_class_type:
            classType

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
    await getClient(
  'teacher'
)
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
      await getClient(
  'teacher'
)
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
    await getClient(
  'teacher'
)
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
// CLASS PICKER
// ==========================================

function renderClassPicker() {

  const tabs =
    $('#teacherClassGradeTabs');

  const grid =
    $('#teacherClassGrid');

  const button =
    $('#teacherClassPickerButton');


  if (
    !tabs ||
    !grid ||
    !button ||
    !activeClass
  ) {
    return;
  }


  const gradeKeys =
    [
      '1',
      '2',
      '3',
      'other'
    ];


  if (
    !gradeKeys.includes(
      classPickerGrade
    )
  ) {

    classPickerGrade =
      classGradeKey(
        activeClass
      );
  }


  const activeOwner =
    activeClass.teacher_id ===
    ctx.user.id;


  button.innerHTML = `
    <span class="class-picker-current">

      <strong>
        ${esc(activeClass.name)}
      </strong>

      <small>
        ${activeOwner ? 'Owner' : 'Shared'}
      </small>

    </span>

    <span class="class-picker-caret">
      ▾
    </span>
  `;


  tabs.innerHTML =
    gradeKeys
      .map(
        key => {

          const count =
            classes.filter(
              item =>
                classGradeKey(
                  item
                ) === key
            ).length;


          return `
            <button
              type="button"
              class="
                class-grade-tab
                ${
                  key === classPickerGrade
                    ? 'active'
                    : ''
                }
              "
              data-class-grade="${key}"
              ${count === 0 ? 'disabled' : ''}>

              ${gradeTabLabel(key)}

              <span>
                ${count}
              </span>

            </button>
          `;
        }
      )
      .join('');


  const visibleClasses =
    classes
      .filter(
        item =>
          classGradeKey(
            item
          ) ===
          classPickerGrade
      )
      .slice()
      .sort(
        compareClasses
      );


  if (!visibleClasses.length) {

    grid.innerHTML =
      '<div class="small muted">この学年のクラスはありません。</div>';

    return;
  }


  grid.innerHTML =
    visibleClasses
      .map(
        item => {

          const owner =
            item.teacher_id ===
            ctx.user.id;


          const active =
            item.id ===
            activeClass.id;


          return `
            <button
              type="button"
              class="
                class-grid-item
                ${active ? 'active' : ''}
              "
              data-class-id="${item.id}"
              title="${esc(item.name)}">

              <span class="class-grid-name">
                ${esc(
                  classPickerLabel(
                    item
                  )
                )}
              </span>

              <span
                class="
                  class-grid-role
                  ${owner ? 'owner' : 'shared'}
                ">

                ${owner ? 'Owner' : 'Shared'}

              </span>

            </button>
          `;
        }
      )
      .join('');
}


function setClassPickerOpen(
  open
) {

  const panel =
    $('#teacherClassPickerPanel');

  const button =
    $('#teacherClassPickerButton');


  if (
    !panel ||
    !button
  ) {
    return;
  }


  panel.classList.toggle(
    'hidden',
    !open
  );


  button.classList.toggle(
    'open',
    open
  );


  button.setAttribute(
    'aria-expanded',
    open
      ? 'true'
      : 'false'
  );
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


  section.dataset.platformPage =
    'overview';


  section.innerHTML = `

    <div class="class-manager-main">

      <div class="class-selector-area">

        <div class="eyebrow">
          My Classes
        </div>


        <button
          id="teacherClassPickerButton"
          type="button"
          class="class-picker-button"
          aria-expanded="false">

          ${esc(activeClass.name)}

          <span class="class-picker-caret">
            ▾
          </span>

        </button>


        <div
          id="teacherClassPickerPanel"
          class="class-picker-panel hidden">

          <div
            id="teacherClassGradeTabs"
            class="class-grade-tabs">
          </div>


          <div
            id="teacherClassGrid"
            class="class-grid">
          </div>

        </div>

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


  renderClassPicker();


  $('#teacherClassPickerButton')
    .onclick =
      () => {

        const panel =
          $('#teacherClassPickerPanel');


        setClassPickerOpen(
          panel.classList.contains(
            'hidden'
          )
        );
      };


  $('#teacherClassGradeTabs')
    .onclick =
      event => {

        const tab =
          event.target.closest(
            '[data-class-grade]'
          );


        if (
          !tab ||
          tab.disabled
        ) {
          return;
        }


        classPickerGrade =
          tab.dataset.classGrade;


        renderClassPicker();
      };


  $('#teacherClassGrid')
    .onclick =
      event => {

        const classButton =
          event.target.closest(
            '[data-class-id]'
          );


        if (!classButton) {
          return;
        }


        moveToClass(
          classButton.dataset.classId
        );
      };


  document.addEventListener(
    'click',
    event => {

      if (
        !section.contains(
          event.target
        )
      ) {

        setClassPickerOpen(
          false
        );
      }
    }
  );


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