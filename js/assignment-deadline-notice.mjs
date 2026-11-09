// Screenshot-ready assignment deadline card for Teacher Mode.
// Uses the assignment's saved due_at; no database changes.
function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = String(text);
  return element;
}

export function formatDeadlineParts(value, timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo') {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('ja-JP', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return {
    date: parts.year + '年' + Number(parts.month) + '月' + Number(parts.day) + '日',
    weekday: parts.weekday,
    time: parts.hour + ':' + parts.minute,
    zone: timeZone === 'Asia/Tokyo' ? '日本時間（JST）' : timeZone
  };
}

export function deadlineNoticeText(assignment, className, timeZone) {
  const due = formatDeadlineParts(assignment.due_at, timeZone);
  const dateLabel = due ? due.date + '（' + due.weekday + '） ' + due.time + '［' + due.zone + '］' : '締切日時未設定';
  return '【Copeak Classroom 課題のお知らせ】\nクラス：' + (className || 'クラス未設定') +
    '\n課題：' + (assignment.title || '無題の課題') + '\n提出締切：' + dateLabel +
    '\n締切までに課題に取り組みましょう。';
}

export function openDeadlineNotice({ assignment, className = '', number = '' }) {
  if (!assignment || typeof document === 'undefined') return;
  const previous = document.querySelector('.deadline-notice-overlay');
  if (previous) previous.querySelector('.deadline-notice-close')?.click();

  const due = formatDeadlineParts(assignment.due_at);
  const published = assignment.is_published !== false;
  const noticeText = deadlineNoticeText(assignment, className);
  const overlay = node('div', 'deadline-notice-overlay');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'deadlineNoticeTitle');

  const shell = node('div', 'deadline-notice-shell');
  const toolbar = node('div', 'deadline-notice-toolbar');
  toolbar.append(node('span', '', 'カードをスクリーンショットで保存し、Google Classroom や Teams に貼り付けられます。'));
  const tools = node('div', 'deadline-notice-tools');
  const copyButton = node('button', 'deadline-notice-copy', '案内文をコピー');
  const closeButton = node('button', 'deadline-notice-close', '✕ 閉じる');
  copyButton.type = closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'お知らせを閉じる');
  tools.append(copyButton, closeButton);
  toolbar.append(tools);

  const card = node('article', 'deadline-notice-card');
  card.setAttribute('aria-label', '課題の締切お知らせカード');
  card.append(node('div', 'deadline-notice-wash'));
  const head = node('div', 'deadline-notice-head');
  const brand = node('div', 'deadline-notice-brand');
  brand.append(node('span', 'deadline-notice-brand-mark', 'C'));
  const brandText = node('span', '', 'Copeak ');
  brandText.append(node('strong', '', 'Classroom'));
  brand.append(brandText);
  head.append(brand, node('span', 'deadline-notice-tag', 'READING ASSIGNMENT'));
  card.append(head);

  const content = node('div', 'deadline-notice-content');
  const eyebrow = node('div', 'deadline-notice-eyebrow', 'ASSIGNMENT DEADLINE');
  eyebrow.append(node('span', 'deadline-notice-eyebrow-line'));
  const title = node('h2', '', '課題の提出締切のお知らせ');
  title.id = 'deadlineNoticeTitle';
  content.append(eyebrow, title);
  const cls = node('div', 'deadline-notice-class', className || 'クラス未設定');
  if (number) cls.append(node('span', '', ' / ' + number));
  content.append(cls, node('div', 'deadline-notice-assignment', assignment.title || '無題の課題'));

  const dueBox = node('div', 'deadline-notice-due');
  const dueLabel = node('div', 'deadline-notice-due-label');
  dueLabel.append(node('span', 'deadline-notice-dot'), document.createTextNode(' 提出締切'));
  dueBox.append(dueLabel);
  if (due) {
    const dateLine = node('div', 'deadline-notice-date', due.date + ' ');
    dateLine.append(node('span', '', '(' + due.weekday + ')'));
    const timeLine = node('div', 'deadline-notice-time', due.time + ' ');
    timeLine.append(node('span', '', 'まで'));
    dueBox.append(dateLine, timeLine, node('div', 'deadline-notice-zone', due.zone));
  } else {
    dueBox.append(node('div', 'deadline-notice-missing', '締切日時が設定されていません'));
  }
  content.append(dueBox);
  if (!published) content.append(node('div', 'deadline-notice-unpublished', '未公開の課題です。生徒へ共有する前に Publish してください。'));
  card.append(content);
  const footer = node('div', 'deadline-notice-footer');
  footer.append(node('span', '', '締切までに課題に取り組みましょう。'), node('strong', '', 'Learn. Speak. Grow.'));
  card.append(footer);

  const status = node('div', 'deadline-notice-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  shell.append(toolbar, card, status);
  overlay.append(shell);
  const focused = document.activeElement;
  const overflow = document.body.style.overflow;
  document.body.append(overlay);
  document.body.style.overflow = 'hidden';

  function close() {
    document.removeEventListener('keydown', onKeydown);
    overlay.remove();
    document.body.style.overflow = overflow;
    focused?.focus?.();
  }
  function onKeydown(event) {
    if (event.key === 'Escape') close();
    if (event.key !== 'Tab') return;
    if (event.shiftKey && document.activeElement === copyButton) {
      event.preventDefault(); closeButton.focus();
    } else if (!event.shiftKey && document.activeElement === closeButton) {
      event.preventDefault(); copyButton.focus();
    }
  }
  closeButton.addEventListener('click', close);
  overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
  document.addEventListener('keydown', onKeydown);
  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(noticeText);
      status.textContent = '案内文をコピーしました。';
    } catch {
      status.textContent = 'コピーできませんでした。スクリーンショットで共有してください。';
    }
  });
  closeButton.focus();
}
