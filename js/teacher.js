import { reviewDeliveryUrl } from './launch-safety.js';
import {
  requireUser,
  getClient,
  signOut,
  pct
} from './supabase.js';

import {
  demoAssignments,
  demoStudents,
  demoSubmissions  
} from './data.js';

import {
  showConfirmModal,
  showInfoModal
} from './ui.js';

const $ =
  s => document.querySelector(s);


let ctx;

let classes = [];

let selectedClass = null;

let students = [];

let assignments = [];

let submissions = [];

let manualScores = [];

let readingRankings = [];

let activeReadingRankAssignmentId =
  null;


// ==========================================
// PROJECTOR LEADERBOARD v5
// ==========================================

let leaderboardVisibleMetrics =
  new Set([
    'accuracy',
    'wpm',
    'practice'
  ]);


let leaderboardHiddenStudentIds =
  new Set();


let leaderboardStudentFilterOpen =
  false;


let gradebookDefaultMetric =
  localStorage.getItem(
    'copeak_gradebook_default_metric'
  ) ||
  'accuracy';


let gradebookMetricMode =
  gradebookDefaultMetric;

let editingAssignmentId = null;

$('#signOut').onclick =
  signOut;

// ==========================================
// PLATFORM ADMIN ACCESS
// ==========================================

async function loadPlatformAdminAccess() {

  const link =
    $('#adminDashboardLink');


  if (
    !link ||
    !ctx ||
    ctx.demo
  ) {

    return;
  }


  const sb =
    getClient(
      'teacher'
    );


  const {
    data,
    error
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
        ctx.user.id
      )
      .maybeSingle();


  if (error) {

    console.warn(
      '[Platform Admin Access]',
      error
    );

    return;
  }


  link.classList
    .toggle(
      'hidden',
      !data
    );
}



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

// ==========================================
// LOCAL DATE + TIME
// datetime-local用
// ==========================================

function localDateTimeValue(
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

  const h =
    String(
      date.getHours()
    ).padStart(2, '0');

  const min =
    String(
      date.getMinutes()
    ).padStart(2, '0');

  const sec =
    String(
      date.getSeconds()
    ).padStart(2, '0');


  return (
    `${y}-${m}-${d}` +
    `T${h}:${min}:${sec}`
  );
}


function parseLocalDateTime(
  value
) {

  if (!value) {
    return null;
  }


  const [
    datePart,
    timePart = '00:00:00'
  ] =
    value.split('T');


  const [
    year,
    month,
    day
  ] =
    datePart
      .split('-')
      .map(Number);


  const [
    hour = 0,
    minute = 0,
    second = 0
  ] =
    timePart
      .split(':')
      .map(Number);


  return new Date(
    year,
    month - 1,
    day,
    hour,
    minute,
    second
  );
}


function assignmentDateTimeLabel(
  value
) {

  if (!value) {
    return '—';
  }


  const date =
    new Date(value);


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

  const h =
    String(
      date.getHours()
    ).padStart(2, '0');

  const min =
    String(
      date.getMinutes()
    ).padStart(2, '0');

  const sec =
    String(
      date.getSeconds()
    ).padStart(2, '0');


  return (
    `${y}/${m}/${d} ` +
    `${h}:${min}:${sec}`
  );
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
// BEST SUBMISSION
// Accuracy最高記録
// ==========================================

function bestSubmissionMap(
  rows
) {

  const map =
    new Map();


  rows.forEach(
    row => {

      const key =
        `${row.student_id}|${row.assignment_id}`;


      const current =
        map.get(
          key
        );


      if (
        !current ||
        Number(
          row.accuracy || 0
        ) >
        Number(
          current.accuracy || 0
        )
      ) {

        map.set(
          key,
          row
        );
      }
    }
  );


  return map;
}


// ==========================================
// ATTEMPT COUNT
// 音読回数
// ==========================================

function attemptCountMap(
  rows
) {

  const map =
    new Map();


  rows.forEach(
    row => {

      const key =
        `${row.student_id}|${row.assignment_id}`;


      map.set(
        key,
        (
          map.get(key) ||
          0
        ) + 1
      );
    }
  );


  return map;
}

// ==========================================
// PUBLISHED ASSIGNMENTS
// ==========================================

function manualScoreMap(
  rows
) {

  const map =
    new Map();

  rows.forEach(
    row => {

      map.set(
        `${row.student_id}|${row.assignment_id}`,
        row
      );

    }
  );

  return map;
}

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
  NO.
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

                      ${assignmentDateTimeLabel(
                        assignment.release_at
                      )}

                      →

                      ${assignmentDateTimeLabel(
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
  title="課題と提出記録を完全削除">

  完全削除

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

  const best =
    bestSubmissionMap(
      submissions
    );

  const manual =
    manualScoreMap(
      manualScores
    );

  const activeAssignments =
    visibleAssignments();

  const released =
    activeAssignments.filter(
      assignment =>
        new Date(
          assignment.release_at
        ) <=
        new Date()
    );


  let done = 0;

  const values = [];


  students.forEach(
    student => {

      released.forEach(
        assignment => {

          const key =
            `${student.id}|${assignment.id}`;

          if (
            manual.has(key) ||
            best.has(key)
          ) {
            done++;
          }

        }
      );


      activeAssignments.forEach(
        assignment => {

          const key =
            `${student.id}|${assignment.id}`;

          const manualRow =
            manual.get(key);

          const result =
            best.get(key);


          if (
            manualRow?.score !== null &&
            manualRow?.score !== undefined
          ) {

            values.push(
              Number(
                manualRow.score
              )
            );

          } else if (result) {

            values.push(
              Number(
                result.accuracy ||
                0
              )
            );
          }

        }
      );

    }
  );


  const possible =
    students.length *
    released.length;


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

function bestWpmSubmissionMap(
  rows
) {

  const map =
    new Map();


  rows.forEach(
    row => {

      const key =
        `${row.student_id}|${row.assignment_id}`;

      const current =
        map.get(key);


      if (
        !current ||
        Number(
          row.wpm ||
          0
        ) >
        Number(
          current.wpm ||
          0
        )
      ) {

        map.set(
          key,
          row
        );
      }

    }
  );


  return map;
}


function bestComprehensionSubmissionMap(
  rows
) {

  const map =
    new Map();


  rows.forEach(
    row => {

      if (
        row.comprehension ===
          null ||
        row.comprehension ===
          undefined
      ) {
        return;
      }


      const key =
        `${row.student_id}|${row.assignment_id}`;

      const current =
        map.get(key);


      if (
        !current ||
        Number(
          row.comprehension
        ) >
        Number(
          current.comprehension ||
          0
        )
      ) {

        map.set(
          key,
          row
        );
      }

    }
  );


  return map;
}


function gradebookMetricLabel(
  metric
) {

  if (metric === 'wpm') {
    return 'WPM';
  }

  if (
    metric ===
    'comprehension'
  ) {
    return 'Comprehension';
  }

  if (metric === 'all') {
    return 'All';
  }

  return 'Accuracy';
}


function updateGradebookDefaultLabel() {

  const label =
    $('#gradebookDefaultLabel');


  if (label) {

    label.textContent =
      `Default: ${gradebookMetricLabel(
        gradebookDefaultMetric
      )}`;
  }


  const button =
    $('#setGradebookDefault');


  if (button) {

    const isCurrentDefault =
      gradebookMetricMode ===
      gradebookDefaultMetric;


    button.textContent =
      isCurrentDefault
        ? '★ デフォルト'
        : '☆ デフォルトに設定';
  }
}

function ensureGradebookControls() {

  const tableWrap =
    $('#gradeBody')
      ?.closest(
        '.table-wrap'
      );


  if (!tableWrap) {
    return;
  }


  let controls =
    $('#gradebookControls');


  if (!controls) {

    controls =
      document.createElement(
        'div'
      );


    controls.id =
      'gradebookControls';

    controls.className =
      'gradebook-controls';


    controls.innerHTML =
      `
        <div class="gradebook-view-control">

          <span class="tiny muted">
            表示
          </span>

          <select
            id="gradebookMetricMode"
            class="input">

            <option value="accuracy">
              Accuracy
            </option>

            <option value="wpm">
              WPM
            </option>

            <option value="comprehension">
              Comprehension
            </option>

            <option value="all">
              All
            </option>

          </select>

          <button
            id="setGradebookDefault"
            type="button"
            class="btn btn-sm btn-light">

            ☆ デフォルトに設定

          </button>

          <span
            id="gradebookDefaultLabel"
            class="tiny muted">
          </span>

        </div>


        <button
          id="exportGradebookCsv"
          type="button"
          class="btn btn-light">

          CSV Export

        </button>
      `;


    tableWrap.insertAdjacentElement(
      'beforebegin',
      controls
    );


    $('#gradebookMetricMode')
      ?.addEventListener(
        'change',
        event => {

          gradebookMetricMode =
            event.target.value;


          renderTable();
        }
      );


    $('#exportGradebookCsv')
      ?.addEventListener(
        'click',
        exportGradebookCsv
      );

    $('#setGradebookDefault')
      ?.addEventListener(
        'click',
        () => {

          gradebookDefaultMetric =
            gradebookMetricMode;


          localStorage.setItem(
            'copeak_gradebook_default_metric',
            gradebookDefaultMetric
          );


          updateGradebookDefaultLabel();
        }
      );
  }


  const select =
    $('#gradebookMetricMode');


  if (select) {
    select.value =
      gradebookMetricMode;
  }


  const hint =
    tableWrap
      .nextElementSibling;


  if (
    hint &&
    hint.classList
      ?.contains(
        'muted'
      )
  ) {

    hint.textContent =
      'Accuracy / WPM / Comprehension を切り替えて表示できます。各スコアをクリックすると先生が手動修正できます。マウスを置くと全指標を確認できます。';
  }
}


function metricManualValue(
  manualRow,
  metric
) {

  if (!manualRow) {
    return null;
  }


  const field =
    metric === 'accuracy'
      ? 'score'
      : metric;


  const value =
    manualRow[field];


  if (
    value === null ||
    value === undefined
  ) {

    return null;
  }


  return Math.round(
    Number(value)
  );
}


function csvEscape(
  value
) {

  const text =
    String(
      value ??
      ''
    );


  return `"${text.replace(
    /"/g,
    '""'
  )}"`;
}


function assignmentPassResult(
  assignment,
  accuracy,
  wpm,
  comprehension
) {

  if (
    assignment.pass_enabled !== true
  ) {

    return {
      configured: false,
      passed: false
    };
  }


  const normalize =
    value => {

      if (
        value === null ||
        value === undefined ||
        value === ''
      ) {
        return null;
      }


      const number =
        Number(value);


      return Number.isFinite(number)
        ? number
        : null;
    };


  const accuracyTarget =
    normalize(
      assignment.pass_accuracy
    );


  const wpmTarget =
    normalize(
      assignment.pass_wpm
    );


  const comprehensionTarget =
    normalize(
      assignment.pass_comprehension
    );


  const configured =
    accuracyTarget !== null ||
    wpmTarget !== null ||
    comprehensionTarget !== null;


  if (!configured) {

    return {
      configured: false,
      passed: false
    };
  }


  const checks = [];


  if (accuracyTarget !== null) {

    checks.push(
      accuracy !== null &&
      accuracy >= accuracyTarget
    );
  }


  if (wpmTarget !== null) {

    checks.push(
      wpm !== null &&
      wpm >= wpmTarget
    );
  }


  if (
    comprehensionTarget !== null
  ) {

    checks.push(
      comprehension !== null &&
      comprehension >=
        comprehensionTarget
    );
  }


  return {
    configured: true,
    passed:
      checks.length > 0 &&
      checks.every(Boolean)
  };
}

function exportGradebookCsv() {

  const activeAssignments =
    visibleAssignments();


  const bestAccuracy =
    bestSubmissionMap(
      submissions
    );


  const bestWpm =
    bestWpmSubmissionMap(
      submissions
    );


  const bestComp =
    bestComprehensionSubmissionMap(
      submissions
    );


  const manual =
    manualScoreMap(
      manualScores
    );


  const attempts =
    attemptCountMap(
      submissions
    );


  const headers = [
    'Student No.',
    'Student'
  ];


  activeAssignments.forEach(
    assignment => {

      headers.push(
        `#${assignment.week_no} Accuracy`,
        `#${assignment.week_no} WPM`,
        `#${assignment.week_no} Comprehension`,
        `#${assignment.week_no} Reads`,
        `#${assignment.week_no} Pass`
      );

    }
  );


  const rows =
    students.map(
      student => {

        const row = [
          student.student_number ||
            '',
          student.display_name ||
            ''
        ];


        activeAssignments.forEach(
          assignment => {

            const key =
              `${student.id}|${assignment.id}`;


            const manualRow =
              manual.get(key);


            const accuracyResult =
              bestAccuracy.get(key);

            const wpmResult =
              bestWpm.get(key);

            const compResult =
              bestComp.get(key);


            const manualAccuracy =
              metricManualValue(
                manualRow,
                'accuracy'
              );


            const manualWpm =
              metricManualValue(
                manualRow,
                'wpm'
              );


            const manualComp =
              metricManualValue(
                manualRow,
                'comprehension'
              );


            const accuracy =
              manualAccuracy ??
              (
                accuracyResult
                  ? Math.round(
                      Number(
                        accuracyResult.accuracy ||
                        0
                      )
                    )
                  : ''
              );


            const wpm =
              manualWpm ??
              (
                wpmResult
                  ? Math.round(
                      Number(
                        wpmResult.wpm ||
                        0
                      )
                    )
                  : ''
              );


            const comprehension =
              manualComp ??
              (
                compResult
                  ? Math.round(
                      Number(
                        compResult.comprehension ||
                        0
                      )
                    )
                  : ''
              );


            const passResultCsv =
              assignmentPassResult(
                assignment,
                accuracy === ''
                  ? null
                  : accuracy,
                wpm === ''
                  ? null
                  : wpm,
                comprehension === ''
                  ? null
                  : comprehension
              );


            row.push(
              accuracy,
              wpm,
              comprehension,
              attempts.get(key) ||
                0,
              passResultCsv.configured
                ? (
                    passResultCsv.passed
                      ? 'PASS'
                      : 'NOT YET'
                  )
                : ''
            );

          }
        );


        return row;
      }
    );


  const csv =
    [
      headers,
      ...rows
    ]
      .map(
        row =>
          row
            .map(csvEscape)
            .join(',')
      )
      .join(
        "`r`n"
      );


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


  const link =
    document.createElement(
      'a'
    );


  link.href =
    url;


  link.download =
    'copeak-gradebook.csv';


  document.body.appendChild(
    link
  );


  link.click();

  link.remove();


  URL.revokeObjectURL(
    url
  );
}

function renderTable() {

  ensureGradebookControls();


  const activeAssignments =
    visibleAssignments();


  const bestAccuracy =
    bestSubmissionMap(
      submissions
    );


  const bestWpm =
    bestWpmSubmissionMap(
      submissions
    );


  const bestComp =
    bestComprehensionSubmissionMap(
      submissions
    );


  const manual =
    manualScoreMap(
      manualScores
    );


  const attempts =
    attemptCountMap(
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
        student.display_name
          .toLowerCase()
          .includes(query)
        ||
        String(
          student.student_number ||
          ''
        ).includes(query)
    );


  $('#gradeHead').innerHTML =
    `
      <tr>

        <th>Student</th>

        ${
          activeAssignments
            .map(
              assignment =>
                `<th>#${assignment.week_no}</th>`
            )
            .join('')
        }

        <th>Reads</th>
        <th>Done</th>
        <th>Avg.</th>

      </tr>
    `;


  $('#gradeBody').innerHTML =
    visibleStudents
      .map(
        student => {

          let done = 0;
          let totalReads = 0;

          let aSum = 0;
          let aCount = 0;

          let wSum = 0;
          let wCount = 0;

          let cSum = 0;
          let cCount = 0;


          const cells =
            activeAssignments
              .map(
                assignment => {

                  const key =
                    `${student.id}|${assignment.id}`;


                  const manualRow =
                    manual.get(key);


                  const aResult =
                    bestAccuracy.get(key);

                  const wResult =
                    bestWpm.get(key);

                  const cResult =
                    bestComp.get(key);


                  const manualA =
                    metricManualValue(
                      manualRow,
                      'accuracy'
                    );


                  const manualW =
                    metricManualValue(
                      manualRow,
                      'wpm'
                    );


                  const manualC =
                    metricManualValue(
                      manualRow,
                      'comprehension'
                    );


                  const accuracy =
                    manualA ??
                    (
                      aResult
                        ? Math.round(
                            Number(
                              aResult.accuracy ||
                              0
                            )
                          )
                        : null
                    );


                  const wpm =
                    manualW ??
                    (
                      wResult
                        ? Math.round(
                            Number(
                              wResult.wpm ||
                              0
                            )
                          )
                        : null
                    );


                  const comprehension =
                    manualC ??
                    (
                      cResult
                        ? Math.round(
                            Number(
                              cResult.comprehension ||
                              0
                            )
                          )
                        : null
                    );


                  const reads =
                    attempts.get(key) ||
                    0;


                  totalReads +=
                    reads;


                  if (
                    accuracy !== null ||
                    wpm !== null ||
                    comprehension !== null
                  ) {
                    done++;
                  }


                  if (accuracy !== null) {
                    aSum += accuracy;
                    aCount++;
                  }


                  if (wpm !== null) {
                    wSum += wpm;
                    wCount++;
                  }


                  if (
                    comprehension !== null
                  ) {
                    cSum += comprehension;
                    cCount++;
                  }


                  const detail =
                    `Accuracy ${
                      accuracy === null
                        ? '—'
                        : `${accuracy}%`
                    } / WPM ${
                      wpm === null
                        ? '—'
                        : wpm
                    } / Comprehension ${
                      comprehension === null
                        ? '—'
                        : `${comprehension}%`
                    } / Reads ${reads}`;


                  const passResult =
                    assignmentPassResult(
                      assignment,
                      accuracy,
                      wpm,
                      comprehension
                    );


                  const passHtml =
                    passResult.passed

                      ? `
                          <div
                            class="grade-pass-badge"
                            title="設定された合格基準をすべてクリア">

                            ✓ PASS

                          </div>
                        `

                      : '';

                  const metricButton =
                    (
                      metric,
                      label,
                      value
                    ) => {

                      return `
                        <button
                          type="button"
                          class="grade grade-score-edit ${
                            value === null
                              ? 'missing'
                              : ''
                          }"
                          data-metric-edit="1"
                          data-metric="${metric}"
                          data-student-id="${student.id}"
                          data-assignment-id="${assignment.id}"
                          data-current-value="${
                            value === null
                              ? ''
                              : value
                          }"
                          title="${esc(
                            `${detail} / ${label}をクリックして修正`
                          )}">

                          ${
                            label
                              ? `${label} `
                              : ''
                          }${
                            value === null
                              ? '—'
                              : value
                          }

                        </button>
                      `;
                    };


                  let display =
                    '';


                  if (
                    gradebookMetricMode ===
                    'wpm'
                  ) {

                    display =
                      metricButton(
                        'wpm',
                        '',
                        wpm
                      );

                  } else if (
                    gradebookMetricMode ===
                    'comprehension'
                  ) {

                    display =
                      metricButton(
                        'comprehension',
                        '',
                        comprehension
                      );

                  } else if (
                    gradebookMetricMode ===
                    'all'
                  ) {

                    display =
                      `
                        <div class="grade-metric-stack">

                          ${metricButton(
                            'accuracy',
                            'A',
                            accuracy
                          )}

                          ${metricButton(
                            'wpm',
                            'W',
                            wpm
                          )}

                          ${metricButton(
                            'comprehension',
                            'C',
                            comprehension
                          )}

                        </div>
                      `;

                  } else {

                    display =
                      metricButton(
                        'accuracy',
                        '',
                        accuracy
                      );
                  }


                  return `
                    <td
                      title="${esc(
                        detail
                      )}">

                      ${display}

                      ${passHtml}

                      <div class="tiny muted">
                        ${reads}
                        read${reads === 1 ? '' : 's'}
                      </div>

                    </td>
                  `;
                }
              )
              .join('');


          const avgA =
            aCount
              ? Math.round(
                  aSum /
                  aCount
                )
              : null;


          const avgW =
            wCount
              ? Math.round(
                  wSum /
                  wCount
                )
              : null;


          const avgC =
            cCount
              ? Math.round(
                  cSum /
                  cCount
                )
              : null;


          const average =
            gradebookMetricMode ===
              'wpm'

              ? (
                  avgW ??
                  '—'
                )

              : gradebookMetricMode ===
                  'comprehension'

                ? (
                    avgC === null
                      ? '—'
                      : `${avgC}%`
                  )

                : gradebookMetricMode ===
                    'all'

                  ? `A ${
                      avgA ?? '—'
                    } / W ${
                      avgW ?? '—'
                    } / C ${
                      avgC ?? '—'
                    }`

                  : (
                      avgA === null
                        ? '—'
                        : `${avgA}%`
                    );


          return `
            <tr>

              <td>

                <span class="gradebook-student-number">
                  ${esc(
                    student.student_number ||
                    '—'
                  )}
                </span>

                <strong>
                  ${esc(
                    student.display_name
                  )}
                </strong>

              </td>

              ${cells}

              <td>
                <strong>
                  ${totalReads}
                </strong>
              </td>

              <td>
                <strong>
                  ${done}/${activeAssignments.length}
                </strong>
              </td>

              <td>
                <strong>
                  ${average}
                </strong>
              </td>

            </tr>
          `;

        }
      )
      .join('');
}


// ==========================================
// ASSIGNMENT READING LEADERBOARD
// ==========================================

function teacherRankStudent(
  studentId
) {

  return students.find(
    student =>
      student.id ===
      studentId
  ) ||
  null;
}


function teacherRankBadge(
  value
) {

  const rank =
    Number(value);


  if (
    !Number.isFinite(rank) ||
    rank <= 0
  ) {

    return '—';
  }


  if (rank === 1) {
    return '🥇';
  }


  if (rank === 2) {
    return '🥈';
  }


  if (rank === 3) {
    return '🥉';
  }


  return `#${Math.round(rank)}`;
}


