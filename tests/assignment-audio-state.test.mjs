import test from 'node:test';
import assert from 'node:assert/strict';
import { getAssignmentAudioState } from '../js/assignment-audio-state.mjs';

const now = Date.parse('2026-11-06T10:00:00.000Z');
const item = expires => ({ audio_object_key: 'classroom-audio/test.mp3', audio_expires_at: expires });
test('no recorded original MP3',()=>{
  assert.deepEqual(getAssignmentAudioState({},now),{status:'none',expiresAt:null});
});
test('expired audio is not treated as an active model recording',()=>{
  assert.equal(getAssignmentAudioState(item('2026-11-05T10:00:00Z'),now).status,'expired');
});
test('three-day warning identifies upcoming expiration',()=>{
  assert.equal(getAssignmentAudioState(item('2026-11-08T10:00:00Z'),now).status,'expiring');
});
test('active model audio remains available',()=>{
  assert.equal(getAssignmentAudioState(item('2026-11-14T10:00:00Z'),now).status,'active');
});
test('unknown expiry is not guessed as expired',()=>{
  assert.equal(getAssignmentAudioState(item(null),now).status,'unknown');
});
