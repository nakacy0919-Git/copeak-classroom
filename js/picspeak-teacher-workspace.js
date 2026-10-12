/**
 * Classroom teacher workspace: additive PicSpeak tabs.
 * Original Copeak gradebook, lesson creation and submissions remain untouched.
 * No writes to the database are performed by this module.
 */
import { getClient, demoRole } from './supabase.js';
import {bestAttempt,passByHistory,metric,headline,breakdown,condition,gradeLabel} from './picspeak-assessment.js';

const css = `
.psw-tabs{display:flex;gap:7px;align-items:center;margin:15px 0 16px;padding:5px;border:1px solid #dfe8ef;border-radius:14px;background:#f2f6f9;width:max-content;max-width:100%;flex-wrap:wrap}
.psw-tab{border:0;background:transparent;color:#44576a;font:inherit;font-size:14px;font-weight:800;padding:11px 17px;border-radius:10px;cursor:pointer}
.psw-tab[aria-selected="true"]{background:#fff;color:#0f766e;box-shadow:0 1px 7px rgba(20,34,48,.12)}
.psw-hidden{display:none!important}
.psw-ps-panel{border:1px solid #e0e8f0;border-radius:16px;padding:20px;background:#fff}
.psw-ps-panel h2{font-size:21px;margin:0 0 6px}
.psw-ps-panel .psw-desc{font-size:12px;color:#64748b;margin:0 0 18px;line-height:1.7}
.psw-control-row{display:flex;align-items:end;flex-wrap:wrap;gap:12px;margin:0 0 16px}
.psw-control-row label{display:grid;gap:5px;font-size:12px;font-weight:750;color:#334155;flex:1;min-width:230px}
.psw-control-row select{padding:10px;border:1px solid #cbd5e1;border-radius:9px;font:inherit;background:white;min-width:0}
.psw-control-row button,.psw-btn{border:1px solid #cbd5e1;border-radius:9px;padding:10px 13px;font:inherit;font-size:13px;font-weight:700;color:#1e4e78;background:#edf4fb;cursor:pointer}
.psw-control-row button:disabled,.psw-btn:disabled{opacity:.5;cursor:default}
.psw-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:17px 0}
.psw-kpi{padding:14px;background:#f5f8fc;border:1px solid #edf2f8;border-radius:12px;text-align:center}
.psw-kpi strong{display:block;font-size:23px;line-height:1.35;font-weight:850;color:#18385b}
.psw-kpi small{color:#65768b;font-weight:600;font-size:11px}
.psw-table-wrap{width:100%;overflow:auto;border:1px solid #e2e8f0;border-radius:11px}
.psw-table{width:100%;min-width:730px;border-collapse:collapse;font-size:13px}
.psw-table th{text-align:left;background:#133b36;color:white;font-size:12px;padding:11px 10px;white-space:nowrap}
.psw-table td{padding:10px;border-top:1px solid #e6edf2;vertical-align:middle}
.psw-table tbody tr:nth-child(even){background:#f7fafc}
.psw-status{color:#64748b;font-size:12px;min-height:20px;margin-top:10px}
.psw-tag{display:inline-block;padding:3px 9px;border-radius:20px;background:#e9eef4;color:#4a6074;font-size:11px;font-weight:700}
.psw-tag.ok{background:#dcfce7;color:#166534}
.psw-detail-line td{background:#eff6fb;color:#334155;font-size:12px;padding:10px 16px}
.psw-ps-panel .psw-error{color:#b91c1c}
#picSpeakBetaPanel.psw-clean .psl-teacher-section>h3:first-of-type{display:none}
#picSpeakBetaPanel.psw-clean #picSpeakBetaReview{display:none!important}
#picSpeakBetaPanel.psw-clean .psl-teacher-section{border:0;background:#fff;margin-top:5px;padding:14px 0}
#picSpeakBetaPanel.psw-clean .psl-teacher-section .psl-card{border-radius:12px;padding:15px}
@media(max-width:720px){.psw-tabs{width:100%}.psw-tab{flex:1;padding:10px 7px}.psw-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.psw-ps-panel{padding:12px}}
`;

