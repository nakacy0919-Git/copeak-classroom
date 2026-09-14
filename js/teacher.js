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

let editingAssignmentId = null;

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
// ASSIGNMENT MANAGEMENT
// ==========================================

function nextWeekNumber() {

  if (!assignments.length) {
    return 1;
  }

  return Math.max(
    ...assignments.map(
      assignment =>
        Number(
          assignment.week_no || 0
        )
    )
  ) + 1;
}


function assignmentDateLabel(value) {

  if (!value) {
    return '—';
  }

  return localDateValue(
    new Date(value)
  );
}


function renderAssignmentManager() {

  const root =
    $('#assignmentManagementList');

  if (!root) {
    return;
  }


  if (!assignments.length) {

    root.innerHTML = `
      <div class="assignment-manager-empty">

        <strong>
          No assignments yet.
        </strong>

        <span>
          New Assignmentから最初の課題を作成してください。
        </span>

      </div>
    `;

    return;
  }


  const sorted =
    [...assignments]
      .sort(
        (a, b) =>
          Number(a.week_no) -
          Number(b.week_no)
      );


  root.innerHTML =
    sorted
      .map(
        assignment => {

          const submissionCount =
            submissions.filter(
              submission =>
                submission.assignment_id ===
                assignment.id
            ).length;


          const published =
            assignment.is_published !==
            false;


          const lessonText =
            String(
              assignment.lesson_text ||
              ''
            ).trim();


          const excerpt =
            lessonText

              ? (
                  lessonText.length > 150
                    ? `${lessonText.slice(0, 150)}…`
                    : lessonText
                )

              : '本文未登録';


          return `
            <article class="teacher-assignment-card">

              <div class="teacher-assignment-week">

                <span>
                  WEEK
                </span>

                <strong>
                  ${assignment.week_no}
                </strong>

              </div>


              <div class="teacher-assignment-main">

                <div class="teacher-assignment-heading">

                  <div>

                    <div class="teacher-assignment-title">
                      ${esc(assignment.title)}
                    </div>

                    <div class="teacher-assignment-meta">

                      ${esc(
                        assignment.category ||
                        'Reading'
                      )}

                      ・

                      ${assignmentDateLabel(
                        assignment.release_at
                      )}

                      →

                      ${assignmentDateLabel(
                        assignment.due_at
                      )}

                      ・

                      ${submissionCount}
                      submission${submissionCount === 1 ? '' : 's'}

                    </div>

                  </div>


                  <span
                    class="
                      assignment-publish-badge
                      ${
                        published
                          ? 'published'
                          : 'draft'
                      }
                    ">

                    ${
                      published
                        ? 'Published'
                        : 'Draft'
                    }

                  </span>

                </div>


                <div class="teacher-assignment-excerpt">
                  ${esc(excerpt)}
                </div>


                <div class="teacher-assignment-actions">

                  <button
                    class="btn btn-sm btn-light"
                    data-assignment-action="edit"
                    data-assignment-id="${assignment.id}">

                    Edit

                  </button>


                  <button
                    class="btn btn-sm btn-light"
                    data-assignment-action="toggle"
                    data-assignment-id="${assignment.id}">

                    ${
                      published
                        ? 'Unpublish'
                        : 'Publish'
                    }

                  </button>


                  <button
                    class="btn btn-sm btn-light"
                    data-assignment-action="duplicate"
                    data-assignment-id="${assignment.id}">

                    Duplicate

                  </button>


                  <button
                    class="btn btn-sm btn-danger"
                    data-assignment-action="delete"
                    data-assignment-id="${assignment.id}"
                    ${
                      submissionCount > 0
                        ? 'disabled'
                        : ''
                    }
                    title="${
                      submissionCount > 0
                        ? '提出済み課題は成績保護のため削除できません'
                        : 'Delete assignment'
                    }">

                    Delete

                  </button>

                </div>

              </div>

            </article>
          `;
        }
      )
      .join('');
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

  renderAssignmentManager();

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

function openAssignmentEditor(
  assignment = null
) {

  editingAssignmentId =
    assignment?.id ||
    null;


  const release =
    assignment

      ? new Date(
          assignment.release_at
        )

      : new Date();


  const due =
    assignment

      ? new Date(
          assignment.due_at
        )

      : addDays(
          release,
          6
        );


  $('#assignmentWeek').value =
    assignment
      ? assignment.week_no
      : nextWeekNumber();


  $('#assignmentCategory').value =
    assignment?.category ||
    'Reading';


  $('#assignmentTitle').value =
    assignment?.title ||
    '';


  $('#assignmentText').value =
    assignment?.lesson_text ||
    '';


  $('#assignmentTranslation').value =
    assignment?.lesson_translation ||
    '';


  $('#assignmentLang').value =
    assignment?.lesson_lang ||
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
    assignment
      ? assignment.is_published !== false
      : true;


  $('#assignmentMsg').textContent =
    '';


  $('#publishAssignment').textContent =
    editingAssignmentId
      ? 'Save Changes'
      : 'Publish Assignment';


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


  $('#assignmentEditor')
    .scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });


  setTimeout(
    () => {

      $('#assignmentTitle')
        .focus();

    },
    150
  );
}

