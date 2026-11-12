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

let activeClass = null;

let roster = [];


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


function createPin() {

  const array =
    new Uint32Array(1);

  crypto.getRandomValues(
    array
  );

  return String(
    100000 +
    (
      array[0] %
      900000
    )
  );
}


function sortRoster(rows) {

  return [...rows].sort(
    (a, b) =>
      String(
        a.student_number
      ).localeCompare(
        String(
          b.student_number
        ),
        undefined,
        {
          numeric: true
        }
      )
  );
}


// ==========================================
// TOP ACTIONS
// ==========================================

function setupRosterToolbar() {

  const addButton =
    $('#toggleRosterImport');


  if (
    !addButton ||
    $('#exportRoster')
  ) {

    return;
  }


  const wrapper =
    document.createElement(
      'div'
    );


  wrapper.className =
    'roster-top-actions';


  addButton.parentNode.insertBefore(
    wrapper,
    addButton
  );


  wrapper.appendChild(
    addButton
  );


  // -----------------------------------------
  // PRINT LOGIN CARDS
  // -----------------------------------------

  const printButton =
    document.createElement(
      'button'
    );


  printButton.id =
    'printRosterCards';


  printButton.className =
    'btn btn-light';


  printButton.textContent =
    'Print Login Cards';


  wrapper.appendChild(
    printButton
  );


  printButton.onclick =
    printLoginCards;


  // -----------------------------------------
  // EXPORT CSV
  // -----------------------------------------

  const exportButton =
    document.createElement(
      'button'
    );


  exportButton.id =
    'exportRoster';


  exportButton.className =
    'btn btn-light';


  exportButton.textContent =
    'Export CSV';


  wrapper.appendChild(
    exportButton
  );


  exportButton.onclick =
    exportRosterCsv;


  // -----------------------------------------
  // CLEAR ROSTER
  // -----------------------------------------

  const clearButton =
    document.createElement(
      'button'
    );


  clearButton.id =
    'clearRoster';


  clearButton.className =
    'btn btn-danger';


  clearButton.textContent =
    'Clear Roster';


  clearButton.disabled =
    roster.length === 0;


  wrapper.appendChild(
    clearButton
  );


  clearButton.onclick =
    clearEntireRoster;
}

// ==========================================
// RENDER
// ==========================================

function renderRoster() {

  const total =
    roster.length;

    const clearButton =
    $('#clearRoster');


  if (clearButton) {

    clearButton.disabled =
      total === 0;
  }

  const joined =
    roster.filter(
      student =>
        Boolean(
          student.linked_student_id
        )
    ).length;


  $('#rosterTotal').textContent =
    total;


  $('#rosterJoined').textContent =
    joined;


  $('#rosterWaiting').textContent =
    total - joined;


  const body =
    $('#rosterBody');


  if (!body) {

    return;
  }


  if (!total) {

    body.innerHTML = `
      <tr>

        <td colspan="5">

          <div class="roster-empty">
            まだ名簿が登録されていません。
          </div>

        </td>

      </tr>
    `;

    return;
  }


  body.innerHTML =
    sortRoster(
      roster
    )
      .map(
        student => {

          const joined =
            Boolean(
              student.linked_student_id
            );


          return `
            <tr
              class="roster-project-row"
              data-roster-project-id="${student.id}"
              tabindex="0"
              title="クリックしてログイン情報を大きく表示">

              <td>

                <strong>
                  ${esc(
                    student.student_number
                  )}
                </strong>

              </td>


              <td class="roster-name">

                ${esc(
                  student.display_name
                )}

              </td>


              <td>

                <span class="join-pin">

                  ${esc(
                    student.join_pin
                  )}

                </span>

              </td>


              <td>

                <span
                  class="
                    roster-status
                    ${
                      joined
                        ? 'joined'
                        : 'waiting'
                    }
                  ">

                  ${
                    joined
                      ? '✓ Joined'
                      : 'Waiting'
                  }

                </span>

              </td>


              <td>

                <div class="roster-actions">

                  <button
                    class="btn btn-sm btn-primary"
                    data-roster-action="project"
                    data-roster-id="${student.id}"
                    title="ログイン情報を大きく表示">

                    🖥 Project

                  </button>


                  <button
                    class="btn btn-sm btn-light"
                    data-roster-action="copy"
                    data-roster-id="${student.id}">

                    Copy

                  </button>


                  <button
                    class="btn btn-sm btn-light"
                    data-roster-action="edit"
                    data-roster-id="${student.id}">

                    Edit

                  </button>


                  <button
                    class="btn btn-sm btn-light"
                    data-roster-action="pin"
                    data-roster-id="${student.id}">

                    New PIN

                  </button>


                  <button
  class="btn btn-sm btn-danger"
  data-roster-action="delete"
  data-roster-id="${student.id}">

  Delete

</button>

                </div>

              </td>

            </tr>
          `;
        }
      )
      .join('');
}


