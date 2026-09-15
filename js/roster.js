import {
  requireUser,
  getClient
} from './supabase.js';


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
}


// ==========================================
// RENDER
// ==========================================

function renderRoster() {

  const total =
    roster.length;


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
                    data-roster-id="${student.id}"
                    ${
                      joined
                        ? 'disabled'
                        : ''
                    }>

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


    alert(
      `${rows.length}名を登録しました。`
    );


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


    alert(
      `${student.display_name} の参加情報をコピーしました。`
    );


  } catch {

    prompt(
      '下記をコピーしてください。',
      text
    );
  }
}


// ==========================================
// EDIT STUDENT
// ==========================================

async function editRosterStudent(
  student
) {

  const studentNumber =
    prompt(
      'Student No.',
      student.student_number
    );


  if (
    studentNumber === null
  ) {

    return;
  }


  const displayName =
    prompt(
      'Student Name',
      student.display_name
    );


  if (
    displayName === null
  ) {

    return;
  }


  const number =
    studentNumber.trim();


  const name =
    displayName.trim();


  if (
    !number ||
    !name
  ) {

    alert(
      'Student No.とStudent Nameは必須です。'
    );

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
            number,

          p_display_name:
            name

        }
      );


  if (error) {

    throw error;
  }


  await loadRoster();


  alert(
    '生徒情報を更新しました。'
  );
}


// ==========================================
// REGENERATE PIN
// ==========================================

async function regeneratePin(
  student
) {

  const ok =
    confirm(
      `「${student.display_name}」のJoin PINを再発行しますか？\n\n古いPINは使用できなくなります。`
    );


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


  alert(
    `${student.display_name} の新しいPINは ${newPin} です。`
  );
}


// ==========================================
// DELETE
// ==========================================

async function deleteRosterStudent(
  student
) {

  if (
    student.linked_student_id
  ) {

    alert(
      'Joined済みの生徒は削除できません。'
    );

    return;
  }


  const ok =
    confirm(
      `「${student.display_name}」を名簿から削除しますか？`
    );


  if (!ok) {

    return;
  }


  const {
    error
  } =
    await getClient()
      .from(
        'class_roster'
      )
      .delete()
      .eq(
        'id',
        student.id
      );


  if (error) {

    throw error;
  }


  await loadRoster();
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


function exportRosterCsv() {

  if (!roster.length) {

    alert(
      '名簿がありません。'
    );

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


    alert(
      error.message ||
      String(error)
    );
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
  error => {

    console.error(
      '[Roster]',
      error
    );


    alert(
      `名簿の読み込みに失敗しました: ${
        error.message ||
        error
      }`
    );
  }
);