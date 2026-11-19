import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../login.css', import.meta.url), 'utf8');

test('login page has two real, safe external resource links below the login card', () => {
  const cardClose=html.indexOf('  </section>\n\n  <nav class="login-resource-links"');
  const navStart=html.indexOf('<nav class="login-resource-links"');
  const mainClose=html.indexOf('</main>');
  assert.ok(cardClose>=0 && navStart>cardClose && mainClose>navStart);
  const nav=html.slice(navStart, html.indexOf('</nav>',navStart));
  assert.match(nav,/href="https:\/\/sites\.google\.com\/view\/koheinakashima\/bio"/);
  assert.match(nav,/href="https:\/\/forms\.gle\/Kvfezyax5qs9BvYQ7"/);
  assert.equal((nav.match(/<a /g)||[]).length,2);
  assert.equal((nav.match(/target="_blank" rel="noopener noreferrer"/g)||[]).length,2);
  assert.match(nav,/Copeakの開発者について/);
  assert.match(nav,/スポンサー・協賛のお問い合わせ/);
});

test('footer styles remain small, responsive, and keyboard accessible', () => {
  assert.match(css,/\.login-page \.login-resource-links\s*\{/);
  assert.match(css,/font-size:\s*12px/);
  assert.match(css,/\.login-page \.login-resource-links a:focus-visible/);
  assert.match(css,/@media \(max-width: 820px\)/);
  assert.match(css,/@media \(max-width: 420px\)/);
  assert.match(css,/height: min\(800px, calc\(100dvh - 116px\)\)/);
});