// ==========================================
// LOAD
// ==========================================

async function loadRoster() {

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
      .from(
        'class_roster'
      )
      .select('*')
      .eq(
        'class_id',
        activeClass.id
      );


  if (error) {

    throw error;
  }


  roster =
    data || [];


  renderRoster();
}


// ==========================================
// IMPORT PARSER
// ==========================================

function nextAutoNumber() {

  const numbers =
    roster
      .map(
        student =>
          Number(
            student.student_number
          )
      )
      .filter(
        Number.isFinite
      );


  return numbers.length
    ? Math.max(...numbers) + 1
    : 1;
}


function parseRosterText(text) {

  const lines =
    text
      .split(/\r?\n/)
      .map(
        line =>
          line.trim()
      )
      .filter(Boolean);


  const existing =
    new Set(
      roster.map(
        student =>
          String(
            student.student_number
          ).trim()
      )
    );


  const used =
    new Set();


  let autoNumber =
    nextAutoNumber();


  const rows = [];


  for (
    const line
    of lines
  ) {

    let studentNumber = '';

    let displayName = '';


    if (
      line.includes('\t')
    ) {

      const parts =
        line.split('\t');


      studentNumber =
        String(
          parts.shift() || ''
        ).trim();


      displayName =
        parts
          .join(' ')
          .trim();

    } else if (
      line.includes(',')
    ) {

      const parts =
        line.split(',');


      studentNumber =
        String(
          parts.shift() || ''
        ).trim();


      displayName =
        parts
          .join(',')
          .trim();

    } else {

      studentNumber =
        String(
          autoNumber++
        );


      displayName =
        line;
    }


    if (
      !studentNumber ||
      !displayName
    ) {

      continue;
    }


    if (
      existing.has(
        studentNumber
      ) ||
      used.has(
        studentNumber
      )
    ) {

      continue;
    }


    used.add(
      studentNumber
    );


    rows.push({

      class_id:
        activeClass.id,

      student_number:
        studentNumber,

      display_name:
        displayName,

      join_pin:
        createPin()

    });
  }


  return rows;
}


// ==========================================
// IMPORT
// ==========================================

async function importRoster() {

  const textarea =
    $('#rosterPaste');


  const message =
    $('#rosterImportMsg');


  const text =
    textarea.value.trim();


  message.textContent = '';


  if (!text) {

    message.textContent =
      '生徒名簿を貼り付けてください。';

    return;
  }


  const rows =
    parseRosterText(
      text
    );


  if (!rows.length) {

    message.textContent =
      '新しく登録できる生徒がありません。';

    return;
  }


  const button =
    $('#importRoster');


  button.disabled =
    true;


  button.textContent =
    'Importing...';


  try {

    const {
      error
    } =
      await getClient(
  'teacher'
)
        .from(
          'class_roster'
        )
        .insert(
          rows
        );


    if (error) {

      throw error;
    }


    textarea.value = '';


    $('#rosterImportPanel')
      .classList
      .add(
        'hidden'
      );


    await loadRoster();


    await showInfoModal({

  badge:
    'Imported',

  badgeType:
    'info',

  title:
    '生徒を登録しました',

  message:
    `${rows.length}名の生徒をRosterに追加しました。`

});



  } catch (error) {

    message.textContent =
      error.message ||
      String(error);


  } finally {

    button.disabled =
      false;


    button.textContent =
      'Import Students';
  }
}


// ==========================================
// ROSTER LOGIN PROJECTOR v1
// ==========================================

let rosterProjectorStudentId =
  null;


let rosterProjectorPinVisible = false;


function rosterProjectorStudents() {

  return sortRoster(
    roster
  );
}


function currentRosterProjectorStudent() {

  return roster.find(
    student =>
      student.id ===
      rosterProjectorStudentId
  ) || null;
}


function ensureRosterProjector() {

  let root =
    $('#rosterLoginProjector');


  if (root) {
    return root;
  }


  root =
    document.createElement(
      'div'
    );


  root.id =
    'rosterLoginProjector';


  root.className =
    'roster-login-projector';


  root.setAttribute(
    'aria-hidden',
    'true'
  );


  document.body.appendChild(
    root
  );


  root.addEventListener(
    'click',
    async event => {

      const action =
        event.target.closest(
          '[data-roster-projector-action]'
        )
        ?.dataset
        .rosterProjectorAction;


      if (!action) {
        return;
      }


      if (action === 'close') {

        await closeRosterProjector();
        return;
      }


      if (action === 'prev') {

        shiftRosterProjector(
          -1
        );

        return;
      }


      if (action === 'next') {

        shiftRosterProjector(
          1
        );

        return;
      }


      if (action === 'pin') {

        rosterProjectorPinVisible =
          !rosterProjectorPinVisible;


        renderRosterProjector();

        return;
      }


      if (action === 'fullscreen') {

        await toggleRosterProjectorFullscreen();
      }
    }
  );


  return root;
}


