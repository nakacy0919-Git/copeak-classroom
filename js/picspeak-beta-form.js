import { getClient, demoRole } from './supabase.js';

document.addEventListener('DOMContentLoaded', () => {
  const panel = document.getElementById('picSpeakBetaPanel');
  const opener = document.getElementById('openPicSpeakBeta');
  const themes = document.getElementById('picSpeakBetaTheme');

  if (!panel || !opener || !themes) {
    console.warn('[PicSpeak beta] Panel not ready.');
    return;
  }

  const section = document.createElement('section');
  section.style.cssText =
    'margin-top:20px;padding-top:18px;border-top:1px solid #e2e8f0';

  const heading = document.createElement('h3');
  heading.textContent =
    '\u8ab2\u984c\u306e\u914d\u5e03\u8a2d\u5b9a';
  section.appendChild(heading);

  const grid = document.createElement('div');
  grid.className = 'grid grid-2';
  grid.style.gap = '14px';
  section.appendChild(grid);

  function field(id, labelText, element) {
    const wrapper = document.createElement('div');
    wrapper.className = 'field';

    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = labelText;

    element.id = id;
    element.className = 'input';

    wrapper.append(label, element);
    grid.appendChild(wrapper);
    return element;
  }

  const title = field(
    'picSpeakBetaAssignmentTitle',
    '\u8ab2\u984c\u540d',
    document.createElement('input')
  );
  title.type = 'text';
  title.maxLength = 200;

  const classSelect = field(
    'picSpeakBetaClass',
    '\u914d\u5e03\u5148\u30af\u30e9\u30b9',
    document.createElement('select')
  );

  const release = field(
    'picSpeakBetaRelease',
    '\u516c\u958b\u65e5\u6642',
    document.createElement('input')
  );
  release.type = 'datetime-local';

  const due = field(
    'picSpeakBetaDue',
    '\u7de0\u5207\u65e5\u6642',
    document.createElement('input')
  );
  due.type = 'datetime-local';

  const publishWrap = document.createElement('label');
  publishWrap.style.cssText =
    'display:flex;align-items:center;gap:9px;margin-top:15px';

  const published = document.createElement('input');
  published.type = 'checkbox';
  published.id = 'picSpeakBetaPublished';

  const publishText = document.createElement('span');
  publishText.textContent =
    '\u516c\u958b\u4e88\u5b9a\uff08\u672c\u756a\u516c\u958b\u306f\u307e\u3060\u884c\u3044\u307e\u305b\u3093\uff09';

  publishWrap.append(published, publishText);
  section.appendChild(publishWrap);

  const checkButton = document.createElement('button');
  checkButton.type = 'button';
  checkButton.className = 'btn btn-primary';
  checkButton.style.marginTop = '14px';
  checkButton.textContent =
    '\u8a2d\u5b9a\u5185\u5bb9\u3092\u78ba\u8a8d';

  section.appendChild(checkButton);

  const result = document.createElement('div');
  result.id = 'picSpeakBetaReview';
  result.setAttribute('role', 'status');
  result.style.cssText =
    'margin-top:12px;white-space:pre-line;font-size:14px;line-height:1.8';

  section.appendChild(result);

  const closeButton = panel.querySelector('#picSpeakBetaClose');
  const closeRow = closeButton?.parentElement;

  if (closeRow) {
    closeRow.insertAdjacentElement('beforebegin', section);
  } else {
    panel.appendChild(section);
  }

  function localDate(date) {
    const copy = new Date(
      date.getTime() - date.getTimezoneOffset() * 60000
    );
    return copy.toISOString().slice(0, 16);
  }

  const now = new Date();
  now.setMinutes(now.getMinutes() + 5);
  now.setSeconds(0, 0);

  const deadline = new Date(now);
  deadline.setDate(deadline.getDate() + 7);

  release.value = localDate(now);
  due.value = localDate(deadline);

  function autoTitle() {
    if (title.dataset.manuallyEdited === '1') return;

    const selected = themes.selectedOptions[0];
    if (!selected || !selected.value) return;

    title.value = selected.textContent
      .replace(/^\[[^\]]+\]\s*/, '')
      .trim();
  }

  title.addEventListener('input', () => {
    title.dataset.manuallyEdited = '1';
  });

  themes.addEventListener('change', autoTitle);

  let loaded = false;

  async function loadClasses() {
    if (loaded) return;

    classSelect.replaceChildren(
      new Option('Loading...', '')
    );
    classSelect.disabled = true;

    if (demoRole() === 'teacher') {
      classSelect.replaceChildren(
        new Option('Demo Class', 'demo-class')
      );
      classSelect.disabled = false;
      loaded = true;
      return;
    }

    try {
      const client = getClient('teacher');
      if (!client) throw Error('Supabase not configured');

      const {data, error} = await client
        .from('classes')
        .select('id,name,class_code')
        .order('name');

      if (error) throw error;
      if (!data?.length) throw Error('No accessible classes');

      classSelect.replaceChildren(
        new Option('Select a class', '')
      );

      for (const cls of data) {
        classSelect.appendChild(
          new Option(
            cls.name + ' (' + (cls.class_code || '') + ')',
            cls.id
          )
        );
      }

      const preferred = localStorage.getItem(
        'copeak_teacher_class_id'
      );

      if (preferred && data.some(c => c.id === preferred)) {
        classSelect.value = preferred;
      }

      classSelect.disabled = false;
      loaded = true;

    } catch (error) {
      classSelect.replaceChildren(
        new Option('Class list unavailable', '')
      );
      result.textContent =
        'Class load error: ' + error.message;
    }
  }

  opener.addEventListener('click', () => {
    autoTitle();
    void loadClasses();
  });

  function fail(message) {
    result.style.color = '#b91c1c';
    result.textContent = message;
  }

  checkButton.addEventListener('click', () => {
    const name = title.value.trim();
    const themeId = themes.value;
    const classId = classSelect.value;

    const start = new Date(release.value);
    const end = new Date(due.value);

    if (!name || name.length > 200) {
      fail('Enter a valid assignment title.');
      return;
    }

    if (!themeId || themes.disabled) {
      fail('Select a PicSpeak picture.');
      return;
    }

    if (!classId || classSelect.disabled) {
      fail('Select a class.');
      return;
    }

    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      end <= start ||
      end <= new Date()
    ) {
      fail('Check release and deadline dates.');
      return;
    }

    const level = document.getElementById(
      'picSpeakBetaLevel'
    ).value;

    const seconds = document.getElementById(
      'picSpeakBetaDuration'
    ).value;

    result.style.color = '#166534';
    result.textContent = [
      '\u2705 \u8a2d\u5b9a\u5185\u5bb9\u306e\u78ba\u8a8d\u5b8c\u4e86',
      '',
      'Title: ' + name,
      'Picture: ' + themeId,
      'Class: ' + classSelect.selectedOptions[0].text,
      'Level: ' + level,
      'Time: ' + seconds + ' seconds',
      'Release: ' + release.value,
      'Deadline: ' + due.value,
      'Publish: ' + (published.checked ? 'Yes' : 'No'),
      '',
      'PREVIEW ONLY - NOT SAVED TO CLASSROOM'
    ].join('\n');
  });
});