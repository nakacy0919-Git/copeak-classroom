import {
  requireUser,
  getClient,
  signOut,
  pct
} from './supabase.js';

import {
  demoAssignments,
  demoSubmissions
} from './data.js';

const $ = selector => document.querySelector(selector);

let ctx;
let assignments = [];
let submissions = [];
let manualScores = [];
let currentClass = null;
let activeAssignmentFilter = 'all';

let activeLanguage =
  localStorage.getItem(
    'copeak-classroom-student-language'
  ) || 'ja';

const processedResultIds = new Set();
const savingAssignments = new Set();

$('#signOut').onclick = signOut;


// ==========================================
// LANGUAGE
// ==========================================

const TEXT = {

  ja: {

    studentDashboard:
      '生徒ダッシュボード',

    signOut:
      'ログアウト',

    joinClassEyebrow:
      'クラスに参加',

    joinClassTitle:
      'クラスに参加',

    joinClassInstruction:
      '先生から受け取ったClass Code・Student No.・Join PINを入力してください。',

    classCode:
      'Class Code',

    studentNumber:
      '出席番号',

    joinPin:
      'Join PIN',

    joinClassButton:
      'クラスに参加',

    joinClassNote:
      '初回だけ入力します。参加後は自分の課題・締切・結果が自動表示されます。',

    learningProgressTitle:
      '学習の進み具合',

    learningProgressLead:
      '音読課題の進み具合を確認できます。',

    progress:
      '進捗',

    nextAssignment:
      '次の課題',

    timeRemaining:
      '残り時間',

    completed:
      '完了した課題',

    averageAccuracy:
      '平均正確率',

    bestWpm:
      '最高WPM',

    assignmentListEyebrow:
      '音読課題',

    assignmentListTitle:
      '課題一覧',

    filterAll:
      'すべて',

    filterTodo:
      '未完了',

    filterCompleted:
      '完了',

    filterUpcoming:
      '公開前',

    statusUpcoming:
      '公開前',

    statusClosed:
      '締切終了',

    statusDone:
      '✓ 完了',

    statusTodo:
      '● 未完了',

    deadline:
      '締切',

    opens:
      '公開',

    startsIn:
      '公開まで',

    closed:
      '締切終了',

    startCopeak:
      'Copeakで始める →',

    practiceAgain:
      'Copeakでもう一度練習',

    notOpen:
      'まだ開始できません',

    allCompleted:
      'すべての課題が完了しました！',

    greatWork:
      'よく頑張りました。',

    noAssignments:
      '表示する課題がありません。',

    noFilteredAssignments:
      'この条件に当てはまる課題はありません。',

    scoreAccuracy:
      '正確率',

    comprehension:
      '理解度',

    demoBanner:
      'デモモード：TEST Submitを押すと提出済みに変わります。',

    alertNotOpen:
      'この課題はまだ公開時刻になっていません。',

    alertClosed:
      'この課題の提出期限は終了しました。',

    alertNoLesson:
      'この課題には音読教材が登録されていません。先生に確認してください。',

    alertPopup:
      'Copeakを開けませんでした。ブラウザのポップアップ設定を確認してください。',

    alertSaveClosed:
      '提出期限を過ぎたため、今回の結果はClassroomには保存されませんでした。',

    joinCodeRequired:
      'Class Codeを入力してください。',

    joinRosterRequired:
      '出席番号とJoin PINの両方を入力してください。',

    submitComplete:
      '提出完了！',

    saveFailed:
      '成績の保存に失敗しました'
  },


  en: {

    studentDashboard:
      'Student Dashboard',

    signOut:
      'Sign out',

    joinClassEyebrow:
      'JOIN A CLASS',

    joinClassTitle:
      'Join a Class',

    joinClassInstruction:
      'Enter the Class Code, Student No., and Join PIN given by your teacher.',

    classCode:
      'Class Code',

    studentNumber:
      'Student No.',

    joinPin:
      'Join PIN',

    joinClassButton:
      'Join Class',

    joinClassNote:
      'You only need to enter these details the first time. Your assignments, deadlines, and results will then appear automatically.',

    learningProgressTitle:
      'Your Progress',

    learningProgressLead:
      'See how many reading assignments you have completed.',

    progress:
      'Progress',

    nextAssignment:
      'Next Assignment',

    timeRemaining:
      'Time Remaining',

    completed:
      'Completed',

    averageAccuracy:
      'Average Accuracy',

    bestWpm:
      'Best WPM',

    assignmentListEyebrow:
      'YOUR ASSIGNMENTS',

    assignmentListTitle:
      'Assignments',

    filterAll:
      'All',

    filterTodo:
      'To Do',

    filterCompleted:
      'Completed',

    filterUpcoming:
      'Upcoming',

    statusUpcoming:
      'Not Open Yet',

    statusClosed:
      'Closed',

    statusDone:
      '✓ Completed',

    statusTodo:
      '● Not Completed',

    deadline:
      'Deadline',

    opens:
      'Opens',

    startsIn:
      'Opens in',

    closed:
      'Closed',

    startCopeak:
      'Start Copeak →',

    practiceAgain:
      'Practice Again in Copeak',

    notOpen:
      'Not Open Yet',

    allCompleted:
      'All assignments completed!',

    greatWork:
      'Great work.',

    noAssignments:
      'There are no assignments to display.',

    noFilteredAssignments:
      'No assignments match this filter.',

    scoreAccuracy:
      'Accuracy',

    comprehension:
      'Comp.',

    demoBanner:
      'Demo mode: press TEST Submit to mark an assignment as submitted.',

    alertNotOpen:
      'This assignment is not open yet.',

    alertClosed:
      'The deadline for this assignment has passed.',

    alertNoLesson:
      'No reading text is registered for this assignment. Please ask your teacher.',

    alertPopup:
      'Copeak could not be opened. Please check your browser pop-up settings.',

    alertSaveClosed:
      'The deadline has passed, so this result was not saved to Classroom.',

    joinCodeRequired:
      'Please enter the Class Code.',

    joinRosterRequired:
      'Please enter both Student No. and Join PIN.',

    submitComplete:
      'Submitted!',

    saveFailed:
      'Failed to save the result'
  }
};


function t(
  key
) {

  return (
    TEXT[
      activeLanguage
    ]?.[
      key
    ] ||
    TEXT.ja[
      key
    ] ||
    key
  );
}


// ==========================================
// STATIC LANGUAGE
// ==========================================

