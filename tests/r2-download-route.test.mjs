import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const handler = require('../api/r2-download-url.js');

const oldFetch = global.fetch;
const originals = Object.fromEntries(
  ['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','R2_ENDPOINT','R2_ACCESS_KEY_ID',
   'R2_SECRET_ACCESS_KEY','R2_BUCKET_NAME'].map(name => [name, process.env[name]])
);
const studentId = '0f11e4d7-a6bc-4721-9c86-cb18bb4018ae';
const home = '8d13adef-7dde-45c8-93e7-99ab77ae46ac';
const shared = '68245a5b-5e4c-4e19-9373-f87ec5bf25a6';
const outsider = '8b989d1f-39c2-414b-9e15-abc885758ae2';

function json(data, status=200) {
  return { ok: status >= 200 && status < 300, status, json: async () => data };
}
function installMocks({ member = shared, linked = true, published = true,
                        expires = null, assignmentVisible = true,
                        membershipOk = true } = {}) {
  const calls = [];
  global.fetch = async (url) => {
    const u = new URL(String(url)); calls.push(u.pathname);
    if (u.pathname === '/auth/v1/user') return json({id:studentId});
    if (u.pathname.endsWith('/profiles')) return json([{role:'student'}]);
    if (u.pathname.endsWith('/class_members'))
      return membershipOk ? json([{class_id:member}]) : json({},403);
    if (u.pathname.endsWith('/assignments')) return json(assignmentVisible
      ? [{id:'lesson-one',class_id:home,is_published:published,
          audio_object_key:'model/lesson-one.mp3',audio_file_name:'model.mp3',
          audio_expires_at:expires}]
      : []);
    if (u.pathname.endsWith('/assignment_classes'))
      return json(linked ? [{class_id:shared}] : []);
    throw new Error('unexpected test-only URL: ' + u.pathname);
  };
  return calls;
}
async function request(method='POST', token='valid-test-token') {
  const res = {
    statusCode:null, payload:null,
    status(code) { this.statusCode=code; return this; },
    json(obj) { this.payload=obj; return this; },
    setHeader() { return this; }
  };
  await handler({method,headers:{'x-supabase-access-token':token},
    body:{assignmentId:'lesson-one'}},res);
  return res;
}
Object.assign(process.env, {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'test-public-key',
  R2_ENDPOINT: 'https://test.r2.cloudflarestorage.com',
  R2_ACCESS_KEY_ID: 'test-access-key',
  R2_SECRET_ACCESS_KEY: 'test-secret-key',
  R2_BUCKET_NAME: 'test-model-audio'
});
test.after(() => {
  global.fetch=oldFetch;
  for (const [key, value] of Object.entries(originals)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
test('teacher original class: student gets a 5-minute signed model audio URL', async () => {
  const calls=installMocks({member:home});
  const result=await request();
  assert.equal(result.statusCode,200);
  assert.ok(result.payload?.downloadUrl?.includes('lesson-one.mp3'));
  assert.equal(result.payload?.expiresIn,300);
  assert.equal(calls.includes('/rest/v1/assignment_classes'),false);
});
test('shared-class recipient: signed MP3 URL is authorized through assignment_classes', async () => {
  const calls=installMocks();
  const result=await request();
  assert.equal(result.statusCode,200);
  assert.ok(result.payload.downloadUrl);
  assert.ok(calls.includes('/rest/v1/assignment_classes'));
});
test('non-recipient classroom cannot obtain MP3',async()=>{
  installMocks({member:outsider});
  const result=await request();
  assert.equal(result.statusCode,403);
  assert.equal(result.payload.downloadUrl,undefined);
});
test('unlinked classroom cannot obtain MP3',async()=>{
  installMocks({linked:false});
  const result=await request();
  assert.equal(result.statusCode,403);
});
test('RLS-hidden assignment remains unavailable',async()=>{
  installMocks({assignmentVisible:false});
  const result=await request();
  assert.equal(result.statusCode,404);
});
test('unpublished lesson must not issue signed URLs',async()=>{
  installMocks({published:false});
  const result=await request();
  assert.equal(result.statusCode,403);
});
test('expired cloud audio must not receive a signed URL',async()=>{
  installMocks({expires:'2020-01-01T00:00:00.000Z'});
  const result=await request();
  assert.equal(result.statusCode,410);
});
test('missing login session denied',async()=>{
  installMocks();
  const result=await request('POST','');
  assert.equal(result.statusCode,401);
});
test('invalid membership lookup fails closed',async()=>{
  installMocks({membershipOk:false});
  const result=await request();
  assert.equal(result.statusCode,403);
});
test('non-POST requests rejected',async()=>{
  installMocks();
  const result=await request('GET');
  assert.equal(result.statusCode,405);
});