function makeTabs(labels, onSelect) {
  const nav = document.createElement('div');
  nav.className = 'psw-tabs';
  nav.setAttribute('role','tablist');
  const buttons = labels.map(([id,label]) => {
    const b=document.createElement('button');
    b.className='psw-tab';b.type='button';b.textContent=label;
    b.dataset.kind=id;b.setAttribute('role','tab');
    b.addEventListener('click',()=>{
      for(const button of nav.querySelectorAll('button')){
        button.setAttribute('aria-selected',String(button===b));
      }
      onSelect(id);
    });
    nav.append(b);return b;
  });
  return { nav,select(id){const btn=buttons.find(x=>x.dataset.kind===id);if(btn)btn.click();} };
}

function initAssignmentTabs(){
  const page=document.querySelector('[data-platform-page="assignments"]');
  const beta=document.getElementById('picSpeakBetaPanel');
  const launcher=document.getElementById('openPicSpeakBeta');
  if(!page||!beta||!launcher)return;
  const content=page.querySelector('section.paper.section');
  if(!content||!content.contains(beta))return;
  const original=new Map();
  for(const node of Array.from(content.children)){
    if(node===beta || node.contains(beta))continue;
    original.set(node,node.classList.contains('psw-hidden'));
  }
  const modeTitle=document.createElement('div');
  modeTitle.className='psw-ps-heading';
  modeTitle.innerHTML='<h2 style="margin:4px 0 2px;font-size:22px">PicSpeak 画像描写の課題</h2><p style="margin:0 0 12px;color:#64748b;font-size:13px">画像・レベル・配布先を指定し、課題を作成します。音読課題と成績は別管理です。</p>';
  beta.insertAdjacentElement('beforebegin',modeTitle);
  const tabs=makeTabs([['reading','📖 Copeak 音読'],['picspeak','🖼️ PicSpeak 画像描写']],mode=>{
    const isPic=mode==='picspeak';
    for(const [node,wasHidden] of original){node.classList.toggle('psw-hidden',isPic||wasHidden);}
    beta.classList.toggle('psw-hidden',!isPic);
    modeTitle.classList.toggle('psw-hidden',!isPic);
    if(isPic){
      beta.classList.remove('hidden');
      beta.classList.add('psw-clean');
      // The existing beta manager listens to the opener for loading its classes and assignments.
      if(!beta.dataset.pswInitialized){
        beta.dataset.pswInitialized='1';
        launcher.click();
        beta.classList.remove('hidden');
      }
    }
  });
  content.insertBefore(tabs.nav,content.firstChild);
  // The original beta opener is superseded by the tab switch.
  launcher.classList.add('psw-hidden');
  tabs.select('reading');
}

const fmtPct=value=>value==null?'—':Number(value).toLocaleString('ja-JP',{maximumFractionDigits:1})+'%';
const fmtDate=value=>value?new Date(value).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
const fmtNumber=value=>value==null?'—':String(Number(value));
const unique=values=>[...new Set(values.filter(Boolean))];

