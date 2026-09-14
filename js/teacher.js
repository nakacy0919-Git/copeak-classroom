import {
  requireUser,
  getClient,
  signOut,
  pct
} from './supabase.js';

import {
  demoAssignments,
  demoStudents,
  demoSubmissions,
  cnnTasks
} from './data.js';


const $ =
  s => document.querySelector(s);


let ctx;

let classes = [];

let selectedClass = null;

let students = [];

let assignments = [];

let submissions = [];


$('#signOut').onclick =
  signOut;


// ==========================================
// DATE
// 日本時間でも日付がズレない形
// ==========================================

function localDateValue(
  date = new Date()
) {

  const y =
    date.getFullYear();

  const m =
    String(
      date.getMonth() + 1
    ).padStart(2, '0');

  const d =
    String(
      date.getDate()
    ).padStart(2, '0');


  return `${y}-${m}-${d}`;
}


function addDays(
  date,
  days
) {

  const result =
    new Date(date);

  result.setDate(
    result.getDate() +
    days
  );

  return result;
}


// ==========================================
// LATEST SUBMISSION
// ==========================================

function latestMap(
  rows
) {

  const map =
    new Map();


  rows
    .slice()
    .sort(
      (a, b) =>
        new Date(
          a.submitted_at
        ) -
        new Date(
          b.submitted_at
        )
    )
    .forEach(
      row => {

        map.set(
          `${row.student_id}|${row.assignment_id}`,
          row
        );

      }
    );


  return map;
}


// ==========================================
// PUBLISHED ASSIGNMENTS
// ==========================================

function visibleAssignments() {

  return assignments
    .filter(
      assignment =>
        assignment.is_published !==
        false
    );
}


// ==========================================
// SUMMARY
// ==========================================

function renderSummary() {

  const latest =
    latestMap(
      submissions
    );


  const activeAssignments =
    visibleAssignments();


  const released =
    activeAssignments
      .filter(
        assignment =>
          new Date(
            assignment.release_at
          ) <=
          new Date()
      );


  const possible =
    students.length *
    released.length;


  let done =
    0;


  latest.forEach(
    submission => {

      if (
        released.some(
          assignment =>
            assignment.id ===
            submission.assignment_id
        )
      ) {

        done++;

      }
    }
  );


  $('#studentCount').textContent =
    students.length;


  $('#assignmentCount').textContent =
    activeAssignments.length;


  $('#submissionRate').textContent =
    possible

      ? `${Math.round(
          done /
          possible *
          100
        )}%`

      : '—';


  const values =
    [...latest.values()]
      .filter(
        row =>
          activeAssignments.some(
            assignment =>
              assignment.id ===
              row.assignment_id
          )
      )
      .map(
        row =>
          Number(
            row.accuracy || 0
          )
      );


  $('#classAverage').textContent =
    values.length

      ? `${Math.round(
          values.reduce(
            (a, b) =>
              a + b,
            0
          ) /
          values.length
        )}%`

      : '—';
}


// ==========================================
// GRADEBOOK
// ==========================================

