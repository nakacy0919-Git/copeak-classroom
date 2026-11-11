// Copeak Classroom -> admin teacher registration notice.
// Dedicated sender deployed on the owner's existing Resend-equipped mail project.
// Private webhook Bearer token: SHA-256 verified, secret stored in Copeak Supabase Vault.
const TOKEN_SHA256 = 'a3ca0d1bda4815862bdcd07b139add2f825a681f15c99cb2bfc697ae36076f44';
const APPROVAL_URL = 'https://cc.pic-speak-story.com/admin.html';
const json=(status,payload)=>new Response(JSON.stringify(payload),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const validEmail=(s)=>typeof s==='string'&&/^[^\s@\r\n]+@[^\s@\r\n]+\.[^\s@\r\n]+$/.test(s)&&s.length<=254;
const validUUID=(s)=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
async function auth(req){
 const match=req.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{64})$/);
 if(!match)return false;
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(match[1]));
 const h=Array.from(new Uint8Array(bytes)).map(v=>v.toString(16).padStart(2,'0')).join('');
 let diff=0;for(let i=0;i<h.length;i++)diff|=h.charCodeAt(i)^TOKEN_SHA256.charCodeAt(i);
 return diff===0;
}
async function send(resendKey,from,to,subject,textBody,key){
 for(let attempt=0;attempt<2;attempt++){
  try{
   const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{
    'Authorization':'Bearer '+resendKey,'Content-Type':'application/json','Idempotency-Key':key
   },body:JSON.stringify({from,to:[to],subject,text:textBody}),signal:AbortSignal.timeout(12000)});
   if(r.ok)return true;
   if(![408,409,425,429].includes(r.status)&&r.status<500)return false;
  }catch{ /* transient network error */ }
  if(attempt===0)await new Promise(resolve=>setTimeout(resolve,550));
 }
 return false;
}
Deno.serve(async(req)=>{
 if(req.method!=='POST')return json(405,{error:'method_not_allowed'});
 if(!await auth(req))return json(401,{error:'unauthorized'});
 const key=Deno.env.get('RESEND_API_KEY')||'';
 const rawFrom=Deno.env.get('GCC_MAIL_FROM')||'';
 const fromAddress=(rawFrom.match(/<([^<>]+)>\s*$/)?.[1]||rawFrom).trim();
 if(!key||!validEmail(fromAddress))return json(503,{error:'mail_provider_not_configured'});
 let body;try{body=await req.json()}catch{return json(400,{error:'invalid_json'})}
 if(body?.event==='provider_test'){
  const ok=await send(key,rawFrom,'delivered@resend.dev','Copeak Classroom mail provider test',
   'Synthetic provider connectivity test. No teacher or student data.',
   'copeak-provider-test-'+new Date().toISOString().slice(0,10));
  return json(ok?200:502,{provider_test:ok?'accepted':'failed'});
 }
 if(body?.event==='admin_test'){
  if(!Array.isArray(body.admins)||body.admins.length<1||body.admins.length>10)
   return json(400,{error:'invalid_test_recipients'});
  let accepted=0,failed=0;
  for(const admin of body.admins){
   if(!validUUID(admin?.id)||!validEmail(admin?.email)){failed++;continue}
   const ok=await send(key,'Copeak Classroom <'+fromAddress+'>',admin.email,
    '【Copeak Classroom】管理者メール通知の動作確認',
    'Copeak Classroomの新規先生登録通知の送信テストです。\n\nこのメールは動作確認用で、新しい先生の登録申請ではありません。\n\n管理者画面: '+APPROVAL_URL,
    'copeak-admin-test-'+new Date().toISOString().slice(0,10)+'-'+admin.id);
   if(ok)accepted++;else failed++;
  }
  return json(failed?502:200,{accepted,failed,test:true});
 }
 if(body?.event!=='teacher_registered'||!validUUID(body.teacher_id)||!Array.isArray(body.admins)||body.admins.length>10)
  return json(400,{error:'invalid_event'});
 const teacher=body.teacher||{};
 if(typeof teacher.name!=='string'||typeof teacher.school!=='string'||typeof teacher.email!=='string'||
    teacher.name.length>200||teacher.school.length>200||!validEmail(teacher.email))
  return json(400,{error:'invalid_teacher'});
 const message='Copeak Classroomに新しい先生の登録申請がありました。\n\n'+
  '氏名: '+(teacher.name||'未登録')+'\n'+
  '学校名: '+(teacher.school||'未登録')+'\n'+
  'メール: '+teacher.email+'\n\n'+
  '承認するには管理者としてログインし、「承認待ち」一覧を確認してください。\n'+
  APPROVAL_URL+'\n\n'+
  '※このメールを開いただけでは承認されません。';
 let sent=0,failed=0;
 const unique=[...new Map(body.admins.filter(a=>validUUID(a?.id)&&validEmail(a?.email))
   .map(a=>[a.id,a])).values()];
 for(const admin of unique){
  const ok=await send(key,'Copeak Classroom <'+fromAddress+'>',admin.email,
    '【Copeak Classroom】新しい先生の承認申請',message,
    'copeak-teacher-'+body.teacher_id.toLowerCase()+'-'+admin.id.toLowerCase());
  if(ok)sent++;else failed++;
 }
 if(unique.length===0)return json(422,{error:'no_verified_admin'});
 return json(failed?502:200,{accepted:sent,failed});
});