function renderRosterProjector() {

  const root =
    ensureRosterProjector();


  const student =
    currentRosterProjectorStudent();


  if (
    !student ||
    !activeClass
  ) {

    return;
  }


  const ordered =
    rosterProjectorStudents();


  const index =
    ordered.findIndex(
      item =>
        item.id ===
        student.id
    );


  const hasMultiple =
    ordered.length > 1;


  const className =
    activeClass.name ||
    'Class';


  const classCode =
    activeClass.class_code ||
    '------';


  const studentNumber =
    student.student_number ||
    '—';


  const pin =
    rosterProjectorPinVisible

      ? student.join_pin

      : '••••••';


  const fullscreen =
    document.fullscreenElement ===
    root;


  root.innerHTML = `
    <div class="roster-projector-stage">

      <div class="roster-projector-top">

        <div class="roster-projector-brand">

          <div class="roster-projector-brand-mark">
            C
          </div>

          <div>

            <strong>
              Copeak Classroom
            </strong>

            <span>
              LOGIN HELP
            </span>

          </div>

        </div>


        <button
          type="button"
          class="roster-projector-close"
          data-roster-projector-action="close"
          aria-label="閉じる">

          ✕

        </button>

      </div>


      <main class="roster-projector-card">

        <div class="roster-projector-class">
          ${esc(className)}
        </div>


        <div class="roster-projector-student-label">
          STUDENT
        </div>


        <h1>
          ${esc(
            student.display_name
          )}
        </h1>


        <div class="roster-projector-login-grid">


          <section class="roster-projector-value class-code">

            <span>
              CLASS CODE
            </span>

            <strong>
              ${esc(classCode)}
            </strong>

          </section>


          <section class="roster-projector-value student-no">

            <span>
              STUDENT NO.
            </span>

            <strong>
              ${esc(studentNumber)}
            </strong>

          </section>


          <section class="roster-projector-value pin">

            <span>
              JOIN PIN
            </span>

            <strong>
              ${esc(pin)}
            </strong>

          </section>


        </div>


        <div class="roster-projector-url">

          <span>
            LOGIN
          </span>

          <strong>
            cc.pic-speak-story.com
          </strong>

        </div>


        <div class="roster-projector-guide">

          Class Code → Student No. → Join PIN の順に入力してください

        </div>

      </main>


      <div class="roster-projector-controls">


        <button
          type="button"
          class="roster-projector-control secondary"
          data-roster-projector-action="prev"
          ${hasMultiple ? '' : 'disabled'}>

          ← 前の生徒

        </button>


        <div class="roster-projector-position">

          ${
            index >= 0
              ? `${index + 1} / ${ordered.length}`
              : ''
          }

        </div>


        <button
          type="button"
          class="roster-projector-control"
          data-roster-projector-action="pin">

          ${
            rosterProjectorPinVisible
              ? '🔒 PINを隠す'
              : '👁 PINを表示'
          }

        </button>


        <button
          type="button"
          class="roster-projector-control"
          data-roster-projector-action="fullscreen">

          ${
            fullscreen
              ? '↙ 全画面を終了'
              : '⛶ フルスクリーン'
          }

        </button>


        <button
          type="button"
          class="roster-projector-control secondary"
          data-roster-projector-action="next"
          ${hasMultiple ? '' : 'disabled'}>

          次の生徒 →

        </button>


      </div>

    </div>
  `;
}


function openRosterProjector(
  student
) {

  if (
    !student ||
    !activeClass
  ) {
    return;
  }


  rosterProjectorStudentId =
    student.id;


  rosterProjectorPinVisible = false;


  const root =
    ensureRosterProjector();


  root.classList.add(
    'open'
  );


  root.setAttribute(
    'aria-hidden',
    'false'
  );


  document.body.classList.add(
    'roster-projector-open'
  );


  renderRosterProjector();
}


async function closeRosterProjector() {

  const root =
    $('#rosterLoginProjector');


  if (!root) {
    return;
  }


  if (
    document.fullscreenElement ===
      root &&
    typeof document.exitFullscreen ===
      'function'
  ) {

    try {

      await document.exitFullscreen();

    } catch (error) {

      console.warn(
        '[Roster Projector] fullscreen exit failed',
        error
      );
    }
  }


  root.classList.remove(
    'open'
  );


  root.setAttribute(
    'aria-hidden',
    'true'
  );


  document.body.classList.remove(
    'roster-projector-open'
  );


  rosterProjectorStudentId =
    null;
}


