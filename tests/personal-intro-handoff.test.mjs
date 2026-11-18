import test from 'node:test';
import assert from 'node:assert/strict';
import { preparePersonalIntroHandoff } from '../js/personal-intro-handoff.mjs';

const uuidA = '11111111-1111-4111-8111-111111111111';
const uuidB = '22222222-2222-4222-8222-222222222222';
const uuidC = '33333333-3333-4333-8333-333333333333';
const origin = 'https://copeak.pic-speak-story.com';
const url = origin + '/?classroom_assignment=' + uuidA + '&self_intro_handoff=1';

function environment() {
  const handlers = new Set();
  const messages = [];
  const popup = { closed: false, postMessage(message, destination) { messages.push([message, destination]); } };
  const target = {
    addEventListener(name, fn) { if (name === 'message') handlers.add(fn); },
    removeEventListener(name, fn) { if (name === 'message') handlers.delete(fn); },
    send(source, eventOrigin, data) { for (const handler of [...handlers]) handler({ source, origin: eventOrigin, data }); }
  };
  return { popup, target, messages, handlers };
}

test('private personal text is sent only after trusted ready handshake', async () => {
  const { popup, target, messages } = environment();
  const init = { popup, url, studentId: uuidB, assignmentId: uuidA, nonce: uuidC,
    text: 'Hi, I am Yuki.', eventTarget: target };
  const handoff = preparePersonalIntroHandoff(init);
  assert.equal(messages.length, 0);
  target.send({}, origin, { type: 'copeak-classroom-intro-ready', nonce: uuidC, assignmentId: uuidA, studentId: uuidB });
  target.send(popup, 'https://evil.example', { type: 'copeak-classroom-intro-ready', nonce: uuidC, assignmentId: uuidA, studentId: uuidB });
  target.send(popup, origin, { type: 'copeak-classroom-intro-ready', nonce: uuidC, assignmentId: uuidA, studentId: uuidB });
  assert.equal(messages.length, 1);
  assert.equal(messages[0][0].text, 'Hi, I am Yuki.');
  assert.equal(messages[0][1], origin);
  assert.equal(url.includes('Hi%2C'), false);
  target.send(popup, origin, { type: 'copeak-classroom-intro-ack', nonce: uuidC, assignmentId: uuidA, ok: true });
  await handoff.done;
});

test('wrong nonce, student ID, origin, or popup do not transmit text', async () => {
  const { popup, target, messages } = environment();
  const handoff = preparePersonalIntroHandoff({ popup, url, studentId: uuidB, assignmentId: uuidA,
    nonce: uuidC, text: 'Secret text', eventTarget: target });
  target.send(popup, origin, { type: 'copeak-classroom-intro-ready', nonce: uuidA, assignmentId: uuidA, studentId: uuidB });
  target.send(popup, origin, { type: 'copeak-classroom-intro-ready', nonce: uuidC, assignmentId: uuidA, studentId: uuidA });
  target.send({}, origin, { type: 'copeak-classroom-intro-ready', nonce: uuidC, assignmentId: uuidA, studentId: uuidB });
  target.send(popup, 'https://evil.example', { type: 'copeak-classroom-intro-ready', nonce: uuidC, assignmentId: uuidA, studentId: uuidB });
  assert.equal(messages.length, 0);
  const expectedRejection = assert.rejects(handoff.done, /中止/);
  handoff.cancel();
  await expectedRejection;
});

test('untrusted acknowledgement is ignored', async () => {
  const { popup, target, messages } = environment();
  const handoff = preparePersonalIntroHandoff({ popup, url, studentId: uuidB, assignmentId: uuidA,
    nonce: uuidC, text: 'Hi.', eventTarget: target });
  target.send(popup, origin, { type: 'copeak-classroom-intro-ready', nonce: uuidC, assignmentId: uuidA, studentId: uuidB });
  target.send(popup, 'https://evil.example', { type: 'copeak-classroom-intro-ack', nonce: uuidC, assignmentId: uuidA, ok: true });
  assert.equal(messages.length, 1);
  target.send(popup, origin, { type: 'copeak-classroom-intro-ack', nonce: uuidC, assignmentId: uuidA, ok: false });
  await assert.rejects(handoff.done, /読み込めません/);
});

test('personal text must be bounded and all IDs UUIDs', () => {
  const { popup, target } = environment();
  assert.throws(() => preparePersonalIntroHandoff({ popup, url, assignmentId: 'not-uuid',
    studentId: uuidB, nonce: uuidC, text: 'Hi.', eventTarget: target }));
  assert.throws(() => preparePersonalIntroHandoff({ popup, url, assignmentId: uuidA,
    studentId: uuidB, nonce: uuidC, text: 'A'.repeat(6001), eventTarget: target }));
});