function teacherRankableAssignments() {

  const rankIds =
    new Set(
      readingRankings.map(
        row =>
          row.assignment_id
      )
    );


  return assignments
    .filter(
      assignment =>
        assignment
          .is_published !==
          false &&
        rankIds.has(
          assignment.id
        )
    )
    .sort(
      (a, b) =>
        Number(
          b.week_no || 0
        ) -
        Number(
          a.week_no || 0
        )
    );
}


function leaderboardColumn(
  sourceRows,
  title,
  icon,
  rankKey,
  valueKey,
  formatter
) {

  const rows =
    sourceRows
      .filter(
        row =>
          row[rankKey] !==
            null &&
          row[rankKey] !==
            undefined
      )
      .sort(
        (a, b) =>
          Number(
            a[rankKey]
          ) -
          Number(
            b[rankKey]
          )
      )
      .slice(
        0,
        5
      );


  const items =
    rows.length

      ? rows
          .map(
            row => {

              const student =
                teacherRankStudent(
                  row.student_id
                );


              const name =
                student
                  ?.display_name ||
                'Student';


              const number =
                student
                  ?.student_number

                  ? `No.${student.student_number}`

                  : '';


              return `
                <div class="teacher-rank-row">

                  <div class="teacher-rank-place">

                    ${teacherRankBadge(
                      row[rankKey]
                    )}

                  </div>

                  <div class="teacher-rank-student">

                    <strong>
                      ${esc(name)}
                    </strong>

                    <span>
                      ${esc(number)}
                    </span>

                  </div>

                  <div class="teacher-rank-score">

                    ${formatter(
                      row[valueKey]
                    )}

                  </div>

                </div>
              `;
            }
          )
          .join('')

      : `
          <div class="teacher-rank-empty">
            まだ記録がありません。
          </div>
        `;


  return `
    <div class="teacher-rank-column">

      <div class="teacher-rank-column-title">

        <span>
          ${icon}
        </span>

        <strong>
          ${title}
        </strong>

      </div>

      ${items}

    </div>
  `;
}


function leaderboardPresentationActive() {

  const root =
    $('#classReadingLeaderboard');


  return Boolean(
    root &&
    (
      document.fullscreenElement ===
        root ||
      document.body.classList.contains(
        'leaderboard-presenting'
      )
    )
  );
}


async function toggleLeaderboardPresentation() {

  const root =
    $('#classReadingLeaderboard');


  if (!root) {
    return;
  }


  const active =
    leaderboardPresentationActive();


  if (active) {

    if (
      document.fullscreenElement &&
      typeof document.exitFullscreen ===
        'function'
    ) {

      try {
        await document.exitFullscreen();
      } catch (error) {

        console.warn(
          '[Copeak Classroom] fullscreen exit failed',
          error
        );
      }
    }


    document.body.classList.remove(
      'leaderboard-presenting'
    );


    root.dataset.rankSignature =
      '';


    renderClassLeaderboard();

    return;
  }


  document.body.classList.add(
    'leaderboard-presenting'
  );


  root.dataset.rankSignature =
    '';


  renderClassLeaderboard();


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

      // requestFullscreen非対応・拒否時も
      // fixedレイアウトの投影モードは維持する。
      console.warn(
        '[Copeak Classroom] native fullscreen unavailable',
        error
      );
    }
  }
}


function leaderboardStudentOptions(
  rows
) {

  const map =
    new Map();


  rows.forEach(
    row => {

      if (
        map.has(
          row.student_id
        )
      ) {
        return;
      }


      const student =
        teacherRankStudent(
          row.student_id
        );


      map.set(
        row.student_id,
        {
          id:
            row.student_id,

          name:
            student
              ?.display_name ||
            'Student',

          number:
            student
              ?.student_number ||
            ''
        }
      );
    }
  );


  return [
    ...map.values()
  ].sort(
    (a, b) => {

      const numberA =
        Number(
          a.number
        );

      const numberB =
        Number(
          b.number
        );


      if (
        Number.isFinite(numberA) &&
        Number.isFinite(numberB) &&
        numberA !== numberB
      ) {

        return numberA -
          numberB;
      }


      return String(
        a.name
      ).localeCompare(
        String(
          b.name
        ),
        'ja'
      );
    }
  );
}


function renderClassLeaderboard() {

  const metricsSection =
    $('#classAverage')
      ?.closest(
        'section'
      );


  if (!metricsSection) {
    return;
  }


  let root =
    $('#classReadingLeaderboard');


  if (!root) {

    root =
      document.createElement(
        'section'
      );


    root.id =
      'classReadingLeaderboard';


    root.className =
      'paper section class-reading-leaderboard';


    metricsSection
      .insertAdjacentElement(
        'afterend',
        root
      );
  }


  const rankAssignments =
    teacherRankableAssignments();


  if (!rankAssignments.length) {

    root.innerHTML = `
      <div class="panel-title">

        <div>

          <div class="eyebrow">
            ASSIGNMENT LEADERBOARD
          </div>

          <h2>
            課題別 Reading Ranking
          </h2>

        </div>

      </div>


      <div class="teacher-rank-empty">
        順位を表示できる公開済み課題はまだありません。
      </div>
    `;


    return;
  }


  if (
    !rankAssignments.some(
      assignment =>
        assignment.id ===
        activeReadingRankAssignmentId
    )
  ) {

    activeReadingRankAssignmentId =
      rankAssignments[0].id;
  }


  const selectedAssignment =
    rankAssignments.find(
      assignment =>
        assignment.id ===
        activeReadingRankAssignmentId
    ) ||
    rankAssignments[0];


  const selectedRows =
    readingRankings.filter(
      row =>
        row.assignment_id ===
        selectedAssignment.id
    );


  const filterStudents =
    leaderboardStudentOptions(
      selectedRows
    );


  const visibleRows =
    selectedRows.filter(
      row =>
        !leaderboardHiddenStudentIds
          .has(
            row.student_id
          )
    );


  const totalStudents =
    Math.max(
      0,
      Number(
        selectedRows[0]
          ?.total_students
      ) || 0
    );


  const submittedStudents =
    selectedRows.filter(
      row =>
        Number(
          row.total_attempts
        ) > 0
    ).length;


  const hiddenCount =
    filterStudents.filter(
      student =>
        leaderboardHiddenStudentIds
          .has(
            student.id
          )
    ).length;


  const visibleMetricCount =
    Math.max(
      1,
      leaderboardVisibleMetrics
        .size
    );


  const isPresenting =
    leaderboardPresentationActive();


  const signature =
    [
      selectedAssignment.id,
      totalStudents,
      submittedStudents,
      JSON.stringify(
        selectedRows
      ),
      [
        ...leaderboardVisibleMetrics
      ]
        .sort()
        .join(','),
      [
        ...leaderboardHiddenStudentIds
      ]
        .sort()
        .join(','),
      leaderboardStudentFilterOpen
        ? 'filter-open'
        : 'filter-closed',
      isPresenting
        ? 'presenting'
        : 'normal',
      rankAssignments
        .map(
          assignment =>
            `${assignment.id}:${assignment.week_no}:${assignment.title}`
        )
        .join('|')
    ].join('::');


  if (
    root.dataset
      .rankSignature ===
    signature
  ) {

    return;
  }


  root.dataset.rankSignature =
    signature;


  const options =
    rankAssignments
      .map(
        assignment => `
          <option
            value="${assignment.id}"
            ${
              assignment.id ===
              selectedAssignment.id
                ? 'selected'
                : ''
            }>

            No.${esc(
              assignment.week_no
            )} — ${esc(
              assignment.title
            )}

          </option>
        `
      )
      .join('');


  const audienceLabel =
    selectedAssignment
      .audience_type ===
      'targeted'

      ? '個別配布'

      : 'クラス配布';


  const metricToggle =
    (
      key,
      icon,
      label
    ) => {

      const active =
        leaderboardVisibleMetrics
          .has(
            key
          );


      const lastActive =
        active &&
        leaderboardVisibleMetrics
          .size ===
          1;


      return `
        <button
          type="button"
          class="
            teacher-rank-display-toggle
            ${active ? 'active' : ''}
          "
          data-rank-metric="${key}"
          ${lastActive ? 'disabled' : ''}>

          <span>
            ${icon}
          </span>

          ${label}

        </button>
      `;
    };


  const studentCheckboxes =
    filterStudents
      .map(
        student => {

          const hidden =
            leaderboardHiddenStudentIds
              .has(
                student.id
              );


          return `
            <label class="teacher-rank-student-option">

              <input
                type="checkbox"
                data-rank-student-id="${esc(
                  student.id
                )}"
                ${hidden ? '' : 'checked'}>

              <span class="teacher-rank-student-option-number">
                ${
                  student.number
                    ? `No.${esc(
                        student.number
                      )}`
                    : '—'
                }
              </span>

              <strong>
                ${esc(
                  student.name
                )}
              </strong>

            </label>
          `;
        }
      )
      .join('');


  const columns = [];


  if (
    leaderboardVisibleMetrics
      .has(
        'accuracy'
      )
  ) {

    columns.push(
      leaderboardColumn(
        visibleRows,
        'Accuracy',
        '🎯',
        'accuracy_rank',
        'best_accuracy',
        value =>
          value === null ||
          value === undefined

            ? '—'

            : `${
                Number(
                  value
                ).toFixed(1)
              }%`
      )
    );
  }


  if (
    leaderboardVisibleMetrics
      .has(
        'wpm'
      )
  ) {

    columns.push(
      leaderboardColumn(
        visibleRows,
        'WPM',
        '⚡',
        'wpm_rank',
        'best_wpm',
        value =>
          value === null ||
          value === undefined

            ? '—'

            : Math.round(
                Number(
                  value
                )
              )
      )
    );
  }


  if (
    leaderboardVisibleMetrics
      .has(
        'practice'
      )
  ) {

    columns.push(
      leaderboardColumn(
        visibleRows,
        'Practice',
        '🔥',
        'practice_rank',
        'total_attempts',
        value =>
          `${
            Math.max(
              0,
              Number(value) ||
              0
            )
          } reads`
      )
    );
  }


  root.innerHTML = `
    <div class="panel-title teacher-rank-main-title">

      <div>

        <div class="eyebrow">
          ASSIGNMENT LEADERBOARD
        </div>

        <h2>
          ${
            isPresenting
              ? `No.${esc(
                  selectedAssignment.week_no
                )} ${esc(
                  selectedAssignment.title
                )}`
              : '課題別 Reading Ranking'
          }
        </h2>

        <p class="muted">
          ${
            isPresenting
              ? 'READING LEADERBOARD'
              : '課題を選択してTop 5を確認します。'
          }
        </p>

      </div>


      <button
        type="button"
        class="
          btn
          ${
            isPresenting
              ? 'btn-danger'
              : 'btn-dark'
          }
          teacher-rank-present-button
        "
        data-rank-present>

        ${
          isPresenting
            ? '✕ 投影を終了'
            : '🖥 投影モード'
        }

      </button>

    </div>


    <div class="teacher-rank-toolbar">

      <div class="reading-rank-picker ranking-picker-v4 teacher-rank-picker-compact">

        <div class="reading-rank-picker-icon">
          📊
        </div>


        <label class="reading-rank-picker-copy">

          <span>
            ランキングを見る課題
          </span>


          <div class="reading-rank-select-wrap">

            <select
              class="reading-rank-select"
              data-teacher-rank-select>

              ${options}

            </select>

          </div>

        </label>

      </div>


      <div class="teacher-rank-view-controls">

        ${metricToggle(
          'accuracy',
          '🎯',
          'Accuracy'
        )}

        ${metricToggle(
          'wpm',
          '⚡',
          'WPM'
        )}

        ${metricToggle(
          'practice',
          '🔥',
          'Practice'
        )}


        <details
          class="teacher-rank-student-filter"
          ${
            leaderboardStudentFilterOpen
              ? 'open'
              : ''
          }>

          <summary>

            👤 生徒

            ${
              hiddenCount
                ? `<b>${hiddenCount}人非表示</b>`
                : ''
            }

          </summary>


          <div class="teacher-rank-student-menu">

            <div class="teacher-rank-student-menu-head">

              <div>

                <strong>
                  表示する生徒
                </strong>

                <span>
                  チェックを外すと投影画面から非表示になります。
                </span>

              </div>

              ${
                hiddenCount
                  ? `
                    <button
                      type="button"
                      data-rank-reset-students>
                      全員表示
                    </button>
                  `
                  : ''
              }

            </div>


            <div class="teacher-rank-student-list">
              ${studentCheckboxes}
            </div>

          </div>

        </details>

      </div>

    </div>


    <div class="teacher-rank-meta-bar">

      <strong>
        No.${esc(
          selectedAssignment.week_no
        )}
      </strong>

      <span class="teacher-rank-meta-title">
        ${esc(
          selectedAssignment.title
        )}
      </span>

      <span>
        ${audienceLabel}
      </span>

      <span>
        対象 ${totalStudents}人
      </span>

      <span class="submitted">
        提出 ${submittedStudents}/${totalStudents}
      </span>

      ${
        hiddenCount
          ? `
            <span class="teacher-rank-hidden-count">
              非表示 ${hiddenCount}人
            </span>
          `
          : ''
      }

    </div>


    <div
      class="
        teacher-rank-grid
        metrics-${visibleMetricCount}
      ">

      ${columns.join('')}

    </div>


    ${
      submittedStudents === 0

        ? `
          <div class="teacher-rank-no-submissions">

            <strong>
              まだ提出はありません。
            </strong>

            <span>
              最初の結果が保存されるとランキングが表示されます。
            </span>

          </div>
        `

        : ''
    }
  `;


  root
    .querySelector(
      '[data-teacher-rank-select]'
    )
    ?.addEventListener(
      'change',
      event => {

        activeReadingRankAssignmentId =
          event.target.value;


        root.dataset.rankSignature =
          '';


        renderClassLeaderboard();
      }
    );


  root
    .querySelectorAll(
      '[data-rank-metric]'
    )
    .forEach(
      button => {

        button.addEventListener(
          'click',
          () => {

            const metric =
              button.dataset
                .rankMetric;


            if (
              leaderboardVisibleMetrics
                .has(
                  metric
                )
            ) {

              if (
                leaderboardVisibleMetrics
                  .size <= 1
              ) {
                return;
              }


              leaderboardVisibleMetrics
                .delete(
                  metric
                );

            } else {

              leaderboardVisibleMetrics
                .add(
                  metric
                );
            }


            root.dataset.rankSignature =
              '';


            renderClassLeaderboard();
          }
        );
      }
    );


  const studentDetails =
    root.querySelector(
      '.teacher-rank-student-filter'
    );


  studentDetails
    ?.addEventListener(
      'toggle',
      () => {

        leaderboardStudentFilterOpen =
          studentDetails.open;
      }
    );


  root
    .querySelectorAll(
      '[data-rank-student-id]'
    )
    .forEach(
      checkbox => {

        checkbox.addEventListener(
          'change',
          () => {

            const studentId =
              checkbox.dataset
                .rankStudentId;


            if (
              checkbox.checked
            ) {

              leaderboardHiddenStudentIds
                .delete(
                  studentId
                );

            } else {

              leaderboardHiddenStudentIds
                .add(
                  studentId
                );
            }


            leaderboardStudentFilterOpen =
              true;


            root.dataset.rankSignature =
              '';


            renderClassLeaderboard();
          }
        );
      }
    );


  root
    .querySelector(
      '[data-rank-reset-students]'
    )
    ?.addEventListener(
      'click',
      event => {

        event.preventDefault();


        leaderboardHiddenStudentIds
          .clear();


        leaderboardStudentFilterOpen =
          true;


        root.dataset.rankSignature =
          '';


        renderClassLeaderboard();
      }
    );


  root
    .querySelector(
      '[data-rank-present]'
    )
    ?.addEventListener(
      'click',
      toggleLeaderboardPresentation
    );
}


