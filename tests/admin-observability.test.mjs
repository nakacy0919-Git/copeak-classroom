import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const ids = Array.from({length:10},(_,i)=>`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
const [admin, teacher, student, other, cls, cross, assignment, targeted, stranger, extra]=ids;
const db = new PGlite();
await db.exec(`
create role anon; create role authenticated; create schema auth;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
create table profiles(id uuid primary key,display_name text);
create table platform_admins(user_id uuid);
create function is_platform_admin(uuid) returns boolean language sql security definer set search_path=public as $$select exists(select 1 from platform_admins where user_id=$1)$$;
create table classes(id uuid primary key,teacher_id uuid,name text);
create table class_members(class_id uuid,student_id uuid);
create table assignments(id uuid primary key,class_id uuid,title text,practice_mode text,release_at timestamptz,due_at timestamptz,created_at timestamptz default now(),is_published boolean,pass_enabled boolean,pass_accuracy numeric,pass_wpm numeric,pass_comprehension numeric,audience_type text);
alter table assignments add column lesson_type text;alter table assignments add column lesson_text text;alter table assignments add column lesson_translation text;alter table assignments add column lesson_dialogue jsonb;
create table assignment_classes(assignment_id uuid,class_id uuid);
create table assignment_targets(assignment_id uuid,student_id uuid);
create table manual_scores(assignment_id uuid,student_id uuid,score numeric,wpm numeric,comprehension numeric);
create table submissions(id uuid primary key,assignment_id uuid,student_id uuid,accuracy numeric,wpm numeric,comprehension numeric,attempt_no integer,practice_mode text,paced_target_wpm integer,vanish_level integer,submitted_at timestamptz);
create function is_student_member_of_assignment_class(aid uuid,sid uuid) returns boolean language sql set search_path=public as $$select exists(select 1 from class_members cm join assignments a on a.id=aid where cm.student_id=sid and (cm.class_id=a.class_id or exists(select 1 from assignment_classes ac where ac.assignment_id=aid and ac.class_id=cm.class_id)))$$;
insert into profiles values('${admin}','Admin'),('${teacher}','Teacher'),('${student}','<img onerror=alert(1)>'),('${other}','Other'),('${stranger}','Stranger');
insert into platform_admins values('${admin}');
insert into classes values('${cls}','${teacher}','Primary'),('${cross}','${teacher}','Cross');
insert into class_members values('${cls}','${student}'),('${cross}','${student}'),('${cross}','${other}');
insert into assignments(id,class_id,title,practice_mode,release_at,due_at,created_at,is_published,pass_enabled,pass_accuracy,pass_wpm,pass_comprehension,audience_type) values('${assignment}','${cls}','Reading','reading',now()-interval '1 day',now()+interval '1 day',now(),true,true,80,100,70,'class'),('${targeted}','${cls}','Targeted','reading',now()-interval '1 day',now()+interval '1 day',now(),true,false,null,null,null,'targets');
insert into assignment_classes values('${assignment}','${cross}');insert into assignment_targets values('${targeted}','${student}');
insert into submissions values('${extra}','${assignment}','${student}',90,120,80,1,'reading',null,null,now());
`);
await db.exec(await readFile(new URL('../supabase/migrations/20261009052917_admin_observability.sql',import.meta.url),'utf8'));
const actor=id=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);
const inspect=async(view,tid=null,aid=null,sid=null,search='',page=0,size=6)=>(await db.query('select admin_inspect_activity($1,$2,$3,$4,$5,$6,$7) result',[view,tid,aid,sid,search,page,size])).rows[0].result;
const report=(aid,code)=>db.query('select report_classroom_diagnostic($1,$2)',[aid,code]);
await test('anonymous, teacher and student cannot inspect; admin can',async()=>{
 for(const id of ['',teacher,student,stranger]){await actor(id);await assert.rejects(inspect('students',null,assignment),/Platform admin required/);}
 await actor(admin);assert.equal((await inspect('students',null,assignment)).total,2);
});
await test('cross-post targets deduplicated, selective targets respected',async()=>{
 await actor(admin);const a=(await inspect('assignments',teacher)).items.find(a=>a.assignment_id===assignment);
 assert.equal(a.target_count,2);assert.equal(a.submitted_students,1);assert.equal(a.submission_count,1);assert.equal(a.delivery_status,'open');
 assert.equal((await inspect('students',null,targeted)).total,1);assert.equal((await inspect('assignments',teacher,null,null,'Cross')).total,1);assert.equal((await inspect('lesson',null,assignment)).total,1);
});
await test('latest score and pass status, immutable attempts',async()=>{
 await actor(admin);const s=(await inspect('students',null,assignment)).items.find(s=>s.student_id===student);assert.equal(s.passed,true);assert.equal(s.accuracy,90);
 assert.equal((await inspect('history',null,assignment,student)).items[0].attempt_no,1);
});
await test('empty page keeps total; search is literal',async()=>{
 await actor(admin);const r=await inspect('students',null,assignment,null,'',20,1);assert.equal(r.total,2);assert.deepEqual(r.items,[]);
 assert.equal((await inspect('students',null,assignment,null,'%')).total,0);
});
await test('diagnostics bound to caller and assignment; fixed codes and deduplication',async()=>{
 await actor(stranger);await assert.rejects(report(assignment,'submission_save_failed'),/Assignment access denied/);
 await actor(other);await assert.rejects(report(targeted,'submission_save_failed'),/Assignment access denied/);
 await actor(student);await assert.rejects(report(assignment,'raw_token_secret'),/Invalid diagnostic code/);
 await report(assignment,'submission_save_failed');await report(assignment,'submission_save_failed');
 assert.equal((await db.query('select count(*)::int n from classroom_diagnostics')).rows[0].n,1);
 await actor(admin);assert.equal((await inspect('diagnostics')).items[0].reporter_name,'<img onerror=alert(1)>');
});
await test('table private, anonymous denied, real authenticated non-admin denied RPC',async()=>{
 const p=(await db.query("select has_table_privilege('authenticated','classroom_diagnostics','SELECT') sel,has_table_privilege('authenticated','classroom_diagnostics','INSERT') ins,has_function_privilege('anon','admin_inspect_activity(text,uuid,uuid,uuid,text,integer,integer)','EXECUTE') anon")).rows[0];
 assert.deepEqual(p,{sel:false,ins:false,anon:false});await actor(student);await db.exec('set role authenticated');
 await assert.rejects(inspect('history',null,assignment,student),/Platform admin required/);await report(assignment,'launch_preparation_failed');await db.exec('reset role');
});
await test('pass state uses best metric across attempts and manual overrides',async()=>{
 await actor(admin);await db.exec(`update submissions set accuracy=79.5,wpm=80; insert into submissions values(gen_random_uuid(),'${assignment}','${student}',50,150,30,2,'reading',null,null,now());`);
 let s=(await inspect('students',null,assignment)).items.find(s=>s.student_id===student);assert.equal(s.passed,true);assert.equal(s.effective_accuracy,80);assert.equal(s.effective_wpm,150);
 await db.exec(`insert into manual_scores values('${assignment}','${student}',70,null,null);`);
 s=(await inspect('students',null,assignment)).items.find(s=>s.student_id===student);assert.equal(s.passed,false);assert.equal(s.effective_accuracy,70);
 await db.exec(`delete from manual_scores; delete from submissions where id<>'${extra}'; update submissions set accuracy=90,wpm=120;`);
});
await test('submissions unchanged',async()=>assert.equal((await db.query('select count(*)::int n from submissions')).rows[0].n,1));
await db.close();
