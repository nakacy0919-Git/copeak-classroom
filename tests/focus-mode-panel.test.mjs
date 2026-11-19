import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Emulates the minimal DOM interactions used by Focus Mode. Native details
// opening behavior itself is supplied by the browser's built-in element.
const source = readFileSync(new URL('../js/focus-mode.js', import.meta.url), 'utf8');

function loadFocusMode(storage, blocked = false) {
  const created = [];
  class Element {
    constructor(tag) {
      this.tagName = tag;
      this.className = '';
      this.textContent = '';
      this.value = '';
      this.open = false;
      this.hidden = false;
      this.children = [];
      this.listeners = Object.create(null);
      this.style = { cssText: '', setProperty(){} };
      this.selectionEnd = 0;
      this.selectionStart = 0;
      this.attributes = Object.create(null);
    }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = [...children]; }
    addEventListener(name, cb) { this.listeners[name] = cb; }
    setAttribute(key, value) { this.attributes[key] = value; }
    insertAdjacentElement(_pos, child) { this.adjacent = child; }
  }
  const input = new Element('textarea');
  input.value = 'This is a practice sentence.';
  const doc = {
    readyState: 'complete',
    getElementById: id => id === 'assignmentText' ? input : null,
    createElement: tag => { const el = new Element(tag); created.push(el); return el; },
    createTextNode: txt => ({textContent: txt}),
    head: new Element('head')
  };
  const ctx = {
    window: {},
    document: doc,
    location: {href:'https://example.test/teacher.html'},
    localStorage: blocked ? {
      getItem() { throw new Error('blocked'); },
      setItem() { throw new Error('blocked'); }
    } : storage,
    URL
  };
  vm.runInNewContext(source, ctx);
  return {focus:ctx.window.CopeakFocus,panel:input.adjacent,input,created};
}

function memoryStorage() {
  const map = new Map();
  return {
    getItem: key => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => { map.set(key,value); },
    map
  };
}

test('Focus Mode begins collapsed with a visible and accessible native summary', () => {
  const { panel } = loadFocusMode(memoryStorage());
  assert.equal(panel.tagName, 'details');
  assert.equal(panel.open, false);
  assert.equal(panel.children[0].tagName, 'summary');
  assert.equal(panel.children[0].children[1].textContent, 'Focus Mode｜表現意識');
  assert.equal(panel.children[0].children[0].attributes['aria-hidden'], 'true');
  assert.ok(panel.children[1].children.some(el => el.tagName === 'div'));
});

test('last opened state is persisted and restored on next page load', () => {
  const storage = memoryStorage();
  const first = loadFocusMode(storage);
  first.panel.open = true;
  first.panel.listeners.toggle();
  assert.equal(loadFocusMode(storage).panel.open, true);
  const second = loadFocusMode(storage);
  second.panel.open = false;
  second.panel.listeners.toggle();
  assert.equal(loadFocusMode(storage).panel.open, false);
  assert.equal(storage.map.get('copeak_classroom_focus_panel_open_v1:assignmentText'), '0');
});

test('storage failure does not prevent toggling or affect Focus Mode data methods', () => {
  const { panel, focus } = loadFocusMode(null, true);
  assert.equal(panel.open, false);
  panel.open = true;
  assert.doesNotThrow(() => panel.listeners.toggle());
  assert.equal(panel.open, true);
  assert.equal(typeof focus.get, 'function');
  assert.equal(typeof focus.restore, 'function');
  assert.equal(typeof focus.withUrl, 'function');
});

test('selection formatting controls remain mounted inside collapsible body', () => {
  const { panel, focus, input } = loadFocusMode(memoryStorage());
  const body = panel.children[1];
  const controls = body.children[0];
  assert.equal(controls.children.length, 4);
  assert.equal(controls.children[0].children[0].textContent, '文字色');
  assert.equal(controls.children[1].children[0].textContent, 'ハイライト');
  assert.equal(controls.children[2].children[0].textContent, '装飾');
  assert.deepEqual(Array.from(focus.get('assignmentText',input.value)), []);
});