document.addEventListener(
  'fullscreenchange',
  () => {

    const root =
      $('#classReadingLeaderboard');


    if (!root) {
      return;
    }


    if (
      document.fullscreenElement !==
      root
    ) {

      document.body.classList.remove(
        'leaderboard-presenting'
      );
    }


    root.dataset.rankSignature =
      '';


    renderClassLeaderboard();
  }
);


document.addEventListener(
  'keydown',
  event => {

    if (
      event.key !==
      'Escape'
    ) {
      return;
    }


    if (
      document.fullscreenElement
    ) {
      return;
    }


    if (
      !document.body.classList.contains(
        'leaderboard-presenting'
      )
    ) {
      return;
    }


    document.body.classList.remove(
      'leaderboard-presenting'
    );


    const root =
      $('#classReadingLeaderboard');


    if (root) {

      root.dataset.rankSignature =
        '';


      renderClassLeaderboard();
    }
  }
);

function render() {

  renderSummary();

  renderClassLeaderboard();

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

async function saveManualMetric(
  studentId,
  assignmentId,
  metric,
  value
) {

  const {
    error
  } =
    await getClient(
      'teacher'
    )
      .rpc(
        'set_manual_metric',
        {

          p_assignment_id:
            assignmentId,

          p_student_id:
            studentId,

          p_metric:
            metric,

          p_value:
            value

        }
      );


  if (error) {
    throw error;
  }


  let row =
    manualScores.find(
      item =>
        item.student_id ===
          studentId &&
        item.assignment_id ===
          assignmentId
    );


  if (!row) {

    row = {
      student_id:
        studentId,

      assignment_id:
        assignmentId,

      score:
        null,

      wpm:
        null,

      comprehension:
        null
    };


    manualScores.push(
      row
    );
  }


  const field =
    metric === 'accuracy'
      ? 'score'
      : metric;


  row[field] =
    value;


  if (
    row.score === null &&
    row.wpm === null &&
    row.comprehension === null
  ) {

    manualScores =
      manualScores.filter(
        item =>
          item !== row
      );
  }


  render();
}


function beginManualMetricEdit(
  button
) {

  const studentId =
    button.dataset.studentId;


  const assignmentId =
    button.dataset.assignmentId;


  const metric =
    button.dataset.metric;


  const current =
    button.dataset.currentValue ||
    '';


  const input =
    document.createElement(
      'input'
    );


  input.type =
    'number';

  input.min =
    '0';

  input.step =
    '1';


  if (
    metric === 'accuracy' ||
    metric === 'comprehension'
  ) {

    input.max =
      '100';
  }


  input.value =
    current;

  input.className =
    'grade-score-input';


  button.replaceWith(
    input
  );


  input.focus();

  input.select();


  let finished =
    false;


  const finish =
    async save => {

      if (finished) {
        return;
      }


      finished =
        true;


      if (!save) {

        renderTable();

        return;
      }


      const raw =
        input.value.trim();


      const value =
        raw === ''
          ? null
          : Math.round(
              Number(raw)
            );


      const invalidPercent =
        (
          metric === 'accuracy' ||
          metric === 'comprehension'
        ) &&
        value !== null &&
        (
          value < 0 ||
          value > 100
        );


      const invalidWpm =
        metric === 'wpm' &&
        value !== null &&
        value < 0;


      if (
        value !== null &&
        (
          !Number.isFinite(
            value
          ) ||
          invalidPercent ||
          invalidWpm
        )
      ) {

        finished =
          false;

        input.focus();

        input.select();

        return;
      }


      input.disabled =
        true;


      try {

        await saveManualMetric(
          studentId,
          assignmentId,
          metric,
          value
        );

      } catch (
        error
      ) {

        console.error(
          error
        );


        await showInfoModal({

          badge:
            'Error',

          badgeType:
            'danger',

          title:
            'スコアを保存できませんでした',

          message:
            error.message ||
            String(error)

        });


        renderTable();
      }
    };


  input.addEventListener(
    'keydown',
    event => {

      if (
        event.key ===
        'Enter'
      ) {

        event.preventDefault();

        finish(true);
      }


      if (
        event.key ===
        'Escape'
      ) {

        event.preventDefault();

        finish(false);
      }
    }
  );


  input.addEventListener(
    'blur',
    () => {

      finish(true);
    }
  );
}


$('#gradeBody')
  ?.addEventListener(
    'click',
    event => {

      const button =
        event.target.closest(
          '[data-metric-edit]'
        );


      if (!button) {
        return;
      }


      beginManualMetricEdit(
        button
      );
    }
  );


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


  const msg =
    $('#onboardMsg');


  msg.textContent =
    '';


  if (!school) {

    msg.textContent =
      'Schoolを入力してください。';

    return;
  }


  if (!name) {

    msg.textContent =
      'Classを入力してください。';

    return;
  }


  const sb =
    getClient(
  'teacher'
);


try {

    /*
     * 初回Teacherはschool_idを持っていない可能性があるため、
     * 先にSchoolを作成してプロフィールへ設定する。
     */

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


    if (schoolError) {

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


    if (profileError) {

      throw profileError;
    }


    const {
      data: classId,
      error: classError
    } =
      await sb
        .rpc(
          'create_teacher_class',
          {

            p_name:
              name,

            p_academic_year:
              new Date()
                .getFullYear()

          }
        );


    if (classError) {

      throw classError;
    }


    if (classId) {

      localStorage.setItem(
        'copeak_teacher_class_id',
        classId
      );
    }


    location.reload();


  } catch (error) {

    console.error(
      '[Create First Class]',
      error
    );


    await showInfoModal({

      badge:
        'Error',

      badgeType:
        'danger',

      title:
        'クラスを作成できませんでした',

      message:
        error.message ||
        String(error)

    });
  }
}
// ==========================================
// YOUTUBE CLIP
// URL / TIME PARSER
// ==========================================

function extractYoutubeVideoId(
  value
) {

  const input =
    String(
      value || ''
    ).trim();


  if (!input) {
    return null;
  }


  // ========================================
  // Video IDそのものが入力された場合
  // 11文字
  // ========================================

  if (
    /^[A-Za-z0-9_-]{11}$/.test(
      input
    )
  ) {

    return input;
  }


  try {

    const url =
      new URL(
        input
      );


    const host =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ''
        );


    // ======================================
    // youtu.be/VIDEO_ID
    // ======================================

    if (
      host ===
      'youtu.be'
    ) {

      const id =
        url.pathname
          .split('/')
          .filter(Boolean)[0];


      return (
        /^[A-Za-z0-9_-]{11}$/.test(
          id || ''
        )
          ? id
          : null
      );
    }


    // ======================================
    // youtube.com
    // ======================================

    if (
      host ===
        'youtube.com' ||
      host.endsWith(
        '.youtube.com'
      )
    ) {

      // ------------------------------------
      // watch?v=VIDEO_ID
      // ------------------------------------

      const watchId =
        url.searchParams.get(
          'v'
        );


      if (
        /^[A-Za-z0-9_-]{11}$/.test(
          watchId || ''
        )
      ) {

        return watchId;
      }


      // ------------------------------------
      // /shorts/VIDEO_ID
      // /embed/VIDEO_ID
      // /live/VIDEO_ID
      // ------------------------------------

      const parts =
        url.pathname
          .split('/')
          .filter(Boolean);


      const supportedPaths =
        new Set([
          'shorts',
          'embed',
          'live'
        ]);


      if (
        parts.length >=
          2 &&
        supportedPaths.has(
          parts[0]
        ) &&
        /^[A-Za-z0-9_-]{11}$/.test(
          parts[1]
        )
      ) {

        return parts[1];
      }
    }


  } catch {

    return null;
  }


  return null;
}


// ==========================================
// YOUTUBE TIME
//
// 45      → 45
// 0:45    → 45
// 1:20    → 80
// 1:02:30 → 3750
// ==========================================

function parseYoutubeTimeToSeconds(
  value
) {

  const text =
    String(
      value ?? ''
    ).trim();


  if (!text) {

    return null;
  }


  // ========================================
  // 秒だけ
  // ========================================

  if (
    /^\d+$/.test(
      text
    )
  ) {

    return Number(
      text
    );
  }


  // ========================================
  // mm:ss
  // hh:mm:ss
  // ========================================

  if (
    !/^\d+:\d{1,2}(?::\d{1,2})?$/.test(
      text
    )
  ) {

    return null;
  }


  const parts =
    text
      .split(':')
      .map(Number);


  if (
    parts.some(
      part =>
        !Number.isFinite(
          part
        )
    )
  ) {

    return null;
  }


  // ========================================
  // mm:ss
  // ========================================

  if (
    parts.length ===
    2
  ) {

    const [
      minutes,
      seconds
    ] =
      parts;


    if (
      seconds >=
      60
    ) {

      return null;
    }


    return (
      minutes *
        60 +
      seconds
    );
  }


  // ========================================
  // hh:mm:ss
  // ========================================

  if (
    parts.length ===
    3
  ) {

    const [
      hours,
      minutes,
      seconds
    ] =
      parts;


    if (
      minutes >=
        60 ||
      seconds >=
        60
    ) {

      return null;
    }


    return (
      hours *
        3600 +
      minutes *
        60 +
      seconds
    );
  }


  return null;
}


function updateAssignmentYoutubePreview() {

  const input =
    $('#assignmentYoutubeUrl');

  const preview =
    $('#assignmentYoutubePreview');

  const frame =
    $('#assignmentYoutubePreviewFrame');


  if (
    !input ||
    !preview ||
    !frame
  ) {
    return;
  }


  const url =
    input.value
      .trim();


  if (!url) {

    preview.classList.add(
      'hidden'
    );

    frame.src =
      'about:blank';

    delete frame.dataset.videoId;

    return;
  }


  const videoId =
    extractYoutubeVideoId(
      url
    );


  if (!videoId) {

    preview.classList.add(
      'hidden'
    );

    frame.src =
      'about:blank';

    delete frame.dataset.videoId;

    return;
  }


  if (
    frame.dataset.videoId !==
    videoId
  ) {

    frame.src =
      `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&playsinline=1`;

    frame.dataset.videoId =
      videoId;
  }


  preview.classList.remove(
    'hidden'
  );
}

