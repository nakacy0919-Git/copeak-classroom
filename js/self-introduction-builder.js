/* Self-Introduction Builder, stage 1: teacher-only local draft. No student data is stored. */
(function (root) {
  'use strict';

  const levelFields = {
    beginner: ['name', 'school', 'grade', 'hobby', 'closing'],
    intermediate: ['name', 'school', 'grade', 'hobby', 'reason', 'goal', 'closing'],
    advanced: ['name', 'school', 'grade', 'hometown', 'hobby', 'reason', 'strength', 'goal', 'closing']
  };
  const levelExpressions = {
    beginner: {
      name: 'hello', age: 'years', school: 'go', grade: 'in',
      hometown: 'from', hobby: 'like', reason: 'because', strength: 'good',
      goal: 'want', subject: 'favorite', club: 'member', closing: 'meet'
    },
    intermediate: {
      name: 'hi', age: 'short', school: 'attend', grade: 'student',
      hometown: 'come', hobby: 'enjoy', reason: 'one', strength: 'one',
      goal: 'hope', subject: 'study', club: 'belong', closing: 'thanks'
    },
    advanced: {
      name: 'pleasure', age: 'currently', school: 'student', grade: 'currently',
      hometown: 'hometown', hobby: 'free', reason: 'meaning', strength: 'confident',
      goal: 'dream', subject: 'interested', club: 'takepart', closing: 'learn'
    }
  };
  const fields = [
    { id: 'name', label: '名前・ニックネーム', sample: 'Yuki', hint: '本人の呼ばれたい名前。実名は必須にしない', options: [
      ['hello', 'Hello! My name is {name}.'],
      ['hi', "Hi, I'm {name}."],
      ['pleasure', "It's a pleasure to meet you. I'm {name}."] ] },
    { id: 'age', label: '年齢', sample: '16', hint: '数字を入力（任意）', options: [
      ['years', "I'm {age} years old."],
      ['short', "I'm {age}."],
      ['currently', "I'm currently {age} years old."] ] },
    { id: 'school', label: '学校名', sample: 'Sakura High School', hint: '学校名を英語で入力', options: [
      ['attend', 'I attend {school}.'],
      ['go', 'I go to {school}.'],
      ['student', "I'm a student at {school}."] ] },
    { id: 'grade', label: '学年', sample: 'Grade 11', hint: '例：Grade 6 / Grade 11（学校段階に応じて選択）', options: [
      ['in', "I'm in {grade}."],
      ['currently', "I'm currently studying in {grade}."],
      ['student', "I'm a student in {grade}."] ] },
    { id: 'hometown', label: '出身地', sample: 'Aichi, Japan', hint: '正確な住所は入力させない', options: [
      ['from', "I'm from {hometown}."],
      ['hometown', 'My hometown is {hometown}.'],
      ['come', 'I come from {hometown}.'] ] },
    { id: 'hobby', label: '趣味・好きなこと', sample: 'playing basketball', hint: '動名詞などの自然な英語表現で入力', options: [
      ['like', 'I like {hobby}.'],
      ['enjoy', 'I enjoy {hobby}.'],
      ['free', 'In my free time, I love {hobby}.'] ] },
    { id: 'reason', label: '趣味の理由', sample: 'it helps me work with others', hint: 'becauseの後に続く文の形で入力', options: [
      ['because', 'I like it because {reason}.'],
      ['one', 'One reason I enjoy it is that {reason}.'],
      ['meaning', "It's meaningful to me because {reason}."] ] },
    { id: 'strength', label: '得意なこと・長所', sample: 'communicating with people', hint: '例：communicating with people', options: [
      ['good', "I'm good at {strength}."],
      ['one', 'One of my strengths is {strength}.'],
      ['confident', 'I feel confident about {strength}.'] ] },
    { id: 'goal', label: '将来の夢', sample: 'become an English teacher', hint: 'toの後ろに続く動詞の原形で入力', options: [
      ['want', 'I want to {goal} in the future.'],
      ['dream', 'My dream is to {goal}.'],
      ['hope', 'I hope to {goal} someday.'] ] },
    { id: 'subject', label: '好きな教科', sample: 'English', hint: '教科名を英語で入力', options: [
      ['favorite', 'My favorite subject is {subject}.'],
      ['study', 'I especially enjoy studying {subject}.'],
      ['interested', "At school, I'm most interested in {subject}."] ] },
    { id: 'club', label: '部活動', sample: 'basketball club', hint: '所属している部活動名', options: [
      ['member', "I'm a member of the {club}."],
      ['belong', 'I belong to the {club}.'],
      ['takepart', 'I take part in activities with the {club}.'] ] },
    { id: 'closing', label: '結びの表現', sample: '', hint: '入力不要。選んだ英文で締めくくる', options: [
      ['meet', 'Nice to meet you!'],
      ['thanks', 'Thank you for listening.'],
      ['learn', "I'm looking forward to learning with you."] ] }
  ];
  const byId = Object.fromEntries(fields.map(field => [field.id, field]));
  const labels = { basics: '基本設定', fields: '入力項目', expressions: 'Expression Bank' };
  const draftPrefix = 'copeak:self-intro:teacher-draft:v1:';
  let activeTab = 'basics';
  let activeExpression = 'name';
  let classKey = 'default';
  let model = null;
  let mounted = false;

  function defaultConfig(level = 'intermediate') {
    return { version: 1, level, fields: [...levelFields[level]], expressions: { ...levelExpressions[level] }, allowStudentChoice: false, instructions: '' };
  }

  function normalize(raw) {
    const level = Object.hasOwn(levelFields, raw?.level) ? raw.level : 'intermediate';
    const list = Array.isArray(raw?.fields) ? raw.fields : levelFields[level];
    const selected = new Set(list.filter(id => Object.hasOwn(byId, id)));
    selected.add('name');
    if (selected.has('reason') && !selected.has('hobby')) selected.delete('reason');
    const expressions = {};
    for (const field of fields) {
      const valid = new Set(field.options.map(option => option[0]));
      const picked = raw?.expressions?.[field.id];
      expressions[field.id] = valid.has(picked) ? picked : levelExpressions[level][field.id];
    }
    return {
      version: 1,
      level,
      fields: fields.filter(field => selected.has(field.id)).map(field => field.id),
      expressions,
      allowStudentChoice: raw?.allowStudentChoice === true,
      instructions: String(raw?.instructions || '').slice(0, 500)
    };
  }

  function validate(raw) {
    const cfg = normalize(raw);
    if (!cfg.fields.includes('name')) return { ok: false, message: '名前の項目が必要です。' };
    if (cfg.fields.length < 2) return { ok: false, message: '2項目以上を選んでください。' };
    return { ok: true, message: '', config: cfg };
  }

  function generatePreview(raw, values = {}) {
    const cfg = normalize(raw);
    const sentences = [];
    for (const id of cfg.fields) {
      const field = byId[id];
      const chosen = field.options.find(option => option[0] === cfg.expressions[id]) || field.options[0];
      const result = chosen[1].replace(/\{([a-z]+)\}/g, (_, key) => {
        const original = values[key] == null ? byId[key]?.sample || '' : String(values[key]);
        return original.trim().slice(0, 120);
      });
      if (result) sentences.push(result);
    }
    return sentences.join('\n');
  }

  // Student-generated text NEVER substitutes demo data for missing answers.
  // The teacher preview above intentionally uses sample values; keep these paths separate.
  function cleanAnswers(raw = {}) {
    const result = {};
    for (const field of fields) {
      if (field.id === 'closing') continue;
      const value = typeof raw?.[field.id] === 'string' ? raw[field.id] : String(raw?.[field.id] ?? '');
      result[field.id] = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 120);
    }
    return result;
  }

  function validateAnswers(raw, values) {
    const cfg = normalize(raw);
    const answers = cleanAnswers(values);
    const missing = cfg.fields.filter(id => id !== 'closing' && !answers[id]);
    if (missing.length) return { ok: false, message: byId[missing[0]].label + 'を入力してください。', missing, answers };
    if (cfg.fields.includes('age') && !/^\d{1,3}$/.test(answers.age)) {
      return { ok: false, message: '年齢は数字で入力してください。', missing: ['age'], answers };
    }
    if (cfg.fields.includes('age') && (Number(answers.age) < 1 || Number(answers.age) > 120)) {
      return { ok: false, message: '年齢は1〜120の数字で入力してください。', missing: ['age'], answers };
    }
    if (cfg.fields.includes('grade') && !/^Grade (?:[1-9]|1[0-2])$/.test(answers.grade)) {
      return { ok: false, message: '学年をGrade 1〜12から選んでください。', missing: ['grade'], answers };
    }
    return { ok: true, message: '', missing: [], answers };
  }

  function generateStudentText(raw, values, rawChoices = {}) {
    const cfg = normalize(raw);
    const validated = validateAnswers(cfg, values);
    if (!validated.ok) throw new Error(validated.message);
    const output = [];
    for (const id of cfg.fields) {
      const field = byId[id];
      const requested = cfg.allowStudentChoice ? rawChoices?.[id] : null;
      const chosenId = field.options.some(opt => opt[0] === requested) ? requested : cfg.expressions[id];
      const phrase = (field.options.find(opt => opt[0] === chosenId) || field.options[0])[1];
      output.push(phrase.replace(/\{([a-z]+)\}/g, (_, key) => validated.answers[key] || ''));
    }
    return output.join('\n');
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function $(id) { return document.getElementById(id); }
  function persist() {
    try {
      window.localStorage.setItem(draftPrefix + classKey, JSON.stringify(model));
      return true;
    } catch (error) {
      console.warn('[Self-Introduction Builder] local draft was not saved', error);
      return false;
    }
  }

  function restore(classId = 'default', assignmentTemplate = null) {
    classKey = String(classId || 'default');
    let saved;
    try {
      saved = JSON.parse(window.localStorage.getItem(draftPrefix + classKey) || 'null');
    } catch (_error) { saved = null; }
    model = normalize(assignmentTemplate && typeof assignmentTemplate === 'object' ? assignmentTemplate : saved);
    activeTab = 'basics';
    activeExpression = 'name';
    if (mounted) {
      render();
      $('selfIntroNotice').textContent = '設定を変更したら下書き保存、または課題の保存・配布を選んでください。';
    }
  }

  function render() {
    if (!mounted) return;
    model = normalize(model);
    const tabContainer = $('selfIntroTabs');
    tabContainer.querySelectorAll('[data-selfintro-tab]').forEach(button => {
      const selected = button.dataset.selfintroTab === activeTab;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-selected', String(selected));
    });
    for (const tab of Object.keys(labels)) {
      const panel = $('selfIntroPanel-' + tab);
      panel.hidden = activeTab !== tab;
    }
    $('selfIntroLevel').value = model.level;
    $('selfIntroStudentChoice').checked = model.allowStudentChoice;
    $('selfIntroInstructions').value = model.instructions;
    $('selfIntroFieldList').innerHTML = fields.map(field => {
      const checked = model.fields.includes(field.id);
      const required = field.id === 'name';
      return '<label class="selfintro-field-row"><input type="checkbox" data-selfintro-field="' + field.id +
        '" ' + (checked ? 'checked ' : '') + (required ? 'disabled ' : '') + '/>' +
        '<span><strong>' + escapeHtml(field.label) + '</strong><small>' + escapeHtml(field.hint) + '</small></span>' +
        (required ? '<em>必須</em>' : '') + '</label>';
    }).join('');
    const options = model.fields.map(id => byId[id]);
    if (!options.some(field => field.id === activeExpression)) activeExpression = options[0].id;
    $('selfIntroExpressionField').innerHTML = options.map(field =>
      '<option value="' + field.id + '"' + (field.id === activeExpression ? ' selected' : '') + '>' + escapeHtml(field.label) + '</option>'
    ).join('');
    const current = byId[activeExpression];
    $('selfIntroExpressionOptions').innerHTML = current.options.map(option =>
      '<label class="selfintro-expression-row"><input type="radio" name="selfintro-expression" value="' + option[0] +
      '" ' + (model.expressions[activeExpression] === option[0] ? 'checked' : '') +
      '/><span>' + escapeHtml(option[1].replace(/\{([a-z]+)\}/g, (_, key) => byId[key]?.sample || '')) + '</span></label>'
    ).join('');
    $('selfIntroPreviewText').textContent = generatePreview(model);
    $('selfIntroPreviewWords').textContent = String(generatePreview(model).trim().split(/\s+/).filter(Boolean).length) + ' words';
    $('selfIntroFieldCount').textContent = String(model.fields.length) + '項目';
  }

  function syncLessonType() {
    const value = $('assignmentLessonType')?.value || 'text';
    document.querySelectorAll('[data-lesson-type]').forEach(button => {
      const active = button.dataset.lessonType === value;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const intro = value === 'self_intro';
    $('assignmentSelfIntroEditor')?.classList.toggle('hidden', !intro);
    $('assignmentOcrImport')?.classList.toggle('hidden', intro);
    $('assignmentTextEditor')?.classList.toggle('hidden', value !== 'text');
    $('assignmentDialogueEditor')?.classList.toggle('hidden', value !== 'dialogue');
    const hint = $('assignmentLessonTypeHint');
    if (hint) hint.textContent = intro
      ? '入力項目と表現を設定すると、生徒ごとに異なる自己紹介英文を作成できます。'
      : value === 'dialogue'
        ? '話者名は表示されますが、Copeakで読む対象はセリフのみです。'
        : '通常の英文を入力して音読教材を作成します。';
  }

  function mount() {
    if (mounted || !$('assignmentSelfIntroEditor')) return;
    mounted = true;
    model = normalize(model);
    document.querySelectorAll('[data-lesson-type]').forEach(button => {
      button.addEventListener('click', () => {
        const select = $('assignmentLessonType');
        if (!select || !['text', 'dialogue', 'self_intro'].includes(button.dataset.lessonType)) return;
        select.value = button.dataset.lessonType;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
    $('assignmentLessonType')?.addEventListener('change', syncLessonType);
    $('selfIntroTabs').addEventListener('click', event => {
      const button = event.target.closest('[data-selfintro-tab]');
      if (!button) return;
      activeTab = button.dataset.selfintroTab;
      render();
    });
    $('selfIntroLevel').addEventListener('change', event => {
      const next = event.target.value;
      if (!Object.hasOwn(levelExpressions, next)) return;
      const previousDefaults = levelExpressions[model.level];
      const nextDefaults = levelExpressions[next];
      // Preserve explicit teacher selections; update only previously recommended phrases.
      const expressions = { ...model.expressions };
      for (const field of fields) {
        if (expressions[field.id] === previousDefaults[field.id]) {
          expressions[field.id] = nextDefaults[field.id];
        }
      }
      model.level = next;
      model.expressions = expressions;
      render();
    });
    $('selfIntroRecommended').addEventListener('click', () => {
      model.fields = [...levelFields[model.level]];
      model.expressions = { ...levelExpressions[model.level] };
      render();
    });
    $('selfIntroStudentChoice').addEventListener('change', event => { model.allowStudentChoice = event.target.checked; render(); });
    $('selfIntroInstructions').addEventListener('input', event => { model.instructions = event.target.value.slice(0, 500); });
    $('selfIntroFieldList').addEventListener('change', event => {
      const id = event.target.dataset.selfintroField;
      if (!id || id === 'name') return;
      const selected = new Set(model.fields);
      if (event.target.checked) selected.add(id); else selected.delete(id);
      if (id === 'reason' && event.target.checked) selected.add('hobby');
      if (id === 'hobby' && !event.target.checked) selected.delete('reason');
      model.fields = fields.filter(field => selected.has(field.id)).map(field => field.id);
      render();
    });
    $('selfIntroExpressionField').addEventListener('change', event => { activeExpression = event.target.value; render(); });
    $('selfIntroExpressionOptions').addEventListener('change', event => {
      const id = event.target.value;
      if (byId[activeExpression]?.options.some(option => option[0] === id)) model.expressions[activeExpression] = id;
      render();
    });
    $('selfIntroSaveDraft').addEventListener('click', () => {
      const validation = validate(model);
      const notice = $('selfIntroNotice');
      if (!validation.ok) { notice.textContent = validation.message; return; }
      notice.textContent = persist()
        ? '✓ このブラウザに下書きを保存しました。公開・配布はまだ行われません。'
        : '下書きを保存できませんでした。ブラウザの保存設定を確認してください。';
    });
    $('selfIntroReset').addEventListener('click', () => {
      model = defaultConfig();
      try { window.localStorage.removeItem(draftPrefix + classKey); } catch (_error) {}
      activeTab = 'basics';
      render();
      $('selfIntroNotice').textContent = '初期設定に戻しました。';
    });
    render();
    syncLessonType();
  }

  const api = { fields, levelExpressions, defaultConfig, normalize, validate, generatePreview, cleanAnswers, validateAnswers, generateStudentText, mount, restore, syncLessonType, getConfig: () => normalize(model) };
  root.CopeakSelfIntro = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