function csvDownload(data,filename){
  function safe(value){
    let v=String(value??'');
    if(/^[\s]*[=+@\-]/.test(v))v="'"+v;
    return '"'+v.replace(/"/g,'""')+'"';
  }
  const content='\ufeff'+data.map(row=>row.map(safe).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=filename;
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function initGradebookTabs(){
  const page=document.querySelector('[data-platform-page="gradebook"]');
  if(!page)return;
  const original=page.querySelector('section.paper.section');
  if(!original)return;
  const panel=document.createElement('section');
  panel.className='paper section psw-ps-panel';
  panel.innerHTML=`
    <h2>PicSpeak 成績管理</h2>
    <p class="psw-desc">到達率（%）・練習回数・累計発話単語数を中心に確認します。WPMは最高達成率を出した回の値です。<br>※画像描写の達成率はアプリ算出の未検証値です。Copeak音読の成績とは合算しません。</p>
    <div class="psw-control-row">
      <label>クラス <select id="pswClass"><option value="">クラスを読み込み中…</option></select></label>
      <label>PicSpeak課題 <select id="pswAssignment"><option value="">クラスを選択してください</option></select></label>
      <button id="pswReload" type="button">↻ 更新</button>
      <button id="pswCsv" type="button" disabled>CSV出力</button>
    </div>
    <div class="psw-summary" id="pswStats"></div>
    <div class="psw-table-wrap">
      <table class="psw-table"><thead><tr><th>生徒</th><th>練習回数</th><th>最高達成率／最速タイム</th><th>累計発話単語数</th><th>WPM</th><th>合格</th><th>履歴</th></tr></thead>
      <tbody id="pswGradeBody"><tr><td colspan="7">クラスと課題を選択してください。</td></tr></tbody></table>
    </div>
    <p class="psw-status" id="pswStatus" role="status"></p>`;
  const tabs=makeTabs([['reading','📖 Copeak 音読'],['picspeak','🖼️ PicSpeak 画像描写']],mode=>{
    const reading=mode==='reading';
    original.classList.toggle('psw-hidden',!reading);
    panel.classList.toggle('psw-hidden',reading);
    if(!reading && !opened){opened=true;void loadClasses();}
  });
  page.insertBefore(tabs.nav,original);
  original.insertAdjacentElement('afterend',panel);
  tabs.select('reading');

  const $=id=>panel.querySelector('#'+id);
  const selectClass=$('pswClass');
  const selectAssignment=$('pswAssignment');
  const status=$('pswStatus');
  const body=$('pswGradeBody');
  const stats=$('pswStats');
  const reload=$('pswReload');
  const csv=$('pswCsv');
  let opened=false,loading=false;
  let assignments=[],roster=[],attempts=[],targets=[],tableRows=[],selectedAssignment=null;
  const configHost='sxcbudhcxiblpdzpgfep.supabase.co';
  function client(){
    if(demoRole())throw Error('デモではPicSpeakの成績を読み込めません。');
    if(new URL(window.COPEAK_CONFIG?.supabaseUrl||'https://invalid.invalid').hostname!==configHost)
      throw Error('接続先が予期したClassroom Supabaseと異なります。');
    const c=getClient('teacher');if(!c)throw Error('先生としてログインしてください。');return c;
  }
  function busy(isBusy){loading=isBusy;reload.disabled=isBusy;selectClass.disabled=isBusy;selectAssignment.disabled=isBusy;}
  function problem(e){status.textContent='読込エラー: '+(e?.message||String(e));status.classList.add('psw-error');}
  function note(message){status.textContent=message;status.classList.remove('psw-error');}
  function option(text,value){const x=document.createElement('option');x.textContent=text;x.value=value;return x;}
  function fallback(text){body.replaceChildren();const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=7;td.textContent=text;tr.append(td);body.append(tr);}
  function kpi(label,value){const block=document.createElement('div');block.className='psw-kpi';const v=document.createElement('strong'),l=document.createElement('small');v.textContent=String(value);l.textContent=label;block.append(v,l);stats.append(block);}

  async function loadClasses(){
    if(loading)return;
    busy(true);note('クラスを読み込んでいます…');
    try{
      const {data,error}=await client().from('classes').select('id,name,class_code').order('name').limit(250);
      if(error)throw error;
      const previously=selectClass.value;
      selectClass.replaceChildren(option('クラスを選択',''));
      for(const c of data||[])selectClass.append(option(`${c.name} (${c.class_code})`,c.id));
      const activeCode=document.getElementById('classCode')?.textContent?.trim();
      const active=(data||[]).find(c=>c.id===previously)||(data||[]).find(c=>c.class_code===activeCode);
      if(active)selectClass.value=active.id;
      else if((data||[]).length===1)selectClass.value=data[0].id;
      else selectClass.value='';
    }catch(e){problem(e);return;}finally{busy(false);}
    await loadAssignments();
  }
  async function loadAssignments(){
    if(loading)return;
    busy(true);csv.disabled=true;fallback('課題を読み込んでいます…');
    try{
      assignments=[];
      const classId=selectClass.value;
      if(classId){
        const {data,error}=await client().from('picspeak_assignments')
          .select('id,title,mode,class_id,audience_type,pass_percent,pass_seconds,pass_correct,pass_reading_percent,pass_picture_percent,pass_qa_rating,is_published,created_at')
          .eq('class_id',classId).order('created_at',{ascending:false}).limit(250);
        if(error)throw error;
        assignments=data||[];
      }
      const previous=selectAssignment.value;
      selectAssignment.replaceChildren(option('課題を選択',''));
      for(const a of assignments)selectAssignment.append(option(`${a.title} (${a.mode.toUpperCase()}${a.is_published?'':'・下書き'})`,a.id));
      selectAssignment.value=assignments.some(a=>a.id===previous)?previous:assignments[0]?.id||'';
    }catch(e){problem(e);return;}finally{busy(false);}
    await loadGradebook();
  }
  async function loadGradebook(){
    if(loading)return;
    const a=assignments.find(a=>a.id===selectAssignment.value);
    selectedAssignment=a||null;
    tableRows=[];csv.disabled=true;stats.replaceChildren();
    if(!a){fallback('PicSpeak課題がありません。クラスと課題を選択してください。');note('');return;}
    busy(true);fallback('成績を読み込んでいます…');note('生徒の成績を読み込んでいます…');
    try{
      const sb=client();
      const [m,t,ar,rosterResult]=await Promise.all([
        sb.from('class_members').select('student_id').eq('class_id',a.class_id).limit(2000),
        sb.from('picspeak_assignment_targets').select('student_id').eq('assignment_id',a.id).limit(2000),
        sb.from('picspeak_attempts').select('student_id,completion_percent,score_percent,word_count,wpm,duration_seconds,metrics,recorded_at')
          .eq('assignment_id',a.id).order('recorded_at',{ascending:false}).limit(5000),
        sb.from('class_roster').select('linked_student_id,display_name,student_number').eq('class_id',a.class_id).limit(2000)
      ]);
      if(m.error)throw m.error;if(t.error)throw t.error;if(ar.error)throw ar.error;
      attempts=ar.data||[];targets=t.data||[];roster=rosterResult.data||[];
      const membership=unique((m.data||[]).map(item=>item.student_id));
      const designated=new Set(targets.map(t=>t.student_id));
      const ids=a.audience_type==='class'?membership:membership.filter(id=>designated.has(id));
      const names=new Map(roster.filter(r=>r.linked_student_id).map(r=>[
        r.linked_student_id,(r.student_number?r.student_number+' · ':'')+(r.display_name||'生徒')
      ]));
      const missing=ids.filter(id=>!names.has(id));
      for(let i=0;i<missing.length;i+=100){
        const {data,error}=await sb.from('profiles').select('id,display_name').in('id',missing.slice(i,i+100));
        if(error)throw error;
        for(const p of data||[])names.set(p.id,p.display_name||'生徒');
      }
      const byStudent=new Map(ids.map(id=>[id,[]]));
      for(const attempt of attempts)if(byStudent.has(attempt.student_id))byStudent.get(attempt.student_id).push(attempt);
      tableRows=ids.map(id=>{
        const history=byStudent.get(id)||[];
        const best=bestAttempt(a,history);
        const passed=passByHistory(a,history);
        return {id,name:names.get(id)||'登録済み生徒',attempts:history.length,
          achievement:metric(a,best),
          words:history.some(r=>r.word_count!=null)?history.reduce((total,r)=>total+Math.max(0,Number(r.word_count)||0),0):null,
          bestWords:best?.word_count??null,wpm:best?.wpm??null,passed,history,best};
      });
      tableRows.sort((x,y)=>x.name.localeCompare(y.name,'ja'));
      render(a);
      note(`表示：${tableRows.length}名／記録${attempts.length}件。合格条件: ${condition(a)}。スコアはアプリ生成の未検証値です。`+
        (attempts.length===5000?' ※提出データが上限に達しています。':''));
      csv.disabled=false;
    }catch(e){problem(e);fallback('成績を表示できませんでした。');}finally{busy(false);}
  }
  function render(a){
    body.replaceChildren();stats.replaceChildren();
    const table=body.closest('table');
    if(table){const cells=table.querySelectorAll('thead th');if(cells[2])cells[2].textContent=gradeLabel(a);if(cells[3])cells[3].textContent=a.mode==='picflash'?'最高記録の正答数':'累計発話単語数';}
    kpi('この課題の配布対象',tableRows.length+'名');
    kpi('学習した生徒',tableRows.filter(x=>x.attempts>0).length+'名');
    kpi('練習記録',tableRows.reduce((n,x)=>n+x.attempts,0)+'回');
    const have=tableRows.filter(x=>x.achievement!=null);
    kpi(a.mode==='picflash'?'平均最速タイム':'平均最高達成率',have.length
      ?(have.reduce((n,x)=>n+x.achievement,0)/have.length).toFixed(1)+(a.mode==='picflash'?'秒':'%'):'—');
    if(!tableRows.length){fallback('この課題の配布対象生徒はいません。');return;}
    const cell=(row,value)=>{const td=document.createElement('td');td.textContent=String(value??'—');row.append(td);return td;};
    for(const person of tableRows){
      const row=document.createElement('tr');
      cell(row,person.name);cell(row,person.attempts+'回');
      cell(row,headline(a,person.best));
      cell(row,a.mode==='picflash'?(person.best?.metrics?.correct??'—')+'/10問':person.words==null?'—':person.words+'語');cell(row,a.mode==='picflash'?'—':person.wpm);
      const td=cell(row,person.passed?'合格':person.attempts?'未達成':'未着手');
      const tag=document.createElement('span');tag.className='psw-tag'+(person.passed?' ok':'');tag.textContent=td.textContent;td.replaceChildren(tag);
      const detailsCell=document.createElement('td');
      const detailButton=document.createElement('button');detailButton.type='button';detailButton.className='psw-btn';detailButton.textContent='履歴';
      detailButton.disabled=!person.history.length;
      const expanded=document.createElement('tr');expanded.className='psw-detail-line';expanded.hidden=true;
      const inner=document.createElement('td');inner.colSpan=7;
      const recent=person.history.slice(0,15).map((rec,i)=>{
        return (i+1)+'回目（'+fmtDate(rec.recorded_at)+'）: '+breakdown(a,rec)+' · '+(passByHistory(a,[rec])?'合格':'未達成');
      });
      inner.textContent=recent.join('　／　');expanded.append(inner);
      detailButton.addEventListener('click',()=>{expanded.hidden=!expanded.hidden;detailButton.setAttribute('aria-expanded',String(!expanded.hidden));});
      detailsCell.append(detailButton);row.append(detailsCell);
      body.append(row,expanded);
    }
  }
  function download(){
    if(!selectedAssignment||!tableRows.length)return;
    const a=selectedAssignment;
    const rows=[['生徒ID','氏名','練習回数',gradeLabel(a),'累計発話単語数(語)','最高記録時の単語数(語)','WPM','合格','内訳','合格条件'],
      ...tableRows.map(r=>[r.id,r.name,r.attempts,r.achievement??'',r.words??'',r.bestWords??'',r.wpm??'',r.passed?'合格':'未達成',breakdown(a,r.best),condition(a)])];
    csvDownload(rows,'picspeak-gradebook-'+a.id+'.csv');
  }
  selectClass.addEventListener('change',()=>void loadAssignments());
  selectAssignment.addEventListener('change',()=>void loadGradebook());
  reload.addEventListener('click',()=>void loadClasses());
  csv.addEventListener('click',download);
}

function initialize(){
  if(document.getElementById('pswGlobalStyle'))return;
  const style=document.createElement('style');style.id='pswGlobalStyle';style.textContent=css;document.head.append(style);
  initAssignmentTabs();initGradebookTabs();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(initialize,0));
else setTimeout(initialize,0);