function shiftRosterProjector(
  direction
) {

  const ordered =
    rosterProjectorStudents();


  if (!ordered.length) {
    return;
  }


  let index =
    ordered.findIndex(
      student =>
        student.id ===
        rosterProjectorStudentId
    );


  if (index < 0) {
    index = 0;
  }


  index =
    (
      index +
      direction +
      ordered.length
    ) %
    ordered.length;


  rosterProjectorStudentId =
    ordered[index].id;


  rosterProjectorPinVisible = false;


  renderRosterProjector();
}


async function toggleRosterProjectorFullscreen() {

  const root =
    $('#rosterLoginProjector');


  if (!root) {
    return;
  }


  if (
    document.fullscreenElement ===
    root
  ) {

    if (
      typeof document.exitFullscreen ===
      'function'
    ) {

      await document.exitFullscreen();
    }


    return;
  }


  if (
    typeof root.requestFullscreen ===
    'function'
  ) {

    try {

      await root.requestFullscreen({
        navigationUI:
          'hide'
      });

    } catch (error) {

      console.warn(
        '[Roster Projector] fullscreen unavailable',
        error
      );
    }
  }
}


function handleRosterProjectorRowClick(
  event
) {

  if (
    event.target.closest(
      '[data-roster-action]'
    )
  ) {

    return;
  }


  const row =
    event.target.closest(
      '[data-roster-project-id]'
    );


  if (!row) {
    return;
  }


  const student =
    roster.find(
      item =>
        item.id ===
        row.dataset
          .rosterProjectId
    );


  if (student) {

    openRosterProjector(
      student
    );
  }
}


function handleRosterProjectorKeydown(
  event
) {

  const row =
    event.target.closest(
      '[data-roster-project-id]'
    );


  if (
    row &&
    (
      event.key ===
        'Enter' ||
      event.key ===
        ' '
    ) &&
    !event.target.closest(
      '[data-roster-action]'
    )
  ) {

    event.preventDefault();


    const student =
      roster.find(
        item =>
          item.id ===
          row.dataset
            .rosterProjectId
      );


    if (student) {

      openRosterProjector(
        student
      );
    }


    return;
  }


  if (
    !$('#rosterLoginProjector')
      ?.classList
      .contains(
        'open'
      )
  ) {

    return;
  }


  if (
    event.key ===
    'ArrowLeft'
  ) {

    shiftRosterProjector(
      -1
    );

  } else if (
    event.key ===
    'ArrowRight'
  ) {

    shiftRosterProjector(
      1
    );

  } else if (
    event.key ===
    'Escape'
  ) {

    if (
      document.fullscreenElement
    ) {

      return;
    }


    closeRosterProjector();
  }
}


document.addEventListener(
  'fullscreenchange',
  () => {

    if (
      $('#rosterLoginProjector')
        ?.classList
        .contains(
          'open'
        )
    ) {

      renderRosterProjector();
    }
  }
);


// ==========================================// ==========================================
// COPY
// ==========================================

async function copyJoinInfo(
  student
) {

  const text =
`Copeak Classroom

Name: ${student.display_name}
Class Code: ${activeClass.class_code}
Student No.: ${student.student_number}
Join PIN: ${student.join_pin}

https://cc.pic-speak-story.com`;


  try {

    await navigator
      .clipboard
      .writeText(
        text
      );


    await showInfoModal({

  badge:
    'Copied',

  badgeType:
    'info',

  title:
    'ログイン情報をコピーしました',

  message:
    `${student.display_name} のログイン情報をクリップボードにコピーしました。`

});


  } catch {

  await showInfoModal({

    badge:
      'Copy Failed',

    badgeType:
      'danger',

    title:
      'コピーできませんでした',

    message:
      `ブラウザがクリップボードへのアクセスを許可していません。

${text}`

  });
}

}

// ==========================================
// EDIT STUDENT
// ==========================================

async function editRosterStudent(
  student
) {

  const values =
    await showFormModal({

      badge:
        'Edit Student',

      badgeType:
        'info',

      title:
        '生徒情報を編集',

      confirmText:
        'Save',

      cancelText:
        'Cancel',

      fields: [
        {
          name:
            'studentNumber',

          label:
            'Student No.',

          value:
            student.student_number,

          required:
            true
        },
        {
          name:
            'displayName',

          label:
            'Student Name',

          value:
            student.display_name,

          required:
            true
        }
      ]
    });


  if (!values) {

    return;
  }


  const {
    error
  } =
    await getClient(
  'teacher'
)
      .rpc(
        'teacher_update_roster_student',
        {

          p_roster_id:
            student.id,

          p_student_number:
            values.studentNumber,

          p_display_name:
            values.displayName

        }
      );


  if (error) {

    throw error;
  }


  await loadRoster();


  await showInfoModal({

    badge:
      'Updated',

    badgeType:
      'info',

    title:
      '更新しました',

    message:
      `${values.displayName} の生徒情報を更新しました。`

  });
}

