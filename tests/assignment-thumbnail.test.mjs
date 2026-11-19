import test from 'node:test';
import assert from 'node:assert/strict';
import { safeThumbnailUrl, validateThumbnailFile } from '../js/assignment-thumbnail.mjs';

test('small JPEG/WebP data URL is accepted for the thumbnail card', () => {
  assert.equal(safeThumbnailUrl('data:image/jpeg;base64,Zm9v'), 'data:image/jpeg;base64,Zm9v');
  assert.equal(safeThumbnailUrl('data:image/webp;base64,YmFy'), 'data:image/webp;base64,YmFy');
});
test('unsafe or excessive URLs cannot be interpolated into image src', () => {
  assert.equal(safeThumbnailUrl('javascript:alert(1)'), null);
  assert.equal(safeThumbnailUrl('data:image/svg+xml;base64,PHN2Zz4='), null);
  assert.equal(safeThumbnailUrl('data:image/jpeg;base64,'+'a'.repeat(90000)), null);
});
test('source formats and file size are constrained before compression', () => {
  assert.doesNotThrow(()=>validateThumbnailFile({name:'photo.JPG',type:'image/jpeg',size:500000}));
  assert.doesNotThrow(()=>validateThumbnailFile({name:'photo.png',type:'image/png',size:500000}));
  assert.throws(()=>validateThumbnailFile({name:'sample.svg',type:'image/svg+xml',size:5000}));
  assert.throws(()=>validateThumbnailFile({name:'photo.jpg',type:'image/jpeg',size:13*1024*1024}));
});
