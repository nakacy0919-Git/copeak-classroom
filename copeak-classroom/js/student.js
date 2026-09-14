import {requireUser,getClient,signOut,fmtDate,pct} from './supabase.js';
import {demoAssignments,demoSubmissions} from './data.js';
const $=s=>document.querySelector(s);
let ctx, assignments=[], submissions=[], currentClass=null;

$('#signOut').onclick=signOut;

function latestMap(rows){
  const m=new Map(); rows.slice().sort((a,b)=>new Date(a.submitted_at)-new Date(b.submitted_at)).forEach(r=>m.set(r.assignment_id,r)); return m;
}
function assignmentStatus(a,sub){
  if(sub)return ['done','✓ Completed'];
  const now=new Date(), release=new Date(a.release_at), due=new Date(a.due_at);
  if(now<release)return ['upcoming','Upcoming']; if(now>due)return ['late','Overdue']; return ['due','This Week'];
}
function render(){
  const map=latestMap(submissions), done=assignments.filter(a=>map.has(a.id)).length, progress=assignments.length?Math.round(done/assignments.length*100):0;
  $('#progressText').textContent=`${done} / ${assignments.length}`; $('#completedMetric').textContent=`${done} / ${assignments.length}`; $('#progressPct').textContent=`${progress}%`; $('#progressBar').style.width=`${progress}%`;
  const scores=[...map.values()];
  $('#avgAccuracy').textContent=scores.length?pct(scores.reduce((n,x)=>n+Number(x.accuracy||0),0)/scores.length):'—';
  $('#bestWpm').textContent=scores.length?Math.round(Math.max(...scores.map(x=>Number(x.wpm||0)))):'—';
  const target=assignments.find(a=>!map.has(a.id)&&new Date(a.release_at)<=new Date())||assignments.find(a=>!map.has(a.id));
  if(target){
    const [cls,label]=assignmentStatus(target,null); $('#weekLabel').textContent=`WEEK ${String(target.week_no).padStart(2,'0')}`; $('#weekTitle').textContent=target.title; $('#weekMeta').textContent=`${target.category||'Reading'} • Due ${fmtDate(target.due_at)}`;
    const b=$('#weekStart'); b.disabled=cls==='upcoming'; b.onclick=()=>openCopeak(target);
  }else{$('#weekTitle').textContent='All assignments completed!';$('#weekMeta').textContent='Great work.';$('#weekStart').disabled=true;}
  $('#assignmentList').innerHTML=assignments.map(a=>{
    const s=map.get(a.id),[cls,label]=assignmentStatus(a,s),disabled=cls==='upcoming'?'disabled':'';
    return `<div class="assignment"><div class="weekbox"><span>WEEK</span><strong>${String(a.week_no).padStart(2,'0')}</strong></div><div><div class="assignment-title">${escapeHtml(a.title)}</div><div class="assignment-meta">${escapeHtml(a.category||'Reading')} ・ ${fmtDate(a.due_at)} ・ <span class="status ${cls}">${label}</span></div></div><div class="assignment-score">${s?`<strong>${pct(s.accuracy)}</strong><div class="tiny muted">WPM ${Math.round(s.wpm||0)} / Comp ${pct(s.comprehension)}</div>`:'<strong style="color:#a8a29e">—</strong>'}<div class="assignment-actions"><button class="btn btn-sm ${s?'btn-light':'btn-primary'} start-btn" data-id="${a.id}" ${disabled}>${s?'Practice Again':'Start Copeak'}</button>${ctx.demo&&!s&&cls!=='upcoming'?`<button class="btn btn-sm btn-dark demo-submit" data-id="${a.id}">TEST Submit</button>`:''}</div></div></div>`;
  }).join('');
  document.querySelectorAll('.start-btn').forEach(b=>b.onclick=()=>openCopeak(assignments.find(a=>a.id===b.dataset.id)));
  document.querySelectorAll('.demo-submit').forEach(b=>b.onclick=()=>demoSubmit(b.dataset.id));
}
function escapeHtml(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function openCopeak(a){
  const base=a.copeak_url||window.COPEAK_CONFIG.copeakBaseUrl; const u=new URL(base,location.href); u.searchParams.set('classroom_assignment',a.id); u.searchParams.set('source','copeak-classroom'); window.open(u.toString(),'_blank','noopener');
}
function demoSubmit(id){submissions.push({id:`demo-new-${Date.now()}`,student_id:'s1',assignment_id:id,accuracy:92,wpm:118,comprehension:88,attempt_no:1,submitted_at:new Date().toISOString()});render();}
async function joinClass(){
  const code=$('#joinCode').value.trim().toUpperCase(); if(!code)return;
  const sb=getClient(); const {error}=await sb.rpc('join_class_by_code',{p_code:code}); if(error){$('#joinMsg').textContent=error.message;return;} location.reload();
}
async function loadLive(){
  const sb=getClient();
  const {data:m,error:me}=await sb.from('class_members').select('class_id,classes(id,name,school_id)').eq('student_id',ctx.user.id).limit(1); if(me)throw me;
  if(!m?.length){$('#mainApp').classList.add('hidden');$('#joinPanel').classList.remove('hidden');$('#joinBtn').onclick=joinClass;return;}
  currentClass=m[0].classes; $('#className').textContent=currentClass.name;
  const {data:a,error:ae}=await sb.from('assignments').select('*').eq('class_id',currentClass.id).eq('is_published',true).order('week_no'); if(ae)throw ae; assignments=a||[];
  const {data:s,error:se}=await sb.from('submissions').select('*').eq('student_id',ctx.user.id); if(se)throw se; submissions=s||[];
}
(async()=>{
  ctx=await requireUser('student'); if(!ctx)return; $('#userName').textContent=ctx.profile?.display_name||'Student';
  if(ctx.demo){currentClass={id:'demo-class',name:'3年2組 English Course'};assignments=demoAssignments();submissions=demoSubmissions().filter(x=>x.student_id==='s1');$('#className').textContent=currentClass.name;$('#demoBanner').classList.remove('hidden');}
  else await loadLive();
  render();
})().catch(e=>{console.error(e);alert(e.message);});
