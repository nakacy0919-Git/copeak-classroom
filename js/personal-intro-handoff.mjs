/**
 * One-time transport for personalized Classroom text.
 * Only public class/assignment metadata enters the URL. The student's writing
 * is sent in memory to a trusted Copeak window after a verified ready signal.
 */
export function preparePersonalIntroHandoff({
  popup, url, assignmentId, studentId, nonce, text,
  eventTarget = window, timeoutMs = 60000
}) {
  const targetOrigin = new URL(url).origin;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!popup || !targetOrigin.startsWith('https://') ||
      !uuid.test(assignmentId || '') || !uuid.test(studentId || '') ||
      !uuid.test(nonce || '') || typeof text !== 'string' ||
      !text.trim() || text.length > 6000) {
    throw new Error('安全な自己紹介の受け渡しに必要な情報が不足しています。');
  }
  let settled = false;
  let receivedReady = false;
  let timer = null;
  let rejectPromise;
  let resolvePromise;
  const done = new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  function finish(error = null) {
    if (settled) return;
    settled = true;
    if (timer !== null) clearTimeout(timer);
    eventTarget.removeEventListener('message', onMessage);
    if (error) rejectPromise(error);
    else resolvePromise();
  }
  function onMessage(event) {
    if (settled || event.source !== popup || event.origin !== targetOrigin) return;
    const message = event.data;
    if (!message || message.nonce !== nonce || message.assignmentId !== assignmentId) return;
    if (message.type === 'copeak-classroom-intro-ready') {
      if (receivedReady || message.studentId !== studentId || popup.closed) return;
      receivedReady = true;
      popup.postMessage({
        type: 'copeak-classroom-intro-payload', nonce, assignmentId,
        studentId, text
      }, targetOrigin);
    } else if (message.type === 'copeak-classroom-intro-ack' && receivedReady) {
      finish(message.ok === true ? null : new Error('Copeakで自己紹介を読み込めませんでした。'));
    }
  }
  eventTarget.addEventListener('message', onMessage);
  timer = setTimeout(() => finish(new Error('Copeakとの接続を確認できませんでした。再度開いてください。')), timeoutMs);
  return {
    done,
    cancel() { finish(new Error('自己紹介の送信を中止しました。')); }
  };
}