// ==========================================
// CLOSE EDITOR
// ==========================================

function closeAssignmentEditor() {

  editingAssignmentId =
    null;


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


  $('#publishAssignment').textContent =
    'Publish Assignment';


  $('#assignmentMsg').textContent =
    '';
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

async function saveAssignment() {

  if (!selectedClass) {
    return;
  }


  const week =
    Number(
      $('#assignmentWeek').value
    );


  const category =
    $('#assignmentCategory').value;


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
    $('#assignmentLang').value;


  const releaseValue =
    $('#assignmentRelease').value;


  const dueValue =
    $('#assignmentDue').value;


  const published =
    $('#assignmentPublished').checked;


  const msg =
    $('#assignmentMsg');


  msg.style.color =
    '#b91c1c';


  if (!week || week < 1) {

    msg.textContent =
      'Weekを入力してください。';

    return;
  }


  if (!title) {

    msg.textContent =
      'Titleを入力してください。';

    return;
  }


  if (!lessonText) {

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


  if (due < release) {

    msg.textContent =
      'Due DateはRelease Date以降にしてください。';

    return;
  }


  const isEditing =
    Boolean(
      editingAssignmentId
    );


  if (isEditing) {

    const submissionCount =
      submissions.filter(
        submission =>
          submission.assignment_id ===
          editingAssignmentId
      ).length;


    if (
      submissionCount > 0
    ) {

      const proceed =
        confirm(
          `この課題にはすでに${submissionCount}件の提出があります。\n\n` +
          `教材内容を変更すると、過去の提出時の教材と内容が異なる可能性があります。\n\n` +
          `変更を続けますか？`
        );


      if (!proceed) {
        return;
      }
    }
  }


  const button =
    $('#publishAssignment');


  button.disabled =
    true;


  button.textContent =
    'Saving...';


  const row = {

    title,

    category,

    week_no:
      week,

    release_at:
      release.toISOString(),

    due_at:
      due.toISOString(),

    is_published:
      published,

    lesson_text:
      lessonText,

    lesson_translation:
      translation ||
      null,

    lesson_lang:
      language
  };


  try {

    const sb =
      getClient();


    let error;


    if (
      isEditing
    ) {

      const result =
        await sb
          .from(
            'assignments'
          )
          .update(
            row
          )
          .eq(
            'id',
            editingAssignmentId
          );


      error =
        result.error;

    } else {

      const result =
        await sb
          .from(
            'assignments'
          )
          .insert({
            ...row,

            class_id:
              selectedClass.id,

            copeak_url:
              null
          });


      error =
        result.error;
    }


    if (error) {

      if (
        error.code ===
        '23505'
      ) {

        throw new Error(
          `Week ${week} はすでに登録されています。`
        );
      }


      throw error;
    }


    await loadClass(
      selectedClass.id
    );


    render();


    closeAssignmentEditor();


    alert(
      isEditing

        ? '課題を更新しました！'

        : published

          ? '課題を公開しました！'

          : '課題をDraftとして保存しました。'
    );


  } catch (
    error
  ) {

    msg.textContent =
      error.message ||
      String(error);


    button.textContent =
      isEditing
        ? 'Save Changes'
        : 'Publish Assignment';


  } finally {

    button.disabled =
      false;
  }
}

// ==========================================
// EDIT
// ==========================================

function editAssignment(
  assignment
) {

  openAssignmentEditor(
    assignment
  );
}


// ==========================================
// PUBLISH / UNPUBLISH
// ==========================================

async function toggleAssignmentPublish(
  assignment
) {

  const nextPublished =
    !assignment.is_published;


  if (
    nextPublished &&
    !String(
      assignment.lesson_text ||
      ''
    ).trim()
  ) {

    alert(
      '本文が登録されていないためPublishできません。'
    );

    return;
  }


  const {
    error
  } =
    await getClient()
      .from(
        'assignments'
      )
      .update({
        is_published:
          nextPublished
      })
      .eq(
        'id',
        assignment.id
      );


  if (error) {
    throw error;
  }


  await loadClass(
    selectedClass.id
  );


  render();
}


// ==========================================
// DUPLICATE
// ==========================================

async function duplicateAssignment(
  assignment
) {

  const newWeek =
    nextWeekNumber();


  const oldWeek =
    Number(
      assignment.week_no ||
      1
    );


  const weekDifference =
    Math.max(
      1,
      newWeek -
      oldWeek
    );


  const release =
    addDays(
      new Date(
        assignment.release_at
      ),
      weekDifference *
      7
    );


  const due =
    addDays(
      new Date(
        assignment.due_at
      ),
      weekDifference *
      7
    );


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

        title:
          `${assignment.title} (Copy)`,

        category:
          assignment.category,

        week_no:
          newWeek,

        release_at:
          release.toISOString(),

        due_at:
          due.toISOString(),

        copeak_url:
          assignment.copeak_url ||
          null,

        is_published:
          false,

        lesson_text:
          assignment.lesson_text,

        lesson_translation:
          assignment.lesson_translation,

        lesson_lang:
          assignment.lesson_lang ||
          'en-US'
      });


  if (error) {
    throw error;
  }


  await loadClass(
    selectedClass.id
  );


  render();


  alert(
    `Week ${newWeek} にDraftとして複製しました。`
  );
}