function applyStaticLanguage() {

  document.documentElement.lang =
    activeLanguage ===
      'ja'
      ? 'ja'
      : 'en';


  document
    .querySelectorAll(
      '[data-i18n]'
    )
    .forEach(
      element => {

        const key =
          element.dataset.i18n;


        if (
          key &&
          TEXT[
            activeLanguage
          ]?.[
            key
          ]
        ) {

          element.textContent =
            TEXT[
              activeLanguage
            ][
              key
            ];
        }
      }
    );


  document
    .querySelectorAll(
      '[data-lang]'
    )
    .forEach(
      button => {

        const active =
          button.dataset.lang ===
          activeLanguage;


        button.classList.toggle(
          'active',
          active
        );


        button.setAttribute(
          'aria-pressed',
          active
            ? 'true'
            : 'false'
        );
      }
    );


  const demoBanner =
    $('#demoBanner');


  if (
    demoBanner &&
    !demoBanner.classList.contains(
      'hidden'
    )
  ) {

    demoBanner.textContent =
      t(
        'demoBanner'
      );
  }
}


// ==========================================
// CHANGE LANGUAGE
// ==========================================

function setLanguage(
  language
) {

  if (
    language !==
      'ja' &&
    language !==
      'en'
  ) {

    return;
  }


  activeLanguage =
    language;


  localStorage.setItem(
    'copeak-classroom-student-language',
    language
  );


  applyStaticLanguage();


  if (
    ctx
  ) {

    render();
  }
}


document
  .querySelectorAll(
    '[data-lang]'
  )
  .forEach(
    button => {

      button.addEventListener(
        'click',
        () => {

          setLanguage(
            button.dataset.lang
          );
        }
      );
    }
  );


// ==========================================
// DATE / DEADLINE
// ==========================================

function validTime(
  value
) {

  const time =
    new Date(
      value
    ).getTime();


  return Number.isFinite(
    time
  )
    ? time
    : null;
}


// ==========================================
// DATE FORMAT
// ==========================================

function formatDateTime(
  value
) {

  const time =
    validTime(
      value
    );


  if (
    time === null
  ) {

    return '—';
  }


  const date =
    new Date(
      time
    );


  if (
    activeLanguage ===
      'ja'
  ) {

    const month =
      date.getMonth() +
      1;


    const day =
      date.getDate();


    const hour =
      String(
        date.getHours()
      ).padStart(
        2,
        '0'
      );


    const minute =
      String(
        date.getMinutes()
      ).padStart(
        2,
        '0'
      );


    return (
      `${month}月${day}日 ` +
      `${hour}:${minute}`
    );
  }


  return new Intl
    .DateTimeFormat(
      'en-US',
      {
        month:
          'short',

        day:
          'numeric',

        hour:
          '2-digit',

        minute:
          '2-digit',

        hour12:
          false
      }
    )
    .format(
      date
    );
}


// ==========================================
// COUNTDOWN PARTS
// ==========================================

function countdownParts(
  milliseconds
) {

  const totalSeconds =
    Math.max(
      0,
      Math.floor(
        milliseconds /
        1000
      )
    );


  return {

    days:
      Math.floor(
        totalSeconds /
        86400
      ),

    hours:
      Math.floor(
        (
          totalSeconds %
          86400
        ) /
        3600
      ),

    minutes:
      Math.floor(
        (
          totalSeconds %
          3600
        ) /
        60
      ),

    seconds:
      totalSeconds %
      60
  };
}


// ==========================================
// HUMAN COUNTDOWN
// ==========================================

function formatHumanCountdown(
  milliseconds
) {

  const {
    days,
    hours,
    minutes,
    seconds
  } =
    countdownParts(
      milliseconds
    );


  if (
    activeLanguage ===
      'ja'
  ) {

    if (
      days >
      0
    ) {

      return (
        `あと ${days}日 ` +
        `${hours}時間`
      );
    }


    if (
      hours >
      0
    ) {

      return (
        `あと ${hours}時間 ` +
        `${minutes}分`
      );
    }


    return (
      `あと ${minutes}分 ` +
      `${seconds}秒`
    );
  }


  if (
    days >
    0
  ) {

    return (
      `${days}d ` +
      `${hours}h`
    );
  }


  if (
    hours >
    0
  ) {

    return (
      `${hours}h ` +
      `${minutes}m`
    );
  }


  return (
    `${minutes}m ` +
    `${seconds}s`
  );
}


// ==========================================
// DEADLINE INFO
// ==========================================

function deadlineInfo(
  assignment
) {

  const now =
    Date.now();


  const release =
    validTime(
      assignment.release_at
    );


  const due =
    validTime(
      assignment.due_at
    );


  if (
    release === null ||
    due === null
  ) {

    return {

      state:
        'unknown',

      className:
        'normal',

      countdown:
        '—',

      percent:
        0,

      dateText:
        '—'
    };
  }


  // ========================================
  // NOT OPEN
  // ========================================

  if (
    now <
      release
  ) {

    return {

      state:
        'upcoming',

      className:
        'upcoming',

      countdown:
        `${t(
          'startsIn'
        )} ${formatHumanCountdown(
          release -
          now
        )}`,

      percent:
        100,

      dateText:
        `${t(
          'opens'
        )}：${formatDateTime(
          assignment.release_at
        )}`
    };
  }


  // ========================================
  // CLOSED
  // ========================================

  if (
    now >=
      due
  ) {

    return {

      state:
        'closed',

      className:
        'closed',

      countdown:
        t(
          'closed'
        ),

      percent:
        0,

      dateText:
        `${t(
          'deadline'
        )}：${formatDateTime(
          assignment.due_at
        )}`
    };
  }


  // ========================================
  // OPEN
  // ========================================

  const total =
    Math.max(
      1,
      due -
      release
    );


  const remaining =
    due -
    now;


  const percent =
    Math.max(
      0,
      Math.min(
        100,
        Math.round(
          remaining /
          total *
          100
        )
      )
    );


  let className =
    'normal';


  // 1時間以内
  if (
    remaining <=
      60 *
      60 *
      1000
  ) {

    className =
      'danger';
  }

  // 24時間以内
  else if (
    remaining <=
      24 *
      60 *
      60 *
      1000
  ) {

    className =
      'warning';
  }


  return {

    state:
      'open',

    className,

    countdown:
      formatHumanCountdown(
        remaining
      ),

    percent,

    dateText:
      `${t(
        'deadline'
      )}：${formatDateTime(
        assignment.due_at
      )}`
  };
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
      (
        a,
        b
      ) =>
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
          row.assignment_id,
          row
        );
      }
    );


  return map;
}


// ==========================================
// ASSIGNMENT STATUS
// ==========================================

function bestStudentMetricMap(
  rows,
  metric
) {

  const map =
    new Map();


  rows.forEach(
    row => {

      const raw =
        row?.[metric];


      if (
        raw === null ||
        raw === undefined
      ) {
        return;
      }


      const value =
        Number(raw);


      if (
        !Number.isFinite(value)
      ) {
        return;
      }


      const current =
        map.get(
          row.assignment_id
        );


      if (
        !current ||
        value >
        Number(
          current?.[metric] ??
          -Infinity
        )
      ) {

        map.set(
          row.assignment_id,
          row
        );
      }

    }
  );


  return map;
}


