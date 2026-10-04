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
        `#${assignment.week_no} Reads`
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


            row.push(
              accuracy,
              wpm,
              comprehension,
              attempts.get(key) ||
                0
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


  msg.style.color =
    '#b91c1c';
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
      submissionRows ||
      [];

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
      manualRows ||
      [];

  } else {

    manualScores =
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
