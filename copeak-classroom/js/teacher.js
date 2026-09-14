import {requireUser,getClient,signOut,pct} from './supabase.js';
import {demoAssignments,demoStudents,demoSubmissions,cnnTasks} from './data.js';
const $=s=>document.querySelector(s);
let ctx, classes=[], selectedClass=null, students=[], assignments=[], submissions=[];
$('#signOut').onclick=signOut;
function latestMap(rows){const m=new Map(); rows.slice().sort((a,b)=>new Date(a.submitted_at)-new Date(b.submitted_at)).forEach(r=>m.set(`${r.student_id}|${r.assignment_id}`,r));return m;}
function renderSummary(){
  const latest=latestMap(submissions),possible=students.length*assignments.filter(a=>new Date(a.release_at)<=new Date()).length,done=latest.size;
  $('#studentCount').textContent=students.length; $('#assignmentCount').textContent=assignments.length; $('#submissionRate').textContent=possible?`${Math.round(done/possible*100)}%`:'—';
  const vals=[...latest.values()].map(x=>Number(x.accuracy||0)); $('#classAverage').textContent=vals.length?`${Math.round(vals.reduce((a,b)=>a+b,0)/vals.length)}%`:'—';
}
function renderTable(){
  const latest=latestMap(submissions),q=$('#studentSearch').value.trim().toLowerCase();
  const visible=students.filter(s=>s.display_name.toLowerCase().includes(q));
  $('#gradeHead').innerHTML=`<tr><th>Student</th>${assignments.map(a=>`<th title="${esc(a.title)}">W${a.week_no}</th>`).join('')}<th>Done</th><th>Avg.</th></tr>`;
  $('#gradeBody').innerHTML=visible.map(s=>{
    let done=0,total=0,sum=0;
    const cells=assignments.map(a=>{const r=latest.get(`${s.id}|${a.id}`);if(!r)return '<td><span class="grade missing">—</span></td>';done++;total++;sum+=Number(r.accuracy||0);const v=Math.round(r.accuracy||0),c=v>=90?'good':v>=75?'mid':'low';return `<td title="WPM ${Math.round(r.wpm||0)} / Comp ${pct(r.comprehension)}"><span class="grade ${c}">${v}</span></td>`;}).join('');
    return `<tr><td>${esc(s.display_name)}</td>${cells}<td><strong>${done}/${assignments.length}</strong></td><td><strong>${total?Math.round(sum/total):'—'}${total?'%':''}</strong></td></tr>`;
  }).join('');
}
function render(){renderSummary();renderTable();$('#classTitle').textContent=selectedClass?.name||'Class';$('#classCode').textContent=selectedClass?.class_code||'DEMO32';}
function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
$('#studentSearch').oninput=renderTable;
$('#copyCode').onclick=async()=>{await navigator.clipboard.writeText($('#classCode').textContent);$('#copyCode').textContent='Copied!';setTimeout(()=>$('#copyCode').textContent='Copy',1200);};
async function createFirstClass(){
  const school=$('#schoolName').value.trim(),name=$('#newClassName').value.trim(); if(!school||!name)return;
  const sb=getClient(); const {data:sc,error:se}=await sb.from('schools').insert({name:school}).select().single(); if(se)throw se;
  const {error:pe}=await sb.from('profiles').update({school_id:sc.id}).eq('id',ctx.user.id); if(pe)throw pe;
  const {error:ce}=await sb.from('classes').insert({school_id:sc.id,teacher_id:ctx.user.id,name,academic_year:new Date().getFullYear()}); if(ce)throw ce; location.reload();
}
async function load30(){
  if(!selectedClass)return; if(assignments.length){alert('このクラスにはすでに課題があります。');return;}
  const startVal=$('#startDate').value||new Date().toISOString().slice(0,10); const start=new Date(`${startVal}T00:00:00`);
  const rows=cnnTasks.map(t=>{const r=new Date(start);r.setDate(start.getDate()+(t.week-1)*7);const d=new Date(r);d.setDate(r.getDate()+6);d.setHours(23,59,0,0);return {class_id:selectedClass.id,title:t.title,category:t.category,week_no:t.week,release_at:r.toISOString(),due_at:d.toISOString(),is_published:true,copeak_url:null};});
  const {error}=await getClient().from('assignments').insert(rows); if(error)throw error; await loadClass(selectedClass.id);render();
}
async function loadClass(id){
  selectedClass=classes.find(c=>c.id===id)||classes[0];
  const sb=getClient();
  const {data:m,error:me}=await sb.from('class_members').select('student_id,profiles!class_members_student_id_fkey(id,display_name)').eq('class_id',selectedClass.id); if(me)throw me;
  students=(m||[]).map(x=>x.profiles).filter(Boolean);
  const {data:a,error:ae}=await sb.from('assignments').select('*').eq('class_id',selectedClass.id).order('week_no'); if(ae)throw ae; assignments=a||[];
  if(assignments.length){const ids=assignments.map(a=>a.id);const {data:s,error:se}=await sb.from('submissions').select('*').in('assignment_id',ids);if(se)throw se;submissions=s||[];}else submissions=[];
}
async function loadLive(){
  const sb=getClient(); const {data:c,error}=await sb.from('classes').select('*').eq('teacher_id',ctx.user.id).order('created_at'); if(error)throw error; classes=c||[];
  if(!classes.length){$('#mainApp').classList.add('hidden');$('#onboard').classList.remove('hidden');$('#createClass').onclick=()=>createFirstClass().catch(e=>$('#onboardMsg').textContent=e.message);return false;}
  await loadClass(classes[0].id); return true;
}
(async()=>{
  ctx=await requireUser('teacher'); if(!ctx)return; $('#userName').textContent=ctx.profile?.display_name||'Teacher';
  const now=new Date(); $('#startDate').value=now.toISOString().slice(0,10); $('#load30').onclick=()=>load30().catch(e=>alert(e.message));
  if(ctx.demo){classes=[{id:'demo-class',name:'3年2組 English Course',class_code:'AG32EN'}];selectedClass=classes[0];students=demoStudents;assignments=demoAssignments();submissions=demoSubmissions();$('#demoBanner').classList.remove('hidden');render();return;}
  if(await loadLive())render();
})().catch(e=>{console.error(e);alert(e.message);});