// ==========================================
// REGENERATE PIN
// ==========================================

async function regeneratePin(
  student
) {

  const ok =
    await showConfirmModal({

      badge:
        'New PIN',

      badgeType:
        'danger',

      title:
        'Join PINを再発行しますか？',

      message:
        `「${student.display_name}」のJoin PINを再発行します。

古いPINは使用できなくなります。`,

      confirmText:
        'Generate New PIN',

      cancelText:
        'Cancel',

      confirmVariant:
        'danger'

    });


  if (!ok) {

    return;
  }


  const newPin =
    createPin();


  const {
    error
  } =
    await getClient(
  'teacher'
)
      .from(
        'class_roster'
      )
      .update({

        join_pin:
          newPin

      })
      .eq(
        'id',
        student.id
      )
      .eq(
        'class_id',
        activeClass.id
      );


  if (error) {

    throw error;
  }


  await loadRoster();


  await showInfoModal({

    badge:
      'PIN Updated',

    badgeType:
      'info',

    title:
      '新しいJoin PIN',

    message:
      `${student.display_name}

${newPin}

古いPINは使用できません。`

  });
}

// ==========================================
// DELETE
// ==========================================

async function deleteRosterStudent(
  student
) {

  const joined =
    Boolean(
      student.linked_student_id
    );


  const message =
    joined
      ? `「${student.display_name}」を削除しますか？

この生徒はJoined済みです。

・このクラスから生徒を削除
・このクラスの提出データを削除
・Rosterから削除

この操作は元に戻せません。`
      : `「${student.display_name}」を名簿から削除しますか？

この操作は元に戻せません。`;


  const ok =
    await showConfirmModal({

      badge:
        'Delete Student',

      badgeType:
        'danger',

      title:
        `${student.display_name} を削除しますか？`,

      message,

      confirmText:
        'Delete',

      cancelText:
        'Cancel'

    });


  if (!ok) {

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
        'teacher_delete_roster_student',
        {
          p_roster_id:
            student.id
        }
      );


  if (error) {

    throw error;
  }


  await loadRoster();


  const deletedSubmissions =
    Number(data || 0);


  if (joined) {

    await showInfoModal({

      badge:
        'Deleted',

      badgeType:
        'info',

      title:
        '削除が完了しました',

      message:
        `${student.display_name} を削除しました。\n\n提出データ ${deletedSubmissions} 件を削除しました。`,

      confirmText:
        'OK'

    });

  } else {

    await showInfoModal({

      badge:
        'Deleted',

      badgeType:
        'info',

      title:
        '削除が完了しました',

      message:
        `${student.display_name} を削除しました。`,

      confirmText:
        'OK'

    });
  }
}

// ==========================================
// CLEAR ENTIRE ROSTER
// ==========================================

async function clearEntireRoster() {

  if (
    !activeClass ||
    !roster.length
  ) {

    await showInfoModal({

      badge:
        'Roster',

      badgeType:
        'info',

      title:
        '削除する生徒がいません',

      message:
        'Rosterはすでに空です。'

    });

    return;
  }


  const total =
    roster.length;


  const joined =
    roster.filter(
      student =>
        Boolean(
          student.linked_student_id
        )
    ).length;


  const waiting =
    total -
    joined;


  const message =
    joined > 0

      ? `「${activeClass.name}」のRosterを全員削除します。

Registered: ${total}名
Joined: ${joined}名
Waiting: ${waiting}名

Joined済みの生徒については、
・このクラスへの参加情報
・このクラスの提出データ
・Roster登録

も削除されます。

生徒のアカウント自体は削除されません。

この操作は元に戻せません。`

      : `「${activeClass.name}」のRosterを全員削除します。

Registered: ${total}名
Waiting: ${waiting}名

現在のRoster登録をすべて削除します。

この操作は元に戻せません。`;


  const ok =
    await showConfirmModal({

      badge:
        'Clear Roster',

      badgeType:
        'danger',

      title:
        `${total}名を一括削除しますか？`,

      message,

      confirmText:
        'Delete All Students',

      cancelText:
        'Cancel',

      confirmVariant:
        'danger'

    });


  if (!ok) {

    return;
  }


  const button =
    $('#clearRoster');


  if (button) {

    button.disabled =
      true;

    button.textContent =
      'Deleting...';
  }


  try {

    const {
      data,
      error
    } =
      await getClient(
  'teacher'
)
        .rpc(
          'teacher_clear_class_roster',
          {

            p_class_id:
              activeClass.id

          }
        );


    if (error) {

      throw error;
    }


    await loadRoster();


    const result =
      data || {};


    await showInfoModal({

      badge:
        'Roster Cleared',

      badgeType:
        'info',

      title:
        'Rosterを削除しました',

      message:
        `${result.roster_count || total}名をRosterから削除しました。

Joined: ${result.joined_count || 0}名
削除した提出データ: ${result.submission_count || 0}件

生徒アカウント自体は削除されていません。`

    });


  } catch (error) {

    console.error(
      '[Clear Roster]',
      error
    );


    await showInfoModal({

      badge:
        'Error',

      badgeType:
        'danger',

      title:
        'Rosterを削除できませんでした',

      message:
        error.message ||
        String(error)

    });


  } finally {

    if (button) {

      button.textContent =
        'Clear Roster';

      button.disabled =
        roster.length === 0;
    }
  }
}