function studentManualScoreMap(
  rows
) {

  const map =
    new Map();


  rows.forEach(
    row => {

      map.set(
        row.assignment_id,
        row
      );

    }
  );


  return map;
}


function studentEffectiveMetric(
  manualRow,
  automaticRow,
  metric
) {

  const manualField =
    metric === 'accuracy'
      ? 'score'
      : metric;


  const manualValue =
    manualRow?.[
      manualField
    ];


  if (
    manualValue !== null &&
    manualValue !== undefined
  ) {

    const number =
      Number(
        manualValue
      );


    return Number.isFinite(
      number
    )
      ? Math.round(number)
      : null;
  }


  const automaticValue =
    automaticRow?.[
      metric
    ];


  if (
    automaticValue === null ||
    automaticValue === undefined
  ) {
    return null;
  }


  const number =
    Number(
      automaticValue
    );


  return Number.isFinite(
    number
  )
    ? Math.round(number)
    : null;
}


function studentPassState(
  assignment,
  maps
) {

  if (
    assignment.pass_enabled !== true
  ) {

    return {
      configured: false,
      passed: false,
      hasScore: false,
      accuracy: null,
      wpm: null,
      comprehension: null,
      targets: {
        accuracy: null,
        wpm: null,
        comprehension: null
      }
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


      return Number.isFinite(
        number
      )
        ? number
        : null;
    };


  const targets = {

    accuracy:
      normalize(
        assignment.pass_accuracy
      ),

    wpm:
      normalize(
        assignment.pass_wpm
      ),

    comprehension:
      normalize(
        assignment.pass_comprehension
      )

  };


  const configured =
    targets.accuracy !== null ||
    targets.wpm !== null ||
    targets.comprehension !== null;


  if (!configured) {

    return {
      configured: false,
      passed: false,
      hasScore: false,
      accuracy: null,
      wpm: null,
      comprehension: null,
      targets
    };
  }


  const manualRow =
    maps.manual.get(
      assignment.id
    );


  const accuracy =
    studentEffectiveMetric(
      manualRow,
      maps.accuracy.get(
        assignment.id
      ),
      'accuracy'
    );


  const wpm =
    studentEffectiveMetric(
      manualRow,
      maps.wpm.get(
        assignment.id
      ),
      'wpm'
    );


  const comprehension =
    studentEffectiveMetric(
      manualRow,
      maps.comprehension.get(
        assignment.id
      ),
      'comprehension'
    );


  const checks =
    [];


  if (
    targets.accuracy !== null
  ) {

    checks.push(
      accuracy !== null &&
      accuracy >=
        targets.accuracy
    );
  }


  if (
    targets.wpm !== null
  ) {

    checks.push(
      wpm !== null &&
      wpm >=
        targets.wpm
    );
  }


  if (
    targets.comprehension !== null
  ) {

    checks.push(
      comprehension !== null &&
      comprehension >=
        targets.comprehension
    );
  }


  return {

    configured:
      true,

    passed:
      checks.length > 0 &&
      checks.every(Boolean),

    hasScore:
      accuracy !== null ||
      wpm !== null ||
      comprehension !== null,

    accuracy,
    wpm,
    comprehension,
    targets
  };
}


function studentGaugeMetricHtml({
  label,
  current,
  target,
  unit = '',
  maximum = 100
}) {

  if (
    target === null ||
    target === undefined
  ) {
    return '';
  }


  const safeMaximum =
    Math.max(
      1,
      Number(maximum) ||
      100
    );


  const currentNumber =
    current === null ||
    current === undefined

      ? null

      : Number(current);


  const targetNumber =
    Number(target);


  const currentPosition =
    currentNumber === null ||
    !Number.isFinite(
      currentNumber
    )

      ? 0

      : Math.max(
          0,
          Math.min(
            100,
            currentNumber /
            safeMaximum *
            100
          )
        );


  const targetPosition =
    Math.max(
      0,
      Math.min(
        100,
        targetNumber /
        safeMaximum *
        100
      )
    );


  const reached =
    currentNumber !== null &&
    Number.isFinite(
      currentNumber
    ) &&
    currentNumber >=
      targetNumber;


  const gap =
    currentNumber === null ||
    !Number.isFinite(
      currentNumber
    )

      ? targetNumber

      : Math.max(
          0,
          targetNumber -
          currentNumber
        );


  const formatValue =
    value =>
      Math.round(
        Number(value) ||
        0
      );


  let gapText;


  if (
    currentNumber === null ||
    !Number.isFinite(
      currentNumber
    )
  ) {

    gapText =
      activeLanguage === 'ja'

        ? `目標 ${formatValue(
            targetNumber
          )}${unit}`

        : `Goal ${formatValue(
            targetNumber
          )}${unit}`;
  }

  else if (reached) {

    gapText =
      activeLanguage === 'ja'
        ? '✓ 達成'
        : '✓ Reached';
  }

  else {

    gapText =
      activeLanguage === 'ja'

        ? `あと ${formatValue(
            gap
          )}${unit}`

        : `${formatValue(
            gap
          )}${unit} to go`;
  }


  const goalText =
    activeLanguage === 'ja'

      ? `合格 ${formatValue(
          targetNumber
        )}${unit}`

      : `Goal ${formatValue(
          targetNumber
        )}${unit}`;


  const currentText =
    currentNumber === null ||
    !Number.isFinite(
      currentNumber
    )

      ? '—'

      : `${formatValue(
          currentNumber
        )}${unit}`;


  return `
    <div
      class="student-gauge-card ${
        reached
          ? 'reached'
          : 'not-reached'
      }">

      <div class="student-gauge-head">

        <span class="student-gauge-label">
          ${escapeHtml(
            label
          )}
        </span>


        <strong class="student-gauge-value">
          ${escapeHtml(
            currentText
          )}
        </strong>

      </div>


      <div class="student-gauge-sub">

        <span class="student-gauge-goal-text">
          ${escapeHtml(
            goalText
          )}
        </span>

        <span
          class="student-gauge-gap ${
            reached
              ? 'reached'
              : ''
          }">

          ${escapeHtml(
            gapText
          )}

        </span>

      </div>


      <div
        class="student-gauge-track"
        style="
          --current:${currentPosition}%;
          --goal:${targetPosition}%;
        ">

        <div class="student-gauge-fill">
        </div>


        <div
          class="student-gauge-goal-line"
          title="${escapeHtml(
            goalText
          )}">

          <span>
            ${
              activeLanguage === 'ja'
                ? '合格'
                : 'GOAL'
            }
          </span>

        </div>

      </div>

    </div>
  `;
}


function studentPassPanelHtml(
  state
) {

  if (
    !state.configured
  ) {
    return '';
  }


  const accuracyGauge =
    state.targets.accuracy !== null

      ? studentGaugeMetricHtml({

          label:
            'Accuracy',

          current:
            state.accuracy,

          target:
            state.targets.accuracy,

          unit:
            '%',

          maximum:
            100
        })

      : '';


  const comprehensionGauge =
    state.targets.comprehension !== null

      ? studentGaugeMetricHtml({

          label:
            'Comprehension',

          current:
            state.comprehension,

          target:
            state.targets.comprehension,

          unit:
            '%',

          maximum:
            100
        })

      : '';


  const wpmMaximum =
    state.targets.wpm !== null

      ? Math.max(
          120,
          state.targets.wpm *
            1.25,
          (
            state.wpm ||
            0
          ) *
            1.1
        )

      : 120;


  const wpmGauge =
    state.targets.wpm !== null

      ? studentGaugeMetricHtml({

          label:
            'WPM',

          current:
            state.wpm,

          target:
            state.targets.wpm,

          unit:
            '',

          maximum:
            wpmMaximum
        })

      : '';


  let statusText;


  if (state.passed) {

    statusText =
      activeLanguage === 'ja'
        ? '✓ 合格'
        : '✓ PASS';
  }

  else if (state.hasScore) {

    statusText =
      activeLanguage === 'ja'
        ? 'あと少し'
        : 'Not Yet';
  }

  else {

    statusText =
      activeLanguage === 'ja'
        ? '未挑戦'
        : 'Not Attempted';
  }


  return `
    <div
      class="student-pass-panel ${
        state.passed
          ? 'passed'
          : state.hasScore
            ? 'pending'
            : 'waiting'
      }">

      <div class="student-pass-head">

        <div>

          <div class="student-pass-title">
            🎯 ${
              activeLanguage === 'ja'
                ? '合格基準'
                : 'Pass Criteria'
            }
          </div>

          <div class="student-pass-guide">

            ${
              activeLanguage === 'ja'

                ? '赤いラインが合格ラインです'

                : 'The red marker shows the goal'
            }

          </div>

        </div>


        <div
          class="student-pass-status ${
            state.passed
              ? 'passed'
              : state.hasScore
                ? 'pending'
                : 'waiting'
          }">

          ${escapeHtml(
            statusText
          )}

        </div>

      </div>


      <div class="student-pass-gauges">

        ${accuracyGauge}

        ${wpmGauge}

        ${comprehensionGauge}

      </div>

    </div>
  `;
}

function assignmentStatus(
  assignment,
  submission
) {

  const now =
    Date.now();


  const release =
    validTime(
      assignment.release_at
    );


  const due =
    validTime(
      assignment.due_at
    );


  // ========================================
  // COMPLETED
  //
  // 締切後でも提出済みなら完了
  // ========================================

  if (
    submission
  ) {

    return {

      key:
        'done',

      label:
        t(
          'statusDone'
        )
    };
  }


  // ========================================
  // UPCOMING
  // ========================================

  if (
    release !==
      null &&
    now <
      release
  ) {

    return {

      key:
        'upcoming',

      label:
        t(
          'statusUpcoming'
        )
    };
  }


  // ========================================
  // LATE / CLOSED
  // ========================================

  if (
    due !==
      null &&
    now >=
      due
  ) {

    return {

      key:
        'late',

      label:
        activeLanguage ===
          'ja'

          ? '！未完了・締切終了'

          : 'Not Completed · Closed'
    };
  }


  // ========================================
  // OPEN / TODO
  // ========================================

  return {

    key:
      'due',

    label:
      t(
        'statusTodo'
      )
  };
}


// ==========================================
// FILTER MATCH
// ==========================================

function assignmentMatchesFilter(
  statusKey
) {

  if (
    activeAssignmentFilter ===
      'todo'
  ) {

    return (
      statusKey ===
        'due' ||
      statusKey ===
        'late'
    );
  }


  if (
    activeAssignmentFilter ===
      'done'
  ) {

    return (
      statusKey ===
      'done'
    );
  }


  if (
    activeAssignmentFilter ===
      'upcoming'
  ) {

    return (
      statusKey ===
      'upcoming'
    );
  }


  return true;
}


// ==========================================
// FILTER BUTTONS
// ==========================================

function syncFilterButtons() {

  document
    .querySelectorAll(
      '[data-assignment-filter]'
    )
    .forEach(
      button => {

        const active =
          button.dataset
            .assignmentFilter ===
          activeAssignmentFilter;


        button.classList.toggle(
          'active',
          active
        );


        button.setAttribute(
          'aria-pressed',
          active
            ? 'true'
            : 'false'
        );
      }
    );
}


document
  .querySelectorAll(
    '[data-assignment-filter]'
  )
  .forEach(
    button => {

      button.addEventListener(
        'click',
        () => {

          activeAssignmentFilter =
            button.dataset
              .assignmentFilter ||
            'all';


          syncFilterButtons();


          render();
        }
      );
    }
  );


// ==========================================
// DASHBOARD RENDER
// ==========================================

function render() {

  applyStaticLanguage();

  syncFilterButtons();


  const map =
    latestMap(
      submissions
    );


  const done =
    assignments
      .filter(
        assignment =>
          map.has(
            assignment.id
          )
      )
      .length;


  const progress =
    assignments.length

      ? Math.round(
          done /
          assignments.length *
          100
        )

      : 0;


  $('#progressText').textContent =
    activeLanguage ===
      'ja'

      ? `${done} / ${assignments.length} 課題完了`

      : `${done} / ${assignments.length} completed`;


  $('#completedMetric').textContent =
    `${done} / ${assignments.length}`;


  $('#progressPct').textContent =
    `${progress}%`;


  $('#progressBar').style.width =
    `${progress}%`;


  // ========================================
  // SCORE SUMMARY
  // ========================================

  const scores =
    [
      ...map.values()
    ];


  $('#avgAccuracy').textContent =
    scores.length

      ? pct(
          scores.reduce(
            (
              sum,
              item
            ) =>
              sum +
              Number(
                item.accuracy ||
                0
              ),
            0
          ) /
          scores.length
        )

      : '—';


  $('#bestWpm').textContent =
    scores.length

      ? Math.round(
          Math.max(
            ...scores.map(
              item =>
                Number(
                  item.wpm ||
                  0
                )
            )
          )
        )

      : '—';


  renderNextAssignment(
    map
  );


  renderAssignmentList(
    map
  );
}


// ==========================================
// NEXT ASSIGNMENT
// ==========================================

function renderNextAssignment(
  map
) {

  const now =
    Date.now();


  // ========================================
  // まず「今できる未完了課題」
  // なければ「次の公開予定課題」
  // ========================================

  const target =
    assignments.find(
      assignment => {

        const release =
          validTime(
            assignment.release_at
          );


        const due =
          validTime(
            assignment.due_at
          );


        return (
          !map.has(
            assignment.id
          ) &&
          release !==
            null &&
          due !==
            null &&
          now >=
            release &&
          now <
            due
        );
      }
    )
    ||
    assignments.find(
      assignment => {

        const release =
          validTime(
            assignment.release_at
          );


        return (
          !map.has(
            assignment.id
          ) &&
          release !==
            null &&
          now <
            release
        );
      }
    );


  const weekStatus =
    $('#weekStatus');


  const deadlineVisual =
    $('#weekDeadlineVisual');


  const button =
    $('#weekStart');


  // ========================================
  // ALL COMPLETED
  // ========================================

  if (
    !target
  ) {

    $('#weekLabel').textContent =
      activeLanguage ===
        'ja'
        ? '完了'
        : 'COMPLETED';


    $('#weekTitle').textContent =
      t(
        'allCompleted'
      );


    $('#weekMeta').textContent =
      t(
        'greatWork'
      );


    if (
      weekStatus
    ) {

      weekStatus.textContent =
        t(
          'statusDone'
        );


      weekStatus.className =
        'student-status-badge done';
    }


    deadlineVisual
      ?.classList
      .add(
        'hidden'
      );


    button.disabled =
      true;


    button.textContent =
      t(
        'statusDone'
      );


    return;
  }


  // ========================================
  // TARGET INFO
  // ========================================

  const status =
    assignmentStatus(
      target,
      null
    );


  const deadline =
    deadlineInfo(
      target
    );


  $('#weekLabel').textContent =
    activeLanguage ===
      'ja'

      ? `課題 #${String(
          target.week_no
        ).padStart(
          2,
          '0'
        )}`

      : `ASSIGNMENT #${String(
          target.week_no
        ).padStart(
          2,
          '0'
        )}`;


  $('#weekTitle').textContent =
    target.title;


  $('#weekMeta').innerHTML =
    `
      <span class="student-category-chip">
        ${escapeHtml(
          target.category ||
          'Reading'
        )}
      </span>
    `;


  // ========================================
  // STATUS
  // ========================================

  if (
    weekStatus
  ) {

    weekStatus.textContent =
      status.label;


    weekStatus.className =
      `student-status-badge ${status.key}`;
  }


  // ========================================
  // DEADLINE VISUAL
  // ========================================

  if (
    deadlineVisual
  ) {

    deadlineVisual
      .classList
      .remove(
        'hidden'
      );


    deadlineVisual
      .classList
      .remove(
        'normal',
        'warning',
        'danger',
        'upcoming',
        'closed'
      );


    deadlineVisual
      .classList
      .add(
        deadline.className
      );
  }


  $('#weekDeadlineLabel').textContent =
    deadline.state ===
      'upcoming'

      ? t(
          'startsIn'
        )

      : t(
          'timeRemaining'
        );


  $('#weekCountdown').textContent =
    deadline.countdown;


  $('#weekTimeBar').style.width =
    `${deadline.percent}%`;


  $('#weekDeadlineDate').textContent =
    deadline.dateText;


  // ========================================
  // BUTTON
  // ========================================

  const unavailable =
    status.key ===
      'upcoming' ||
    status.key ===
      'late';


  button.disabled =
    unavailable;


  button.textContent =
    status.key ===
      'upcoming'

      ? t(
          'notOpen'
        )

      : status.key ===
          'late'

        ? t(
            'closed'
          )

        : t(
            'startCopeak'
          );


  button.onclick =
    unavailable

      ? null

      : () =>
          openCopeak(
            target
          );
}


// ==========================================
// ASSIGNMENT LIST
// ==========================================

function renderAssignmentList(
  map
) {

  const passMaps = {

    accuracy:
      bestStudentMetricMap(
        submissions,
        'accuracy'
      ),

    wpm:
      bestStudentMetricMap(
        submissions,
        'wpm'
      ),

    comprehension:
      bestStudentMetricMap(
        submissions,
        'comprehension'
      ),

    manual:
      studentManualScoreMap(
        manualScores
      )
  };


  const visibleAssignments =
    assignments
      .filter(
        assignment => {

          const submission =
            map.get(
              assignment.id
            );


          const status =
            assignmentStatus(
              assignment,
              submission
            );


          return assignmentMatchesFilter(
            status.key
          );
        }
      );


  // ========================================
  // NO ASSIGNMENTS
  // ========================================

  if (
    !assignments.length
  ) {

    $('#assignmentList').innerHTML =
      `
        <div class="student-empty-state">
          ${escapeHtml(
            t(
              'noAssignments'
            )
          )}
        </div>
      `;


    return;
  }


  // ========================================
  // FILTER EMPTY
  // ========================================

  if (
    !visibleAssignments.length
  ) {

    $('#assignmentList').innerHTML =
      `
        <div class="student-empty-state">
          ${escapeHtml(
            t(
              'noFilteredAssignments'
            )
          )}
        </div>
      `;


    return;
  }


  // ========================================
  // CARDS
  // ========================================

  $('#assignmentList').innerHTML =
    visibleAssignments
      .map(
        assignment => {

          const submission =
            map.get(
              assignment.id
            );


          const status =
            assignmentStatus(
              assignment,
              submission
            );


          const deadline =
            deadlineInfo(
              assignment
            );


          const dueTime =
            validTime(
              assignment.due_at
            );


          const releaseTime =
            validTime(
              assignment.release_at
            );


          const now =
            Date.now();


          const isNotOpen =
            releaseTime !==
              null &&
            now <
              releaseTime;


          const isClosed =
            dueTime !==
              null &&
            now >=
              dueTime;


          const disabled =
            isNotOpen ||
            isClosed;


          let actionLabel;


          if (
            isNotOpen
          ) {

            actionLabel =
              t(
                'notOpen'
              );
          }

          else if (
            isClosed
          ) {

            actionLabel =
              t(
                'closed'
              );
          }

          else if (
            submission
          ) {

            actionLabel =
              t(
                'practiceAgain'
              );
          }

          else {

            actionLabel =
              activeLanguage ===
                'ja'

                ? 'Copeakで始める'

                : 'Start Copeak';
          }


          const deadlineLabel =
            deadline.state ===
              'upcoming'

              ? deadline.dateText

              : `${t(
                  'deadline'
                )}：${formatDateTime(
                  assignment.due_at
                )}`;


          const showMiniDeadline =
            status.key ===
              'due' ||
            status.key ===
              'upcoming' ||
            status.key ===
              'late';


          const passState =
            studentPassState(
              assignment,
              passMaps
            );


          const passPanel =
            studentPassPanelHtml(
              passState
            );

          return `
            <article
              class="assignment student-assignment-card ${passState.configured ? 'has-pass-criteria' : ''}"
              data-status="${status.key}">

              <div class="weekbox">

                <span>
                  ${
                    activeLanguage ===
                      'ja'

                      ? '課題'

                      : 'NO.'
                  }
                </span>

                <strong>
                  ${String(
                    assignment.week_no
                  ).padStart(
                    2,
                    '0'
                  )}
                </strong>

              </div>


              <div class="student-assignment-content">


                <div class="student-assignment-title-row">

                  <div class="assignment-title">

                    ${escapeHtml(
                      assignment.title
                    )}

                  </div>


                  <span
                    class="student-status-badge ${status.key}">

                    ${escapeHtml(
                      status.label
                    )}

                  </span>

                </div>


                <div class="student-assignment-meta-row">

                  <span class="student-category-chip">

                    ${escapeHtml(
                      assignment.category ||
                      'Reading'
                    )}

                  </span>


                  <span class="student-deadline-inline">

                    ◷
                    ${escapeHtml(
                      deadlineLabel
                    )}

                  </span>

                </div>


                ${
                  showMiniDeadline

                    ? `
                      <div
                        class="student-mini-deadline ${deadline.className}">

                        <div class="student-mini-deadline-copy">

                          <strong>

                            ${escapeHtml(
                              deadline.countdown
                            )}

                          </strong>


                          ${
                            deadline.state ===
                              'open'

                              ? `
                                <span>
                                  ${deadline.percent}%
                                </span>
                              `

                              : ''
                          }

                        </div>


                        <div class="student-mini-deadline-track">

                          <div
                            class="student-mini-deadline-fill"
                            style="width:${deadline.percent}%">
                          </div>

                        </div>

                      </div>
                    `

                    : ''
                }

              </div>


                            ${passPanel}

<div
                class="assignment-score student-assignment-result">


                ${
                  submission

                    ? `
                      <strong>

                        ${pct(
                          submission.accuracy
                        )}

                      </strong>



                    `

                    : `
                      <strong class="student-no-score">
                        —
                      </strong>
                    `
                }


                <div class="assignment-actions">

                  <button
                    class="
                      btn
                      btn-sm
                      ${
                        submission
                          ? 'btn-light'
                          : 'btn-primary'
                      }
                      start-btn
                    "
                    data-id="${assignment.id}"
                    ${
                      disabled
                        ? 'disabled'
                        : ''
                    }>

                    ${escapeHtml(
                      actionLabel
                    )}

                  </button>


                  ${
                    ctx.demo &&
                    !submission &&
                    !isNotOpen &&
                    !isClosed

                      ? `
                        <button
                          class="
                            btn
                            btn-sm
                            btn-dark
                            demo-submit
                          "
                          data-id="${assignment.id}">

                          TEST Submit

                        </button>
                      `

                      : ''
                  }

                </div>

              </div>

            </article>
          `;
        }
      )
      .join(
        ''
      );


  // ========================================
  // START BUTTONS
  // ========================================

  document
    .querySelectorAll(
      '.start-btn'
    )
    .forEach(
      button => {

        button.onclick =
          () =>
            openCopeak(
              assignments.find(
                assignment =>
                  assignment.id ===
                  button.dataset.id
              )
            );
      }
    );


  // ========================================
  // DEMO BUTTONS
  // ========================================

  document
    .querySelectorAll(
      '.demo-submit'
    )
    .forEach(
      button => {

        button.onclick =
          () =>
            demoSubmit(
              button.dataset.id
            );
      }
    );
}


// ==========================================
// HTML SAFETY
// ==========================================

function escapeHtml(
  value = ''
) {

  return String(
    value
  )
    .replace(
      /[&<>"']/g,
      character => ({

        '&':
          '&amp;',

        '<':
          '&lt;',

        '>':
          '&gt;',

        '"':
          '&quot;',

        "'":
          '&#39;'

      })[
        character
      ]
    );
}


// ==========================================
// SECURE ASSIGNMENT AUDIO URL
// ==========================================

async function getAssignmentAudioUrl(
  assignment
) {

  if (
    !assignment
      ?.audio_object_key
  ) {

    return null;
  }


  try {

    const sb =
      getClient(
        'student'
      );


    const {
      data: {
        session
      }
    } =
      await sb
        .auth
        .getSession();


    if (
      !session
        ?.access_token
    ) {

      return null;
    }


    const response =
      await fetch(
        '/api/r2-download-url',
        {
          method:
            'POST',

          headers: {

            'Content-Type':
              'application/json',

            'X-Supabase-Access-Token':
              session
                .access_token
          },

          body:
            JSON.stringify(
              {
                assignmentId:
                  assignment.id
              }
            )
        }
      );


    if (
      !response.ok
    ) {

      console.warn(
        '[Copeak Classroom] audio URL unavailable:',
        response.status
      );


      return null;
    }


    const data =
      await response
        .json();


    return (
      data.downloadUrl ||
      null
    );
  }

  catch (
    error
  ) {

    console.warn(
      '[Copeak Classroom] audio download URL failed:',
      error
    );


    return null;
  }
}


// ==========================================
// SECURE ASSIGNMENT IMAGE URL
// ==========================================

async function getAssignmentImageUrl(
  assignment
) {

  if (
    !assignment
      ?.image_object_key
  ) {

    return null;
  }


  try {

    const sb =
      getClient(
        'student'
      );


    const {
      data: {
        session
      }
    } =
      await sb
        .auth
        .getSession();


    if (
      !session
        ?.access_token
    ) {

      return null;
    }


    const response =
      await fetch(
        '/api/r2-download-url',
        {
          method:
            'POST',

          headers: {

            'Content-Type':
              'application/json',

            'X-Supabase-Access-Token':
              session
                .access_token
          },

          body:
            JSON.stringify(
              {
                assignmentId:
                  assignment.id,

                mediaType:
                  'image'
              }
            )
        }
      );


    if (
      !response.ok
    ) {

      console.warn(
        '[Copeak Classroom] image URL unavailable:',
        response.status
      );

      return null;
    }


    const data =
      await response
        .json();


    return (
      data.downloadUrl ||
      null
    );
  }

  catch (
    error
  ) {

    console.warn(
      '[Copeak Classroom] image download URL failed:',
      error
    );

    return null;
  }
}


// ==========================================
// OPEN COPEAK
// ==========================================

async function openCopeak(
  assignment
) {

  if (
    !assignment
  ) {

    return;
  }


  const now =
    new Date();


  const release =
    new Date(
      assignment.release_at
    );


  const due =
    new Date(
      assignment.due_at
    );


  // ========================================
  // NOT OPEN
  // ========================================

  if (
    now <
      release
  ) {

    alert(
      t(
        'alertNotOpen'
      )
    );


    return;
  }


  // ========================================
  // DEADLINE CLOSED
  // ========================================

  if (
    now >=
      due
  ) {

    alert(
      t(
        'alertClosed'
      )
    );


    return;
  }


  // ========================================
  // LESSON TEXT
  // ========================================

  const lessonText =
    String(
      assignment.lesson_text ||
      ''
    )
      .trim();


  if (
    !lessonText
  ) {

    alert(
      t(
        'alertNoLesson'
      )
    );


    return;
  }


  // ========================================
  // COPEAK URL
  // ========================================

  const base =
    assignment.copeak_url ||
    window.COPEAK_CONFIG
      .copeakBaseUrl;


  const url =
    new URL(
      base,
      location.href
    );


  // ========================================
  // CLASSROOM DATA
  // ========================================

  url.searchParams.set(
    'classroom_assignment',
    assignment.id
  );


  url.searchParams.set(
    'source',
    'copeak-classroom'
  );


  url.searchParams.set(
    'classroom_origin',
    location.origin
  );


  // ========================================
  // LESSON DATA
  // ========================================

  url.searchParams.set(
    'title',
    assignment.title ||
    `#${assignment.week_no}`
  );


  url.searchParams.set(
    'eng',
    lessonText
  );


  url.searchParams.set(
    'jpn',
    assignment.lesson_translation ||
    ''
  );


  url.searchParams.set(
    'lang',
    assignment.lesson_lang ||
    'en-US'
  );

// ========================================
// ========================================
// DIALOGUE LESSON
// ========================================

if (
  assignment.lesson_type ===
    'dialogue' &&
  Array.isArray(
    assignment.lesson_dialogue
  ) &&
  assignment.lesson_dialogue.length
) {

  url.searchParams.set(
    'type',
    'dialogue'
  );


  url.searchParams.set(
    'dialogue',
    JSON.stringify(
      assignment.lesson_dialogue
    )
  );
}

// YOUTUBE CLIP
// ========================================

const youtubeId =
  String(
    assignment.youtube_video_id ||
    ''
  ).trim();


if (
  /^[A-Za-z0-9_-]{11}$/.test(
    youtubeId
  )
) {

  url.searchParams.set(
    'youtube_id',
    youtubeId
  );


  const youtubeStart =
    Number(
      assignment.youtube_start_seconds
    );


  if (
    Number.isFinite(
      youtubeStart
    ) &&
    youtubeStart >=
      0
  ) {

    url.searchParams.set(
      'youtube_start',
      String(
        youtubeStart
      )
    );
  }


  const youtubeEnd =
    Number(
      assignment.youtube_end_seconds
    );


  if (
    assignment.youtube_end_seconds !==
      null &&
    assignment.youtube_end_seconds !==
      undefined &&
    Number.isFinite(
      youtubeEnd
    ) &&
    youtubeEnd >
      youtubeStart
  ) {

    url.searchParams.set(
      'youtube_end',
      String(
        youtubeEnd
      )
    );
  }


  url.searchParams.set(
    'youtube_loop',
    assignment.youtube_loop ===
      true
      ? '1'
      : '0'
  );
}

  // ========================================
  // OPEN WINDOW IMMEDIATELY
  // Safari / iPad popup-blocker protection
  // ========================================

  const popup =
    window.open(
      'about:blank',
      '_blank'
    );


  if (
    !popup
  ) {

    alert(
      t(
        'alertPopup'
      )
    );


    return;
  }


  // ========================================
  // AUDIO
  // ========================================

  const audioUrl =
    await getAssignmentAudioUrl(
      assignment
    );


  if (
    audioUrl
  ) {

    url.searchParams.set(
      'audioUrl',
      audioUrl
    );
  }


  // ========================================
  // SUPPORT IMAGE
  // ========================================

  const imageUrl =
    await getAssignmentImageUrl(
      assignment
    );


  if (
    imageUrl
  ) {

    url.searchParams.set(
      'image_url',
      imageUrl
    );
  }


  // ========================================
  // NAVIGATE TO COPEAK
  // ========================================

  popup.location.replace(
    url.toString()
  );
}


// ==========================================
// DEMO SUBMIT
// ==========================================

function demoSubmit(
  id
) {

  submissions.push(
    {

      id:
        `demo-new-${Date.now()}`,

      student_id:
        's1',

      assignment_id:
        id,

      accuracy:
        92,

      wpm:
        118,

      comprehension:
        88,

      attempt_no:
        1,

      submitted_at:
        new Date()
          .toISOString()
    }
  );


  render();
}


// ==========================================
// SAVE COPEAK RESULT
// ==========================================

async function saveCopeakResult(
  data,
  event
) {

  if (
    !ctx ||
    ctx.demo ||
    !ctx.user
  ) {

    return;
  }


  const assignment =
    assignments.find(
      item =>
        item.id ===
        data.assignmentId
    );


  if (
    !assignment
  ) {

    console.warn(
      '[Copeak Classroom] Unknown assignment:',
      data.assignmentId
    );


    return;
  }


  const now =
    new Date();


  const release =
    new Date(
      assignment.release_at
    );


  const due =
    new Date(
      assignment.due_at
    );


  // ========================================
  // RELEASE CHECK
  // ========================================

  if (
    now <
      release
  ) {

    alert(
      t(
        'alertNotOpen'
      )
    );


    return;
  }


  // ========================================
  // DEADLINE CHECK
  // ========================================

  if (
    now >=
      due
  ) {

    alert(
      t(
        'alertSaveClosed'
      )
    );


    return;
  }


  const resultId =
    String(
      data.resultId ||
      ''
    );


  // ========================================
  // DUPLICATE PREVENTION
  // ========================================

  if (
    resultId &&
    processedResultIds.has(
      resultId
    )
  ) {

    return;
  }


  if (
    savingAssignments.has(
      data.assignmentId
    )
  ) {

    return;
  }


  // ========================================
  // VALUES
  // ========================================

  const accuracy =
    Number(
      data.accuracy
    );


  const wpm =
    Number(
      data.wpm
    );


  const comprehension =
    Number(
      data.comprehension
    );


  // ========================================
  // VALUE CHECK
  // ========================================

  if (
    !Number.isFinite(
      accuracy
    ) ||
    accuracy <
      0 ||
    accuracy >
      100
  ) {

    return;
  }


  if (
    !Number.isFinite(
      wpm
    ) ||
    wpm <
      0
  ) {

    return;
  }


  if (
    !Number.isFinite(
      comprehension
    ) ||
    comprehension <
      0 ||
    comprehension >
      100
  ) {

    return;
  }


  savingAssignments.add(
    data.assignmentId
  );


  try {

    // ======================================
    // ATTEMPT NO.
    // ======================================

    const attempts =
      submissions
        .filter(
          submission =>
            submission.assignment_id ===
            data.assignmentId
        )
        .map(
          submission =>
            Number(
              submission.attempt_no
            ) ||
            1
        );


    const attemptNo =
      attempts.length

        ? Math.max(
            ...attempts
          ) +
          1

        : 1;


    // ======================================
    // SAVE ROW
    // ======================================

    const row = {

      assignment_id:
        data.assignmentId,

      student_id:
        ctx.user.id,

      accuracy,

      wpm,

      comprehension,

      attempt_no:
        attemptNo,

      submitted_at:
        new Date()
          .toISOString()
    };


    // ======================================
    // SUPABASE
    // ======================================

    const {
      data: saved,
      error
    } =
      await getClient(
        'student'
      )
        .from(
          'submissions'
        )
        .insert(
          row
        )
        .select()
        .single();


    if (
      error
    ) {

      throw error;
    }


    submissions.push(
      saved
    );


    if (
      resultId
    ) {

      processedResultIds.add(
        resultId
      );
    }


    // ======================================
    // REFRESH DASHBOARD
    // ======================================

    render();


    // ======================================
    // RETURN RESULT TO COPEAK
    // ======================================

    if (
      event?.source &&
      typeof
        event.source.postMessage ===
        'function'
    ) {

      event.source.postMessage(
        {

          type:
            'copeak-classroom-saved',

          assignmentId:
            data.assignmentId,

          resultId
        },

        event.origin
      );
    }


    alert(
      `${t(
        'submitComplete'
      )} ` +
      `Accuracy ${Math.round(
        accuracy
      )}% / ` +
      `WPM ${Math.round(
        wpm
      )} / ` +
      `Comp ${Math.round(
        comprehension
      )}%`
    );
  }

  catch (
    error
  ) {

    console.error(
      '[Copeak Classroom] result save failed',
      error
    );


    alert(
      `${t(
        'saveFailed'
      )}: ${
        error.message ||
        error
      }`
    );
  }

  finally {

    savingAssignments.delete(
      data.assignmentId
    );
  }
}


// ==========================================
// RECEIVE COPEAK RESULT
// ==========================================

window.addEventListener(
  'message',
  event => {

    let copeakOrigin =
      '';


    try {

      copeakOrigin =
        new URL(
          window
            .COPEAK_CONFIG
            .copeakBaseUrl
        )
          .origin;
    }

    catch (
      error
    ) {

      return;
    }


    if (
      event.origin !==
      copeakOrigin
    ) {

      return;
    }


    const data =
      event.data;


    if (
      !data ||
      data.type !==
        'copeak-classroom-result'
    ) {

      return;
    }


    saveCopeakResult(
      data,
      event
    );
  }
);


// ==========================================
// CLASS JOIN
// ==========================================

async function joinClass() {

  const code =
    $('#joinCode')
      .value
      .trim()
      .toUpperCase();


  const studentNumber =
    $('#joinStudentNumber')
      ?.value
      .trim() ||
    '';


  const pin =
    $('#joinPin')
      ?.value
      .trim() ||
    '';


  const msg =
    $('#joinMsg');


  msg.textContent =
    '';


  // ========================================
  // CLASS CODE
  // ========================================

  if (
    !code
  ) {

    msg.textContent =
      t(
        'joinCodeRequired'
      );


    return;
  }


  // ========================================
  // STUDENT NO + PIN
  // ========================================

  if (
    (
      studentNumber &&
      !pin
    ) ||
    (
      !studentNumber &&
      pin
    )
  ) {

    msg.textContent =
      t(
        'joinRosterRequired'
      );


    return;
  }


  const sb =
    getClient(
      'student'
    );


  let error;


  // ========================================
  // ROSTER AUTH
  // ========================================

  if (
    studentNumber &&
    pin
  ) {

    const result =
      await sb.rpc(
        'join_class_with_roster',
        {

          p_code:
            code,

          p_student_number:
            studentNumber,

          p_pin:
            pin
        }
      );


    error =
      result.error;
  }


  // ========================================
  // LEGACY CLASS CODE
  // ========================================

  else {

    const result =
      await sb.rpc(
        'join_class_by_code',
        {

          p_code:
            code
        }
      );


    error =
      result.error;
  }


  if (
    error
  ) {

    msg.textContent =
      error.message;


    return;
  }


  location.reload();
}


// ==========================================
// LOAD LIVE DATA
// ==========================================

async function loadLive() {

  const sb =
    getClient(
      'student'
    );


  // ========================================
  // CLASS MEMBERSHIP
  // ========================================

  const {
    data: members,
    error: memberError
  } =
    await sb
      .from(
        'class_members'
      )
      .select(
        'class_id,classes(id,name,school_id)'
      )
      .eq(
        'student_id',
        ctx.user.id
      )
      .limit(
        1
      );


  if (
    memberError
  ) {

    throw memberError;
  }


  // ========================================
  // NOT JOINED
  // ========================================

  if (
    !members
      ?.length
  ) {

    $('#mainApp')
      .classList
      .add(
        'hidden'
      );


    $('#joinPanel')
      .classList
      .remove(
        'hidden'
      );


    $('#joinBtn').onclick =
      joinClass;


    return;
  }


  // ========================================
  // CURRENT CLASS
  // ========================================

  currentClass =
    members[
      0
    ]
      .classes;


  $('#className').textContent =
    currentClass.name;


  // ========================================
  // ASSIGNMENTS
  // ========================================

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
        currentClass.id
      )
      .eq(
        'is_published',
        true
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


  // ========================================
  // SUBMISSIONS
  // ========================================

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
      .eq(
        'student_id',
        ctx.user.id
      );


  if (
    submissionError
  ) {

    throw submissionError;
  }


  submissions =
    submissionRows ||
    [];

  // ========================================
  // TEACHER MANUAL SCORE OVERRIDES
  // ========================================

  const {
    data: manualRows,
    error: manualError
  } =
    await sb
      .from(
        'manual_scores'
      )
      .select(
        'assignment_id,student_id,score,wpm,comprehension'
      )
      .eq(
        'student_id',
        ctx.user.id
      );


  if (
    manualError
  ) {
    throw manualError;
  }


  manualScores =
    manualRows ||
    [];
}


// ==========================================
// START
// ==========================================

applyStaticLanguage();


(async () => {

  ctx =
    await requireUser(
      'student'
    );


  if (
    !ctx
  ) {

    return;
  }


  $('#userName').textContent =
    ctx.profile
      ?.display_name ||
    'Student';


  // ========================================
  // DEMO
  // ========================================

  if (
    ctx.demo
  ) {

    currentClass = {

      id:
        'demo-class',

      name:
        '3年2組 English Course'
    };


    assignments =
      demoAssignments();


    submissions =
      demoSubmissions()
        .filter(
          item =>
            item.student_id ===
            's1'
        );


    $('#className').textContent =
      currentClass.name;


    $('#demoBanner')
      .classList
      .remove(
        'hidden'
      );


    $('#demoBanner').textContent =
      t(
        'demoBanner'
      );
  }


  // ========================================
  // LIVE
  // ========================================

  else {

    await loadLive();
  }


  render();


  // ========================================
  // COUNTDOWN CLOCK
  //
  // Supabase通信は発生しません。
  // 画面の残り時間だけを1秒ごとに更新します。
  // ========================================

  setInterval(
    render,
    1000
  );
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
