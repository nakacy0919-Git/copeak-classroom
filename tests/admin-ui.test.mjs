import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..');
const stub=`export const isConfigured=()=>true;
export const getClient=()=>({auth:{getUser:async()=>({data:{user:{id:'admin',email:'admin@example.invalid'}}}),signOut:async()=>({})},
 from:name=>{const q={select:()=>q,eq:()=>q,single:async()=>({data:{display_name:'Admin',role:'teacher',teacher_status:'approved'}}),maybeSingle:async()=>({data:{user_id:'admin'}})};return q;},
 rpc:async(name,args)=>{
  window.calls.push({name,args});
  if(name==='admin_list_teachers')return {data:Array.from({length:14},(_,i)=>({teacher_id:'t'+i,display_name:i===0?'<img src=x onerror=alert(1)>':'先生'+i,school_name:'学校',email:'teacher@example.invalid',teacher_status:'approved'}))};
  if(name==='admin_get_teacher_activity')return {data:Array.from({length:14},(_,i)=>({teacher_id:'t'+i,teacher_name:i===0?'<img src=x onerror=alert(1)>':'先生'+i,school_name:'学校',class_count:2,assignment_count:4,submission_count:8}))};
  if(name==='admin_get_teacher_lessons')return {data:[{assignment_id:'a1',lesson_text:'Hello world.',lesson_translation:'こんにちは',lesson_type:'text'}]};
  const items={lesson:[{assignment_id:'a1',lesson_text:'Hello world.',lesson_translation:'こんにちは',lesson_type:'text'}],assignments:[{assignment_id:'a1',title:'Reading',class_names:'3年 / 4年',delivery_status:'open',practice_mode:'shadowing',target_count:20,submitted_students:8,submission_count:19,recent_errors:1}],students:[{student_id:'s1',student_name:'生徒1',current_target:true,attempts:11,accuracy:90,wpm:120,comprehension:85,passed:true,effective_accuracy:95,effective_wpm:130,effective_comprehension:90}],history:[{id:'r1',attempt_no:11,accuracy:90,wpm:120,comprehension:85,practice_mode:'shadowing'}],diagnostics:[{id:'d1',teacher_name:'先生',class_name:'3年',title:'Reading',reporter_name:'生徒1',code:'submission_save_failed'}]}[args.p_view];
  return {data:{total:items.length,items}};
 }});`;
const server=createServer(async(req,res)=>{try{if(req.url==='/js/supabase.js'){res.setHeader('Content-Type','text/javascript');res.end(stub);return;}
 const p=resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!p.startsWith(root+'/'))throw Error();
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[extname(p)]||'text/plain');res.end(await readFile(p));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.ADMIN_TEST_BROWSER?{executablePath:process.env.ADMIN_TEST_BROWSER}:{})});
try{
 for(const viewport of [{width:1280,height:720},{width:390,height:844}]){
  const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>window.calls=[]);
  const base=`http://127.0.0.1:${server.address().port}`;
  await page.goto(base+'/admin-activity.html');await page.locator('[data-open=assignments]').first().waitFor();
  assert.equal(await page.locator('#activityTable tbody tr').count(),6);
  assert.equal(await page.locator('#activityTable img').count(),0);
  assert(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1));
  await page.locator('#activityNext').click();await page.waitForFunction(()=>document.querySelector('#activityPage').textContent.includes('2 / 3'));
  await page.locator('[data-open=assignments]').first().click();await page.locator('[data-open=students]').waitFor();
  await page.locator('[data-open=students]').click();await page.locator('[data-open=history]').waitFor();
  await page.locator('#activityPreviewButton').click();await page.waitForFunction(()=>document.querySelector('#previewText').textContent.includes('Hello world.'));await page.locator('#previewClose').click();
  await page.locator('[data-open=history]').click();await page.waitForFunction(()=>document.querySelector('#activityTitle').textContent==='提出履歴');
  assert((await page.locator('#activityTable').textContent()).includes('shadowing'));
  await page.locator('#activityBack').click();await page.locator('[data-open=history]').waitFor();
  await page.locator('#activityErrors').click();await page.waitForFunction(()=>document.querySelector('#activityTable').textContent.includes('成績保存に失敗'));
  assert(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1));
  await page.screenshot({path:`/tmp/admin-activity-${viewport.width}.png`,fullPage:true});
  await page.goto(base+'/admin.html');await page.locator('[data-detail]').first().waitFor();
  assert.equal(await page.locator('#adminTeacherList tbody tr').count(),6);assert.equal(await page.locator('#adminTeacherList img').count(),0);
  assert(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1));
  await page.locator('[data-detail]').first().click();assert(await page.locator('#adminTeacherDetail').isVisible());await page.locator('#adminDetailClose').click();
  await page.locator('#adminNext').click();assert((await page.locator('#adminPage').textContent()).includes('2 / 3'));
  await page.screenshot({path:`/tmp/admin-accounts-${viewport.width}.png`,fullPage:true});
  assert.deepEqual(errors,[]);console.log(`PASS: ${viewport.width}x${viewport.height}, pagination/navigation/preview/details/escaping; no page scroll or JS errors.`);await page.close();
 }
}finally{await browser.close();server.close();}
