// Advisory learning guidance only: no grades or submission data are modified.
// This module is shared by teacher settings and student dashboards.
export const LEARNING_NOTICE_MODES = Object.freeze({
  strict: Object.freeze({
    label: 'しっかり管理',
    description: '締切後1件から学習計画の確認を促します。未完了が多い場合は相談を勧めます。'
  }),
  standard: Object.freeze({
    label: '標準管理（おすすめ）',
    description: '締切後1〜2件は穏やかに通知し、3件以上で計画の見直しを促します。'
  }),
  gentle: Object.freeze({
    label: 'ゆったり管理',
    description: '締切後1〜3件は穏やかに通知し、4件以上で計画の見直しを促します。'
  })
});

export function normalizeLearningNoticeMode(value) {
  return Object.prototype.hasOwnProperty.call(LEARNING_NOTICE_MODES, value)
    ? value : 'standard';
}

export function summarizeLearningHealth(rows, now = Date.now(), preference = 'standard') {
  const HOUR = 3600000;
  const mode = normalizeLearningNoticeMode(preference);
  const result = {
    total: 0, passed: 0, submittedComplete: 0, complete: 0,
    incomplete: 0, unsubmitted: 0, future: 0,
    overdue: 0, overdueUnsubmitted: 0, near: 0, agedOpen: 0,
    agedPending: 0, percent: null, mode,
    level: 'neutral', title: '課題なし',
    message: '公開された課題がありません。'
  };

  for (const row of rows || []) {
    const release = Number.isFinite(row.releaseMs) ? row.releaseMs : null;
    const due = Number.isFinite(row.dueMs) ? row.dueMs : null;
    if (release !== null && release > now) {
      result.future++;
      continue;
    }
    result.total++;
    if (release !== null && now - release >= 48 * HOUR) result.agedOpen++;
    if (row.complete) {
      result.complete++;
      if (row.passed) result.passed++;
      else result.submittedComplete++;
      continue;
    }
    if (row.attempted) result.incomplete++;
    else result.unsubmitted++;
    if (release !== null && now - release >= 48 * HOUR) result.agedPending++;
    if (due !== null) {
      if (due <= now) {
        result.overdue++;
        if (!row.attempted) result.overdueUnsubmitted++;
      } else if (due - now <= 48 * HOUR) {
        result.near++;
      }
    }
  }

  if (!result.total) return result;
  result.percent = Math.round(result.complete / result.total * 100);
  const past = result.overdue;
  const ratio = past / result.total;
  // Escalation combines absolute counts with proportion, avoiding harsh
  // notices for a few missed tasks out of a large annual workload.
  const support =
    mode === 'strict' ? (past >= 4 && ratio >= 0.5) :
    mode === 'gentle' ? (past >= 8 && ratio >= 0.6) :
      (past >= 6 && ratio >= 0.5);
  const plan =
    mode === 'strict' ? (past >= 1 || result.near >= 3) :
    mode === 'gentle' ? (past >= 4 || result.near >= 6) :
      (past >= 3 || result.near >= 4);
  const reminder = past > 0 || (
    mode === 'gentle' ? result.near >= 2 : result.near >= 1
  );

  if (support) {
    result.level = 'support';
    result.title = '先生と一緒に考えよう';
  } else if (plan) {
    result.level = 'plan';
    result.title = '学習計画を確認しよう';
  } else if (reminder) {
    result.level = 'reminder';
    result.title = 'あと少し！';
  } else {
    result.level = 'normal';
    result.title = result.complete === result.total
      ? '順調です！' : '自分のペースで進めよう';
  }

  if (past > 0) {
    result.message = `締切後の未完了課題が${past}件あります。` +
      (result.level === 'support' ? '先生と進め方を相談しましょう。' : 'できる課題から1件ずつ進めましょう。');
  } else if (result.near > 0) {
    result.message = `締切が近い未完了課題が${result.near}件あります。取り組む順番を確認しましょう。`;
  } else if (result.complete === result.total) {
    result.message = '公開されている課題をすべて達成しました！';
  } else {
    result.message = '今のところ締切に余裕があります。自分のペースで進めましょう。';
  }
  return result;
}
