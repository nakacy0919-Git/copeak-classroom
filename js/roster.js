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
            <tr>

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
    await getClient()
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
      await getClient()
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
    await getClient()
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
    await getClient()
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
    await getClient()
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
      await getClient()
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


  const cards =
    students
      .map(
        student => `
          <div class="login-card">

            <div class="brand">
              Copeak Classroom
            </div>

            <div class="class-name">
              ${esc(activeClass.name || '')}
            </div>

            <div class="student-name">
              ${esc(student.display_name)}
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
            </div>

          </div>
        `
      )
      .join('');


  const printWindow =
    window.open(
      '',
      '_blank'
    );


  if (!printWindow) {

    await showInfoModal({

  badge:
    'Print',

  badgeType:
    'danger',

  title:
    '印刷画面を開けませんでした',

  message:
    'ブラウザのポップアップを許可してから、もう一度Print Login Cardsを押してください。'

});

    return;
  }


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
  margin: 10mm;
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
    repeat(2, 1fr);
  gap: 8mm;
}

.login-card {
  min-height: 60mm;
  border: 2px solid #d1d5db;
  border-radius: 14px;
  padding: 8mm;
  break-inside: avoid;
  position: relative;
}

.brand {
  font-size: 15px;
  font-weight: 800;
  color: #2563eb;
  margin-bottom: 4px;
}

.class-name {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 8px;
}

.student-name {
  font-size: 22px;
  font-weight: 800;
  margin-bottom: 10px;
}

.login-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid #e5e7eb;
  padding: 5px 0;
  font-size: 13px;
}

.login-row strong {
  font-size: 18px;
  letter-spacing: 1px;
}

.pin-row strong {
  font-size: 24px;
  letter-spacing: 3px;
}

.url {
  margin-top: 8px;
  text-align: center;
  font-size: 11px;
  color: #6b7280;
}

@media print {

  .page {
    gap: 6mm;
  }

}

</style>

</head>

<body>

<div class="page">

  ${cards}

</div>

<script>

window.onload = () => {

  window.print();

};

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
}


// ==========================================
// CLASS
// ==========================================

async function loadTeacherClass() {

  const {
    data,
    error
  } =
    await getClient()
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