// ==========================================
// DELETE
// ==========================================

async function deleteAssignment(
  assignment
) {

  const submissionCount =
    submissions.filter(
      submission =>
        submission.assignment_id ===
        assignment.id
    ).length;


  if (
    submissionCount > 0
  ) {

    alert(
      `この課題には${submissionCount}件の提出があります。\n` +
      `成績データ保護のため削除できません。\n\n` +
      `必要ならUnpublishしてください。`
    );

    return;
  }


  const ok =
    confirm(
      `「${assignment.title}」を削除しますか？\n\n` +
      `この操作は元に戻せません。`
    );


  if (!ok) {
    return;
  }


  const {
    error
  } =
    await getClient()
      .from(
        'assignments'
      )
      .delete()
      .eq(
        'id',
        assignment.id
      );


  if (error) {
    throw error;
  }


  await loadClass(
    selectedClass.id
  );


  render();
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
    saveAssignment();

$('#assignmentRelease').onchange =
  updateDueDate;


$('#load30').onclick =
  load30;

  $('#assignmentManagementList')
  ?.addEventListener(
    'click',
    async event => {

      const button =
        event.target.closest(
          '[data-assignment-action]'
        );


      if (!button) {
        return;
      }


      const assignment =
        assignments.find(
          item =>
            item.id ===
            button.dataset.assignmentId
        );


      if (!assignment) {
        return;
      }


      const action =
        button.dataset.assignmentAction;


      try {

        if (
          action ===
          'edit'
        ) {

          editAssignment(
            assignment
          );

        } else if (
          action ===
          'toggle'
        ) {

          await toggleAssignmentPublish(
            assignment
          );

        } else if (
          action ===
          'duplicate'
        ) {

          await duplicateAssignment(
            assignment
          );

        } else if (
          action ===
          'delete'
        ) {

          await deleteAssignment(
            assignment
          );
        }


      } catch (
        error
      ) {

        console.error(
          error
        );


        alert(
          error.message ||
          String(error)
        );
      }
    }
  );

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