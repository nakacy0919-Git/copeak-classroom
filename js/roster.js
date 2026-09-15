import {
  requireUser,
  getClient
} from './supabase.js';


const $ =
  selector =>
    document.querySelector(
      selector
    );


let ctx = null;

let activeClass = null;

let roster = [];


// ==========================================
// HTML ESCAPE
// ==========================================

function esc(
  value = ''
) {

  return String(
    value
  ).replace(

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


// ==========================================
// CREATE 6 DIGIT PIN
// ==========================================

function createPin() {

  const array =
    new Uint32Array(
      1
    );


  crypto.getRandomValues(
    array
  );


  const number =
    100000 +
    (
      array[0] %
      900000
    );


  return String(
    number
  );
}


// ==========================================
// SORT ROSTER
// ==========================================

function sortRoster(
  rows
) {

  return [...rows]
    .sort(
      (a, b) =>
        String(
          a.student_number
        )
          .localeCompare(
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


  const waiting =
    total -
    joined;


  $('#rosterTotal').textContent =
    total;


  $('#rosterJoined').textContent =
    joined;


  $('#rosterWaiting').textContent =
    waiting;


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

          const isJoined =
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
                      isJoined
                        ? 'joined'
                        : 'waiting'
                    }
                  ">

                  ${
                    isJoined
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
                    class="btn btn-sm btn-danger"
                    data-roster-action="delete"
                    data-roster-id="${student.id}"
                    ${
                      isJoined
                        ? 'disabled'
                        : ''
                    }
                    title="${
                      isJoined
                        ? 'Joined済みの生徒は削除できません'
                        : 'Delete student'
                    }">

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
// LOAD ROSTER
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
      .select(
        '*'
      )
      .eq(
        'class_id',
        activeClass.id
      );


  if (error) {

    throw error;
  }


  roster =
    data ||
    [];


  renderRoster();
}


// ==========================================
// NEXT AUTO NUMBER
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
        number =>
          Number.isFinite(
            number
          )
      );


  if (!numbers.length) {

    return 1;
  }


  return Math.max(
    ...numbers
  ) + 1;
}


// ==========================================
// PARSE IMPORT TEXT
// ==========================================

function parseRosterText(
  text
) {

  const lines =
    text
      .split(
        /\r?\n/
      )
      .map(
        line =>
          line.trim()
      )
      .filter(
        Boolean
      );


  const existingNumbers =
    new Set(
      roster.map(
        student =>
          String(
            student.student_number
          ).trim()
      )
    );


  const usedNumbers =
    new Set();


  let autoNumber =
    nextAutoNumber();


  const rows =
    [];


  for (
    const line
    of lines
  ) {

    let studentNumber =
      '';

    let displayName =
      '';


    // ======================================
    // Excel / Google Sheets
    // 1<TAB>山田 太郎
    // ======================================

    if (
      line.includes(
        '\t'
      )
    ) {

      const parts =
        line.split(
          '\t'
        );


      studentNumber =
        String(
          parts.shift() ||
          ''
        ).trim();


      displayName =
        parts
          .join(
            ' '
          )
          .trim();
    }


    // ======================================
    // CSV
    // 1,山田 太郎
    // ======================================

    else if (
      line.includes(
        ','
      )
    ) {

      const parts =
        line.split(
          ','
        );


      studentNumber =
        String(
          parts.shift() ||
          ''
        ).trim();


      displayName =
        parts
          .join(
            ','
          )
          .trim();
    }


    // ======================================
    // NAME ONLY
    // 山田 太郎
    // ======================================

    else {

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


    // ======================================
    // DUPLICATE NUMBER CHECK
    // ======================================

    if (
      existingNumbers.has(
        studentNumber
      ) ||
      usedNumbers.has(
        studentNumber
      )
    ) {

      continue;
    }


    usedNumbers.add(
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
// IMPORT STUDENTS
// ==========================================

async function importRoster() {

  const textarea =
    $('#rosterPaste');


  const message =
    $('#rosterImportMsg');


  if (
    !textarea ||
    !message
  ) {

    return;
  }


  const text =
    textarea
      .value
      .trim();


  message.textContent =
    '';

  message.style.color =
    '#b91c1c';


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
      '新しく登録できる生徒がありません。出席番号の重複を確認してください。';

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


    textarea.value =
      '';


    $('#rosterImportPanel')
      .classList
      .add(
        'hidden'
      );


    await loadRoster();


    alert(
      `${rows.length}名を名簿に登録しました！`
    );


  } catch (
    error
  ) {

    console.error(
      '[Roster Import]',
      error
    );


    message.textContent =
      error.message ||
      String(
        error
      );

  } finally {

    button.disabled =
      false;


    button.textContent =
      'Import Students';
  }
}


// ==========================================
// COPY JOIN INFORMATION
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


  } catch (
    error
  ) {

    console.error(
      '[Clipboard]',
      error
    );


    prompt(
      '下記をコピーしてください。',
      text
    );
  }
}


// ==========================================
// DELETE WAITING STUDENT
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
// ROSTER ACTIONS
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


  const action =
    button.dataset.rosterAction;


  try {

    if (
      action ===
      'copy'
    ) {

      await copyJoinInfo(
        student
      );
    }


    if (
      action ===
      'delete'
    ) {

      await deleteRosterStudent(
        student
      );
    }


  } catch (
    error
  ) {

    console.error(
      '[Roster Action]',
      error
    );


    alert(
      error.message ||
      String(
        error
      )
    );
  }
}


// ==========================================
// EVENTS
// ==========================================

function bindEvents() {

  const toggle =
    $('#toggleRosterImport');


  const cancel =
    $('#cancelRosterImport');


  const importButton =
    $('#importRoster');


  const body =
    $('#rosterBody');


  if (
    toggle
  ) {

    toggle.onclick =
      () => {

        const panel =
          $('#rosterImportPanel');


        panel
          .classList
          .toggle(
            'hidden'
          );


        if (
          !panel
            .classList
            .contains(
              'hidden'
            )
        ) {

          setTimeout(
            () =>
              $('#rosterPaste')
                ?.focus(),
            80
          );
        }
      };
  }


  if (
    cancel
  ) {

    cancel.onclick =
      () => {

        $('#rosterImportPanel')
          .classList
          .add(
            'hidden'
          );


        $('#rosterImportMsg')
          .textContent =
          '';
      };
  }


  if (
    importButton
  ) {

    importButton.onclick =
      importRoster;
  }


  if (
    body
  ) {

    body.addEventListener(
      'click',
      handleRosterAction
    );
  }
}


// ==========================================
// LOAD TEACHER CLASS
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
        'id,name,class_code,created_at'
      )
      .eq(
        'teacher_id',
        ctx.user.id
      )
      .order(
        'created_at',
        {
          ascending: true
        }
      )
      .limit(
        1
      );


  if (error) {

    throw error;
  }


  activeClass =
    data?.[0] ||
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


    const body =
      $('#rosterBody');


    if (body) {

      body.innerHTML = `
        <tr>

          <td colspan="5">

            <div class="roster-empty">

              名簿の読み込みに失敗しました。

            </div>

          </td>

        </tr>
      `;
    }


    alert(
      `名簿の読み込みに失敗しました: ${
        error.message ||
        error
      }`
    );
  }
);