// ==========================================
// CSV EXPORT
// ==========================================

function csvValue(value) {

  return `"${String(
    value ?? ''
  ).replace(
    /"/g,
    '""'
  )}"`;
}

// ==========================================
// PRINT LOGIN CARDS
// ==========================================


const CLASSROOM_LOGIN_CARD_URL =
  'https://cc.pic-speak-story.com/';

let loginCardQrLibraryPromise = null;

// Generate one QR image locally and reuse it on every printed student card.
// PIN, student number and class code are NEVER encoded in this QR.
async function getLoginCardQrDataUrl() {
  if (typeof window.QRCode !== 'function') {
    if (!loginCardQrLibraryPromise) {
      loginCardQrLibraryPromise = (async () => {
        const cdns = [
          'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js',
          'https://unpkg.com/qrcodejs@1.0.0/qrcode.min.js'
        ];
        for (const url of cdns) {
          try {
            await new Promise((resolve, reject) => {
              const script = document.createElement('script');
              script.src = url;
              script.async = true;
              script.onload = () => {
                if (typeof window.QRCode === 'function') resolve();
                else { script.remove(); reject(new Error('QR library missing')); }
              };
              script.onerror = () => {
                script.remove();
                reject(new Error('QR library download failed'));
              };
              document.head.appendChild(script);
            });
            return;
          } catch (_) {
            // Try the fallback CDN before reporting a printable-card error.
          }
        }
        throw new Error('QRコードライブラリを読み込めませんでした。通信環境をご確認ください。');
      })().catch(error => {
        loginCardQrLibraryPromise = null;
        throw error;
      });
    }
    await loginCardQrLibraryPromise;
  }

  const holder = document.createElement('div');
  holder.setAttribute('aria-hidden', 'true');
  holder.style.cssText =
    'position:fixed;left:-10000px;top:-10000px;visibility:hidden;';
  document.body.appendChild(holder);
  try {
    new window.QRCode(holder, {
      text: CLASSROOM_LOGIN_CARD_URL,
      width: 256,
      height: 256,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: window.QRCode.CorrectLevel.M
    });
    const canvas = holder.querySelector('canvas');
    const image = holder.querySelector('img');
    const dataUrl =
      canvas?.toDataURL('image/png') ||
      image?.src ||
      '';
    if (!dataUrl.startsWith('data:image/png;base64,')) {
      throw new Error('QRコード画像を作成できませんでした。');
    }
    return dataUrl;
  } finally {
    holder.remove();
  }
}

