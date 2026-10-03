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

  const best =
  bestSubmissionMap(
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


  best.forEach(
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
    [...best.values()]
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


  const best =
    bestSubmissionMap(
      submissions
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
        student
          .display_name
          .toLowerCase()
          .includes(
            query
          )
        ||
        String(
          student.student_number ||
          ''
        ).includes(
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
                    #${assignment.week_no}
                  </th>
                `
            )
            .join('')
        }

        <th>
          Reads
        </th>

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

          let totalReads =
            0;


          const cells =
            activeAssignments
              .map(
                assignment => {

                  const key =
                    `${student.id}|${assignment.id}`;


                  const result =
                    best.get(
                      key
                    );


                  const readCount =
                    attempts.get(
                      key
                    ) || 0;


                  totalReads +=
                    readCount;


                  if (!result) {

                    return `
                      <td>

                        <span class="grade missing">
                          —
                        </span>

                        <div class="tiny muted">
                          0 reads
                        </div>

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
                      title="Best Accuracy ${value}% / ${readCount} reads / WPM ${Math.round(
                        result.wpm || 0
                      )} / Comp ${pct(
                        result.comprehension
                      )}">

                      <span
                        class="grade ${gradeClass}">

                        ${value}

                      </span>

                      <div class="tiny muted">
                        ${readCount}
                        read${readCount === 1 ? '' : 's'}
                      </div>

                    </td>
                  `;
                }
              )
              .join('');


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
// MP3 → R2
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


  if (
    !fileName.endsWith(
      '.mp3'
    )
  ) {

    throw new Error(
      'MP3ファイルを選択してください。'
    );
  }


  if (
    file.size >
    MAX_ASSIGNMENT_AUDIO_SIZE
  ) {

    throw new Error(
      'MP3は5 MB以下にしてください。'
    );
  }
}


async function uploadAssignmentAudio(
  file
) {

  validateAssignmentAudio(
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
              'audio/mpeg',

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
      'MP3のアップロード準備に失敗しました。'
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
            'audio/mpeg'
        },

        body:
          file
      }
    );


  if (
    !uploadResponse.ok
  ) {

    throw new Error(
      `MP3 upload failed (${uploadResponse.status}).`
    );
  }


  return {

    objectKey:
      signed.objectKey,

    audioExpiresAt:
      signed.audioExpiresAt,

    contentType:
      signed.contentType ||
      'audio/mpeg',

    fileName:
      file.name,

    fileSize:
      file.size

  };
}

// ==========================================
// CREATE ASSIGNMENT
// ==========================================

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
    'MP3ファイルを確認してください。';

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


  if (
    submissionCount > 0
  ) {

    await showInfoModal({

      badge:
        'Protected',

      badgeType:
        'danger',

      title:
        'この課題は削除できません',

      message:
        `この課題には${submissionCount}件の提出があります。

成績データを保護するため削除できません。

生徒から非表示にしたい場合はUnpublishしてください。`

    });

    return;
  }


  const ok =
    await showConfirmModal({

      badge:
        'Delete Assignment',

      badgeType:
        'danger',

      title:
        '課題を削除しますか？',

      message:
        `「${assignment.title}」を削除します。

この操作は元に戻せません。`,

      confirmText:
        'Delete',

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
      '課題を削除しました',

    message:
      `「${assignment.title}」を削除しました。`

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
            width:120px;
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
                height:90px;
                object-fit:cover;
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
          `;


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

// EVENTS

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


    if (
      assignmentOcrFiles.length
    ) {

      recognizeAssignmentOcrFiles(
        assignmentOcrFiles
      );

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
