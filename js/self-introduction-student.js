/* Personalized Copeak student form.
 * Authenticated drafts are saved per assignment and student through RLS.
 * Session backup is temporary only; no personal data is sent to analytics.
 */
(function (root) {
  'use strict';

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const engine = () => root.CopeakSelfIntro;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  function keyFor(studentId, assignmentId) {
    // Never use a shared key, class ID alone, or an unauthenticated device identity.
    return 'copeak:selfintro:unsynced:v1:' + studentId + ':' + assignmentId;
  }

  function readSessionBackup(key) {
    try {
      const data = JSON.parse(sessionStorage.getItem(key) || 'null');
      return data && typeof data === 'object' && data.answers ? data : null;
    } catch (_error) { return null; }
  }

  function writeSessionBackup(key, values, choices) {
    try { sessionStorage.setItem(key, JSON.stringify({ answers: values, choices, time: Date.now() })); }
    catch (_error) { /* Best effort; remote save remains authoritative. */ }
  }

  function clearSessionBackup(key) {
    try { sessionStorage.removeItem(key); } catch (_error) {}
  }

  function isWithinPracticeWindow(assignment) {
    if (!assignment?.release_at || !assignment?.due_at) return false;
    const release = Date.parse(assignment.release_at);
    const deadline = Date.parse(assignment.due_at);
    const now = Date.now();
    return Number.isFinite(release) && Number.isFinite(deadline)
      && release < deadline && release <= now && now < deadline;
  }

  async function open({ assignment, studentId, client, launch, demo = false }) {
    if (!assignment || !studentId || typeof launch !== 'function' || !engine()) {
      throw new Error('Self-Introductionを開始するための情報が不足しています。');
    }
    if (!demo && !client) throw new Error('保存用の認証セッションがありません。');
    const cfg = engine().normalize(assignment.lesson_template);
    if (!assignment.lesson_template || !engine().validate(cfg).ok) {
      throw new Error('自己紹介のテンプレートが未設定です。先生にご確認ください。');
    }
    const sessionKey = keyFor(studentId, assignment.id);
    let answers = {};
    let choices = {};
    let ready = false;
    let dirty = false;
    let saving = null;
    let timer = null;
    let revision = 0;
    let lastError = '';
    let remoteVersion = null;
    let conflicted = false;

    // Build an isolated modal so the dashboard refresh never destroys an input field.
    const previousEditor = document.getElementById('selfIntroStudentOverlay');
    if (previousEditor) {
      previousEditor.querySelector('[data-answer]')?.focus({ preventScroll: true });
      return;
    }
    const overlay = document.createElement('div');
    overlay.id = 'selfIntroStudentOverlay';
    overlay.className = 'intro-student-overlay';
    overlay.innerHTML = '<section class="intro-student-modal" role="dialog" aria-modal="true" aria-labelledby="introStudentTitle">' +
      '<header class="intro-student-header"><div><small>Personalized Copeak</small><h2 id="introStudentTitle">My Introduction</h2></div>' +
      '<button type="button" class="intro-student-close" aria-label="閉じる">×</button></header>' +
      '<div class="intro-student-body"><p class="intro-student-instruction" id="introStudentInstruction"></p>' +
      '<div id="introStudentForm" class="intro-student-form"></div>' +
      '<section class="intro-student-preview"><div class="intro-student-preview-heading">' +
      '<strong>My English Introduction</strong><span id="introStudentWordCount">0 words</span></div>' +
      '<p id="introStudentPreview" aria-live="polite"></p></section></div>' +
      '<section id="introStudentConflict" class="intro-student-conflict" role="alert" hidden>' +
      '<strong>別の端末で編集された内容があります</strong><p>今入力した文章は残っています。どちらの内容を使うか選んでください。</p>' +
      '<div><button type="button" id="introStudentLoadLatest">最新の保存内容を表示</button>' +
      '<button type="button" id="introStudentOverwrite">この入力で上書き</button></div></section>' +
      '<footer class="intro-student-footer"><p role="status" id="introStudentSaveStatus">読み込み中…</p>' +
      '<div class="intro-student-footer-buttons"><button type="button" id="introStudentSave" class="intro-student-secondary">保存</button>' +
      '<button type="button" id="introStudentStart" class="intro-student-primary">Copeakで練習</button></div></footer></section>';
    document.body.appendChild(overlay);
    const form = $('#introStudentForm', overlay);
    const status = $('#introStudentSaveStatus', overlay);
    const start = $('#introStudentStart', overlay);
    const saveButton = $('#introStudentSave', overlay);
    const closeButton = $('.intro-student-close', overlay);
    const conflictPanel = $('#introStudentConflict', overlay);
    const latestButton = $('#introStudentLoadLatest', overlay);
    const overwriteButton = $('#introStudentOverwrite', overlay);
    const canPractice = isWithinPracticeWindow(assignment);
    start.disabled = true;
    saveButton.disabled = true;
    const notice = cfg.instructions
      ? cfg.instructions
      : '下の質問に答えると、自分だけの英文ができます。いつでも変更できます。';
    $('#introStudentInstruction', overlay).textContent = notice;

    const isInputField = id => id !== 'closing';
    const fields = engine().fields.filter(field => cfg.fields.includes(field.id));

    function fieldHtml(field) {
      if (!isInputField(field.id)) return '';
      const id = escapeHtml(field.id);
      const sample = escapeHtml(field.sample);
      const input = field.id === 'grade'
        ? '<select id="intro-input-' + id + '" data-answer="' + id + '"><option value="">学年を選択</option>' +
          Array.from({ length: 12 }, (_, index) => {
            const name = 'Grade ' + (index + 1);
            const n = index + 1;
            const label = n <= 6 ? '小' + n : n <= 9 ? '中' + (n - 6) : '高' + (n - 9);
            return '<option value="' + name + '">' + name + '（' + label + '）</option>';
          }).join('') + '</select>'
        : '<input id="intro-input-' + id + '" data-answer="' + id + '" ' +
          (field.id === 'age' ? 'type="number" min="1" max="120" inputmode="numeric"' : 'type="text"') +
          ' maxlength="120" autocomplete="off" placeholder="' + sample + '">';
      return '<div class="intro-student-field"><label for="intro-input-' + id + '">' + escapeHtml(field.label) +
        '</label>' + input + '<small>' + escapeHtml(field.hint) + '</small></div>';
    }

    form.innerHTML = fields.filter(field => isInputField(field.id)).map(fieldHtml).join('') +
      (cfg.allowStudentChoice
        ? '<details class="intro-student-expressions"><summary>英語表現を選ぶ（任意）</summary>' +
          fields.map(field => '<label class="intro-student-choice">' +
            '<span>' + escapeHtml(field.label) + '</span><select data-expression="' + field.id + '">' +
            field.options.map(option => '<option value="' + option[0] + '">' +
              escapeHtml(option[1].replace(/\{([a-z]+)\}/g, (_, id) => engine().fields.find(f => f.id === id)?.sample || '')) +
              '</option>').join('') + '</select></label>').join('') + '</details>'
        : '');

    function showStatus(message, error = false) {
      status.textContent = message;
      status.classList.toggle('intro-student-error', error);
    }

    function refreshPreview() {
      const check = engine().validateAnswers(cfg, answers);
      if (!check.ok) {
        $('#introStudentPreview', overlay).textContent = '情報を入力すると、ここに英文が表示されます。';
        $('#introStudentWordCount', overlay).textContent = '0 words';
        start.disabled = true;
        return;
      }
      try {
        const text = engine().generateStudentText(cfg, answers, choices);
        $('#introStudentPreview', overlay).textContent = text;
        $('#introStudentWordCount', overlay).textContent = text.trim().split(/\s+/).length + ' words';
        start.disabled = !ready || !canPractice;
      } catch (error) {
        start.disabled = true;
        showStatus(error.message, true);
      }
    }

    function populate() {
      form.querySelectorAll('[data-answer]').forEach(input => {
        input.value = answers[input.dataset.answer] || '';
      });
      form.querySelectorAll('[data-expression]').forEach(input => {
        input.value = choices[input.dataset.expression] || cfg.expressions[input.dataset.expression];
      });
      refreshPreview();
    }

    function onChange() {
      revision += 1;
      dirty = true;
      writeSessionBackup(sessionKey, answers, choices);
      refreshPreview();
      clearTimeout(timer);
      if (conflicted) {
        showStatus('他の端末との編集競合があります。入力内容は保持しています。', true);
        return;
      }
      showStatus('入力内容を保存します…');
      timer = setTimeout(() => { void flush(); }, 900);
    }

    form.addEventListener('input', event => {
      const id = event.target.dataset.answer;
      if (!id) return;
      answers[id] = String(event.target.value).slice(0, 120);
      onChange();
    });
    form.addEventListener('change', event => {
      const id = event.target.dataset.expression;
      if (id) { choices[id] = event.target.value; onChange(); return; }
      if (event.target.dataset.answer) {
        answers[event.target.dataset.answer] = String(event.target.value).slice(0, 120);
        onChange();
      }
    });

    async function flush() {
      if (!ready || conflicted) return false;
      if (saving) {
        try { await saving; } catch (_error) { /* First writer reports the error. */ }
        if (!dirty) return true;
        if (conflicted) return false;
      }
      if (!dirty) return true;
      clearTimeout(timer);
      const token = revision;
      const payload = {
        assignment_id: assignment.id,
        student_id: studentId,
        answers: engine().cleanAnswers(answers),
        expression_choices: cfg.allowStudentChoice ? { ...choices } : {}
      };
      showStatus('保存中…');
      saving = (async () => {
        if (demo) return null;
        let result;
        if (remoteVersion) {
          result = await client.from('student_intro_drafts')
            .update({ answers: payload.answers, expression_choices: payload.expression_choices })
            .eq('assignment_id', assignment.id)
            .eq('student_id', studentId)
            .eq('updated_at', remoteVersion)
            .select('updated_at').maybeSingle();
          if (!result.error && !result.data) {
            const conflictError = new Error('REMOTE_CONFLICT');
            conflictError.kind = 'conflict';
            throw conflictError;
          }
        } else {
          result = await client.from('student_intro_drafts')
            .insert(payload)
            .select('updated_at').single();
        }
        if (result.error) {
          if (result.error.code === '23505') {
            const conflictError = new Error('REMOTE_CONFLICT');
            conflictError.kind = 'conflict';
            throw conflictError;
          }
          throw result.error;
        }
        if (!result.data?.updated_at) throw new Error('保存時刻を確認できませんでした。');
        return result.data.updated_at;
      })();
      try {
        const updatedVersion = await saving;
        if (!demo) remoteVersion = updatedVersion;
        lastError = '';
        if (revision === token) {
          dirty = false;
          // Demo has no DB; retain the temporary preview backup.
          if (!demo) clearSessionBackup(sessionKey);
          showStatus(demo ? 'デモ内で一時保存しました。' : '✓ 保存しました。後から再編集できます。');
        } else {
          showStatus('新しい変更を保存します…');
          clearTimeout(timer);
          timer = setTimeout(() => { void flush(); }, 250);
        }
        return !dirty;
      } catch (error) {
        lastError = error.message || '保存できませんでした。';
        if (error.kind === 'conflict') {
          conflicted = true;
          conflictPanel.hidden = false;
          showStatus('別の端末の更新と重なりました。今の入力は消さずに保持しています。', true);
        } else {
          showStatus('保存できませんでした。通信状態を確認して再試行してください。', true);
        }
        return false;
      } finally {
        saving = null;
      }
    }

    async function close() {
      if (dirty && !(await flush())) {
        showStatus('保存されていない変更があります。閉じずに「保存」を押してください。', true);
        return;
      }
      dismiss();
    }

    async function readLatest() {
      if (demo) return null;
      const { data, error } = await client.from('student_intro_drafts')
        .select('answers,expression_choices,updated_at')
        .eq('assignment_id', assignment.id)
        .eq('student_id', studentId)
        .maybeSingle();
      if (error) throw error;
      return data;
    }

    latestButton.addEventListener('click', async () => {
      if (!window.confirm('今入力している内容を破棄して、最新の保存内容を表示しますか？')) return;
      try {
        const data = await readLatest();
        answers = engine().cleanAnswers(data?.answers || {});
        choices = data?.expression_choices && typeof data.expression_choices === 'object'
          ? data.expression_choices : {};
        remoteVersion = data?.updated_at || null;
        dirty = false;
        conflicted = false;
        revision += 1;
        clearTimeout(timer);
        clearSessionBackup(sessionKey);
        conflictPanel.hidden = true;
        populate();
        showStatus('最新の保存内容を読み込みました。');
      } catch (_error) {
        showStatus('最新の内容を確認できません。通信を確認してください。', true);
      }
    });

    overwriteButton.addEventListener('click', async () => {
      if (!window.confirm('別の端末で保存された内容を、現在入力している文章で上書きしますか？')) return;
      try {
        const data = await readLatest();
        remoteVersion = data?.updated_at || null;
        conflicted = false;
        conflictPanel.hidden = true;
        dirty = true;
        revision += 1;
        writeSessionBackup(sessionKey, answers, choices);
        await flush();
      } catch (_error) {
        conflicted = true;
        conflictPanel.hidden = false;
        showStatus('最新の保存内容を確認できません。通信を確認してください。', true);
      }
    });

    function retryWhenOnline() {
      if (ready && dirty && !conflicted) void flush();
    }
    window.addEventListener('online', retryWhenOnline);
    function dismiss() {
      clearTimeout(timer);
      window.removeEventListener('online', retryWhenOnline);
      overlay.remove();
    }

    closeButton.addEventListener('click', () => { void close(); });
    saveButton.addEventListener('click', () => { void flush(); });
    start.addEventListener('click', async () => {
      const check = engine().validateAnswers(cfg, answers);
      if (!check.ok) { showStatus(check.message, true); return; }
      if (!canPractice || !isWithinPracticeWindow(assignment)) {
        showStatus('この課題は現在、練習時間外です。入力内容は保存できます。', true);
        return;
      }
      const text = engine().generateStudentText(cfg, answers, choices);
      // Open synchronously in the click gesture for Safari/iPad popup protection.
      const popup = window.open('about:blank', '_blank');
      if (!popup) { showStatus('ポップアップの許可を確認してください。', true); return; }
      start.disabled = true;
      const success = await flush();
      if (!success || dirty) {
        popup.close();
        showStatus(lastError ? '保存に失敗しました。再試行してください。' : '保存完了後にもう一度お試しください。', true);
        start.disabled = false;
        return;
      }
      try {
        await launch(text, popup);
        dismiss();
      } catch (error) {
        popup.close();
        showStatus('Copeakを開けませんでした。' + (error.message || ''), true);
        start.disabled = false;
      }
    });

    try {
      if (!demo) {
        const { data, error } = await client.from('student_intro_drafts')
          .select('answers,expression_choices,updated_at')
          .eq('assignment_id', assignment.id)
          .eq('student_id', studentId)
          .maybeSingle();
        if (error) throw error;
        answers = engine().cleanAnswers(data?.answers || {});
        choices = data?.expression_choices && typeof data.expression_choices === 'object'
          ? data.expression_choices : {};
        remoteVersion = data?.updated_at || null;
        // Session backup exists only for unsynced edits. Never compare device and server clocks.
        const backup = readSessionBackup(sessionKey);
        if (backup) {
          answers = engine().cleanAnswers(backup.answers);
          choices = backup.choices || {};
          dirty = true;
          revision += 1;
        }
      } else {
        const backup = readSessionBackup(sessionKey);
        answers = engine().cleanAnswers(backup?.answers || {});
        choices = backup?.choices || {};
      }
      ready = true;
      saveButton.disabled = false;
      populate();
      showStatus(dirty ? '未保存の入力を復元しました。' : 'いつでも編集できます。');
      if (dirty) timer = setTimeout(() => { void flush(); }, 250);
      // Keep the initially presented question in view.
      form.querySelector('[data-answer]')?.focus({ preventScroll: true });
    } catch (error) {
      showStatus('入力内容を読み込めませんでした。先生にご確認ください。' +
        (error.code === '42P01' ? '（DB更新が未適用です）' : ''), true);
      start.disabled = true;
      saveButton.disabled = true;
      console.warn('[Copeak] Self-Introduction draft unavailable:', error.code || error.message);
    }
  }

  root.CopeakSelfIntroStudent = { open, isWithinPracticeWindow };
  if (typeof module !== 'undefined' && module.exports) module.exports = { isWithinPracticeWindow, keyFor };
})(typeof globalThis !== 'undefined' ? globalThis : this);