async function printLoginCards() {

  if (!roster.length) {

    await showInfoModal({

  badge:
    'Roster',

  badgeType:
    'info',

  title:
    '名簿がありません',

  message:
    '先に生徒をRosterへ登録してください。'

});

    return;
  }


  const students =
    sortRoster(
      roster
    );

  // Open immediately during the click event so iPad Safari does not
  // mistake the print window for an asynchronously opened popup.
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    await showInfoModal({
      badge: 'Print',
      badgeType: 'danger',
      title: '印刷画面を開けませんでした',
      message: 'ブラウザのポップアップを許可してから、もう一度Print Login Cardsを押してください。'
    });
    return;
  }

  printWindow.document.write('<!doctype html><html lang="ja"><meta charset="utf-8"><title>Login Cards</title><body><p>QRコード付きログインカードを準備しています…</p></body></html>');
  printWindow.document.close();

  let qrDataUrl;
  try {
    qrDataUrl = await getLoginCardQrDataUrl();
  } catch (error) {
    printWindow.document.open();
    printWindow.document.write('<!doctype html><html lang="ja"><meta charset="utf-8"><title>QR Error</title><body><p>QRコードを作成できませんでした。通信環境を確認してから再度お試しください。</p></body></html>');
    printWindow.document.close();
    await showInfoModal({
      badge: 'Print',
      badgeType: 'danger',
      title: 'QRコードを作成できませんでした',
      message: error.message || String(error)
    });
    return;
  }

  const cards =
    students
      .map(
        student => `
          <div class="login-card">

            <div class="card-header">
              <div class="card-heading">
                <div class="brand">
                  Copeak Classroom
                </div>

                <div class="class-name">
              ${esc(activeClass.name || '')}
            </div>

                <div class="student-name">
                  ${esc(student.display_name)}
                </div>
              </div>

              <div class="qr-box">
                <img src="${qrDataUrl}"
                  alt="Copeak ClassroomログインQRコード"
                  width="256" height="256">
              </div>
            </div>

            <div class="login-row">
              <span>Student No.</span>
              <strong>
                ${esc(student.student_number)}
              </strong>
            </div>

            <div class="login-row">
              <span>Class Code</span>
              <strong>
                ${esc(activeClass.class_code)}
              </strong>
            </div>

            <div class="login-row pin-row">
              <span>Join PIN</span>
              <strong>
                ${esc(student.join_pin)}
              </strong>
            </div>

            <div class="url">
              cc.pic-speak-story.com
              <span>・QRを読み取ってログイン</span>
            </div>

          </div>
        `
      )
      .join('');


  printWindow.document.open();
  printWindow.document.write(`
<!DOCTYPE html>

<html lang="ja">

<head>

<meta charset="UTF-8">

<title>
  ${esc(activeClass.name || 'Class')}
  - Login Cards
</title>

<style>

@page {
  size: A4 portrait;
  margin: 8mm;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family:
    Arial,
    "Noto Sans JP",
    sans-serif;
  color: #111827;
}

.page {
  display: grid;
  grid-template-columns:
    repeat(2, minmax(0, 1fr));
  gap: 4mm;
}

.login-card {
  min-height: 60mm;
  border: 1px solid #b8c0cc;
  border-radius: 8px;
  padding: 5mm;
  break-inside: avoid;
  page-break-inside: avoid;
  position: relative;
}
.card-header {
  display: flex;
  align-items: flex-start;
  gap: 3mm;
  min-height: 27mm;
}
.card-heading {
  min-width: 0;
  flex: 1 1 auto;
}
.qr-box {
  /* Around four QR modules of white quiet zone on each edge. */
  flex: 0 0 27mm;
  width: 27mm;
  height: 27mm;
  background: #ffffff;
  padding: 3mm;
  border: 0;
}
.qr-box img {
  display: block;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}
.print-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 10px 14px;
  margin-bottom: 10px;
}
.print-actions button {
  font-size: 14px;
  padding: 8px 14px;
  cursor: pointer;
}

.brand {
  font-size: 14px;
  font-weight: 800;
  color: #1d4ed8;
  margin-bottom: 2px;
}

.class-name {
  font-size: 12px;
  color: #4b5563;
  margin-bottom: 3px;
}

.student-name {
  font-size: 18px;
  font-weight: 800;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.login-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid #e5e7eb;
  padding: 3px 0;
  font-size: 12px;
  gap: 6px;
}

.login-row strong {
  font-size: 16px;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.pin-row strong {
  font-size: 20px;
  letter-spacing: 2px;
}

.url {
  margin-top: 4px;
  text-align: center;
  font-size: 10px;
  color: #4b5563;
}
.url span {
  display: inline-block;
  margin-left: 4px;
}

@media print {
  .print-actions { display: none !important; }
  .page { gap: 4mm; }
}

</style>

</head>

<body>

<div class="print-actions">
  <button type="button" onclick="window.print()">印刷する / Print</button>
  <span>各カードのQRコードからCopeak Classroomのログイン画面にアクセスできます。</span>
</div>

<div class="page">

  ${cards}

</div>

<script>

window.addEventListener('load', () => {
  // Embedded PNGs are ready before opening the print dialog.
  const ready = Array.from(document.images).map(img => {
    if (img.decode) return img.decode().catch(() => undefined);
    if (img.complete) return Promise.resolve();
    return new Promise(resolve => {
      img.onload = resolve;
      img.onerror = resolve;
    });
  });
  Promise.all(ready).then(() => setTimeout(() => window.print(), 150));
});

<\/script>

</body>

</html>
  `);


  printWindow.document.close();
}