function renderTable() {

  const activeAssignments =
    visibleAssignments();


  const latest =
    latestMap(
      submissions
    );


  const query =
    $('#studentSearch')
      .value
      .trim()
      .toLowerCase();


  const visibleStudents =
    students.filter(
      student =>
        student
          .display_name
          .toLowerCase()
          .includes(
            query
          )
    );


  $('#gradeHead').innerHTML =
    `
      <tr>

        <th>
          Student
        </th>

        ${
          activeAssignments
            .map(
              assignment =>
                `
                  <th
                    title="${esc(
                      assignment.title
                    )}">
                    W${assignment.week_no}
                  </th>
                `
            )
            .join('')
        }

        <th>
          Done
        </th>

        <th>
          Avg.
        </th>

      </tr>
    `;


  $('#gradeBody').innerHTML =
    visibleStudents
      .map(
        student => {

          let done =
            0;

          let total =
            0;

          let sum =
            0;


          const cells =
            activeAssignments
              .map(
                assignment => {

                  const result =
                    latest.get(
                      `${student.id}|${assignment.id}`
                    );


                  if (!result) {

                    return `
                      <td>
                        <span class="grade missing">
                          —
                        </span>
                      </td>
                    `;
                  }


                  done++;

                  total++;

                  sum +=
                    Number(
                      result.accuracy || 0
                    );


                  const value =
                    Math.round(
                      result.accuracy || 0
                    );


                  const gradeClass =
                    value >= 90

                      ? 'good'

                      : value >= 75

                        ? 'mid'

                        : 'low';


                  return `
                    <td
                      title="WPM ${Math.round(
                        result.wpm || 0
                      )} / Comp ${pct(
                        result.comprehension
                      )}">

                      <span
                        class="grade ${gradeClass}">

                        ${value}

                      </span>

                    </td>
                  `;
                }
              )
              .join('');


          return `
            <tr>

              <td>
                ${esc(
                  student.display_name
                )}
              </td>

              ${cells}

              <td>
                <strong>
                  ${done}/${activeAssignments.length}
                </strong>
              </td>

              <td>
                <strong>

                  ${
                    total

                      ? Math.round(
                          sum /
                          total
                        )

                      : '—'
                  }

                  ${
                    total
                      ? '%'
                      : ''
                  }

                </strong>
              </td>

            </tr>
          `;

        }
      )
      .join('');
}


// ==========================================
// MAIN RENDER
// ==========================================

function render() {

  renderSummary();

  renderTable();


  $('#classTitle').textContent =
    selectedClass?.name ||
    'Class';


  $('#classCode').textContent =
    selectedClass?.class_code ||
    'DEMO32';
}


// ==========================================
// ESCAPE
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
// SEARCH
// ==========================================

$('#studentSearch').oninput =
  renderTable;


// ==========================================
// COPY CODE
// ==========================================

$('#copyCode').onclick =
  async () => {

    await navigator
      .clipboard
      .writeText(
        $('#classCode')
          .textContent
      );


    $('#copyCode').textContent =
      'Copied!';


    setTimeout(
      () => {

        $('#copyCode').textContent =
          'Copy';

      },
      1200
    );
  };


// ==========================================
// CREATE FIRST CLASS
// ==========================================

async function createFirstClass() {

  const school =
    $('#schoolName')
      .value
      .trim();


  const name =
    $('#newClassName')
      .value
      .trim();


  if (
    !school ||
    !name
  ) {

    return;
  }


  const sb =
    getClient();


  const {
    data: schoolRow,
    error: schoolError
  } =
    await sb
      .from(
        'schools'
      )
      .insert({
        name: school
      })
      .select()
      .single();


  if (
    schoolError
  ) {

    throw schoolError;
  }


  const {
    error: profileError
  } =
    await sb
      .from(
        'profiles'
      )
      .update({
        school_id:
          schoolRow.id
      })
      .eq(
        'id',
        ctx.user.id
      );


  if (
    profileError
  ) {

    throw profileError;
  }


  const {
    error: classError
  } =
    await sb
      .from(
        'classes'
      )
      .insert({

        school_id:
          schoolRow.id,

        teacher_id:
          ctx.user.id,

        name,

        academic_year:
          new Date()
            .getFullYear()

      });


  if (
    classError
  ) {

    throw classError;
  }


  location.reload();
}


// ==========================================
// NEW ASSIGNMENT FORM
// ==========================================

