import {
  requireUser,
  getClient,
  signOut,
  fmtDate,
  pct
} from './supabase.js';

import {
  demoAssignments,
  demoSubmissions
} from './data.js';

const $ = s => document.querySelector(s);

let ctx;
let assignments = [];
let submissions = [];
let currentClass = null;

const processedResultIds = new Set();
const savingAssignments = new Set();

$('#signOut').onclick = signOut;


// ==========================================
// 最新提出結果
// ==========================================
function latestMap(rows) {

  const m = new Map();

  rows
    .slice()
    .sort(
      (a, b) =>
        new Date(a.submitted_at) -
        new Date(b.submitted_at)
    )
    .forEach(
      r =>
        m.set(
          r.assignment_id,
          r
        )
    );

  return m;
}


// ==========================================
// 課題ステータス
// ==========================================
function assignmentStatus(
  assignment,
  submission
) {

  if (submission) {
    return [
      'done',
      '✓ Completed'
    ];
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

  if (now < release) {
    return [
      'upcoming',
      'Upcoming'
    ];
  }

  if (now > due) {
    return [
      'late',
      'Overdue'
    ];
  }

  return [
    'due',
    'This Week'
  ];
}


// ==========================================
// Dashboard描画
// ==========================================
function render() {

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
    `${done} / ${assignments.length}`;

  $('#completedMetric').textContent =
    `${done} / ${assignments.length}`;

  $('#progressPct').textContent =
    `${progress}%`;

  $('#progressBar').style.width =
    `${progress}%`;


  // ========================================
  // Accuracy平均
  // ========================================
  const scores =
    [...map.values()];


  $('#avgAccuracy').textContent =
    scores.length
      ? pct(
          scores.reduce(
            (sum, item) =>
              sum +
              Number(
                item.accuracy || 0
              ),
            0
          ) /
          scores.length
        )
      : '—';


  // ========================================
  // Best WPM
  // ========================================
  $('#bestWpm').textContent =
    scores.length
      ? Math.round(
          Math.max(
            ...scores.map(
              item =>
                Number(
                  item.wpm || 0
                )
            )
          )
        )
      : '—';


  // ========================================
  // 今週の課題
  // ========================================
  const target =
    assignments.find(
      assignment =>
        !map.has(
          assignment.id
        ) &&
        new Date(
          assignment.release_at
        ) <=
        new Date()
    ) ||
    assignments.find(
      assignment =>
        !map.has(
          assignment.id
        )
    );


  if (target) {

    const [statusClass] =
      assignmentStatus(
        target,
        null
      );

    $('#weekLabel').textContent =
      `WEEK ${
        String(
          target.week_no
        )
        .padStart(
          2,
          '0'
        )
      }`;

    $('#weekTitle').textContent =
      target.title;

    $('#weekMeta').textContent =
      `${
        target.category ||
        'Reading'
      } • Due ${
        fmtDate(
          target.due_at
        )
      }`;

    const button =
      $('#weekStart');

    button.disabled =
      statusClass ===
      'upcoming';

    button.onclick =
      () =>
        openCopeak(
          target
        );

  } else {

    $('#weekTitle').textContent =
      'All assignments completed!';

    $('#weekMeta').textContent =
      'Great work.';

    $('#weekStart').disabled =
      true;
  }


  // ========================================
  // 課題一覧
  // ========================================
  $('#assignmentList').innerHTML =
    assignments
      .map(
        assignment => {

          const submission =
            map.get(
              assignment.id
            );

          const [
            statusClass,
            statusLabel
          ] =
            assignmentStatus(
              assignment,
              submission
            );

          const disabled =
            statusClass ===
            'upcoming'
              ? 'disabled'
              : '';


          return `
            <div class="assignment">

              <div class="weekbox">
                <span>WEEK</span>
                <strong>
                  ${
                    String(
                      assignment.week_no
                    )
                    .padStart(
                      2,
                      '0'
                    )
                  }
                </strong>
              </div>


              <div>

                <div class="assignment-title">
                  ${
                    escapeHtml(
                      assignment.title
                    )
                  }
                </div>

                <div class="assignment-meta">

                  ${
                    escapeHtml(
                      assignment.category ||
                      'Reading'
                    )
                  }

                  ・

                  ${
                    fmtDate(
                      assignment.due_at
                    )
                  }

                  ・

                  <span class="status ${statusClass}">
                    ${statusLabel}
                  </span>

                </div>

              </div>


              <div class="assignment-score">

                ${
                  submission
                    ? `
                      <strong>
                        ${
                          pct(
                            submission.accuracy
                          )
                        }
                      </strong>

                      <div class="tiny muted">
                        WPM ${
                          Math.round(
                            submission.wpm ||
                            0
                          )
                        }
                        /
                        Comp ${
                          pct(
                            submission.comprehension
                          )
                        }
                      </div>
                    `
                    : `
                      <strong style="color:#a8a29e">
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
                    ${disabled}
                  >
                    ${
                      submission
                        ? 'Practice Again'
                        : 'Start Copeak'
                    }
                  </button>


                  ${
                    ctx.demo &&
                    !submission &&
                    statusClass !==
                    'upcoming'

                      ? `
                        <button
                          class="
                            btn
                            btn-sm
                            btn-dark
                            demo-submit
                          "
                          data-id="${assignment.id}"
                        >
                          TEST Submit
                        </button>
                      `

                      : ''
                  }

                </div>

              </div>

            </div>
          `;
        }
      )
      .join('');


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
// HTML安全化
// ==========================================
function escapeHtml(
  value = ''
) {

  return String(
    value
  )
    .replace(
      /[&<>'"]/g,
      character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      })[
        character
      ]
    );
}


// ==========================================
// Copeakを開く
// Classroom課題の英文を自動で渡す
// ==========================================
function openCopeak(assignment) {

  if (!assignment) {
    return;
  }

  // 教材本文がない場合はCopeakを開かない
  const lessonText =
    String(
      assignment.lesson_text || ''
    ).trim();

  if (!lessonText) {
    alert(
      'この課題には音読教材が登録されていません。先生に確認してください。'
    );
    return;
  }


  const base =
    assignment.copeak_url ||
    window.COPEAK_CONFIG.copeakBaseUrl;


  const url =
    new URL(
      base,
      location.href
    );


  // ========================================
  // Copeak Classroom情報
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
  // Copeakへ教材を渡す
  // ========================================

  url.searchParams.set(
    'title',
    assignment.title ||
    `Week ${assignment.week_no}`
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
  // Copeakを開く
  // ========================================

  const popup =
    window.open(
      url.toString(),
      '_blank'
    );


  if (!popup) {

    alert(
      'Copeakを開けませんでした。ブラウザのポップアップ設定を確認してください。'
    );
  }
}

// ==========================================
// Demo提出
// ==========================================
function demoSubmit(
  id
) {

  submissions.push({

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
  });


  render();
}


// ==========================================
// Copeak結果をSupabaseへ保存
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


  // ========================================
  // 本当にこのクラスの課題か確認
  // ========================================
  const assignment =
    assignments.find(
      item =>
        item.id ===
        data.assignmentId
    );


  if (!assignment) {

    console.warn(
      '[Copeak Classroom] Unknown assignment:',
      data.assignmentId
    );

    return;
  }


  const resultId =
    String(
      data.resultId ||
      ''
    );


  // ========================================
  // 二重送信防止
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
  // 数値取得
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
  // 異常値防止
  // ========================================
  if (
    !Number.isFinite(
      accuracy
    ) ||
    accuracy < 0 ||
    accuracy > 100
  ) {
    return;
  }


  if (
    !Number.isFinite(
      wpm
    ) ||
    wpm < 0
  ) {
    return;
  }


  if (
    !Number.isFinite(
      comprehension
    ) ||
    comprehension < 0 ||
    comprehension > 100
  ) {
    return;
  }


  savingAssignments.add(
    data.assignmentId
  );


  try {

    // ======================================
    // Attempt番号
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
    // 保存データ
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
    // SupabaseへINSERT
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


    if (error) {
      throw error;
    }


    submissions.push(
      saved
    );


    if (resultId) {

      processedResultIds.add(
        resultId
      );
    }


    // 生徒Dashboardを即更新
    render();


    // ======================================
    // Copeak側へ保存成功を通知
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
      `提出完了！ Accuracy ${Math.round(accuracy)}% / ` +
      `WPM ${Math.round(wpm)} / ` +
      `Comp ${Math.round(comprehension)}%`
    );


  } catch (
    error
  ) {

    console.error(
      '[Copeak Classroom] result save failed',
      error
    );


    alert(
      `成績の保存に失敗しました: ${
        error.message ||
        error
      }`
    );


  } finally {

    savingAssignments.delete(
      data.assignmentId
    );
  }
}


// ==========================================
// CopeakからpostMessageを受信
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

    } catch (
      error
    ) {

      return;
    }


    // ======================================
    // Copeak本体以外からは受けない
    // ======================================
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
// Class Code参加
// ==========================================
// ==========================================
// Class Join
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


  if (!code) {

    msg.textContent =
      'Class Codeを入力してください。';

    return;
  }


  // Student No.とPINの片方だけはNG
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
      'Student No.とJoin PINの両方を入力してください。';

    return;
  }


  const sb =
    getClient(
  'student'
);


  let error;


  // ========================================
  // 名簿認証
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
  // 従来型Class Code
  // 名簿なしクラスのみ利用可能
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


  if (error) {

    msg.textContent =
      error.message;

    return;
  }


  location.reload();
}

// ==========================================
// Studentデータ読み込み
// ==========================================
async function loadLive() {

  const sb =
    getClient(
  'student'
);


  // ========================================
  // 所属クラス
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
  // まだクラス未参加
  // ========================================
  if (
    !members?.length
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


  currentClass =
    members[0]
      .classes;


  $('#className').textContent =
    currentClass.name;


  // ========================================
  // 課題読み込み
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
  // 自分の提出結果
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
}


// ==========================================
// 起動
// ==========================================
(async () => {

  ctx =
    await requireUser(
      'student'
    );


  if (!ctx) {
    return;
  }


  $('#userName').textContent =
    ctx.profile
      ?.display_name ||
    'Student';


  // ========================================
  // Demo
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


  } else {

    await loadLive();
  }


  render();


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