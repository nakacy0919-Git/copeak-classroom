import { getClient, isConfigured } from './supabase.js';
const $ = selector => document.querySelector(selector);
let client, teachers = [], serial = 0, timer;
let state = {view:'teachers',page:0}, stack = [], displayed = [];
const size = 6;
const esc = value => String(value ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = value => value == null ? '—' : Number(value).toLocaleString('ja-JP',{maximumFractionDigits:2});
const date = value => value ? new Date(value).toLocaleString('ja-JP') : '—';
const codes = {launch_preparation_failed:'教材・連携の準備に失敗',delivery_too_long:'教材URLが長すぎる',submission_save_failed:'成績保存に失敗',dashboard_refresh_failed:'画面更新に失敗'};
const reasons = {offline:'通信オフライン',permission:'権限・課題条件の拒否',duplicate:'重複登録の拒否',invalid_data:'送信データの拒否',unknown:'原因コードなし（要調査）'};
const statuses = {draft:'未公開',scheduled:'公開待ち',open:'公開中',closed:'締切済み'};
function message(text) { $('#activityMessage').textContent=text; $('#activityMessage').classList.remove('hidden'); }
function hideMessage() { $('#activityMessage').classList.add('hidden'); }
async function verifyAdmin() {
  if (!isConfigured()) {
    location.replace('index.html');
    return false;
  }

  client = getClient('teacher');

  const { data: auth, error: authError } =
    await client.auth.getUser();

  if (authError || !auth?.user) {
    location.replace('index.html');
    return false;
  }

  const user = auth.user;

  const [profileResult, adminResult] = await Promise.all([
    client.from('profiles')
      .select('display_name,role,teacher_status')
      .eq('id', user.id)
      .single(),

    client.from('platform_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()
  ]);

  if (profileResult.error) throw profileResult.error;
  if (adminResult.error) throw adminResult.error;

  const profile = profileResult.data;

  if (profile?.role !== 'teacher' ||
      profile.teacher_status !== 'approved' ||
      !adminResult.data) {
    location.replace('teacher.html');
    return false;
  }

  $('#activityAdminName').textContent =
    profile.display_name || user.email || 'Admin';

  return true;
}

function table(headers, rows) {
  return `<table class="admin-table"><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(cells=>`<tr>${cells.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}">該当する記録がありません。</td></tr>`}</tbody></table>`;
}
const button = (kind,id,label) => `<button class="btn btn-sm btn-light" data-open="${kind}" data-id="${esc(id)}">${label}</button>`;
function navigate(next) {
  stack.push({...state, search:$('#activitySearch').value, filter:$('#activityFilter').value});
  state = {...state,...next,page:0}; $('#activitySearch').value=''; $('#activityFilter').value='all';
  void load().catch(showError);
}
function showError(error) { message(`読み込みに失敗しました。更新で再試行してください：${error.message || error}`); }
function renderRows(items) {
  displayed=items;
  if (state.view==='teachers') return table(['先生 / 学校','クラス','課題','公開済み','提出記録','最終提出','操作'],items.map(t=>[
    `${esc(t.teacher_name)}<small>${esc(t.school_name)}</small>`,num(t.class_count),num(t.assignment_count),num(t.published_count),num(t.submission_count),esc(date(t.last_submission_at)),button('assignments',t.teacher_id,'課題 →')]));
  if (state.view==='assignments') return table(['課題 / 配布クラス','公開状態','練習モード','対象 / 提出済み','提出回数','締切','報告','操作'],items.map(a=>[
    `${esc(a.title)}<small>${esc(a.class_names)}</small>`, `<span class="admin-badge ${esc(a.delivery_status)}">${statuses[a.delivery_status] || '—'}</span><small>公開 ${esc(date(a.release_at))}</small>`,esc(a.practice_mode),`${num(a.target_count)} / ${num(a.submitted_students)}`,num(a.submission_count),esc(date(a.due_at)),num(a.recent_errors),button('students',a.assignment_id,'成績 →')]));
  if (state.view==='students') return table(['生徒','提出回数','最新 Accuracy','最新 WPM','最新 Comp.','合格（最高値・手動）','最終提出','操作'],items.map(s=>[
    `${esc(s.student_name)}${s.current_target?'':'<small>現在の配布対象外</small>'}`,num(s.attempts),num(s.accuracy),num(s.wpm),num(s.comprehension),s.passed==null?'対象外':s.passed?`✓ 合格<small>${num(s.effective_accuracy)}% / ${num(s.effective_wpm)} WPM / ${num(s.effective_comprehension)}%</small>`:`未合格<small>${num(s.effective_accuracy)}% / ${num(s.effective_wpm)} WPM / ${num(s.effective_comprehension)}%</small>`,esc(date(s.submitted_at)),Number(s.attempts)?button('history',s.student_id,'履歴 →'):'—']));
  if (state.view==='history') return table(['音読回数','日時','Accuracy %','WPM','Comp. %','練習モード','設定'],items.map(s=>[
    num(s.attempt_no),esc(date(s.submitted_at)),num(s.accuracy),num(s.wpm),num(s.comprehension),esc(s.practice_mode),s.practice_mode==='paced'?`目標 ${num(s.paced_target_wpm)} WPM`:s.practice_mode==='vanish'?`Level ${num(s.vanish_level)}`:'—']));
  return table(['報告日時','先生 / クラス','課題','報告した利用者','内容'],items.map(d=>[
    esc(date(d.created_at)),`${esc(d.teacher_name)}<small>${esc(d.class_name)}</small>`,esc(d.title),esc(d.reporter_name),`${esc(codes[d.code]||d.code)}<small>${esc(reasons[d.reason]||reasons.unknown)}</small>`]));
}
function renderHeader() {
  $('#activityTitle').textContent = {teachers:'先生を選択',assignments:'配布課題',students:'生徒別の成績',history:'提出履歴',diagnostics:'エラー報告'}[state.view];
  $('#activityContext').textContent = [state.teacherName,state.assignmentTitle,state.studentName].filter(Boolean).join(' → ') || '先生から課題・生徒・提出履歴へ進めます。';
  $('#activityBack').classList.toggle('hidden',!stack.length);
  $('#activityPrevious').classList.toggle('hidden',state.view==='students');
  $('#activityNext').classList.toggle('hidden',state.view==='students');
  $('#activityFilter').classList.toggle('hidden',state.view!=='teachers');
  $('#activityErrors').classList.toggle('hidden',state.view==='diagnostics');
  $('#activityPreviewButton').classList.toggle('hidden',!state.assignmentId || state.view==='diagnostics');
  $('#activitySearch').classList.toggle('hidden',state.view==='history');
  $('#activitySearch').placeholder = {teachers:'先生・学校名を検索',assignments:'課題・クラス名を検索',students:'生徒名を検索',diagnostics:'課題・利用者・エラーコードを検索'}[state.view] || '';
}
async function load() {
  const current=++serial; clearTimeout(timer); hideMessage(); renderHeader();
  $('#activityTable').innerHTML='<div class="admin-loading" role="status">読み込み中…</div>';
  $('#activityPrevious').disabled=true; $('#activityNext').disabled=true; $('#activityPage').textContent='';
  let items,total;
  const batchSize = state.view==='students' ? 50 : size;
  if (state.view==='teachers') {
    const search=$('#activitySearch').value.trim().toLowerCase(), filter=$('#activityFilter').value;
    const found=teachers.filter(t=>[t.teacher_name,t.school_name].join(' ').toLowerCase().includes(search) &&
      (filter==='all' || Number(t[filter==='lessons'?'assignment_count':'submission_count'])>0));
    total=found.length; items=found.slice(state.page*size,(state.page+1)*size);
  } else {
    const {data,error}=await client.rpc('admin_inspect_activity',{
      p_view:state.view,p_teacher_id:state.teacherId||null,p_assignment_id:state.assignmentId||null,
      p_student_id:state.studentId||null,p_search:$('#activitySearch').value.trim(),p_page:state.view==='students' ? 0 : state.page,p_size:batchSize
    });
    if (current!==serial) return;
    if (error) throw error;
    total=Number(data?.total||0); items=Array.isArray(data?.items)?data.items:[];
  }
  // ADMIN_STUDENT_SCROLL_20261009: fetch all matching students in bounded batches.
  if (state.view==='students') {
    for (let page=1; page*batchSize<total; page++) {
      const {data,error}=await client.rpc('admin_inspect_activity',{
        p_view:'students',p_teacher_id:state.teacherId||null,p_assignment_id:state.assignmentId||null,
        p_student_id:null,p_search:$('#activitySearch').value.trim(),p_page:page,p_size:batchSize
      });
      if(current!==serial)return;
      if(error)throw error;
      const next=Array.isArray(data?.items)?data.items:[];
      if(!next.length)break;
      items.push(...next);
    }
    items=[...new Map(items.map(s=>[s.student_id,s])).values()];
  }
  if(current!==serial)return;
  $('#activityTable').innerHTML=renderRows(items);
  $('#activityTable').scrollTop=0;
  $('#activityPage').textContent=state.view==='students'
    ? `${num(items.length)} / ${num(total)}人`
    : `${num(total)}件 · ${state.page+1} / ${Math.max(1,Math.ceil(total/size))}ページ`;
  $('#activityPrevious').disabled=state.page===0; $('#activityNext').disabled=(state.page+1)*size>=total;
}
async function refresh() {
  const current=++serial;
  const {data,error}=await client.rpc('admin_get_teacher_activity');
  if(current!==serial)return;
  if(error)throw error; teachers=data||[];
  const total=key=>teachers.reduce((s,t)=>s+Number(t[key]||0),0);
  $('#activityStats').innerHTML=[['先生',teachers.length],['クラス',total('class_count')],['課題',total('assignment_count')],['提出記録',total('submission_count')]].map(([k,v])=>`<span>${k}<strong>${num(v)}</strong></span>`).join('');
  await load();
}
$('#activityTable').onclick=event=>{
  const b=event.target.closest('[data-open]'); if(!b)return;
  const id=b.dataset.id;
  if(b.dataset.open==='assignments') { const t=displayed.find(t=>t.teacher_id===id); if(t)navigate({view:'assignments',teacherId:id,teacherName:t.teacher_name,assignmentId:null,assignmentTitle:null,studentId:null,studentName:null}); }
  if(b.dataset.open==='students') { const a=displayed.find(a=>a.assignment_id===id); if(a)navigate({view:'students',assignmentId:id,assignmentTitle:a.title,studentId:null,studentName:null}); }
  if(b.dataset.open==='history') { const s=displayed.find(s=>s.student_id===id); if(s)navigate({view:'history',studentId:id,studentName:s.student_name}); }
};
$('#activityBack').onclick=()=>{state=stack.pop()||{view:'teachers',page:0};$('#activitySearch').value=state.search||'';$('#activityFilter').value=state.filter||'all';void load().catch(showError);};
$('#activityErrors').onclick=()=>navigate({view:'diagnostics',studentId:null,studentName:null});
$('#activityPrevious').onclick=()=>{state.page--;void load().catch(showError);};
$('#activityNext').onclick=()=>{state.page++;void load().catch(showError);};
$('#activitySearch').oninput=()=>{++serial;clearTimeout(timer);state.page=0;timer=setTimeout(()=>void load().catch(showError),250);};
$('#activityFilter').onchange=()=>{state.page=0;void load().catch(showError);};
$('#activityRefresh').onclick=()=>void refresh().catch(showError);
$('#activitySignOut').onclick=async()=>{if(client)await client.auth.signOut();location.replace('index.html');};
$('#previewClose').onclick=()=>$('#activityPreview').close();
$('#activityPreviewButton').onclick=async()=>{
  const assignmentId=state.assignmentId;
  $('#previewTitle').textContent=state.assignmentTitle||'教材';$('#previewText').textContent='読み込み中…';$('#activityPreview').showModal();
  try {
    const {data,error}=await client.rpc('admin_inspect_activity',{p_view:'lesson',p_assignment_id:assignmentId});
    if(error)throw error;
    const lesson=data?.items?.[0];
    if(!lesson)throw new Error('教材を取得できません。');
    $('#previewText').textContent=[lesson.lesson_text,lesson.lesson_translation,lesson.lesson_type==='dialogue'?JSON.stringify(lesson.lesson_dialogue,null,2):''].filter(Boolean).join('\n\n');
  } catch(error){$('#previewText').textContent=error.message||'取得に失敗しました。';}
};
(async()=>{if(await verifyAdmin())await refresh();})().catch(showError);
