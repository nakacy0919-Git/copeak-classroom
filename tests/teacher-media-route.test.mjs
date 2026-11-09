import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const handler = require('../api/r2-download-url.js');
const previousFetch = global.fetch;
const envNames = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'R2_ENDPOINT',
  'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];
const previousEnv = Object.fromEntries(envNames.map(key => [key, process.env[key]]));
const teacherId = '0f11e4d7-a6bc-4721-9c86-cb18bb4018ae';
const home = '8d13adef-7dde-45c8-93e7-99ab77ae46ac';
const shared = '68245a5b-5e4c-4e19-9373-f87ec5bf25a6';
const outsider = '8b989d1f-39c2-414b-9e15-abc885758ae2';

function json(data, status=200) {
  return {ok: status>=200&&status<300, status, json: async()=>data};
}

function installMocks({ ownedClass=home, sharedLink=false, approved=true,
  assignmentVisible=true, published=false, classLookupOk=true, expires=null }={}) {
  const calls = [];
  global.fetch = async raw => {
    const u = new URL(String(raw));
    calls.push(u.pathname);
    if (u.pathname === '/auth/v1/user') return json({id:teacherId});
    if (u.pathname === '/rest/v1/profiles') {
      return json([{role:'teacher',teacher_status:approved?'approved':'pending'}]);
    }
    if (u.pathname === '/rest/v1/classes') {
      return classLookupOk ? json([{id:ownedClass}]) : json({},403);
    }
    if (u.pathname === '/rest/v1/assignments') {
      return json(assignmentVisible ? [{
        id:'lesson-one',class_id:home,is_published:published,
        audio_object_key:'model/lesson-one.mp3',audio_file_name:'model.mp3',
        audio_expires_at:expires
      }] : []);
    }
    if (u.pathname === '/rest/v1/assignment_classes') {
      return json(sharedLink ? [{class_id:shared}] : []);
    }
    throw new Error('Unexpected request: '+u.pathname);
  };
  return calls;
}

async function request(mediaType='audio') {
  const res = {statusCode:0,payload:null,status(n){this.statusCode=n;return this},
    json(x){this.payload=x;return this},setHeader(){return this}};
  await handler({method:'POST',headers:{'x-supabase-access-token':'teacher-jwt'},
    body:{assignmentId:'lesson-one', mediaType}},res);
  return res;
}

Object.assign(process.env,{
  SUPABASE_URL:'https://test.supabase.co',
  SUPABASE_PUBLISHABLE_KEY:'test-public-key',
  R2_ENDPOINT:'https://test.r2.cloudflarestorage.com',
  R2_ACCESS_KEY_ID:'test-key',
  R2_SECRET_ACCESS_KEY:'test-secret',
  R2_BUCKET_NAME:'test-media'
});

test.after(()=>{
  global.fetch=previousFetch;
  for(const [k,v] of Object.entries(previousEnv)) {
    if(v===undefined) delete process.env[k]; else process.env[k]=v;
  }
});

test('approved teacher previews own unpublished assignment model audio',async()=>{
  const calls=installMocks();
  const res=await request();
  assert.equal(res.statusCode,200);
  assert.ok(res.payload.downloadUrl.includes('lesson-one.mp3'));
  assert.ok(calls.includes('/rest/v1/classes'));
  assert.equal(calls.includes('/rest/v1/class_members'),false);
});

test('teacher may preview cross-posted assignment in an owned linked class',async()=>{
  installMocks({ownedClass:shared,sharedLink:true});
  assert.equal((await request()).statusCode,200);
});

test('teacher cannot access an unlinked class or another teacher\'s assignment',async()=>{
  installMocks({ownedClass:outsider,sharedLink:true});
  assert.equal((await request()).statusCode,403);
  installMocks({ownedClass:shared,sharedLink:false});
  assert.equal((await request()).statusCode,403);
});

test('non-approved teacher has no media access',async()=>{
  installMocks({approved:false});
  assert.equal((await request()).statusCode,403);
});

test('teacher class verification must succeed',async()=>{
  installMocks({classLookupOk:false});
  assert.equal((await request()).statusCode,403);
});

test('RLS-hidden assignment remains inaccessible to teacher',async()=>{
  installMocks({assignmentVisible:false});
  assert.equal((await request()).statusCode,404);
});

test('expired teacher preview audio is still denied',async()=>{
  installMocks({expires:'2020-01-01T00:00:00.000Z'});
  assert.equal((await request()).statusCode,410);
});
