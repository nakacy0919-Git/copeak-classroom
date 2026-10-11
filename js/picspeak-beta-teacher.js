(() => {
  'use strict';

  const opener = document.getElementById('newAssignment');
  const editor = document.getElementById('assignmentEditor');
  if (!opener || !editor ||
      document.getElementById('openPicSpeakBeta')) return;

  const buttons = document.createElement('div');
  buttons.style.cssText =
    'display:flex;gap:8px;flex-wrap:wrap;align-items:center';
  opener.parentNode.insertBefore(buttons, opener);
  buttons.appendChild(opener);

  const openButton = document.createElement('button');
  openButton.type = 'button';
  openButton.id = 'openPicSpeakBeta';
  openButton.className = 'btn btn-light';
  openButton.textContent = 'PicSpeak \u03b2';
  buttons.appendChild(openButton);

  const panel = document.createElement('section');
  panel.id = 'picSpeakBetaPanel';
  panel.className = 'hidden';
  panel.style.cssText =
    'border:1px solid #e2e8f0;border-radius:16px;' +
    'padding:20px;margin:18px 0;background:#f8fafc';

  panel.innerHTML =
    '<h3 style="margin:0 0 8px">PicSpeak \u03b2 \u2014 \u753b\u50cf\u63cf\u5199\u8ab2\u984c</h3>' +
    '<p class="small muted" style="margin-bottom:16px">' +
    '\u73fe\u5728\u306f\u6559\u6750\u9078\u629e\u306e\u30d7\u30ec\u30d3\u30e5\u30fc\u306e\u307f\u3067\u3059\u3002' +
    'Classroom\u3078\u306e\u4fdd\u5b58\u30fb\u914d\u5e03\u306f\u307e\u3060\u884c\u3044\u307e\u305b\u3093\u3002</p>' +
    '<div class="grid grid-2" style="gap:12px">' +
    '<div class="field"><label for="picSpeakBetaTheme">\u6559\u6750\u753b\u50cf</label>' +
    '<select id="picSpeakBetaTheme" class="input"></select></div>' +
    '<div class="field"><label for="picSpeakBetaLevel">\u30ec\u30d9\u30eb</label>' +
    '<select id="picSpeakBetaLevel" class="input">' +
    '<option value="elementary">\u5c0f\u5b66\u751f</option>' +
    '<option value="junior_high">\u4e2d\u5b66\u751f</option>' +
    '<option value="high_school">\u9ad8\u6821\u751f</option></select></div>' +
    '<div class="field"><label for="picSpeakBetaDuration">\u5236\u9650\u6642\u9593</label>' +
    '<select id="picSpeakBetaDuration" class="input">' +
    '<option value="30">30\u79d2</option>' +
    '<option value="45" selected>45\u79d2</option>' +
    '<option value="60">60\u79d2</option></select></div>' +
    '</div>' +
    '<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-top:16px">' +
    '<img id="picSpeakBetaImage" alt="" style="width:min(300px,100%);aspect-ratio:16/9;object-fit:cover;border-radius:12px;border:1px solid #e2e8f0">' +
    '<div style="flex:1;min-width:220px"><strong id="picSpeakBetaTitle"></strong>' +
    '<p id="picSpeakBetaImageStatus" class="small muted"></p></div></div>' +
    '<div style="display:flex;gap:8px;align-items:center;margin-top:18px">' +
    '<button type="button" id="picSpeakBetaClose" class="btn btn-light">\u9589\u3058\u308b</button>' +
    '<span class="small muted">\u203b \u8ab2\u984c\u4f5c\u6210\u30fb\u516c\u958b\u306f\u6b21\u306e\u5de5\u7a0b\u3067\u8ffd\u52a0\u3057\u307e\u3059\u3002</span></div>';

  editor.insertAdjacentElement('beforebegin', panel);

  const list = panel.querySelector('#picSpeakBetaTheme');
  const image = panel.querySelector('#picSpeakBetaImage');
  const title = panel.querySelector('#picSpeakBetaTitle');
  const status = panel.querySelector('#picSpeakBetaImageStatus');

  let byId = new Map();

  function updatePreview() {
    const item = byId.get(list.value);

    if (!item) {
      image.hidden = true;
      title.textContent = '';
      status.textContent = '';
      return;
    }

    title.textContent =
      (item.titleJa || item.titleEn || item.id) +
      ' (' + item.id + ')';

    status.textContent = item.titleEn || '';
    image.hidden = false;
    image.alt = item.titleJa || item.titleEn || item.id;

    image.onerror = () => {
      image.hidden = true;
      status.textContent =
        '\u753b\u50cf\u30d7\u30ec\u30d3\u30e5\u30fc\u306f\u5229\u7528\u3067\u304d\u307e\u305b\u3093\u3002' +
        '\u6559\u6750\u540d\u306f\u9078\u629e\u3067\u304d\u307e\u3059\u3002';
    };

    const safePath =
      /^assets\/images\/[A-Za-z0-9_-]+\.webp$/.test(item.imageSrc || '')
        ? item.imageSrc
        : '';

    if (safePath) {
      image.src = 'https://pic-speak-story.com/' + safePath;
    } else {
      image.hidden = true;
    }
  }

  async function loadCatalog() {
    if (byId.size) return;

    list.replaceChildren(new Option('Loading...', ''));
    list.disabled = true;

    try {
      const response = await fetch(
        'assets/picspeak/lesson-catalog.json',
        {cache: 'no-store'}
      );

      if (!response.ok) throw Error('HTTP ' + response.status);

      const entries = await response.json();
      if (!Array.isArray(entries)) {
        throw Error('Invalid lesson catalog');
      }

      const groups = [
        {
          name: '\u65b0\u6559\u6750',
          data: entries.filter(x => x.category !== 'other')
        },
        {
          name: '\u65e7\u6559\u6750',
          data: entries.filter(x => x.category === 'other')
        }
      ];

      list.replaceChildren();
      byId = new Map();

      for (const group of groups) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = group.name;

        for (const entry of group.data) {
          if (!entry || !entry.id ||
              byId.has(String(entry.id))) continue;

          const id = String(entry.id);
          byId.set(id, entry);

          optgroup.appendChild(new Option(
            '[' + id + '] ' +
            (entry.titleJa || entry.titleEn || id),
            id
          ));
        }

        list.appendChild(optgroup);
      }

      if (!byId.size) throw Error('No lessons');

      list.disabled = false;
      updatePreview();

    } catch (error) {
      list.replaceChildren(
        new Option('Lesson catalog unavailable', '')
      );

      title.textContent = 'Cannot load lesson catalog';
      status.textContent = error.message;
    }
  }

  openButton.addEventListener('click', () => {
    if (!editor.classList.contains('hidden')) {
      alert(
        '\u901a\u5e38\u306e\u8ab2\u984c\u7de8\u96c6\u3092\u9589\u3058\u3066\u304b\u3089' +
        'PicSpeak \u03b2\u3092\u958b\u3044\u3066\u304f\u3060\u3055\u3044\u3002'
      );
      return;
    }

    panel.classList.remove('hidden');
    void loadCatalog();

    panel.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  });

  opener.addEventListener('click', () => {
    panel.classList.add('hidden');
  });

  panel.querySelector('#picSpeakBetaClose')
    .addEventListener('click', () => {
      panel.classList.add('hidden');
    });

  list.addEventListener('change', updatePreview);
})();