function openAssignmentEditor() {

  const nextWeek =
    assignments.length

      ? Math.max(
          ...assignments.map(
            assignment =>
              Number(
                assignment.week_no ||
                0
              )
          )
        ) + 1

      : 1;


  const release =
    new Date();


  const due =
    addDays(
      release,
      6
    );


  $('#assignmentWeek').value =
    nextWeek;


  $('#assignmentCategory').value =
    'Reading';


  $('#assignmentTitle').value =
    '';


  $('#assignmentText').value =
    '';


  $('#assignmentTranslation').value =
    '';


  $('#assignmentLang').value =
    'en-US';


  $('#assignmentRelease').value =
    localDateValue(
      release
    );


  $('#assignmentDue').value =
    localDateValue(
      due
    );


  $('#assignmentPublished').checked =
    true;


  $('#assignmentMsg').textContent =
    '';


  $('#assignmentEditor')
    .classList
    .remove(
      'hidden'
    );


  $('#assignmentHint')
    .classList
    .add(
      'hidden'
    );


  setTimeout(
    () => {

      $('#assignmentTitle')
        .focus();

    },
    100
  );
}


// ==========================================
// CLOSE EDITOR
// ==========================================

function closeAssignmentEditor() {

  $('#assignmentEditor')
    .classList
    .add(
      'hidden'
    );


  $('#assignmentHint')
    .classList
    .remove(
      'hidden'
    );
}


// ==========================================
// RELEASE DATE → DUE +6
// ==========================================

function updateDueDate() {

  const releaseValue =
    $('#assignmentRelease')
      .value;


  if (
    !releaseValue
  ) {

    return;
  }


  const release =
    new Date(
      `${releaseValue}T00:00:00`
    );


  const due =
    addDays(
      release,
      6
    );


  $('#assignmentDue').value =
    localDateValue(
      due
    );
}


// ==========================================
// CREATE ASSIGNMENT
// ==========================================

async function createAssignment() {

  if (
    !selectedClass
  ) {

    return;
  }


  const week =
    Number(
      $('#assignmentWeek')
        .value
    );


  const category =
    $('#assignmentCategory')
      .value;


  const title =
    $('#assignmentTitle')
      .value
      .trim();


  const lessonText =
    $('#assignmentText')
      .value
      .trim();


  const translation =
    $('#assignmentTranslation')
      .value
      .trim();


  const language =
    $('#assignmentLang')
      .value;


  const releaseValue =
    $('#assignmentRelease')
      .value;


  const dueValue =
    $('#assignmentDue')
      .value;


  const published =
    $('#assignmentPublished')
      .checked;


  const msg =
    $('#assignmentMsg');


  msg.style.color =
    '#b91c1c';


  if (
    !week ||
    week < 1
  ) {

    msg.textContent =
      'Weekを入力してください。';

    return;
  }


  if (
    !title
  ) {

    msg.textContent =
      'Titleを入力してください。';

    return;
  }


  if (
    !lessonText
  ) {

    msg.textContent =
      '音読するEnglish Textを入力してください。';

    return;
  }


  if (
    !releaseValue ||
    !dueValue
  ) {

    msg.textContent =
      'Release DateとDue Dateを入力してください。';

    return;
  }


  const release =
    new Date(
      `${releaseValue}T00:00:00`
    );


  const due =
    new Date(
      `${dueValue}T23:59:00`
    );


  if (
    due <
    release
  ) {

    msg.textContent =
      'Due DateはRelease Date以降にしてください。';

    return;
  }


  const button =
    $('#publishAssignment');


  button.disabled =
    true;


  button.textContent =
    'Saving...';


  try {

    const {
      error
    } =
      await getClient()
        .from(
          'assignments'
        )
        .insert({

          class_id:
            selectedClass.id,

          title,

          category,

          week_no:
            week,

          release_at:
            release
              .toISOString(),

          due_at:
            due
              .toISOString(),

          is_published:
            published,

          copeak_url:
            null,

          lesson_text:
            lessonText,

          lesson_translation:
            translation ||
            null,

          lesson_lang:
            language

        });


    if (
      error
    ) {

      throw error;
    }


    await loadClass(
      selectedClass.id
    );


    render();


    closeAssignmentEditor();


    alert(
      published

        ? '課題を公開しました！'

        : '課題をDraftとして保存しました。'
    );


  } catch (
    error
  ) {

    msg.textContent =
      error.message ||
      String(
        error
      );

  } finally {

    button.disabled =
      false;


    button.textContent =
      'Publish Assignment';
  }
}