async function exportRosterCsv() {

  if (!roster.length) {

    await showInfoModal({

  badge:
    'Export',

  badgeType:
    'info',

  title:
    'Exportするデータがありません',

  message:
    '先に生徒をRosterへ登録してください。'

});

    return;
  }


  const header = [

    'Student No.',
    'Student',
    'Class Code',
    'Join PIN',
    'Status'

  ];


  const rows =
    sortRoster(
      roster
    ).map(
      student => [

        student.student_number,

        student.display_name,

        activeClass.class_code,

        student.join_pin,

        student.linked_student_id
          ? 'Joined'
          : 'Waiting'

      ]
    );


  const csv =
    [
      header,
      ...rows
    ]
      .map(
        row =>
          row
            .map(csvValue)
            .join(',')
      )
      .join('\r\n');


  // Excelで日本語文字化けしにくいUTF-8 BOM
  const blob =
    new Blob(
      [
        '\uFEFF',
        csv
      ],
      {
        type:
          'text/csv;charset=utf-8'
      }
    );


  const url =
    URL.createObjectURL(
      blob
    );


  const a =
    document.createElement(
      'a'
    );


  const safeClassName =
    String(
      activeClass.name ||
      'class'
    ).replace(
      /[\\/:*?"<>|]/g,
      '_'
    );


  a.href =
    url;


  a.download =
    `${safeClassName}_roster.csv`;


  document.body.appendChild(
    a
  );


  a.click();


  a.remove();


  URL.revokeObjectURL(
    url
  );
}


// ==========================================
// ACTION
// ==========================================

async function handleRosterAction(
  event
) {

  const button =
    event.target.closest(
      '[data-roster-action]'
    );


  if (!button) {

    return;
  }


  const student =
    roster.find(
      item =>
        item.id ===
        button.dataset.rosterId
    );


  if (!student) {

    return;
  }


  try {

    const action =
      button.dataset.rosterAction;


    if (
      action === 'project'
    ) {

      openRosterProjector(
        student
      );

    } else if (
      action === 'copy'
    ) {

      await copyJoinInfo(
        student
      );

    } else if (
      action === 'edit'
    ) {

      await editRosterStudent(
        student
      );

    } else if (
      action === 'pin'
    ) {

      await regeneratePin(
        student
      );

    } else if (
      action === 'delete'
    ) {

      await deleteRosterStudent(
        student
      );
    }


  } catch (error) {

    console.error(
      '[Roster]',
      error
    );


    await showInfoModal({

  badge:
    'Error',

  badgeType:
    'danger',

  title:
    '処理を完了できませんでした',

  message:
    error.message ||
    String(error)

});
  }
}


// ==========================================
// EVENTS
// ==========================================

function bindEvents() {

  setupRosterToolbar();


  $('#toggleRosterImport')
    ?.addEventListener(
      'click',
      () => {

        const panel =
          $('#rosterImportPanel');


        panel.classList.toggle(
          'hidden'
        );


        if (
          !panel.classList.contains(
            'hidden'
          )
        ) {

          $('#rosterPaste')
            ?.focus();
        }
      }
    );


  $('#cancelRosterImport')
    ?.addEventListener(
      'click',
      () => {

        $('#rosterImportPanel')
          .classList
          .add(
            'hidden'
          );


        $('#rosterImportMsg')
          .textContent = '';
      }
    );


  $('#importRoster')
    ?.addEventListener(
      'click',
      importRoster
    );


  $('#rosterBody')
    ?.addEventListener(
      'click',
      handleRosterAction
    );


  $('#rosterBody')
    ?.addEventListener(
      'click',
      handleRosterProjectorRowClick
    );



  document.addEventListener(
    'keydown',
    handleRosterProjectorKeydown
  );
}


// ==========================================
// CLASS
// ==========================================

async function loadTeacherClass() {

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
        'id,name,class_code,teacher_id,created_at'
      )
      .order(
        'created_at',
        {
          ascending: true
        }
      );


  if (error) {

    throw error;
  }


  const availableClasses =
    data || [];


  const requestedId =
    new URLSearchParams(
      location.search
    ).get(
      'class'
    )
    ||
    localStorage.getItem(
      'copeak_teacher_class_id'
    );


  activeClass =
    availableClasses.find(
      item =>
        item.id ===
        requestedId
    )
    ||
    availableClasses[0]
    ||
    null;
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


  await loadTeacherClass();


  if (!activeClass) {

    return;
  }


  bindEvents();


  await loadRoster();

})()
.catch(
  async error => {

    console.error(
      '[Roster]',
      error
    );


    await showInfoModal({

      badge:
        'Error',

      badgeType:
        'danger',

      title:
        '名簿を読み込めませんでした',

      message:
        error.message ||
        String(error)

    });
  }
);