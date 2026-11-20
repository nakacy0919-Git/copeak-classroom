import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const upload = require('../api/r2-upload-url.js');
const batch = require('../api/r2-thumbnail-urls.js');

const originals = Object.fromEntries(['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY',
  'R2_ENDPOINT','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET_NAME']
  .map(n => [n, process.env[n]]));
Object.assign(process.env, {
  SUPABASE_URL:'https://test.supabase.co',
  SUPABASE_PUBLISHABLE_KEY:'public-test-key',
  R2_ENDPOINT:'https://test.r2.cloudflarestorage.com',
  R2_ACCESS_KEY_ID:'test-access',
  R2_SECRET_ACCESS_KEY:'test-secret',
  R2_BUCKET_NAME:'test-assets'
});
const previousFetch = global.fetch;
const teacher = '0f11e4d7-a6bc-4721-9c86-cb18bb4018ae';
const home = '8d13adef-7dde-45c8-93e7-99ab77ae46ac';
const other = '9b989d1f-39c2-414b-9e15-abc885758ae2';
const id = 'ec232d40-2a34-4909-98fe-e50ec5f8e271';
const key = 'classroom-thumbnails/' + teacher +
  '/1795000000000-751d9b28-2927-402a-a5d2-a381a217a25d.webp';

function response(data, status=200) {
  return {ok: status>=200 && status<300, status, json:async()=>data};
}
function mocks({approved=true,linked=false,owner=true,visible=true,badKey=false}={}) {
  global.fetch = async input => {
    const u = new URL(String(input));
    if (u.pathname === '/auth/v1/user') return response({id:teacher});
    if (u.pathname === '/rest/v1/profiles') {
      return response([{role:'teacher',teacher_status:approved?'approved':'pending'}]);
    }
    if (u.pathname === '/rest/v1/classes') return response(owner?[{id:home}]:[{id:other}]);
    if (u.pathname === '/rest/v1/assignments') return response(visible?
      [{id, class_id:home, thumbnail_object_key:badKey?'other-prefix/unsafe.webp':key}]:[]);
    if (u.pathname === '/rest/v1/assignment_classes') return response(linked?[{assignment_id:id,class_id:other}]:[]);
    throw new Error('Unexpected mock path: ' + u.pathname);
  };
}
async function invoke(handler, body, {method='POST',token='verified-token'}={}) {
  const res={statusCode:0,body:null,headers:{},
    status(n){this.statusCode=n;return this},
    json(data){this.body=data;return this},
    setHeader(k,v){this.headers[k]=v;return this}};
  await handler({method,body,headers:{'x-supabase-access-token':token}},res);
  return res;
}
test.after(()=>{
  global.fetch=previousFetch;
  for(const [k,v] of Object.entries(originals)) {
    if(v===undefined)delete process.env[k]; else process.env[k]=v;
  }
});
test('signed micro-thumbnail uploads use isolated R2 prefix',async()=>{
  mocks();
  const res=await invoke(upload,{mediaKind:'thumbnail',fileName:'thumbnail.webp',
    contentType:'image/webp',fileSize:11000});
  assert.equal(res.statusCode,200);
  assert.equal(res.body.mediaKind,'thumbnail');
  assert.match(res.body.objectKey, /^classroom-thumbnails\//);
  assert.ok(res.body.uploadUrl.startsWith('https://'));
});
test('24KiB hard cap, MIME, and approved teacher are enforced',async()=>{
  mocks();
  assert.equal((await invoke(upload,{mediaKind:'thumbnail',fileName:'thumbnail.webp',
    contentType:'image/webp',fileSize:24577})).statusCode,400);
  assert.equal((await invoke(upload,{mediaKind:'thumbnail',fileName:'thumbnail.webp',
    contentType:'image/jpeg',fileSize:9000})).statusCode,400);
  mocks({approved:false});
  assert.equal((await invoke(upload,{mediaKind:'thumbnail',fileName:'thumbnail.webp',
    contentType:'image/webp',fileSize:9000})).statusCode,403);
});
test('existing support-image signing is still available',async()=>{
  mocks();
  const res=await invoke(upload,{fileName:'support.webp',contentType:'image/webp',fileSize:45000});
  assert.equal(res.statusCode,200);
  assert.equal(res.body.mediaKind,'image');
  assert.match(res.body.objectKey, /^classroom-images\//);
});
test('owner can batch sign small thumbnail GET URLs',async()=>{
  mocks();
  const res=await invoke(batch,{assignmentIds:[id]});
  assert.equal(res.statusCode,200);
  assert.ok(res.body.urls[id].includes('cloudflarestorage.com'));
  assert.equal(res.body.expiresIn,600);
  assert.equal(res.headers['Cache-Control'],'private, no-store');
});
test('unapproved or unauthenticated teacher cannot fetch thumbnails',async()=>{
  mocks({approved:false});
  assert.equal((await invoke(batch,{assignmentIds:[id]})).statusCode,403);
  mocks();
  assert.equal((await invoke(batch,{assignmentIds:[id]},{token:''})).statusCode,401);
});
test('unlinked / RLS-hidden assignments and invalid paths produce no URLs',async()=>{
  mocks({owner:false,linked:false});
  assert.deepEqual((await invoke(batch,{assignmentIds:[id]})).body.urls,{});
  mocks({visible:false});
  assert.deepEqual((await invoke(batch,{assignmentIds:[id]})).body.urls,{});
  mocks({badKey:true});
  assert.deepEqual((await invoke(batch,{assignmentIds:[id]})).body.urls,{});
});
test('cross-posted teacher receives only class-linked thumbnail URL',async()=>{
  mocks({owner:false,linked:true});
  const res=await invoke(batch,{assignmentIds:[id]});
  assert.equal(res.statusCode,200);
  assert.ok(res.body.urls[id]);
});
test('batch endpoint checks bounded unique UUIDs',async()=>{
  mocks();
  assert.equal((await invoke(batch,{assignmentIds:[id,id]})).statusCode,400);
  assert.equal((await invoke(batch,{assignmentIds:['not-a-uuid']})).statusCode,400);
  assert.equal((await invoke(batch,{assignmentIds:[id]},{method:'GET'})).statusCode,405);
});
test('Classroom save references keys, not base64, and legacy fallback remains',()=>{
  const teacherJs = readFileSync(new URL('../js/teacher.js', import.meta.url),'utf8');
  const thumbnailJs = readFileSync(new URL('../js/assignment-thumbnail.mjs', import.meta.url),'utf8');
  assert.ok(teacherJs.includes('uploadThumbnailToR2(thumbnailValue'));
  assert.ok(teacherJs.includes('thumbnail_object_key = cover.objectKey'));
  // Grouped lists sign URLs only for expanded/visible cards; legacy flat layout used sorted.
  assert.ok(teacherJs.includes('hydrateThumbnailCards(visible') ||
    teacherJs.includes('hydrateThumbnailCards(sorted'));
  assert.equal(teacherJs.includes('thumbnail_data_url: thumbnailValue'),false);
  assert.ok(thumbnailJs.includes("thumbnailUrl(raw)"));
  assert.ok(thumbnailJs.includes('TARGET_BYTES = 12 * 1024'));
  assert.ok(thumbnailJs.includes('LIMIT_BYTES = 24 * 1024'));
});