function previewAssignmentYoutubeClip() {

  const url =
    $('#assignmentYoutubeUrl')
      ?.value
      ?.trim() ||
    '';

  const startValue =
    $('#assignmentYoutubeStart')
      ?.value
      ?.trim() ||
    '';

  const endValue =
    $('#assignmentYoutubeEnd')
      ?.value
      ?.trim() ||
    '';

  const frame =
    $('#assignmentYoutubePreviewFrame');

  const preview =
    $('#assignmentYoutubePreview');

  const status =
    $('#assignmentYoutubeStatus');


  if (
    !frame ||
    !preview
  ) {
    return;
  }


  const videoId =
    extractYoutubeVideoId(url);

  if (!videoId) {

    if (status) {
      status.textContent =
        '有効なYouTube URLを入力してください。';
    }

    return;
  }


  const startSeconds =
    parseYoutubeTimeToSeconds(
      startValue
    );

  const endSeconds =
    parseYoutubeTimeToSeconds(
      endValue
    );


  if (
    startSeconds === null ||
    endSeconds === null
  ) {

    if (status) {
      status.textContent =
        'Start と End を入力してください。例：1:25 / 2:10';
    }

    return;
  }


  if (endSeconds <= startSeconds) {

    if (status) {
      status.textContent =
        'End Time は Start Time より後にしてください。';
    }

    return;
  }


  const loop =
    $('#assignmentYoutubeLoop')
      ?.checked ??
    true;


  const params =
    new URLSearchParams({
      rel: '0',
      playsinline: '1',
      autoplay: '1',
      start: String(startSeconds),
      end: String(endSeconds)
    });


  if (loop) {

    params.set(
      'loop',
      '1'
    );

    params.set(
      'playlist',
      videoId
    );
  }


  frame.src =
    `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;

  frame.dataset.videoId =
    videoId;

  preview.classList.remove(
    'hidden'
  );


  if (status) {
    status.textContent =
      `▶ ${startValue} 〜 ${endValue} をプレビュー再生中`;
  }
}


// ==========================================
// READ YOUTUBE CLIP FROM FORM
// ==========================================

function getYoutubeClipFromForm() {

  const url =
    $('#assignmentYoutubeUrl')
      ?.value
      ?.trim() ||
    '';


  const startValue =
    $('#assignmentYoutubeStart')
      ?.value
      ?.trim() ||
    '';


  const endValue =
    $('#assignmentYoutubeEnd')
      ?.value
      ?.trim() ||
    '';


  const loop =
    $('#assignmentYoutubeLoop')
      ?.checked ??
    true;


  // ========================================
  // YouTubeを使用しない教材
  // ========================================

  if (!url) {

    return {
      enabled:
        false,

      url:
        null,

      videoId:
        null,

      startSeconds:
        null,

      endSeconds:
        null,

      loop:
        false
    };
  }


  // ========================================
  // VIDEO ID
  // ========================================

  const videoId =
    extractYoutubeVideoId(
      url
    );


  if (!videoId) {

    throw new Error(
      '有効なYouTube URLを入力してください。'
    );
  }


  // ========================================
  // START
  // ========================================

  const startSeconds =
    startValue
      ? parseYoutubeTimeToSeconds(
          startValue
        )
      : 0;


  if (
    startValue &&
    startSeconds ===
      null
  ) {

    throw new Error(
      'YouTubeのStart Timeを確認してください。例：45 または 0:45'
    );
  }


  // ========================================
  // END
  // ========================================

  const endSeconds =
    endValue
      ? parseYoutubeTimeToSeconds(
          endValue
        )
      : null;


  if (
    endValue &&
    endSeconds ===
      null
  ) {

    throw new Error(
      'YouTubeのEnd Timeを確認してください。例：80 または 1:20'
    );
  }


  // ========================================
  // START / END RANGE
  // ========================================

  if (
    endSeconds !==
      null &&
    endSeconds <=
      startSeconds
  ) {

    throw new Error(
      'YouTubeのEnd TimeはStart Timeより後にしてください。'
    );
  }


  return {

    enabled:
      true,

    url,

    videoId,

    startSeconds,

    endSeconds,

    loop
  };
}
// ==========================================
// NEW ASSIGNMENT FORM
// ==========================================

function restoreAssignmentDialogueForm(
  dialogue = []
) {

  const container =
    $('#assignmentDialogueLines');

  if (!container) {
    return;
  }

  let lines =
    [
      ...container.querySelectorAll(
        '.assignment-dialogue-line'
      )
    ];

  lines
    .slice(2)
    .forEach(
      line =>
        line.remove()
    );

  lines =
    [
      ...container.querySelectorAll(
        '.assignment-dialogue-line'
      )
    ];

  lines.forEach(
    line => {

      const speaker =
        line.querySelector(
          '.assignment-dialogue-speaker'
        );

      const dialogueText =
        line.querySelector(
          '.assignment-dialogue-text'
        );

      if (speaker) {
        speaker.value = '';
      }

      if (dialogueText) {
        dialogueText.value = '';
      }

    }
  );

  const savedDialogue =
    Array.isArray(dialogue)
      ? dialogue
      : [];

  savedDialogue.forEach(
    (item, index) => {

      if (index >= 2) {
        $('#addAssignmentDialogueLine')
          ?.click();
      }

      const currentLines =
        [
          ...container.querySelectorAll(
            '.assignment-dialogue-line'
          )
        ];

      const line =
        currentLines[index];

      if (!line) {
        return;
      }

      const speaker =
        line.querySelector(
          '.assignment-dialogue-speaker'
        );

      const dialogueText =
        line.querySelector(
          '.assignment-dialogue-text'
        );

      if (speaker) {
        speaker.value =
          item?.speaker || '';
      }

      if (dialogueText) {
        dialogueText.value =
          item?.text || '';
      }

    }
  );
}

function resetAssignmentOcr() {

  if (
    assignmentOcrPreviewUrl
  ) {

    URL.revokeObjectURL(
      assignmentOcrPreviewUrl
    );

    assignmentOcrPreviewUrl =
      null;
  }


  assignmentOcrQueueUrls
    .forEach(
      url => {
        URL.revokeObjectURL(
          url
        );
      }
    );


  assignmentOcrQueueUrls =
    [];

  assignmentOcrFiles =
    [];


  const input =
    $('#assignmentOcrImageInput');

  if (input) {
    input.value =
      '';
  }


  const queue =
    $('#assignmentOcrQueue');

  if (queue) {
    queue.innerHTML =
      '';
  }


  const preview =
    $('#assignmentOcrPreview');

  if (preview) {

    preview.removeAttribute(
      'src'
    );

    preview.classList.add(
      'hidden'
    );
  }


  const result =
    $('#assignmentOcrResult');

  if (result) {
    result.value =
      '';
  }


  const resultWrap =
    $('#assignmentOcrResultWrap');

  if (resultWrap) {
    resultWrap.classList.add(
      'hidden'
    );
  }


  const panel =
    $('#assignmentOcrPanel');

  if (panel) {
    panel.classList.add(
      'hidden'
    );
  }


  const status =
    $('#assignmentOcrStatus');

  if (status) {

    status.style.color =
      '';

    status.textContent =
      '印刷された英語教科書のページを撮影または選択してください。';
  }


  const summary =
    $('#assignmentOcrOrderSummary');

  if (summary) {
    summary.textContent =
      '画像を選択してください。';
  }


  const runButton =
    $('#assignmentOcrRun');

  if (runButton) {

    runButton.disabled =
      true;

    runButton.textContent =
      '🔍 この順番で読み取る';
  }
}

function updateAssignmentPassCriteriaState() {

  const enabled =
    $('#assignmentPassEnabled')
      ?.checked ===
    true;


  [
    '#assignmentPassAccuracy',
    '#assignmentPassWpm',
    '#assignmentPassComprehension'
  ]
    .forEach(
      selector => {

        const input =
          $(selector);


        if (input) {
          input.disabled =
            !enabled;
        }
      }
    );


  $('#assignmentPassCriteriaFields')
    ?.classList
    .toggle(
      'is-disabled',
      !enabled
    );
}

// ==========================================
// CROSS-POSTING UI
// ==========================================

function renderAssignmentClassTargets(
  selectedIds = []
) {

  const root =
    $('#assignmentClassList');

  const summary =
    $('#assignmentClassSummary');


  if (
    !root ||
    !summary ||
    !selectedClass
  ) {
    return;
  }


  const selectedSet =
    new Set(
      [
        selectedClass.id,
        ...(selectedIds || [])
      ]
        .filter(Boolean)
    );


  const targeted =
    $('#assignmentAudienceTargeted')
      ?.checked === true;


  root.replaceChildren();


  classes.forEach(
    classItem => {

      const primary =
        classItem.id ===
        selectedClass.id;


      const checked =
        primary ||
        (
          !targeted &&
          selectedSet.has(
            classItem.id
          )
        );


      const disabled =
        primary ||
        targeted;


      const label =
        document.createElement(
          'label'
        );


      label.style.cssText =
        [
          'display:flex',
          'align-items:center',
          'gap:9px',
          'padding:9px 10px',
          'border:1px solid #e5e7eb',
          'border-radius:9px',
          `background:${primary ? '#f0fdf4' : '#ffffff'}`,
          `cursor:${disabled ? 'default' : 'pointer'}`
        ].join(';');


      const input =
        document.createElement(
          'input'
        );


      input.type =
        'checkbox';


      input.className =
        'assignment-class-target';


      input.value =
        classItem.id;


      input.checked =
        checked;


      input.disabled =
        disabled;


      const textWrap =
        document.createElement(
          'span'
        );


      textWrap.style.cssText =
        [
          'display:flex',
          'flex-direction:column',
          'gap:2px',
          'min-width:0'
        ].join(';');


      const name =
        document.createElement(
          'strong'
        );


      name.style.cssText =
        [
          'font-size:13px',
          'line-height:1.3'
        ].join(';');


      name.textContent =
        classItem.name ||
        'Class';


      textWrap.appendChild(
        name
      );


      if (primary) {

        const primaryLabel =
          document.createElement(
            'small'
          );


        primaryLabel.style.cssText =
          [
            'color:#15803d',
            'font-weight:700'
          ].join(';');


        primaryLabel.textContent =
          'Primary Class';


        textWrap.appendChild(
          primaryLabel
        );
      }


      label.append(
        input,
        textWrap
      );


      root.appendChild(
        label
      );
    }
  );


  updateAssignmentClassSummary();
}


function getSelectedAssignmentClassIds() {

  if (!selectedClass) {
    return [];
  }


  const ids =
    new Set([
      selectedClass.id
    ]);


  document
    .querySelectorAll(
      '.assignment-class-target:checked'
    )
    .forEach(
      input => {

        if (
          input.value
        ) {

          ids.add(
            input.value
          );
        }
      }
    );


  return [
    ...ids
  ];
}


function updateAssignmentClassSummary() {

  const summary =
    $('#assignmentClassSummary');


  if (
    !summary ||
    !selectedClass
  ) {
    return;
  }


  const targeted =
    $('#assignmentAudienceTargeted')
      ?.checked === true;


  if (targeted) {

    summary.textContent =
      '個別配布ではPrimary Classのみ使用します。';

    return;
  }


  const ids =
    getSelectedAssignmentClassIds();


  const names =
    classes
      .filter(
        classItem =>
          ids.includes(
            classItem.id
          )
      )
      .map(
        classItem =>
          classItem.name
      );


  summary.textContent =
    `${ids.length}クラス選択` +
    (
      names.length
        ? ` · ${names.join(' + ')}`
        : ''
    );
}


// ==========================================
// PRACTICE MODE UI
// ==========================================

function updateAssignmentPracticeModeState() {

  const mode =
    $('#assignmentPracticeMode')
      ?.value ||
    'free';


  const lock =
    $('#assignmentModeLocked');


  if (lock) {

    lock.disabled =
      mode ===
      'free';


    if (
      mode ===
      'free'
    ) {

      lock.checked =
        false;
    }
  }


  $('#assignmentPacedSettings')
    ?.classList
    .toggle(
      'hidden',
      mode !==
      'paced'
    );


  $('#assignmentVanishSettings')
    ?.classList
    .toggle(
      'hidden',
      mode !==
      'vanish'
    );


  $('#assignmentShadowingNotice')
    ?.classList
    .toggle(
      'hidden',
      mode !==
      'shadowing'
    );
}


// COPEAK_DELIVERY_SAFETY_V1
function previewAssignmentDelivery() {
  const dialogueMode = $('#assignmentLessonType')?.value === 'dialogue';
  const dialogue = dialogueMode ? getAssignmentDialogueFromForm() : [];

  const english = dialogueMode
    ? dialogue.map(line => line.text || '').filter(Boolean).join('\n')
    : ($('#assignmentText')?.value || '').trim();

  const japanese = ($('#assignmentTranslation')?.value || '').trim();
  const title = ($('#assignmentTitle')?.value || '').trim()
    || 'Reading Assignment';

  const previous = editingAssignmentId
    ? assignments.find(item => item.id === editingAssignmentId)
    : null;

  const url = new URL(
    previous?.copeak_url ||
    window.COPEAK_CONFIG?.copeakBaseUrl ||
    'https://copeak.pic-speak-story.com/'
  );

  const p = url.searchParams;

  p.set('classroom_assignment',
    editingAssignmentId || '00000000-0000-0000-0000-000000000000');
  p.set('source', 'copeak-classroom');
  p.set('classroom_origin', location.origin);

  const mode = $('#assignmentPracticeMode')?.value || 'free';
  p.set('practice_mode', mode);
  p.set('mode_locked', $('#assignmentModeLocked')?.checked ? '1' : '0');

  if (mode === 'paced') {
    p.set('paced_target_wpm',
      $('#assignmentPacedTargetWpm')?.value || '120');
  }

  if (mode === 'vanish') {
    p.set('vanish_level',
      $('#assignmentVanishLevel')?.value || '3');
  }

  p.set('title', title);
  p.set('eng', english);
  p.set('jpn', japanese);
  p.set('lang', $('#assignmentLang')?.value || 'en-US');

  if (dialogueMode && dialogue.length) {
    p.set('type', 'dialogue');
    p.set('dialogue', JSON.stringify(dialogue));
  }

  const hasAudio = Boolean(
    $('#assignmentAudio')?.files?.length ||
    previous?.audio_object_key ||
    previous?.audio_url
  );

  const hasImage = Boolean(
    $('#assignmentImage')?.files?.length ||
    previous?.image_object_key
  );

  const reserve =
    150 + (hasAudio ? 1800 : 0) + (hasImage ? 1800 : 0);

  return {
    ...reviewDeliveryUrl(url, reserve),
    englishCount: english.length,
    japaneseCount: japanese.length
  };
}

function updateAssignmentDeliveryStatus() {
  const status = $('#assignmentDeliveryStatus');
  const stats = $('#assignmentDeliveryStats');

  if (!status || !stats) return;

  try {
    const d = previewAssignmentDelivery();

    stats.textContent =
      '英語 ' + d.englishCount.toLocaleString('ja-JP') +
      '文字 ／ 日本語訳 ' +
      d.japaneseCount.toLocaleString('ja-JP') +
      '文字 ／ 配信データ約 ' +
      d.full.toLocaleString('ja-JP') + '文字';

    if (d.tooLong) {
      status.textContent =
        '⚠ 文章量が多すぎます。日本語訳を送らなくても開けないおそれがあります。英文を複数の課題に分けてください。';
      status.style.color = '#b91c1c';
    } else if (d.omitJapanese) {
      status.textContent =
        '⚠ 文章量が多いため、生徒の音読画面には日本語訳を送らず、教材を開きやすくします。日本語訳は保存されます。';
      status.style.color = '#92400e';
    } else if (d.warning) {
      status.textContent =
        '△ 文章量が多めです。一部の端末では開きにくくなる場合があります。';
      status.style.color = '#92400e';
    } else {
      status.textContent =
        '✓ 配信データは短めです（すべての端末での動作を保証するものではありません）。';
      status.style.color = '#166534';
    }
  } catch (error) {
    status.textContent =
      '配信状態を確認できませんでした。教材の入力内容をご確認ください。';
    status.style.color = '#b91c1c';
    console.warn('[Copeak Classroom] delivery preview failed', error);
  }
}

function ensureAssignmentDeliveryPanel() {
  if ($('#assignmentDeliverySafety')) return;

  const field = $('#assignmentTranslation')?.closest('.field');
  if (!field) return;

  field.insertAdjacentHTML('afterend',
    '<section id="assignmentDeliverySafety" ' +
    'style="border:1px solid #cbd5e1;border-radius:12px;padding:14px;margin-top:12px;background:#f8fafc">' +
    '<strong>🛡 教材の配信チェック</strong>' +
    '<p id="assignmentDeliveryStats" style="font-size:13px;color:#475569;margin:9px 0 6px"></p>' +
    '<p id="assignmentDeliveryStatus" role="status" aria-live="polite" style="font-size:14px;line-height:1.6;margin:0"></p>' +
    '<small style="display:block;margin-top:8px;color:#64748b">日本語訳は削除されません。音声・画像の容量そのものは配信リンクの長さに含まれません。</small>' +
    '</section>'
  );
}
function openAssignmentEditor(
  assignment = null
) {

  resetAssignmentOcr();

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


 
  $('#assignmentCategory').value =
    assignment?.category ||
    'Reading';


  $('#assignmentTitle').value =
    assignment?.title ||
    '';


  const editorAudienceType =
    assignment?.audience_type ===
      'targeted'
      ? 'targeted'
      : 'class';


  $('#assignmentAudienceClass').checked =
    editorAudienceType ===
    'class';


  $('#assignmentAudienceTargeted').checked =
    editorAudienceType ===
    'targeted';


  $('#assignmentTargetPanel')
    .classList
    .toggle(
      'hidden',
      editorAudienceType !==
      'targeted'
    );


  renderAssignmentTargetStudents(
    editorAudienceType ===
      'targeted'
      ? assignment?.target_student_ids ||
        []
      : []
  );


  // ========================================
  // CROSS-POSTING INITIAL STATE
  // ========================================

  renderAssignmentClassTargets(

    assignment?.class_ids ||

    [
      assignment?.class_id ||
      selectedClass?.id
    ]

  );


  // ========================================
  // PRACTICE MODE INITIAL STATE
  // ========================================

  const editorPracticeMode =
    [
      'reading',
      'paced',
      'vanish',
      'shadowing'
    ]
      .includes(
        assignment?.practice_mode
      )

      ? assignment.practice_mode

      : 'free';


  $('#assignmentPracticeMode').value =
    editorPracticeMode;


  $('#assignmentModeLocked').checked =
    assignment?.mode_locked ===
    true;


  $('#assignmentPacedTargetWpm').value =
    assignment?.paced_target_wpm ??
    120;


  $('#assignmentVanishLevel').value =
    assignment?.vanish_level ??
    3;


  updateAssignmentPracticeModeState();

  const editorLessonType =
    assignment?.lesson_type ===
      'dialogue'
      ? 'dialogue'
      : 'text';

  $('#assignmentLessonType').value =
    editorLessonType;

  restoreAssignmentDialogueForm(
    assignment?.lesson_dialogue ||
    []
  );

  const editorIsDialogue =
    editorLessonType ===
    'dialogue';

  $('#assignmentTextEditor')
    .classList
    .toggle(
      'hidden',
      editorIsDialogue
    );

  $('#assignmentDialogueEditor')
    .classList
    .toggle(
      'hidden',
      !editorIsDialogue
    );

  $('#assignmentText').value =
    assignment?.lesson_text ||
    '';


  $('#assignmentTranslation').value =
    assignment?.lesson_translation ||
    '';

  const audioInput =
    $('#assignmentAudio');

  if (audioInput) {
    audioInput.value = '';
  }

  const audioStatus =
    $('#assignmentAudioStatus');

  const removeAudioButton =
    $('#removeAssignmentAudio');

  const hasRegisteredAudio =
    Boolean(
      assignment?.audio_object_key ||
      assignment?.audio_url ||
      assignment?.audio_file_name
    );

  if (audioStatus) {

    audioStatus.style.color =
      hasRegisteredAudio
        ? '#15803d'
        : '';

    audioStatus.textContent =
      hasRegisteredAudio
        ? `✓ 登録済み: ${assignment?.audio_file_name || 'Audio File'}`
        : 'MP3 / WAV · Max 5 MB · Cloud copy expires after 14 days';
  }

  if (removeAudioButton) {

    removeAudioButton.classList.toggle(
      'hidden',
      !hasRegisteredAudio
    );
  }

  const imageInput =
    $('#assignmentImage');


  if (imageInput) {
    imageInput.value =
      '';
  }


  resetAssignmentImagePreview();


  const imageStatus =
    $('#assignmentImageStatus');


  const removeImageButton =
    $('#removeAssignmentImage');


  const hasRegisteredImage =
    Boolean(
      assignment?.image_object_key ||
      assignment?.image_file_name
    );


  if (imageStatus) {

    imageStatus.style.color =
      hasRegisteredImage
        ? '#15803d'
        : '';


    imageStatus.textContent =
      hasRegisteredImage

        ? `✓ 登録済み: ${
            assignment?.image_file_name ||
            'Support Image'
          }`

        : 'PNG / JPG / WebP · Max 5 MB · 縦長・正方形・横長すべて対応';
  }


  if (removeImageButton) {

    removeImageButton
      .classList
      .toggle(
        'hidden',
        !hasRegisteredImage
      );
  }


  $('#assignmentYoutubeUrl').value =
  assignment?.youtube_url ||
  '';


$('#assignmentYoutubeStart').value =
  assignment?.youtube_start_seconds !==
    null &&
  assignment?.youtube_start_seconds !==
    undefined

    ? String(
        assignment.youtube_start_seconds
      )

    : '';


$('#assignmentYoutubeEnd').value =
  assignment?.youtube_end_seconds !==
    null &&
  assignment?.youtube_end_seconds !==
    undefined

    ? String(
        assignment.youtube_end_seconds
      )

    : '';


$('#assignmentYoutubeLoop').checked =
  assignment
    ? assignment.youtube_loop !== false
    : true;

  $('#assignmentLang').value =
    assignment?.lesson_lang ||
    'en-US';


  $('#assignmentRelease').value =
  localDateTimeValue(
    release
  );


$('#assignmentDue').value =
  localDateTimeValue(
    due
  );


    $('#assignmentPassAccuracy').value =
    assignment?.pass_accuracy ??
    '';


  $('#assignmentPassWpm').value =
    assignment?.pass_wpm ??
    '';


  $('#assignmentPassComprehension').value =
    assignment?.pass_comprehension ??
    '';


  const passEnabledForEditor =
    assignment

      ? (
          assignment.pass_enabled === true ||
          (
            assignment.pass_enabled === undefined &&
            (
              assignment.pass_accuracy !== null ||
              assignment.pass_wpm !== null ||
              assignment.pass_comprehension !== null
            )
          )
        )

      : false;


  $('#assignmentPassEnabled').checked =
    passEnabledForEditor;


  updateAssignmentPassCriteriaState();

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
  ensureAssignmentDeliveryPanel();
  updateAssignmentDeliveryStatus();


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

  resetAssignmentOcr();

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


  if (!releaseValue) {
    return;
  }


  const release =
    parseLocalDateTime(
      releaseValue
    );


  if (!release) {
    return;
  }


  const due =
    addDays(
      release,
      6
    );


  $('#assignmentDue').value =
    localDateTimeValue(
      due
    );
}

// ==========================================
// ASSIGNMENT AUDIO
// MP3 / WAV → R2
// ==========================================

const MAX_ASSIGNMENT_AUDIO_SIZE =
  5 * 1024 * 1024;


function getSelectedAssignmentAudio() {

  return (
    $('#assignmentAudio')
      ?.files?.[0] ||
    null
  );
}


function getAssignmentAudioContentType(
  file
) {

  const fileName =
    String(
      file?.name || ''
    )
      .trim()
      .toLowerCase();


  return fileName.endsWith('.wav')
    ? 'audio/wav'
    : 'audio/mpeg';
}


function validateAssignmentAudio(
  file
) {

  if (!file) {
    return;
  }


  const fileName =
    String(
      file.name || ''
    )
      .trim()
      .toLowerCase();


  const supported =
    fileName.endsWith('.mp3') ||
    fileName.endsWith('.wav');


  if (!supported) {

    throw new Error(
      'MP3またはWAVファイルを選択してください。'
    );
  }


  if (
    file.size >
    MAX_ASSIGNMENT_AUDIO_SIZE
  ) {

    throw new Error(
      '音声ファイルは5 MB以下にしてください。'
    );
  }
}

async function uploadAssignmentAudio(
  file
) {

  validateAssignmentAudio(
    file
  );


    const contentType =
    getAssignmentAudioContentType(
      file
    );

const sb =
    getClient(
      'teacher'
    );


  const {
    data: {
      session
    },
    error:
      sessionError
  } =
    await sb
      .auth
      .getSession();


  if (
    sessionError ||
    !session?.access_token
  ) {

    throw new Error(
      'Teacherのログイン情報を確認できません。'
    );
  }


  const signResponse =
    await fetch(
      '/api/r2-upload-url',
      {
        method:
          'POST',

        headers: {

          'Content-Type':
            'application/json',

          'X-Supabase-Access-Token':
            session.access_token

        },

        body:
          JSON.stringify({

            fileName:
              file.name,

            contentType:
              contentType,

            fileSize:
              file.size

          })
      }
    );


  let signed = {};

  try {

    signed =
      await signResponse.json();

  } catch {

    signed = {};

  }


  if (
    !signResponse.ok ||
    !signed.uploadUrl ||
    !signed.objectKey
  ) {

    throw new Error(
      signed.error ||
      '音声ファイルのアップロード準備に失敗しました。'
    );
  }


  const uploadResponse =
    await fetch(
      signed.uploadUrl,
      {
        method:
          'PUT',

        headers: {
          'Content-Type':
            contentType
        },

        body:
          file
      }
    );


  if (
    !uploadResponse.ok
  ) {

    throw new Error(
      `Audio upload failed (${uploadResponse.status}).`
    );
  }


  return {

    objectKey:
      signed.objectKey,

    audioExpiresAt:
      signed.audioExpiresAt,

    contentType:
      signed.contentType || contentType,

    fileName:
      file.name,

    fileSize:
      file.size

  };
}

// ==========================================
// ASSIGNMENT SUPPORT IMAGE
// PNG / JPG / WEBP → R2
// ==========================================

const MAX_ASSIGNMENT_IMAGE_SIZE =
  5 * 1024 * 1024;


let assignmentImagePreviewUrl =
  null;


function getSelectedAssignmentImage() {

  return (
    $('#assignmentImage')
      ?.files?.[0] ||
    null
  );
}


function getAssignmentImageContentType(
  file
) {

  const name =
    String(
      file?.name || ''
    )
      .trim()
      .toLowerCase();


  if (
    name.endsWith(
      '.png'
    )
  ) {
    return 'image/png';
  }


  if (
    name.endsWith(
      '.webp'
    )
  ) {
    return 'image/webp';
  }


  return 'image/jpeg';
}


function validateAssignmentImage(
  file
) {

  if (!file) {
    return;
  }


  const name =
    String(
      file.name || ''
    )
      .trim()
      .toLowerCase();


  const supported =
    name.endsWith('.png') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.webp');


  if (!supported) {

    throw new Error(
      'PNG・JPG・WebP画像を選択してください。'
    );
  }


  if (
    file.size >
    MAX_ASSIGNMENT_IMAGE_SIZE
  ) {

    throw new Error(
      '画像ファイルは5 MB以下にしてください。'
    );
  }
}


function resetAssignmentImagePreview() {

  if (
    assignmentImagePreviewUrl
  ) {

    URL.revokeObjectURL(
      assignmentImagePreviewUrl
    );

    assignmentImagePreviewUrl =
      null;
  }


  const preview =
    $('#assignmentImagePreview');

  const wrap =
    $('#assignmentImagePreviewWrap');


  if (preview) {
    preview.removeAttribute(
      'src'
    );
  }


  wrap
    ?.classList
    .add(
      'hidden'
    );
}


function updateAssignmentImagePreview(
  file
) {

  resetAssignmentImagePreview();


  if (!file) {
    return;
  }


  assignmentImagePreviewUrl =
    URL.createObjectURL(
      file
    );


  const preview =
    $('#assignmentImagePreview');

  const wrap =
    $('#assignmentImagePreviewWrap');


  if (preview) {

    preview.src =
      assignmentImagePreviewUrl;
  }


  wrap
    ?.classList
    .remove(
      'hidden'
    );
}


async function uploadAssignmentImage(
  file
) {

  validateAssignmentImage(
    file
  );


  const contentType =
    getAssignmentImageContentType(
      file
    );


  const sb =
    getClient(
      'teacher'
    );


  const {
    data: {
      session
    },
    error:
      sessionError
  } =
    await sb
      .auth
      .getSession();


  if (
    sessionError ||
    !session?.access_token
  ) {

    throw new Error(
      'Teacherのログイン情報を確認できません。'
    );
  }


  const signResponse =
    await fetch(
      '/api/r2-upload-url',
      {
        method:
          'POST',

        headers: {

          'Content-Type':
            'application/json',

          'X-Supabase-Access-Token':
            session.access_token

        },

        body:
          JSON.stringify({

            fileName:
              file.name,

            contentType,

            fileSize:
              file.size

          })
      }
    );


  let signed = {};


  try {

    signed =
      await signResponse.json();

  } catch {

    signed = {};
  }


  if (
    !signResponse.ok ||
    !signed.uploadUrl ||
    !signed.objectKey ||
    signed.mediaKind !==
      'image'
  ) {

    throw new Error(
      signed.error ||
      '画像のアップロード準備に失敗しました。'
    );
  }


  const uploadResponse =
    await fetch(
      signed.uploadUrl,
      {
        method:
          'PUT',

        headers: {
          'Content-Type':
            contentType
        },

        body:
          file
      }
    );


  if (
    !uploadResponse.ok
  ) {

    throw new Error(
      `Image upload failed (${uploadResponse.status}).`
    );
  }


  return {

    objectKey:
      signed.objectKey,

    contentType:
      signed.contentType ||
      contentType,

    fileName:
      file.name,

    fileSize:
      file.size

  };
}


async function removeAssignmentImage() {

  if (
    !editingAssignmentId
  ) {
    return;
  }


  const assignment =
    assignments.find(
      item =>
        item.id ===
        editingAssignmentId
    );


  if (!assignment) {
    return;
  }


  const ok =
    await showConfirmModal({

      badge:
        'Remove Image',

      badgeType:
        'danger',

      title:
        '補助画像を削除しますか？',

      message:
        'この課題から登録済みの補助画像を解除します。',

      confirmText:
        '画像を削除',

      cancelText:
        'Cancel',

      confirmVariant:
        'danger'

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
      .from(
        'assignments'
      )
      .update({

        image_object_key:
          null,

        image_file_name:
          null,

        image_size_bytes:
          null,

        image_content_type:
          null

      })
      .eq(
        'id',
        editingAssignmentId
      );


  if (error) {
    throw error;
  }


  Object.assign(
    assignment,
    {

      image_object_key:
        null,

      image_file_name:
        null,

      image_size_bytes:
        null,

      image_content_type:
        null

    }
  );


  $('#removeAssignmentImage')
    ?.classList
    .add(
      'hidden'
    );


  const status =
    $('#assignmentImageStatus');


  if (status) {

    status.style.color =
      '';

    status.textContent =
      'PNG / JPG / WebP · Max 5 MB · 縦長・正方形・横長すべて対応';
  }


  resetAssignmentImagePreview();
}


// ==========================================
// CREATE ASSIGNMENT
// ==========================================

// ==========================================
// REMOVE ASSIGNMENT AUDIO
// ==========================================

async function removeAssignmentAudio() {

  if (!editingAssignmentId) {
    return;
  }

  const assignment =
    assignments.find(
      item =>
        item.id ===
        editingAssignmentId
    );

  if (!assignment) {
    return;
  }

  const ok =
    await showConfirmModal({

      badge:
        'Remove Audio',

      badgeType:
        'danger',

      title:
        '登録済みMP3を削除しますか？',

      message:
        `「${assignment.audio_file_name || 'Audio File'}」をこの課題から削除します。

生徒はこの音声を利用できなくなります。`,

      confirmText:
        'MP3を削除',

      cancelText:
        'Cancel',

      confirmVariant:
        'danger'

    });

  if (!ok) {
    return;
  }

  const button =
    $('#removeAssignmentAudio');

  if (button) {
    button.disabled = true;
  }

  try {

    const {
      data,
      error
    } =
      await getClient(
        'teacher'
      )
        .from(
          'assignments'
        )
        .update({

          audio_url: null,
          audio_object_key: null,
          audio_expires_at: null,
          audio_file_name: null,
          audio_size_bytes: null

        })
        .eq(
          'id',
          assignment.id
        )
        .select(
          'id'
        )
        .single();

    if (error) {
      throw error;
    }

    if (!data?.id) {
      throw new Error(
        'MP3を削除できませんでした。'
      );
    }

    assignment.audio_url = null;
    assignment.audio_object_key = null;
    assignment.audio_expires_at = null;
    assignment.audio_file_name = null;
    assignment.audio_size_bytes = null;

    const input =
      $('#assignmentAudio');

    if (input) {
      input.value = '';
    }

    const status =
      $('#assignmentAudioStatus');

    if (status) {

      status.style.color =
        '#15803d';

      status.textContent =
        '✓ 登録済みMP3を削除しました';
    }

    if (button) {
      button.classList.add(
        'hidden'
      );
    }

  } finally {

    if (button) {
      button.disabled = false;
    }
  }
}

async function saveAssignment() {

  if (!selectedClass) {
    return;
  }


  const existingAssignment =
  editingAssignmentId

    ? assignments.find(
        assignment =>
          assignment.id ===
          editingAssignmentId
      )

    : null;


const week =
  existingAssignment

    ? Number(
        existingAssignment.week_no
      )

    : nextWeekNumber();

  const category =
    $('#assignmentCategory').value;


  const title =
    $('#assignmentTitle')
      .value
      .trim();


  const lessonType =
    $('#assignmentLessonType').value ===
      'dialogue'
      ? 'dialogue'
      : 'text';


  const lessonDialogue =
    lessonType === 'dialogue'
      ? getAssignmentDialogueFromForm()
      : [];


  const lessonText =
    lessonType === 'dialogue'

      ? lessonDialogue
          .map(
            item =>
              item.text
          )
          .filter(Boolean)
          .join('\n')

      : $('#assignmentText')
          .value
          .trim();

  const translation =
    $('#assignmentTranslation')
      .value
      .trim();
const audioFile =
  getSelectedAssignmentAudio();

const imageFile =
  getSelectedAssignmentImage();

let youtubeClip =
  null;

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


  // ========================================
  // PRACTICE POLICY SAVE VALUES
  // ========================================

  const requestedPracticeMode =
    $('#assignmentPracticeMode')
      ?.value ||
    'free';


  const practiceMode =
    [
      'free',
      'reading',
      'paced',
      'vanish',
      'shadowing'
    ]
      .includes(
        requestedPracticeMode
      )

      ? requestedPracticeMode

      : 'free';


  const modeLocked =
    practiceMode !== 'free' &&
    $('#assignmentModeLocked')
      ?.checked === true;


  const pacedTargetWpm =
    practiceMode === 'paced'

      ? Number(
          $('#assignmentPacedTargetWpm')
            ?.value
        )

      : null;


  const vanishLevel =
    practiceMode === 'vanish'

      ? Number(
          $('#assignmentVanishLevel')
            ?.value
        )

      : null;


  if (
    practiceMode === 'paced' &&
    (
      !Number.isInteger(
        pacedTargetWpm
      ) ||
      pacedTargetWpm < 40 ||
      pacedTargetWpm > 300
    )
  ) {

    msg.textContent =
      'PacedのTarget WPMは40〜300で設定してください。';

    return;
  }


  if (
    practiceMode === 'vanish' &&
    (
      !Number.isInteger(
        vanishLevel
      ) ||
      vanishLevel < 1 ||
      vanishLevel > 5
    )
  ) {

    msg.textContent =
      'Vanish Levelは1〜5で設定してください。';

    return;
  }


  const existingAudio =
    Boolean(
      existingAssignment?.audio_object_key ||
      existingAssignment?.audio_url
    );


  if (
    practiceMode === 'shadowing' &&
    !audioFile &&
    !existingAudio
  ) {

    msg.textContent =
      'Shadowing課題にはAudioファイルを登録してください。';

    return;
  }

  msg.style.color =
    '#b91c1c';
  const optionalNumber =
    selector => {

      const raw =
        $(selector)
          ?.value
          ?.trim() ||
        '';


      if (raw === '') {
        return null;
      }


      return Number(raw);
    };


  const passAccuracy =
    optionalNumber(
      '#assignmentPassAccuracy'
    );


  const passWpm =
    optionalNumber(
      '#assignmentPassWpm'
    );


  const passComprehension =
    optionalNumber(
      '#assignmentPassComprehension'
    );


  const passEnabled =
    $('#assignmentPassEnabled')
      ?.checked ===
    true;


  if (
    passEnabled &&
    passAccuracy === null &&
    passWpm === null &&
    passComprehension === null
  ) {

    msg.textContent =
      '合格基準を使用する場合は、Accuracy・WPM・Comprehensionのいずれかを設定してください。';

    return;
  }

  if (
    passAccuracy !== null &&
    (
      !Number.isFinite(passAccuracy) ||
      passAccuracy < 0 ||
      passAccuracy > 100
    )
  ) {

    msg.textContent =
      'Accuracyの合格基準は0〜100で入力してください。';

    return;
  }


  if (
    passWpm !== null &&
    (
      !Number.isFinite(passWpm) ||
      passWpm < 0
    )
  ) {

    msg.textContent =
      'WPMの合格基準は0以上で入力してください。';

    return;
  }


  if (
    passComprehension !== null &&
    (
      !Number.isFinite(passComprehension) ||
      passComprehension < 0 ||
      passComprehension > 100
    )
  ) {

    msg.textContent =
      'Comprehensionの合格基準は0〜100で入力してください。';

    return;
  }

  const audienceType =
    $('#assignmentAudienceTargeted')
      ?.checked === true
      ? 'targeted'
      : 'class';


  const targetStudentIds =
    audienceType === 'targeted'
      ? [
          ...document.querySelectorAll(
            '.assignment-target-student:checked'
          )
        ]
          .map(
            input =>
              input.value
          )
          .filter(Boolean)
      : [];


  if (
    audienceType === 'targeted' &&
    targetStudentIds.length === 0
  ) {

    msg.textContent =
      '配布する生徒を1人以上選択してください。';

    return;
  }

try {

  validateAssignmentAudio(
    audioFile
  );

} catch (
  error
) {

  msg.textContent =
    error.message ||
    'MP3 / WAVファイルを確認してください。';

  return;
}

try {

  validateAssignmentImage(
    imageFile
  );

} catch (
  error
) {

  msg.textContent =
    error.message ||
    '画像ファイルを確認してください。';

  return;
}


try {

  youtubeClip =
    getYoutubeClipFromForm();


  const youtubeStatus =
    $('#assignmentYoutubeStatus');


  if (
    youtubeStatus &&
    youtubeClip.enabled
  ) {

    youtubeStatus.style.color =
      '#15803d';


    const start =
      youtubeClip.startSeconds ?? 0;


    const end =
      youtubeClip.endSeconds;


    youtubeStatus.textContent =
      end !== null
        ? `✓ YouTube Clip: ${start}s → ${end}s${youtubeClip.loop ? ' · Loop ON' : ''}`
        : `✓ YouTube: ${start}sから再生${youtubeClip.loop ? ' · Loop ON' : ''}`;
  }


  if (
    youtubeStatus &&
    !youtubeClip.enabled
  ) {

    youtubeStatus.style.color =
      '';


    youtubeStatus.textContent =
      'YouTube URLを貼り、再生する区間を指定してください。';
  }

} catch (
  error
) {

  msg.textContent =
    error.message ||
    'YouTube設定を確認してください.';


  const youtubeStatus =
    $('#assignmentYoutubeStatus');


  if (youtubeStatus) {

    youtubeStatus.style.color =
      '#b91c1c';

    youtubeStatus.textContent =
      error.message ||
      'YouTube設定を確認してください。';
  }


  return;
}

  if (!title) {

    msg.textContent =
      'Titleを入力してください。';

    return;
  }


  if (
    lessonType === 'dialogue'
  ) {

    if (
      lessonDialogue.length < 2
    ) {

      msg.textContent =
        'Dialogueは2つ以上のセリフを入力してください。';

      return;
    }


    const incompleteDialogueLine =
      lessonDialogue.find(
        item =>
          !item.speaker ||
          !item.text
      );


    if (incompleteDialogueLine) {

      msg.textContent =
        'DialogueのSpeakerとTextを両方入力してください。';

      return;
    }
  }

  if (!lessonText) {

    msg.textContent =
      '音読するEnglish Textを入力してください。';

    return;
  }
  if (published && previewAssignmentDelivery().tooLong) {
    msg.textContent = '文章量が多すぎるため公開できません。英文を分割するか、Publish nowをOFFにして下書き保存してください。';
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
  parseLocalDateTime(
    releaseValue
  );


const due =
  parseLocalDateTime(
    dueValue
  );

  if (
  !release ||
  !due ||
  Number.isNaN(
    release.getTime()
  ) ||
  Number.isNaN(
    due.getTime()
  )
) {

  msg.textContent =
    'ReleaseとDeadlineの日時を確認してください。';

  return;
}

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
  await showConfirmModal({

    badge:
      'Edit Assignment',

    badgeType:
      'danger',

    title:
      '提出済みの課題を編集しますか？',

    message:
      `この課題にはすでに${submissionCount}件の提出があります。

教材内容を変更すると、過去の提出時の教材と現在の教材内容が異なる可能性があります。

変更を続けますか？`,

    confirmText:
      'Continue Editing',

    cancelText:
      'Cancel',

    confirmVariant:
      'danger'

  });


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

const audioStatus =
  $('#assignmentAudioStatus');


let uploadedAudio =
  null;

let uploadedImage =
  null;

  const row = {
    practice_mode:
      practiceMode,

    mode_locked:
      modeLocked,

    paced_target_wpm:
      pacedTargetWpm,

    vanish_level:
      vanishLevel,


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

    audience_type:
      audienceType,

    lesson_type:
      lessonType,

    lesson_dialogue:
      lessonType === 'dialogue'
        ? lessonDialogue
        : null,
    lesson_text:
      lessonText,

    lesson_translation:
  translation ||
  null,

lesson_lang:
  language,

pass_accuracy:
  passAccuracy,

pass_wpm:
  passWpm,

pass_comprehension:
  passComprehension,

pass_enabled:
  passEnabled,


youtube_url:
  youtubeClip?.enabled
    ? youtubeClip.url
    : null,

youtube_video_id:
  youtubeClip?.enabled
    ? youtubeClip.videoId
    : null,

youtube_start_seconds:
  youtubeClip?.enabled
    ? youtubeClip.startSeconds
    : null,

youtube_end_seconds:
  youtubeClip?.enabled
    ? youtubeClip.endSeconds
    : null,

youtube_loop:
  youtubeClip?.enabled
    ? youtubeClip.loop
    : false
  };


  try {
if (audioFile) {

  if (audioStatus) {

    audioStatus.style.color =
      '#2563eb';

    audioStatus.textContent =
      `Uploading ${audioFile.name}...`;
  }


  button.textContent =
    'Uploading audio...';


  uploadedAudio =
    await uploadAssignmentAudio(
      audioFile
    );


  Object.assign(
    row,
    {

      audio_object_key:
        uploadedAudio.objectKey,

      audio_expires_at:
        uploadedAudio.audioExpiresAt,

      audio_file_name:
        uploadedAudio.fileName,

      audio_size_bytes:
        uploadedAudio.fileSize,

      audio_url:
        null

    }
  );


  if (audioStatus) {

    audioStatus.style.color =
      '#15803d';

    audioStatus.textContent =
      `✓ ${uploadedAudio.fileName} uploaded`;
  }


  button.textContent =
    'Saving...';
}
if (imageFile) {

  const imageStatus =
    $('#assignmentImageStatus');


  if (imageStatus) {

    imageStatus.style.color =
      '#2563eb';

    imageStatus.textContent =
      `Uploading ${imageFile.name}...`;
  }


  button.textContent =
    'Uploading image...';


  uploadedImage =
    await uploadAssignmentImage(
      imageFile
    );


  Object.assign(
    row,
    {

      image_object_key:
        uploadedImage.objectKey,

      image_file_name:
        uploadedImage.fileName,

      image_size_bytes:
        uploadedImage.fileSize,

      image_content_type:
        uploadedImage.contentType

    }
  );


  if (imageStatus) {

    imageStatus.style.color =
      '#15803d';

    imageStatus.textContent =
      `✓ ${uploadedImage.fileName} uploaded`;
  }


  button.textContent =
    'Saving...';
}


    const sb =
      getClient(
  'teacher'
);


    let error;

    let savedAssignmentId =
      isEditing
        ? editingAssignmentId
        : null;


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
          )
          .select(
            'id'
          )
          .single();


      error =
        result.error;


      if (
        !error &&
        !result.data
      ) {

        error =
          new Error(
            'Assignment was not updated.'
          );

      }


      if (
        result.data?.id
      ) {

        savedAssignmentId =
          result.data.id;

      }

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
          })
          .select(
            'id'
          )
          .single();


      error =
        result.error;


      if (
        !error &&
        !result.data
      ) {

        error =
          new Error(
            'Assignment was not created.'
          );

      }


      if (
        result.data?.id
      ) {

        savedAssignmentId =
          result.data.id;

      }

    }

    if (error) {

      if (
        error.code ===
        '23505'
      ) {

        throw new Error(
          `No. ${week} はすでに登録されています。`
        );
      }


      throw error;
    }


    if (!savedAssignmentId) {

      throw new Error(
        '保存した課題IDを取得できませんでした。'
      );

    }


    // ========================================
    // CROSS-POSTING SAVE RPC
    // ========================================

    const assignmentClassIds =
      audienceType === 'targeted'

        ? [
            selectedClass.id
          ]

        : getSelectedAssignmentClassIds();


    const {
      error: classLinkError
    } =
      await sb.rpc(
        'set_assignment_classes',
        {
          p_assignment_id:
            savedAssignmentId,

          p_class_ids:
            assignmentClassIds
        }
      );


    if (classLinkError) {

      throw classLinkError;
    }

    const {
      error: targetError
    } =
      await sb.rpc(
        'set_assignment_targets',
        {
          p_assignment_id:
            savedAssignmentId,

          p_student_ids:
            targetStudentIds
        }
      );


    if (targetError) {

      throw targetError;

    }

    await loadClass(
      selectedClass.id
    );


    render();


    closeAssignmentEditor();


    await showInfoModal({

  badge:
    isEditing
      ? 'Updated'
      : published
        ? 'Published'
        : 'Draft Saved',

  badgeType:
    'info',

  title:
    isEditing
      ? '課題を更新しました'
      : published
        ? '課題を公開しました'
        : 'Draftとして保存しました',

  message:
    isEditing
      ? `「${title}」の変更を保存しました。`
      : published
        ? `「${title}」を生徒に公開しました。`
        : `「${title}」をDraftとして保存しました。`

});


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

    await showInfoModal({

      badge:
        'Cannot Publish',

      badgeType:
        'danger',

      title:
        'Publishできません',

      message:
        'English Textが登録されていません。Editから本文を登録してください。'

    });

    return;
  }


  const {
    error
  } =
    await getClient(
  'teacher'
)
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
    data: duplicatedAssignment,
    error
  } =
    await getClient(
  'teacher'
)
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

        audience_type:
          assignment.audience_type ===
            'targeted'
            ? 'targeted'
            : 'class',

        lesson_type:
          assignment.lesson_type ||
          'text',

        lesson_dialogue:
          assignment.lesson_type ===
            'dialogue'
            ? assignment.lesson_dialogue ||
              []
            : null,

        lesson_text:
          assignment.lesson_text,

        lesson_translation:
          assignment.lesson_translation,

        lesson_lang:
          assignment.lesson_lang ||
          'en-US',

        audio_url:
          assignment.audio_url ||
          null,

        audio_object_key:
          assignment.audio_object_key ||
          null,

        audio_expires_at:
          assignment.audio_expires_at ||
          null,

        audio_file_name:
          assignment.audio_file_name ||
          null,

        audio_size_bytes:
          assignment.audio_size_bytes ??
          null,

        image_object_key:
          assignment.image_object_key ||
          null,

        image_file_name:
          assignment.image_file_name ||
          null,

        image_size_bytes:
          assignment.image_size_bytes ??
          null,

        image_content_type:
          assignment.image_content_type ||
          null,


        youtube_url:
          assignment.youtube_url ||
          null,

        youtube_video_id:
          assignment.youtube_video_id ||
          null,

        youtube_start_seconds:
          assignment.youtube_start_seconds ??
          null,

        youtube_end_seconds:
          assignment.youtube_end_seconds ??
          null,

        youtube_loop:
          assignment.youtube_loop ===
          true
      })
      .select(
        'id'
      )
      .single();


  if (error) {
    throw error;
  }


  if (
    !duplicatedAssignment?.id
  ) {

    throw new Error(
      '複製した課題IDを取得できませんでした。'
    );
  }



  // Register duplicate in the assignment_classes bridge.
  const duplicateClassIds = assignment.audience_type === 'targeted'
    ? [selectedClass.id]
    : [...new Set([selectedClass.id, ...(assignment.class_ids || [])])];

  const { error: duplicateClassLinkError } =
    await getClient('teacher').rpc(
      'set_assignment_classes',
      {
        p_assignment_id: duplicatedAssignment.id,
        p_class_ids: duplicateClassIds
      }
    );

  if (duplicateClassLinkError) throw duplicateClassLinkError;

  const duplicateTargetIds =
    assignment.audience_type ===
      'targeted'
      ? assignment.target_student_ids ||
        []
      : [];


  if (
    assignment.audience_type ===
      'targeted' &&
    duplicateTargetIds.length === 0
  ) {

    throw new Error(
      '個別配布先を取得できないため複製できませんでした。'
    );
  }


  const {
    error: targetError
  } =
    await getClient(
      'teacher'
    ).rpc(
      'set_assignment_targets',
      {
        p_assignment_id:
          duplicatedAssignment.id,

        p_student_ids:
          duplicateTargetIds
      }
    );


  if (targetError) {
    throw targetError;
  }


  await loadClass(
    selectedClass.id
  );


  render();


  await showInfoModal({

  badge:
    'Duplicated',

  badgeType:
    'info',

  title:
    '課題を複製しました',

  message:
    `No. ${newWeek} としてDraftに複製しました。

公開する前に内容と日付を確認してください。`

});
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


  const ok =
    await showConfirmModal({

      badge:
        'Permanent Delete',

      badgeType:
        'danger',

      title:
        'この課題を完全に削除しますか？',

      message:
        `「${assignment.title}」を完全に削除します。

課題本体に加えて、${submissionCount}件の提出記録と個別配布設定も削除されます。

この操作は元に戻せません。`,

      confirmText:
        '完全削除',

      cancelText:
        'Cancel',

      confirmVariant:
        'danger'

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


  await showInfoModal({

    badge:
      'Deleted',

    badgeType:
      'info',

    title:
      '完全に削除しました',

    message:
      `「${assignment.title}」と関連する提出記録を完全に削除しました。`

  });
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
    getClient(
  'teacher'
);


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


  const {
  data: rosterRows,
  error: rosterError
} =
  await sb
    .from(
      'class_roster'
    )
    .select(
      'linked_student_id, student_number'
    )
    .eq(
      'class_id',
      selectedClass.id
    );


if (rosterError) {

  throw rosterError;
}


const studentNumberMap =
  new Map(
    (rosterRows || [])
      .filter(
        row =>
          row.linked_student_id
      )
      .map(
        row => [
          row.linked_student_id,
          row.student_number
        ]
      )
  );


students =
  (members || [])
    .map(
      item => {

        if (!item.profiles) {

          return null;
        }


        return {

          ...item.profiles,

          student_number:
            studentNumberMap.get(
              item.student_id
            ) || ''

        };
      }
    )
    .filter(
      Boolean
    )
    .sort(
      (a, b) => {

        const aNo =
          String(
            a.student_number || ''
          );

        const bNo =
          String(
            b.student_number || ''
          );


        if (!aNo && bNo) {
          return 1;
        }


        if (aNo && !bNo) {
          return -1;
        }


        return aNo.localeCompare(
          bNo,
          undefined,
          {
            numeric:
              true
          }
        );
      }
    );

  // ========================================
  // ========================================
  // CURRENT CLASS STUDENT FILTER
  // ========================================

  const currentClassStudentIds =
    new Set(
      students
        .map(
          student =>
            student.id
        )
        .filter(Boolean)
    );

  // CROSS-POSTING ASSIGNMENT LOAD
  // ========================================

  const {
    data: currentClassLinks,
    error: currentClassLinkError
  } =
    await sb
      .from(
        'assignment_classes'
      )
      .select(
        'assignment_id'
      )
      .eq(
        'class_id',
        selectedClass.id
      );


  if (
    currentClassLinkError
  ) {

    throw currentClassLinkError;
  }


  const linkedAssignmentIds =
    [
      ...new Set(
        (currentClassLinks || [])
          .map(
            row =>
              row.assignment_id
          )
          .filter(Boolean)
      )
    ];



  // Include assignments owned by this class even without bridge links.
  const { data: primaryAssignmentIds, error: primaryAssignmentError } =
    await sb.from('assignments')
      .select('id')
      .eq('class_id', selectedClass.id);

  if (primaryAssignmentError) throw primaryAssignmentError;

  const allAssignmentIds = [...new Set([
    ...linkedAssignmentIds,
    ...(primaryAssignmentIds || []).map(row => row.id)
  ])];

  let assignmentRows = [];


  if (allAssignmentIds.length) {

    const {
      data: loadedAssignments,
      error: assignmentError
    } =
      await sb
        .from(
          'assignments'
        )
        .select(
          '*'
        )
        .in('id', allAssignmentIds)
        .order(
          'week_no'
        );


    if (
      assignmentError
    ) {

      throw assignmentError;
    }


    const {
      data: allClassLinks,
      error: allClassLinkError
    } =
      await sb
        .from(
          'assignment_classes'
        )
        .select(
          'assignment_id,class_id'
        )
        .in('assignment_id', allAssignmentIds);


    if (
      allClassLinkError
    ) {

      throw allClassLinkError;
    }


    const assignmentClassMap =
      new Map();


    (allClassLinks || [])
      .forEach(
        row => {

          if (
            !assignmentClassMap.has(
              row.assignment_id
            )
          ) {

            assignmentClassMap.set(
              row.assignment_id,
              []
            );
          }


          assignmentClassMap
            .get(
              row.assignment_id
            )
            .push(
              row.class_id
            );
        }
      );


    assignmentRows =
      (loadedAssignments || [])
        .map(
          assignment => ({
            ...assignment,

            class_ids:
              assignmentClassMap.get(
                assignment.id
              ) ||
              [
                assignment.class_id
              ].filter(Boolean)
          })
        );
  }


  assignments =
    assignmentRows;

  if (
    assignments.length
  ) {

    const ids =
      assignments.map(
        assignment =>
          assignment.id
      );


    const {
      data: targetRows,
      error: targetError
    } =
      await sb
        .from(
          'assignment_targets'
        )
        .select(
          'assignment_id, student_id'
        )
        .in(
          'assignment_id',
          ids
        );


    if (
      targetError
    ) {

      throw targetError;
    }


    const targetMap =
      new Map();


    (targetRows || [])
      .forEach(
        row => {

          if (
            !targetMap.has(
              row.assignment_id
            )
          ) {

            targetMap.set(
              row.assignment_id,
              []
            );
          }


          targetMap
            .get(
              row.assignment_id
            )
            .push(
              row.student_id
            );
        }
      );


    assignments =
      assignments.map(
        assignment => ({
          ...assignment,

          target_student_ids:
            targetMap.get(
              assignment.id
            ) || []
        })
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
      (submissionRows || [])
        .filter(
          row =>
            currentClassStudentIds.has(
              row.student_id
            )
        );

  } else {

    submissions =
      [];
  }

  if (
    assignments.length
  ) {

    const {
      data: manualRows,
      error: manualError
    } =
      await sb
        .from(
          'manual_scores'
        )
        .select(
          'assignment_id,student_id,score,wpm,comprehension,updated_at'
        )
        .in(
          'assignment_id',
          assignments.map(
            assignment =>
              assignment.id
          )
        );


    if (
      manualError
    ) {
      throw manualError;
    }


    manualScores =
      (manualRows || [])
        .filter(
          row =>
            currentClassStudentIds.has(
              row.student_id
            )
        );

  } else {

    manualScores =
      [];
  }


  // ========================================
  // CLASS READING RANKINGS
  // ========================================

  const {
    data: rankingRows,
    error: rankingError
  } =
    await sb.rpc(
      'get_teacher_assignment_reading_rankings',
      {
        p_class_id:
          selectedClass.id
      }
    );


  if (rankingError) {

    console.warn(
      '[Copeak Classroom] ranking load failed:',
      rankingError
    );

    readingRankings =
      [];

  } else {

    readingRankings =
      rankingRows ||
      [];
  }
}


// ==========================================
// LOAD LIVE
// ==========================================

async function loadLive() {

  const sb =
    getClient(
  'teacher'
);


  const {
    data: classRows,
    error
  } =
    await sb
      .from(
        'classes'
      )
      .select('*')
      .order(
        'created_at'
      );


  if (error) {

    throw error;
  }


  // RLSによって
  // Ownerクラス + Sharedクラスだけ返る
  classes =
    classRows || [];


  if (!classes.length) {

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


  const initialClass =
    classes.find(
      item =>
        item.id ===
        requestedId
    )
    ||
    classes[0];


  localStorage.setItem(
    'copeak_teacher_class_id',
    initialClass.id
  );


  await loadClass(
    initialClass.id
  );


  return true;
}

// ==========================================
function getAssignmentDialogueFromForm() {

  return [
    ...document.querySelectorAll(
      '#assignmentDialogueLines .assignment-dialogue-line'
    )
  ]
    .map(
      line => {

        const speaker =
          line.querySelector(
            '.assignment-dialogue-speaker'
          );

        const text =
          line.querySelector(
            '.assignment-dialogue-text'
          );

        return {
          speaker:
            speaker?.value.trim() ||
            '',

          text:
            text?.value.trim() ||
            ''
        };
      }
    )
    .filter(
      item =>
        item.speaker ||
        item.text
    );
}

function renderAssignmentTargetStudents(
  selectedIds = []
) {

  const list =
    $('#assignmentTargetList');

  const summary =
    $('#assignmentTargetSummary');

  if (
    !list ||
    !summary
  ) {
    return;
  }


  const selectedSet =
    new Set(
      selectedIds
    );


  if (
    !Array.isArray(
      students
    ) ||
    students.length === 0
  ) {

    list.innerHTML =
      '<div class="small muted">このクラスには生徒が登録されていません。</div>';

    summary.textContent =
      '0人選択';

    return;
  }


  list.innerHTML =
    students
      .map(
        student => {

          const checked =
            selectedSet.has(
              student.id
            )
              ? ' checked'
              : '';

          const number =
            student.student_number
              ? `${student.student_number} `
              : '';

          const name =
            student.display_name ||
            'No name';

          return `
            <label
              style="
                display:flex;
                align-items:center;
                gap:8px;
                padding:8px 6px;
                border-bottom:1px solid #f1f5f9;
                cursor:pointer;
              ">

              <input
                type="checkbox"
                class="assignment-target-student"
                value="${student.id}"
                ${checked}>

              <span>
                ${number}${name}
              </span>

            </label>
          `;
        }
      )
      .join('');


  updateAssignmentTargetSummary();
}


function updateAssignmentTargetSummary() {

  const summary =
    $('#assignmentTargetSummary');

  if (!summary) {
    return;
  }

  const count =
    document.querySelectorAll(
      '.assignment-target-student:checked'
    ).length;

  summary.textContent =
    `${count}人選択`;
}


function updateAssignmentAudienceUI() {

  const targeted =
    $('#assignmentAudienceTargeted')
      ?.checked ===
      true;

  $('#assignmentTargetPanel')
    ?.classList
    .toggle(
      'hidden',
      !targeted
    );

  if (targeted) {
    renderAssignmentTargetStudents();
  }

  // ========================================
  // CROSS-POSTING AUDIENCE SYNC
  // 個別配布ではPrimary Classのみ
  // ========================================

  const selectedClassIds =
    getSelectedAssignmentClassIds();


  renderAssignmentClassTargets(
    targeted
      ? [
          selectedClass?.id
        ]
      : selectedClassIds
  );
}

let assignmentOcrPreviewUrl =
  null;


function handleAssignmentOcrImage(
  file
) {

  const preview =
    $('#assignmentOcrPreview');

  const status =
    $('#assignmentOcrStatus');

  const resultWrap =
    $('#assignmentOcrResultWrap');

  const result =
    $('#assignmentOcrResult');


  if (
    assignmentOcrPreviewUrl
  ) {

    URL.revokeObjectURL(
      assignmentOcrPreviewUrl
    );

    assignmentOcrPreviewUrl =
      null;
  }


  if (!file) {

    preview.removeAttribute(
      'src'
    );

    preview.classList.add(
      'hidden'
    );

    resultWrap.classList.add(
      'hidden'
    );

    result.value =
      '';

    status.textContent =
      '印刷された英語教科書のページを撮影または選択してください。';

    return;
  }


  if (
    !file.type.startsWith(
      'image/'
    )
  ) {

    status.textContent =
      '画像ファイルを選択してください。';

    return;
  }


  assignmentOcrPreviewUrl =
    URL.createObjectURL(
      file
    );


  preview.src =
    assignmentOcrPreviewUrl;

  preview.classList.remove(
    'hidden'
  );


  resultWrap.classList.add(
    'hidden'
  );

  result.value =
    '';


  status.textContent =
    '画像を読み込みました。次のステップで文字認識を行います。';
}

let assignmentOcrWorker =
  null;


async function getAssignmentOcrWorker() {

  if (
    assignmentOcrWorker
  ) {

    return assignmentOcrWorker;
  }


  if (
    !window.Tesseract
  ) {

    throw new Error(
      'OCRエンジンを読み込めませんでした。ページを再読み込みしてください。'
    );
  }


  assignmentOcrWorker =
    await window.Tesseract.createWorker(
      'eng',
      1,
      {
        logger:
          message => {

            const status =
              $('#assignmentOcrStatus');

            if (!status) {
              return;
            }


            if (
              message.status ===
              'recognizing text'
            ) {

              const percent =
                Math.round(
                  (message.progress || 0) *
                  100
                );

              status.textContent =
                `文字認識中... ${percent}%`;

              return;
            }


            status.textContent =
              'OCRを準備しています...';
          }
      }
    );


  return assignmentOcrWorker;
}


async function recognizeAssignmentOcr(
  file
) {

  if (!file) {
    return;
  }


  const status =
    $('#assignmentOcrStatus');

  const resultWrap =
    $('#assignmentOcrResultWrap');

  const result =
    $('#assignmentOcrResult');


  try {

    status.style.color =
      '';

    status.textContent =
      'OCRを準備しています...';


    const worker =
      await getAssignmentOcrWorker();


    const response =
      await worker.recognize(
        file
      );


    const recognizedText =
      response?.data?.text
        ?.replace(
          /\r\n/g,
          '\n'
        )
        ?.trim() ||
      '';


    if (!recognizedText) {

      result.value =
        '';

      resultWrap.classList.remove(
        'hidden'
      );

      status.style.color =
        '#b45309';

      status.textContent =
        '文字を認識できませんでした。画像の明るさや角度を確認してください。';

      return;
    }


    result.value =
      recognizedText;

    resultWrap.classList.remove(
      'hidden'
    );

    status.style.color =
      '#15803d';

    status.textContent =
      '✓ 文字認識が完了しました。';

  } catch (
    error
  ) {

    console.error(
      'OCR error:',
      error
    );

    status.style.color =
      '#b91c1c';

    status.textContent =
      error.message ||
      '文字認識中にエラーが発生しました。';
  }
}

function cleanAssignmentOcrText(
  rawText
) {

  const normalized =
    String(
      rawText ||
      ''
    )
      .replace(
        /\r\n/g,
        '\n'
      )
      .replace(
        /[ \t]+/g,
        ' '
      )
      .trim();


  if (!normalized) {
    return '';
  }


  const paragraphs =
    normalized
      .split(
        /\n\s*\n/
      )
      .map(
        paragraph =>
          paragraph
            .split(
              '\n'
            )
            .map(
              line =>
                line.trim()
            )
            .filter(Boolean)
            .join(' ')
            .replace(
              /\s+([,.!?;:])/g,
              '$1'
            )
            .replace(
              /([“"'(])\s+/g,
              '$1'
            )
            .replace(
              /\s+([”"')])/g,
              '$1'
            )
            .trim()
      )
      .filter(Boolean);


  return paragraphs.join(
    '\n\n'
  );
}


function useAssignmentOcrAsText() {

  const rawText =
    $('#assignmentOcrResult')
      ?.value ||
    '';

  const cleanedText =
    cleanAssignmentOcrText(
      rawText
    );


  if (!cleanedText) {

    $('#assignmentOcrStatus').textContent =
      '使用できる英文がありません。';

    return;
  }


  $('#assignmentLessonType').value =
    'text';


  $('#assignmentTextEditor')
    .classList
    .remove(
      'hidden'
    );


  $('#assignmentDialogueEditor')
    .classList
    .add(
      'hidden'
    );


  $('#assignmentText').value =
    cleanedText;


  $('#assignmentOcrStatus').style.color =
    '#15803d';


  $('#assignmentOcrStatus').textContent =
    '✓ 通常テキストとしてEnglish Textへ取り込みました。';
}

function parseAssignmentOcrDialogue(
  rawText
) {

  const lines =
    String(
      rawText ||
      ''
    )
      .replace(
        /\r\n/g,
        '\n'
      )
      .split(
        '\n'
      )
      .map(
        line =>
          line.trim()
      )
      .filter(Boolean);


  const dialogue =
    [];

  let current =
    null;


  const pushCurrent =
    () => {

      if (
        current?.speaker &&
        current?.text
      ) {

        dialogue.push({
          speaker:
            current.speaker.trim(),

          text:
            current.text
              .replace(
                /\s+([,.!?;:])/g,
                '$1'
              )
              .replace(
                /\s+/g,
                ' '
              )
              .trim()
        });
      }


      current =
        null;
    };


  const isSpeakerOnlyLine =
    line => {

      if (
        line.length > 32
      ) {
        return false;
      }


      if (
        /[.!?,;:：]$/.test(
          line
        )
      ) {
        return false;
      }


      const words =
        line.split(
          /\s+/
        );


      if (
        words.length > 4
      ) {
        return false;
      }


      return /^[A-Za-z][A-Za-z0-9 ._'’\-]*$/.test(
        line
      );
    };


  for (
    let index = 0;
    index < lines.length;
    index++
  ) {

    const line =
      lines[index];


    const inlineMatch =
      line.match(
        /^([A-Za-z][A-Za-z0-9 ._'’\-]{0,31})\s*[:：]\s*(.+)$/
      );


    if (
      inlineMatch
    ) {

      pushCurrent();


      current = {
        speaker:
          inlineMatch[1],

        text:
          inlineMatch[2]
      };


      continue;
    }


    if (
      isSpeakerOnlyLine(
        line
      ) &&
      index <
        lines.length - 1
    ) {

      pushCurrent();


      current = {
        speaker:
          line,

        text:
          ''
      };


      continue;
    }


    if (
      current
    ) {

      current.text +=
        `${current.text ? ' ' : ''}${line}`;

    }

  }


  pushCurrent();


  return dialogue;
}


function useAssignmentOcrAsDialogue() {

  const rawText =
    $('#assignmentOcrResult')
      ?.value ||
    '';


  const dialogue =
    parseAssignmentOcrDialogue(
      rawText
    );


  const status =
    $('#assignmentOcrStatus');


  if (
    dialogue.length < 2
  ) {

    status.style.color =
      '#b45309';

    status.textContent =
      '話者を2つ以上認識できませんでした。読み取り結果を「Emma: Hello.」のような形式に修正して、もう一度お試しください。';

    return;
  }


  $('#assignmentLessonType').value =
    'dialogue';


  $('#assignmentTextEditor')
    .classList
    .add(
      'hidden'
    );


  $('#assignmentDialogueEditor')
    .classList
    .remove(
      'hidden'
    );


  restoreAssignmentDialogueForm(
    dialogue
  );


  status.style.color =
    '#15803d';

  status.textContent =
    `✓ Dialogueとして${dialogue.length}個のセリフを取り込みました。`;
}

let assignmentOcrFiles =
  [];

let assignmentOcrQueueUrls =
  [];


function moveAssignmentOcrFile(
  index,
  direction
) {

  const newIndex =
    index + direction;


  if (
    newIndex < 0 ||
    newIndex >= assignmentOcrFiles.length
  ) {
    return;
  }


  const temp =
    assignmentOcrFiles[index];

  assignmentOcrFiles[index] =
    assignmentOcrFiles[newIndex];

  assignmentOcrFiles[newIndex] =
    temp;


  renderAssignmentOcrQueue();


  const firstFile =
    assignmentOcrFiles[0] ||
    null;


  handleAssignmentOcrImage(
    firstFile
  );


  updateAssignmentOcrOrderSummary();
}


function updateAssignmentOcrOrderSummary() {

  const button =
    $('#assignmentOcrRun');

  const summary =
    $('#assignmentOcrOrderSummary');


  if (
    !button ||
    !summary
  ) {
    return;
  }


  const count =
    assignmentOcrFiles.length;


  button.disabled =
    count === 0;


  if (
    count === 0
  ) {

    summary.textContent =
      '画像を選択してください。';

    return;
  }


  summary.textContent =
    `読み取り順：${
      assignmentOcrFiles
        .map(
          (file, index) =>
            `Page ${index + 1}`
        )
        .join(' → ')
    }`;
}

function removeAssignmentOcrFile(
  index
) {

  if (
    index < 0 ||
    index >= assignmentOcrFiles.length
  ) {
    return;
  }


  assignmentOcrFiles.splice(
    index,
    1
  );


  renderAssignmentOcrQueue();


  const firstFile =
    assignmentOcrFiles[0] ||
    null;


  handleAssignmentOcrImage(
    firstFile
  );


  updateAssignmentOcrOrderSummary();


  const result =
    $('#assignmentOcrResult');

  const resultWrap =
    $('#assignmentOcrResultWrap');


  if (
    result
  ) {
    result.value =
      '';
  }


  if (
    resultWrap
  ) {
    resultWrap.classList.add(
      'hidden'
    );
  }


  const status =
    $('#assignmentOcrStatus');


  if (
    status
  ) {

    status.style.color =
      '';

    status.textContent =
      assignmentOcrFiles.length
        ? `${assignmentOcrFiles.length}枚の画像を使用します。順番を確認して「この順番で読み取る」を押してください。`
        : '画像を選択してください。';

  }
}

function renderAssignmentOcrQueue() {

  const queue =
    $('#assignmentOcrQueue');

  if (!queue) {
    return;
  }


  assignmentOcrQueueUrls
    .forEach(
      url => {
        URL.revokeObjectURL(
          url
        );
      }
    );


  assignmentOcrQueueUrls =
    [];


  queue.innerHTML =
    '';


  assignmentOcrFiles
    .forEach(
      (file, index) => {

        const url =
          URL.createObjectURL(
            file
          );

        assignmentOcrQueueUrls.push(
          url
        );


        const item =
          document.createElement(
            'div'
          );


        item.style.cssText =
          `
            width:240px;
            padding:8px;
            border:1px solid #e5e7eb;
            border-radius:10px;
            background:#fff;
          `;


        item.innerHTML =
          `
            <div
              style="
                font-size:12px;
                font-weight:700;
                margin-bottom:6px;
              ">
              Page ${index + 1}
            </div>

            <img
              src="${url}"
              alt="OCR page ${index + 1}"
              style="
                width:100%;
                height:170px;
                object-fit:contain;
                background:#f8fafc;
                border-radius:7px;
                display:block;
              ">

            <div
              style="
                margin-top:6px;
                font-size:11px;
                overflow:hidden;
                text-overflow:ellipsis;
                white-space:nowrap;
              ">
              ${file.name}
            </div>

            <div
              class="ocr-page-controls"
              style="
                display:flex;
                gap:4px;
                margin-top:7px;
              ">

              <button
                type="button"
                class="btn btn-sm btn-light ocr-move-prev"
                style="flex:1;font-size:10px;padding:4px;"
                ${index === 0 ? 'disabled' : ''}>
                ← 前へ
              </button>

              <button
                type="button"
                class="btn btn-sm btn-light ocr-move-next"
                style="flex:1;font-size:10px;padding:4px;"
                ${index === assignmentOcrFiles.length - 1 ? 'disabled' : ''}>
                後ろへ →
              </button>

            </div>

            <button
              type="button"
              class="btn btn-sm btn-light ocr-remove-page"
              style="
                width:100%;
                margin-top:7px;
                font-size:10px;
                padding:5px;
              ">
              × この画像を削除
            </button>
          `;


        const previousButton =
          item.querySelector(
            '.ocr-move-prev'
          );


        const nextButton =
          item.querySelector(
            '.ocr-move-next'
          );


        const removeButton =
          item.querySelector(
            '.ocr-remove-page'
          );


        if (previousButton) {

          previousButton.onclick =
            () => {
              moveAssignmentOcrFile(
                index,
                -1
              );
            };

        }


        if (nextButton) {

          nextButton.onclick =
            () => {
              moveAssignmentOcrFile(
                index,
                1
              );
            };

        }


        if (removeButton) {

          removeButton.onclick =
            () => {
              removeAssignmentOcrFile(
                index
              );
            };

        }


        queue.appendChild(
          item
        );
      }
    );
}


function setAssignmentOcrFiles(
  files
) {

  const selectedFiles =
    [
      ...(files || [])
    ]
      .filter(
        file =>
          file.type.startsWith(
            'image/'
          )
      );


  assignmentOcrFiles =
    selectedFiles.slice(
      0,
      5
    );


  renderAssignmentOcrQueue();


  const status =
    $('#assignmentOcrStatus');


  if (
    selectedFiles.length > 5
  ) {

    status.style.color =
      '#b45309';

    status.textContent =
      '6枚以上選択されたため、最初の5枚を使用します。';

  } else {

    status.style.color =
      '';

    status.textContent =
      `${assignmentOcrFiles.length}枚の画像を選択しました。`;

  }
}

function combineAssignmentOcrPages(
  pageTexts
) {

  const pages =
    (pageTexts || [])
      .map(
        text =>
          String(
            text || ''
          ).trim()
      )
      .filter(Boolean);


  if (
    pages.length === 0
  ) {
    return '';
  }


  let combined =
    pages[0];


  for (
    let index = 1;
    index < pages.length;
    index++
  ) {

    const nextPage =
      pages[index];


    const previousLastLine =
      combined
        .split('\n')
        .filter(Boolean)
        .at(-1)
        ?.trim() ||
      '';


    const nextFirstLine =
      nextPage
        .split('\n')
        .find(
          line =>
            line.trim()
        )
        ?.trim() ||
      '';


    const previousLooksComplete =
      /[.!?]["'”’)]?$/.test(
        previousLastLine
      );


    const nextStartsWithSpeaker =
      /^[A-Za-z][A-Za-z0-9 ._'’\-]{0,31}\s*[:：]/.test(
        nextFirstLine
      );


    if (
      !previousLooksComplete &&
      !nextStartsWithSpeaker
    ) {

      combined =
        `${combined.trimEnd()} ${nextPage.trimStart()}`;

    } else {

      combined =
        `${combined.trimEnd()}\n\n${nextPage.trimStart()}`;

    }
  }


  return combined.trim();
}

async function recognizeAssignmentOcrFiles(
  files
) {

  const selectedFiles =
    [
      ...(files || [])
    ].slice(
      0,
      5
    );


  if (
    selectedFiles.length === 0
  ) {
    return;
  }


  const status =
    $('#assignmentOcrStatus');

  const resultWrap =
    $('#assignmentOcrResultWrap');

  const result =
    $('#assignmentOcrResult');


  try {

    status.style.color =
      '';

    status.textContent =
      'OCRを準備しています...';


    const worker =
      await getAssignmentOcrWorker();


    const pageTexts =
      [];


    for (
      let index = 0;
      index < selectedFiles.length;
      index++
    ) {

      const file =
        selectedFiles[index];


      status.textContent =
        `Page ${index + 1} / ${selectedFiles.length} を文字認識中...`;


      const response =
        await worker.recognize(
          file
        );


      const pageText =
        response?.data?.text
          ?.replace(
            /\r\n/g,
            '\n'
          )
          ?.trim() ||
        '';


      if (
        pageText
      ) {

        pageTexts.push(
          pageText
        );
      }

    }


    const combinedText =
      combineAssignmentOcrPages(
        pageTexts
      );


    result.value =
      combinedText;


    resultWrap.classList.remove(
      'hidden'
    );


    if (
      combinedText
    ) {

      status.style.color =
        '#15803d';

      status.textContent =
        `✓ ${selectedFiles.length}枚の文字認識が完了しました。`;

    } else {

      status.style.color =
        '#b45309';

      status.textContent =
        '文字を認識できませんでした。画像の明るさや角度を確認してください。';

    }

  } catch (
    error
  ) {

    console.error(
      'Multi-page OCR error:',
      error
    );


    status.style.color =
      '#b91c1c';

    status.textContent =
      error.message ||
      '複数画像の文字認識中にエラーが発生しました。';
  }
}

function setAssignmentMediaPanelOpen(
  type,
  isOpen
) {

  const isYoutube =
    type === 'youtube';


  const panel =
    isYoutube
      ? $('#assignmentYoutubePanel')
      : $('#assignmentAudioPanel');


  const button =
    isYoutube
      ? $('#toggleAssignmentYoutube')
      : $('#toggleAssignmentAudio');


  if (
    !panel ||
    !button
  ) {
    return;
  }


  panel.classList.toggle(
    'hidden',
    !isOpen
  );


  button.classList.toggle(
    'is-open',
    isOpen
  );


  button.setAttribute(
    'aria-expanded',
    isOpen
      ? 'true'
      : 'false'
  );


  button.style.borderColor =
    isOpen
      ? '#2563eb'
      : '';


  button.style.background =
    isOpen
      ? '#eff6ff'
      : '';
}


function toggleAssignmentMediaPanel(
  type
) {

  const panel =
    type === 'youtube'
      ? $('#assignmentYoutubePanel')
      : $('#assignmentAudioPanel');


  if (!panel) {
    return;
  }


  const isOpen =
    !panel.classList.contains(
      'hidden'
    );


  setAssignmentMediaPanelOpen(
    type,
    !isOpen
  );
}

// EVENTS
// COPEAK_DELIVERY_SAFETY_V1
$('#assignmentEditor')?.addEventListener('input', updateAssignmentDeliveryStatus);
$('#assignmentEditor')?.addEventListener('change', updateAssignmentDeliveryStatus);
const assignmentYoutubeUrlInput =
  $('#assignmentYoutubeUrl');


if (assignmentYoutubeUrlInput) {

  assignmentYoutubeUrlInput
    .addEventListener(
      'input',
      updateAssignmentYoutubePreview
    );

}

const assignmentYoutubeStartInput =
  $('#assignmentYoutubeStart');

const assignmentYoutubeEndInput =
  $('#assignmentYoutubeEnd');


function previewYoutubeClipIfReady() {

  const startValue =
    assignmentYoutubeStartInput
      ?.value
      ?.trim() ||
    '';

  const endValue =
    assignmentYoutubeEndInput
      ?.value
      ?.trim() ||
    '';


  if (
    !startValue ||
    !endValue
  ) {
    return;
  }


  previewAssignmentYoutubeClip();
}


[
  assignmentYoutubeStartInput,
  assignmentYoutubeEndInput
].forEach(
  input => {

    if (!input) {
      return;
    }


    input.addEventListener(
      'change',
      previewYoutubeClipIfReady
    );


    input.addEventListener(
      'keydown',
      event => {

        if (
          event.key !==
          'Enter'
        ) {
          return;
        }


        event.preventDefault();

        previewYoutubeClipIfReady();
      }
    );

  }
);


$('#toggleAssignmentYoutube').onclick =
  () => {

    toggleAssignmentMediaPanel(
      'youtube'
    );

  };


$('#toggleAssignmentAudio').onclick =
  () => {

    toggleAssignmentMediaPanel(
      'audio'
    );

  };

$('#toggleAssignmentImage').onclick =
  () => {

    const panel =
      $('#assignmentImagePanel');

    const button =
      $('#toggleAssignmentImage');


    const willOpen =
      panel
        ?.classList
        .contains(
          'hidden'
        );


    $('#assignmentYoutubePanel')
      ?.classList
      .add(
        'hidden'
      );

    $('#assignmentAudioPanel')
      ?.classList
      .add(
        'hidden'
      );


    $('#toggleAssignmentYoutube')
      ?.setAttribute(
        'aria-expanded',
        'false'
      );

    $('#toggleAssignmentAudio')
      ?.setAttribute(
        'aria-expanded',
        'false'
      );


    panel
      ?.classList
      .toggle(
        'hidden',
        !willOpen
      );


    button
      ?.setAttribute(
        'aria-expanded',
        willOpen
          ? 'true'
          : 'false'
      );
  };


$('#assignmentImage')
  ?.addEventListener(
    'change',
    event => {

      const file =
        event.target
          ?.files?.[0] ||
        null;


      try {

        validateAssignmentImage(
          file
        );

        updateAssignmentImagePreview(
          file
        );


        const status =
          $('#assignmentImageStatus');


        if (
          status &&
          file
        ) {

          status.style.color =
            '#15803d';

          status.textContent =
            `✓ 選択中: ${file.name}`;
        }

      } catch (
        error
      ) {

        event.target.value =
          '';

        resetAssignmentImagePreview();


        const status =
          $('#assignmentImageStatus');


        if (status) {

          status.style.color =
            '#b91c1c';

          status.textContent =
            error.message ||
            '画像を確認してください。';
        }
      }
    }
  );


$('#removeAssignmentImage')
  ?.addEventListener(
    'click',
    async () => {

      try {

        await removeAssignmentImage();

      } catch (
        error
      ) {

        console.error(
          error
        );


        await showInfoModal({

          badge:
            'Error',

          badgeType:
            'danger',

          title:
            '画像を削除できませんでした',

          message:
            error.message ||
            String(error)

        });
      }
    }
  );


$('#useOcrAsDialogue').onclick =
  () => {

    useAssignmentOcrAsDialogue();

  };



$('#useOcrAsText').onclick =
  () => {

    useAssignmentOcrAsText();

  };



$('#openAssignmentOcr').onclick =
  () => {

    $('#assignmentOcrPanel')
      .classList
      .toggle(
        'hidden'
      );

  };


$('#assignmentOcrImageInput').onchange =
  event => {

    const files =
      event.target
        ?.files ||
      [];


    setAssignmentOcrFiles(
      files
    );


    const firstFile =
      assignmentOcrFiles[0] ||
      null;


    handleAssignmentOcrImage(
      firstFile
    );


    updateAssignmentOcrOrderSummary();

  };


$('#assignmentOcrRun').onclick =
  async () => {

    if (
      assignmentOcrFiles.length === 0
    ) {
      return;
    }


    const button =
      $('#assignmentOcrRun');


    button.disabled =
      true;

    button.textContent =
      '🔍 読み取り中...';


    try {

      await recognizeAssignmentOcrFiles(
        assignmentOcrFiles
      );

    } finally {

      button.disabled =
        false;

      button.textContent =
        '🔍 この順番で読み取る';

    }

  };

$('#assignmentAudienceClass').onchange =
  () => {
    updateAssignmentAudienceUI();
  };


$('#assignmentAudienceTargeted').onchange =
  () => {
    updateAssignmentAudienceUI();
  };


$('#assignmentTargetList').onchange =
  event => {

    if (
      event.target
        ?.classList
        ?.contains(
          'assignment-target-student'
        )
    ) {

      updateAssignmentTargetSummary();
    }
  };


// ==========================================

$('#newAssignment').onclick =
  openAssignmentEditor;


$('#cancelAssignment').onclick =
  closeAssignmentEditor;


$('#publishAssignment').onclick =
  () =>
    saveAssignment();

$('#assignmentLessonType').onchange =
  () => {

    const isDialogue =
      $('#assignmentLessonType').value ===
      'dialogue';

    $('#assignmentTextEditor')
      .classList
      .toggle(
        'hidden',
        isDialogue
      );

    $('#assignmentDialogueEditor')
      .classList
      .toggle(
        'hidden',
        !isDialogue
      );

  };

$('#addAssignmentDialogueLine').onclick =
  () => {

    const container =
      $('#assignmentDialogueLines');

    const template =
      container.querySelector(
        '.assignment-dialogue-line'
      );

    if (!template) {
      return;
    }

    const newLine =
      template.cloneNode(true);

    const speaker =
      newLine.querySelector(
        '.assignment-dialogue-speaker'
      );

    const dialogueText =
      newLine.querySelector(
        '.assignment-dialogue-text'
      );

    if (speaker) {
      speaker.value = '';
    }

    if (dialogueText) {
      dialogueText.value = '';
    }

    const removeWrap =
      document.createElement(
        'div'
      );

    removeWrap.style.cssText =
      'margin-top:8px;text-align:right';

    const removeButton =
      document.createElement(
        'button'
      );

    removeButton.type =
      'button';

    removeButton.className =
      'btn btn-sm btn-light assignment-dialogue-remove';

    removeButton.textContent =
      '× Remove';

    removeButton.onclick =
      () => {

        newLine.remove();

      };

    removeWrap.appendChild(
      removeButton
    );

    newLine.appendChild(
      removeWrap
    );

    container.appendChild(
      newLine
    );

    if (speaker) {
      speaker.focus();
    }

  };

// REMOVE AUDIO BUTTON EVENT
$('#removeAssignmentAudio')
  ?.addEventListener(
    'click',
    async () => {

      try {

        await removeAssignmentAudio();

      } catch (error) {

        console.error(error);

        await showInfoModal({

          badge:
            'Error',

          badgeType:
            'danger',

          title:
            'MP3を削除できませんでした',

          message:
            error.message ||
            String(error)

        });
      }
    }
  );

$('#assignmentPassEnabled')
  ?.addEventListener(
    'change',
    updateAssignmentPassCriteriaState
  );

// ==========================================
// PRACTICE MODE CHANGE EVENT
// ==========================================

$('#assignmentPracticeMode')
  ?.addEventListener(
    'change',
    () => {

      const mode =
        $('#assignmentPracticeMode')
          ?.value ||
        'free';


      // 指定モードを選んだら
      // 初期状態ではMode LockをON
      if (
        mode !== 'free'
      ) {

        const lock =
          $('#assignmentModeLocked');


        if (lock) {

          lock.checked =
            true;
        }
      }


      updateAssignmentPracticeModeState();
    }
  );

// ==========================================
// CROSS-POSTING CLASS CHANGE EVENT
// ==========================================

$('#assignmentClassList')
  ?.addEventListener(
    'change',
    event => {

      if (
        event.target
          ?.classList
          ?.contains(
            'assignment-class-target'
          )
      ) {

        updateAssignmentClassSummary();
      }
    }
  );

$('#assignmentRelease').onchange =
  updateDueDate;


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


  await loadPlatformAdminAccess();

  if (
    await loadLive()
  ) {

    render();
  }

})()
.catch(
  async error => {

    console.error(
      error
    );


    await showInfoModal({

      badge:
        'Error',

      badgeType:
        'danger',

      title:
        'Teacher Dashboardを読み込めませんでした',

      message:
        error.message ||
        String(error)

    });
  }
);