// ==========================================
// CNN 30
// 今はタイトルのみなので誤登録を防止
// ==========================================

async function load30() {

  alert(
    'CNN 30の本文一括登録は次の工程で実装します。現在は「New Assignment」を使用してください。'
  );
}


// ==========================================
// LOAD CLASS
// ==========================================

async function loadClass(
  id
) {

  selectedClass =
    classes.find(
      item =>
        item.id === id
    ) ||
    classes[0];


  const sb =
    getClient();


  const {
    data: members,
    error: memberError
  } =
    await sb
      .from(
        'class_members'
      )
      .select(
        'student_id,profiles!class_members_student_id_fkey(id,display_name)'
      )
      .eq(
        'class_id',
        selectedClass.id
      );


  if (
    memberError
  ) {

    throw memberError;
  }


  students =
    (members || [])
      .map(
        item =>
          item.profiles
      )
      .filter(
        Boolean
      );


  const {
    data: assignmentRows,
    error: assignmentError
  } =
    await sb
      .from(
        'assignments'
      )
      .select(
        '*'
      )
      .eq(
        'class_id',
        selectedClass.id
      )
      .order(
        'week_no'
      );


  if (
    assignmentError
  ) {

    throw assignmentError;
  }


  assignments =
    assignmentRows ||
    [];


  if (
    assignments.length
  ) {

    const ids =
      assignments.map(
        assignment =>
          assignment.id
      );


    const {
      data: submissionRows,
      error: submissionError
    } =
      await sb
        .from(
          'submissions'
        )
        .select(
          '*'
        )
        .in(
          'assignment_id',
          ids
        );


    if (
      submissionError
    ) {

      throw submissionError;
    }


    submissions =
      submissionRows ||
      [];

  } else {

    submissions =
      [];
  }
}


// ==========================================
// LOAD LIVE
// ==========================================

async function loadLive() {

  const sb =
    getClient();


  const {
    data: classRows,
    error
  } =
    await sb
      .from(
        'classes'
      )
      .select(
        '*'
      )
      .eq(
        'teacher_id',
        ctx.user.id
      )
      .order(
        'created_at'
      );


  if (
    error
  ) {

    throw error;
  }


  classes =
    classRows ||
    [];


  if (
    !classes.length
  ) {

    $('#mainApp')
      .classList
      .add(
        'hidden'
      );


    $('#onboard')
      .classList
      .remove(
        'hidden'
      );


    $('#createClass').onclick =
      () =>
        createFirstClass()
          .catch(
            error => {

              $('#onboardMsg')
                .textContent =
                error.message;

            }
          );


    return false;
  }


  await loadClass(
    classes[0].id
  );


  return true;
}


// ==========================================
// EVENTS
// ==========================================

$('#newAssignment').onclick =
  openAssignmentEditor;


$('#cancelAssignment').onclick =
  closeAssignmentEditor;


$('#publishAssignment').onclick =
  () =>
    createAssignment();


$('#assignmentRelease').onchange =
  updateDueDate;


$('#load30').onclick =
  load30;


// ==========================================
// START
// ==========================================

(async () => {

  ctx =
    await requireUser(
      'teacher'
    );


  if (
    !ctx
  ) {

    return;
  }


  $('#userName').textContent =
    ctx.profile
      ?.display_name ||
    'Teacher';


  const now =
    new Date();


  $('#startDate').value =
    localDateValue(
      now
    );


  if (
    ctx.demo
  ) {

    classes = [
      {
        id:
          'demo-class',

        name:
          '3年2組 English Course',

        class_code:
          'AG32EN'
      }
    ];


    selectedClass =
      classes[0];


    students =
      demoStudents;


    assignments =
      demoAssignments();


    submissions =
      demoSubmissions();


    $('#demoBanner')
      .classList
      .remove(
        'hidden'
      );


    render();


    return;
  }


  if (
    await loadLive()
  ) {

    render();
  }

})()
.catch(
  error => {

    console.error(
      error
    );


    alert(
      error.message
    );
  }
);