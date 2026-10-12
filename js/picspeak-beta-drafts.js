import { getClient, demoRole } from './supabase.js';
import {bestAttempt,passByHistory,headline,breakdown,condition} from './picspeak-assessment.js';

/* PicSpeak LMS only. This module never touches Copeak assignments or submissions. */
document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const panel = $('picSpeakBetaPanel');
  const opener = $('openPicSpeakBeta');
  const closeButton = $('picSpeakBetaClose');
  if (!panel || !opener || !closeButton) return;

  const fields = {
    title: $('picSpeakBetaAssignmentTitle'), theme: $('picSpeakBetaTheme'),
    classId: $('picSpeakBetaClass'), level: $('picSpeakBetaLevel'),
    duration: $('picSpeakBetaDuration'), release: $('picSpeakBetaRelease'),
    due: $('picSpeakBetaDue'), published: $('picSpeakBetaPublished')
  };
  if (Object.values(fields).some(e => !e)) return;
  const PILOT = new URLSearchParams(location.search).has('picspeak_beta');
  const PIC_SPEAK_HOME = 'https://pic-speak-story.com/';
  const MODES = [
    ['snapshot','SNAPSHOT · 画像描写'], ['mosaic','MOSAIC · 50語'],
    ['detective','DETECTIVE · 間違い探し'], ['oralquest','ORAL QUEST'],
    ['story','STORY · Retelling'], ['picflash','PIC FLASH · 10問（英語）']
  ];
  const STORIES = [
    ['story1','スマホに夢中な一日'],['story2','勉強をサボった後悔'],
    ['story3','お弁当への感謝'],['story4','一人の行動から始まる奇跡'],
    ['story5','言葉の壁を越えて'],['story6','変わりゆく私たちの町'],
    ['story7','ファストファッションと環境問題']
  ];
  const FLASH = [
    ['animals_and_bugs','Animals & Bugs'],['sea_animals','Sea Animals'],
    ['fruits_and_vegetables','Fruits & Veggies'],['foods_drinks_and_tastes','Foods & Drinks'],
    ['colors_and_shapes','Colors & Shapes'],['body_parts_and_clothes','Body & Clothes'],
    ['jobs_and_people','Jobs & People'],['family_and_pronouns','Family'],
    ['school_subjects_and_stationery','School & Subjects'],['school_clubs_and_events','Clubs & Events'],
    ['sports_and_hobbies','Sports & Hobbies'],['places_town_and_countries','Places & Countries'],
    ['nature_weather_and_environment','Nature & Weather'],['daily_actions','Daily Actions'],
    ['feelings_and_adjectives','Feelings'],['time_events_and_misc','Time & Events']
  ];
  const ORALQUEST_IDS = ["001", "002", "003", "004", "005", "006", "007", "008", "009", "010", "011", "012", "013", "014", "015", "016", "017", "018", "019", "020"];
  const DETECTIVE_IDS = ["001", "002", "003", "004", "005", "006", "007", "008", "009", "010"];
  const MOSAIC_IDS = ["008", "011", "012", "014", "015", "016", "017", "018", "019", "021", "022", "023", "803", "804", "805", "806", "807", "808", "1001", "1002", "1003", "1004", "1005", "1006", "1007", "1008", "1009", "1010", "1011", "1012", "1013", "1014", "1015", "1016", "1017", "1018", "1019", "1021"];
  // Exact lesson IDs shipped with each distinct PicSpeak game (not SNAPSHOT IDs).
  const MODE_LESSONS = {
    mosaic: MOSAIC_IDS.map((n,i)=>['mosaic_'+n,'Secret '+(i+1)]),
    detective: DETECTIVE_IDS.map(n=>['detective_'+n,'Case '+n]),
    oralquest: ORALQUEST_IDS.map(n=>['oq_'+n,'Oral Quest '+n])
  };
  function specialImage(mode,id){
    const number=id.split('_')[1];
    const path=mode==='mosaic'?'mosaic/'+number+'.webp'
      :mode==='detective'?'detective/dete'+number+'.webp'
      :'oralquest/oq'+number+'.webp';
    return 'https://pic-speak-story.com/assets/images/'+path;
  }
  const section=document.createElement('section');
  section.className='psl-teacher-section';
  section.innerHTML=`
    <style>
      .psl-teacher-section{margin-top:18px;padding:16px;border:1px solid #bdd7f4;border-radius:14px;background:#fff;color:#1e293b}
      .psl-teacher-section h3{font-size:1.1rem;margin:0 0 10px}
      .psl-teacher-section .psl-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:12px 0}
      .psl-teacher-section label{font-size:12px;font-weight:700;display:grid;gap:4px}
      .psl-teacher-section select,.psl-teacher-section input{padding:8px;min-width:0;border:1px solid #cbd5e1;border-radius:8px;background:#fff}
      .psl-teacher-section button{border:0;border-radius:8px;padding:9px 13px;cursor:pointer;font-weight:700;background:#e5edf8;color:#17447d}
      .psl-teacher-section button.primary{background:#2463cf;color:#fff}
      .psl-teacher-section button.danger{background:#fce7e7;color:#9f1239}
      .psl-teacher-section button:disabled{opacity:.55}
      .psl-teacher-section .psl-actions{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0}
      .psl-teacher-section .psl-card{border:1px solid #e2e8f0;border-radius:9px;padding:11px;margin:7px 0;background:#f8fafc}
      .psl-teacher-section .psl-msg{min-height:20px;white-space:pre-wrap;font-size:13px}
      .psl-teacher-section .psl-muted{font-size:12px;color:#64748b}
      .psl-teacher-section .psl-table-scroll{max-width:100%;overflow:auto}
      .psl-teacher-section table{width:100%;border-collapse:collapse;min-width:520px;font-size:13px}
      .psl-teacher-section .psl-student-checks{max-height:210px;overflow-y:auto;border:1px solid #cbd5e1;border-radius:9px;padding:5px;background:#fff}
      .psl-teacher-section .psl-student-checks label{display:flex;align-items:center;gap:9px;font-size:13px;cursor:pointer;padding:7px 8px;font-weight:500}
      .psl-teacher-section .psl-student-checks label:hover{background:#eff6ff}
      .psl-teacher-section .psl-student-checks input{min-width:16px;width:16px;height:16px}
      .psl-teacher-section td,.psl-teacher-section th{padding:8px;text-align:left;border-bottom:1px solid #e2e8f0}
      @media(max-width:700px){.psl-teacher-section .psl-grid{grid-template-columns:1fr}}
    </style>
    <h3>PicSpeak β · 課題配布と成績</h3>
    <p class="psl-muted">PicSpeakの課題・成績はCopeakの音読とは完全に別管理です。<strong>ブラウザ生成スコア（未検証）</strong>のため、正式な試験成績への自動採用には適しません。</p>
    <div class="psl-grid">
      <label>練習モード <select id="pslMode"></select></label>
      <label>合格ライン（%） <input id="pslPassPercent" type="number" min="0" max="100" step="1" value="70"></label>
      <label>PIC FLASH合格タイム（秒） <input id="pslPassSeconds" type="number" min="1" max="1800" step="1" value="90"></label>
    </div>
    <p class="psl-muted" id="pslModeHint"></p>
    <div class="psl-grid" style="grid-template-columns:minmax(170px,1fr) minmax(250px,2fr)">
      <label>配布対象 <select id="pslAudience"><option value="targeted">生徒を指定（推奨）</option><option value="class">クラス全員</option></select></label>
      <div id="pslRecipientsWrap">
        <label>生徒を検索 <input id="pslStudentFilter" type="search" placeholder="例：Test" autocomplete="off"></label>
        <div id="pslRecipientList" class="psl-student-checks" aria-label="配布する生徒を選択">クラスを選択してください。</div>
        <p id="pslRecipientStatus" class="psl-muted" role="status"></p>
      </div>
    </div>
    <p class="psl-muted">※ 配布先は保存時に確定します。「クラス全員」を選んだ場合は公開前に追加確認します。</p>
    <div class="psl-actions">
      <button type="button" class="primary" id="pslSave">💾 課題を保存</button>
      <button type="button" id="pslNew">＋ 新規課題</button>
      <button type="button" id="pslReload">一覧を更新</button>
    </div>
    <p class="psl-msg" id="pslMessage" role="status"></p>
    <h3>PicSpeak 課題一覧</h3>
    <div id="pslList"></div>
    <div id="pslGradebook" hidden>
      <h3>成績一覧 <span id="pslGradeTitle"></span></h3>
      <div class="psl-actions"><button id="pslExport" type="button">CSVダウンロード</button><button id="pslCloseGrades" type="button">閉じる</button></div>
      <div class="psl-table-scroll"><table><thead><tr><th>生徒</th><th>練習回数</th><th>最高達成率 / 最速タイム</th><th>累計発話単語数</th><th>WPM</th><th>合格</th></tr></thead><tbody id="pslGradesBody"></tbody></table></div>
    </div>
  `;
  closeButton.parentElement.insertAdjacentElement('beforebegin',section);
  const el=id=>section.querySelector('#'+id);
  const modeEl=el('pslMode');
  MODES.forEach(([value,label])=>modeEl.add(new Option(label,value)));
  let pictureOptions=[];
  let editing=null, opened=false, busy=false, currentGradeRows=[], activeGrade=null;
  let drafts=[];
  let targetsByAssignment=new Map();
  let recipientClassId=null;
  let recipientGeneration=0;
  const audienceEl=el('pslAudience');
  const recipientBox=el('pslRecipientList');
  const recipientStatus=el('pslRecipientStatus');
  const recipientsWrap=el('pslRecipientsWrap');
  const recipientFilter=el('pslStudentFilter');
  const selectedRecipientIds=()=>Array.from(recipientBox.querySelectorAll('input[type="checkbox"]:checked')).map(c=>c.value).sort();
  const sortedIds=ids=>[...ids].sort().join(',');
  audienceEl.addEventListener('change',()=>{recipientsWrap.hidden=audienceEl.value!=='targeted';});
  recipientFilter.addEventListener('input',()=>{
    const term=recipientFilter.value.trim().toLowerCase();
    for(const label of recipientBox.querySelectorAll('label'))label.hidden=!label.textContent.toLowerCase().includes(term);
  });
  const oldReview=$('picSpeakBetaReview');
  const status=(txt,bad=false)=>{el('pslMessage').style.color=bad?'#b91c1c':'#166534';el('pslMessage').textContent=txt;};
  const permittedUUID=x=>/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(x||'');
  const client=()=>{
    if(demoRole()) throw Error('デモでは保存できません。承認済みの先生アカウントでログインしてください。');
    const expected='sxcbudhcxiblpdzpgfep.supabase.co';
    if(new URL(window.COPEAK_CONFIG?.supabaseUrl||'https://invalid.invalid').hostname!==expected)
      throw Error('PicSpeak βの接続先が指定のClassroomと異なります。');
    const sb=getClient('teacher');if(!sb) throw Error('ログインが必要です。');return sb;
  };
  async function loadRecipients(classId, selectedIds=null){
    const generation=++recipientGeneration;
    const previouslySelected=recipientClassId===classId?selectedRecipientIds():[];
    recipientClassId=null;
    recipientBox.textContent='生徒一覧を読み込んでいます…';
    recipientStatus.textContent='';
    if(!permittedUUID(classId)){
      recipientBox.textContent='配布先クラスを選択してください。';return;
    }
    const sb=client();
    const {data:members,error}=await sb.from('class_members')
      .select('student_id').eq('class_id',classId).limit(1000);
    if(error)throw error;
    const ids=[...new Set((members||[]).map(m=>m.student_id).filter(permittedUUID))];
    let profiles=[];
    for(let i=0;i<ids.length;i+=100){
      const {data,error:pe}=await sb.from('profiles')
        .select('id,display_name').in('id',ids.slice(i,i+100));
      if(pe)throw pe;
      profiles.push(...(data||[]));
    }
    const nameById=new Map(profiles.map(p=>[p.id,p.display_name||'生徒']));
    // Roster labels, when readable, distinguish duplicate display names.
    const {data:roster}=await sb.from('class_roster')
      .select('linked_student_id,display_name,student_number')
      .eq('class_id',classId).limit(1000);
    for(const r of roster||[]){
      if(ids.includes(r.linked_student_id)){
        nameById.set(r.linked_student_id,(r.display_name||nameById.get(r.linked_student_id)||'生徒')+
          (r.student_number?'（'+r.student_number+'）':''));
      }
    }
    if(generation!==recipientGeneration || fields.classId.value!==classId)return;
    const keep=new Set(selectedIds||previouslySelected);
    recipientBox.replaceChildren();
    ids.sort((a,b)=>(nameById.get(a)||a).localeCompare(nameById.get(b)||b,'ja'));
    for(const id of ids){
      const label=document.createElement('label');
      const cb=document.createElement('input');
      cb.type='checkbox';cb.value=id;cb.checked=keep.has(id);
      const span=document.createElement('span');span.textContent=nameById.get(id)||id;
      label.append(cb,span);recipientBox.append(label);
    }
    recipientClassId=classId;
    if(!ids.length)recipientBox.textContent='このクラスにはログイン済みの生徒がいません。';
    recipientStatus.textContent=ids.length+'名の登録済み生徒から配布先を選べます。';
  }
  fields.classId.addEventListener('change',()=>{
    recipientFilter.value='';
    void loadRecipients(fields.classId.value).catch(e=>status('生徒名簿の読込に失敗: '+e.message,true));
  });
  const fmtLocal=s=>{
    const d=new Date(s),offset=d.getTimezoneOffset()*60000;
    return new Date(d.getTime()-offset).toISOString().slice(0,16);
  };
  const getOptions=()=>Array.from(fields.theme.options).filter(o=>o.value).map(o=>[o.value,o.textContent]);
  const applyMode=()=>{
    const mode=modeEl.value;
    const options=mode==='snapshot'?pictureOptions
      :mode==='story'?STORIES
      :mode==='picflash'?FLASH
      :MODE_LESSONS[mode];
    if(options?.length){
      const prev=fields.theme.value;
      fields.theme.replaceChildren(...options.map(([v,t])=>new Option(t,v)));
      if(options.some(([v])=>v===prev)) fields.theme.value=prev;
    }
    fields.theme.dispatchEvent(new Event('change'));
    if(MODE_LESSONS[mode]){
      const image=$('picSpeakBetaImage');
      if(image){image.src=specialImage(mode,fields.theme.value);image.hidden=false;}
    }
    el('pslModeHint').textContent= mode==='picflash'
      ? 'PIC FLASHは英語・10問のタイムアタックです。タイムが小さいほど良い成績です。'
      : mode==='story' ? 'STORYはRetellingの到達率を記録します。'
      : '画像教材を選択します。合格判定はCompletionの到達率（%）を用います。';
    el('pslPassPercent').disabled=mode==='picflash';
    el('pslPassSeconds').disabled=mode!=='picflash';
  };
  modeEl.addEventListener('change',applyMode);
  // Original catalog is filled asynchronously by the existing beta teacher module.
  const observer=new MutationObserver(()=>{
    if(modeEl.value==='snapshot' && fields.theme.options.length>10 && !Array.from(fields.theme.options).some(o=>o.value.startsWith('mosaic_')||o.value.startsWith('oq_')||o.value.startsWith('detective_'))){pictureOptions=getOptions();}
  });
  observer.observe(fields.theme,{childList:true});
  pictureOptions=getOptions();
  applyMode();
  fields.theme.addEventListener('change',()=>{
    if(!MODE_LESSONS[modeEl.value]||!fields.theme.value)return;
    const image=$('picSpeakBetaImage');
    if(image){image.src=specialImage(modeEl.value,fields.theme.value);image.hidden=false;}
  });
  const payload=()=>{
    const title=fields.title.value.trim(),class_id=fields.classId.value;
    const theme_id=fields.theme.value,mode=modeEl.value;
    const t1=new Date(fields.release.value),t2=new Date(fields.due.value);
    const time_limit=Number(fields.duration.value),level=fields.level.value;
    const pass_percent=Number(el('pslPassPercent').value),pass_seconds=Number(el('pslPassSeconds').value);
    const pass_correct=Number(document.getElementById('pslPassCorrect')?.value??8);
    const pass_reading_percent=Number(document.getElementById('pslPassReading')?.value??70);
    const pass_picture_percent=Number(document.getElementById('pslPassPicture')?.value??70);
    const pass_qa_rating=Number(document.getElementById('pslPassQA')?.value??1);
    if(!title||title.length>200)throw Error('課題名を1〜200文字で入力してください。');
    if(!permittedUUID(class_id)||fields.classId.disabled)throw Error('配布先クラスを選択してください。');
    if(!MODES.some(([m])=>m===mode))throw Error('練習モードが不正です。');
    const valid=mode==='snapshot'?/^(?:[0-9]{3}|theme_l2_[0-9]{3})$/.test(theme_id)
      :mode==='story'?/^story[1-9][0-9]*$/.test(theme_id)
      :mode==='picflash'?FLASH.some(([id])=>id===theme_id)
      :MODE_LESSONS[mode]?.some(([id])=>id===theme_id);
    if(!valid)throw Error('このモードの教材を選択してください。');
    if(!['elementary','junior_high','high_school'].includes(level))throw Error('レベルを選択してください。');
    if(![30,45,60].includes(time_limit))throw Error('制限時間が不正です。');
    if(!Number.isFinite(t1.getTime())||!Number.isFinite(t2.getTime())||t2<=t1)throw Error('公開と締切の日時を確認してください。');
    if(!(pass_percent>=0&&pass_percent<=100&&pass_seconds>=1&&pass_seconds<=1800))throw Error('合格ラインが不正です。');
    if(!['targeted','class'].includes(audienceEl.value))throw Error('配布対象を選んでください。');
    if(!Number.isInteger(pass_correct)||pass_correct<1||pass_correct>10||pass_reading_percent<0||pass_reading_percent>100||pass_picture_percent<0||pass_picture_percent>100||![1,2].includes(pass_qa_rating))throw Error('モード別の合格条件を確認してください。');
    return {title,class_id,theme_id,mode,level,time_limit,pass_percent,pass_seconds,pass_correct,pass_reading_percent,pass_picture_percent,pass_qa_rating,
      audience_type:audienceEl.value,release_at:t1.toISOString(),due_at:t2.toISOString()};
  };
  const runBusy=async task=>{if(busy)return;busy=true;el('pslSave').disabled=true;
    try{await task();}catch(e){status('エラー: '+(e.message||String(e)),true);}finally{busy=false;el('pslSave').disabled=false;}
  };
  const openEdit=async item=>{
    if(!Array.from(fields.classId.options).some(o=>o.value===item.class_id)) {status('先にクラスの読込を完了してください。',true);return;}
    editing={id:item.id,class_id:item.class_id,audience_type:item.audience_type||'targeted',
      student_ids:targetsByAssignment.get(item.id)||[],is_published:item.is_published};
    modeEl.value=item.mode||'snapshot';applyMode();
    if(!Array.from(fields.theme.options).some(o=>o.value===item.theme_id)) {status('教材が見つかりません。教材一覧の読込を確認してください。',true);return;}
    fields.title.value=item.title;fields.title.dataset.manuallyEdited='1';
    fields.theme.value=item.theme_id;fields.classId.value=item.class_id;
    audienceEl.value=item.audience_type||'targeted';
    recipientsWrap.hidden=audienceEl.value!=='targeted';
    recipientFilter.value='';
    const targets=targetsByAssignment.get(item.id)||[];
    await loadRecipients(item.class_id,targets);
    fields.level.value=item.level;fields.duration.value=String(item.time_limit);
    fields.release.value=fmtLocal(item.release_at);fields.due.value=fmtLocal(item.due_at);
    fields.theme.dispatchEvent(new Event('change'));
    el('pslPassPercent').value=item.pass_percent??70;
    el('pslPassSeconds').value=item.pass_seconds??90;
    for(const [id,value] of [['pslPassCorrect',item.pass_correct??8],['pslPassReading',item.pass_reading_percent??70],['pslPassPicture',item.pass_picture_percent??70],['pslPassQA',item.pass_qa_rating??1]]){const field=document.getElementById(id);if(field)field.value=value;}
    modeEl.dispatchEvent(new Event('change'));
    fields.published.checked=Boolean(item.is_published);
    el('pslSave').textContent='💾 変更を保存';status('編集中: '+item.title);
    panel.scrollIntoView({behavior:'smooth'});
  };
  const clear=()=>{
    editing=null;fields.title.value='';fields.title.dataset.manuallyEdited='0';
    fields.published.checked=false;modeEl.value='snapshot';applyMode();
    audienceEl.value='targeted';recipientsWrap.hidden=false;
    recipientFilter.value='';
    for(const cb of recipientBox.querySelectorAll('input[type="checkbox"]'))cb.checked=false;
    el('pslSave').textContent='💾 課題を保存';status('新規課題を作成できます。');
  };
  const refresh=async()=>{
    if(!opened)return;
    const box=el('pslList');box.replaceChildren(document.createTextNode('読込中…'));
    const {data,error}=await client().from('picspeak_assignments').select('id,class_id,title,theme_id,mode,level,time_limit,pass_percent,pass_seconds,pass_correct,pass_reading_percent,pass_picture_percent,pass_qa_rating,release_at,due_at,is_published,created_at,audience_type').order('created_at',{ascending:false}).limit(250);
    if(error)throw error;drafts=data||[];box.replaceChildren();
    targetsByAssignment=new Map();
    if(drafts.length){
      const {data:targets,error:te}=await client().from('picspeak_assignment_targets')
        .select('assignment_id,student_id').in('assignment_id',drafts.map(a=>a.id)).limit(5000);
      if(te)throw te;
      for(const t of targets||[]){const ids=targetsByAssignment.get(t.assignment_id)||[];
        ids.push(t.student_id);targetsByAssignment.set(t.assignment_id,ids);}
    }
    if(!drafts.length){box.textContent='PicSpeakの課題はまだありません。';return;}
    drafts.forEach(a=>{
      const card=document.createElement('div');card.className='psl-card';
      const strong=document.createElement('strong');strong.textContent=a.title;
      const details=document.createElement('p');details.className='psl-muted';
      details.textContent=[a.mode||'snapshot',a.theme_id,a.level,a.time_limit+'秒',
        a.audience_type==='class'?'クラス全員':'個別：'+(targetsByAssignment.get(a.id)||[]).length+'名',
        a.is_published?'公開':'下書き','締切: '+new Date(a.due_at).toLocaleString('ja-JP')].join(' / ');
      const actions=document.createElement('div');actions.className='psl-actions';
      function btn(label,cb,kind=''){const b=document.createElement('button');b.type='button';b.textContent=label;b.className=kind;b.addEventListener('click',()=>void runBusy(cb));actions.append(b);}
      btn('編集',async()=>{await openEdit(a);});
      btn(a.is_published?'非公開に戻す':'公開する',async()=>{
        const phrase=a.is_published?'この課題を非公開に戻しますか？':'この課題を生徒に公開しますか？';
        if(!confirm(phrase+'\n'+a.title))return;
        if(!a.is_published&&new Date(a.due_at)<=new Date())throw Error('締切を未来に変更してから公開してください。');
        if(!a.is_published && a.audience_type!=='class' && !(targetsByAssignment.get(a.id)||[]).length)
          throw Error('公開前に生徒を指定してください。');
        if(!a.is_published && a.audience_type==='class'
          && !confirm('【再確認】クラス全員に表示されます。個別テストでは使わないでください。全員に公開しますか？'))return;
        const {data,error}=await client().from('picspeak_assignments').update({is_published:!a.is_published}).eq('id',a.id).select('id').single();
        if(error)throw error;if(!data)throw Error('更新を確認できません。');
        status(a.is_published?'非公開に戻しました。':'生徒への公開を設定しました。');await refresh();
      });
      btn('成績を見る',async()=>{await showGrades(a);});
      btn('削除',async()=>{
        if(!confirm('このPicSpeak課題と関連する成績を削除しますか？\n'+a.title))return;
        const {data,error}=await client().from('picspeak_assignments').delete().eq('id',a.id).select('id');
        if(error)throw error;if(data?.length!==1)throw Error('削除を確認できません。');
        if(editing?.id===a.id)clear();status('課題を削除しました。');await refresh();
      },'danger');
      card.append(strong,details,actions);box.append(card);
    });
  };
  const showGrades=async a=>{
    activeGrade=a;
    const sb=client();
    // RLS limits both requests to the teacher's own classes.
    const [{data:members,error:merr},{data:attempts,error:aerr}]=await Promise.all([
      sb.from('class_members').select('student_id').eq('class_id',a.class_id).limit(2000),
      sb.from('picspeak_attempts').select('student_id,score_percent,completion_percent,word_count,wpm,duration_seconds,recorded_at').eq('assignment_id',a.id).order('recorded_at',{ascending:false}).limit(5000)
    ]);
    if(merr)throw merr;if(aerr)throw aerr;
    const allIds=[...new Set((members||[]).map(x=>x.student_id))];
    const ids=a.audience_type==='class'?allIds:
      allIds.filter(id=>(targetsByAssignment.get(a.id)||[]).includes(id));
    let names=[];
    for(let start=0;start<ids.length;start+=100){const {data,error}=await sb.from('profiles').select('id,display_name').in('id',ids.slice(start,start+100));if(error)throw error;names.push(...(data||[]));}
    const nameById=new Map(names.map(p=>[p.id,p.display_name||p.id]));
    const grouped=new Map();
    for(const id of ids)grouped.set(id,[]);
    for(const attempt of attempts||[]) if(grouped.has(attempt.student_id))grouped.get(attempt.student_id).push(attempt);
    currentGradeRows=ids.map(id=>{
      const rows=grouped.get(id),completionValue=r=>r.completion_percent??r.score_percent;
       const best=a.mode==='picflash'
        ? rows.filter(r=>r.duration_seconds!=null).sort((x,y)=>x.duration_seconds-y.duration_seconds)[0]
        : rows.filter(r=>completionValue(r)!=null).sort((x,y)=>Number(completionValue(y))-Number(completionValue(x)))[0];
      const pass=rows.some(x=>a.mode==='picflash'?(x.duration_seconds!=null&&x.duration_seconds<=a.pass_seconds):(completionValue(x)!=null&&Number(completionValue(x))>=a.pass_percent));
      return {student_id:id,name:nameById.get(id)||id,attempts:rows.length,
        best:best?(a.mode==='picflash'?Number(best.duration_seconds):Number(completionValue(best))):null,
        words:a.mode==='picflash'||!rows.some(r=>r.word_count!=null)?null:rows.reduce((n,r)=>n+Math.max(0,Number(r.word_count)||0),0),wpm:a.mode==='picflash'?null:(best?.wpm??null),pass};
    });
    const tbody=el('pslGradesBody');tbody.replaceChildren();
    const th=val=>{const td=document.createElement('td');td.textContent=String(val??'—');return td;};
    for(const row of currentGradeRows){const tr=document.createElement('tr');
      tr.append(th(row.name),th(row.attempts+'回'),th(row.best==null?'—':row.best+(a.mode==='picflash'?'秒':'%')),
        th(row.words==null?'—':row.words+'語'),th(row.wpm),th(row.pass?'合格':'未達成'));
      tbody.append(tr);}
    el('pslGradeTitle').textContent=a.title+'（'+currentGradeRows.length+'名）';
    el('pslGradebook').hidden=false;el('pslGradebook').scrollIntoView({behavior:'smooth'});
  };
  const csvEscape=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const exportCSV=()=>{
    if(!activeGrade)return;
    const headers=['生徒ID','氏名','練習回数','最高達成率 (%) / PIC FLASH最速(秒)','累計発話単語数 (語)','WPM','合格'];
    const data=[headers,...currentGradeRows.map(x=>[x.student_id,x.name,x.attempts,x.best,x.words,x.wpm,x.pass?'合格':'未達成'])];
    const contents='\ufeff'+data.map(row=>row.map(csvEscape).join(',')).join('\r\n');
    const blob=new Blob([contents],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='picspeak-results-'+activeGrade.id+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  el('pslSave').addEventListener('click',()=>void runBusy(async()=>{
    const value=payload();
    if(editing&&value.class_id!==editing.class_id)throw Error('編集中は配布先クラスを変更できません。');
    if(value.audience_type==='targeted' && recipientClassId!==value.class_id)
      throw Error('対象クラスの生徒一覧を読み込んでください。');
    const selected=value.audience_type==='targeted'?selectedRecipientIds():[];
    if(value.audience_type==='targeted'&&!selected.length)
      throw Error('個別配布では生徒を1名以上選んでください。');
    const changed=editing&&(value.audience_type!==editing.audience_type||
      (value.audience_type==='targeted'&&sortedIds(selected)!==sortedIds(editing.student_ids||[])));
    if(editing?.is_published && changed)
      throw Error('公開中の配布先は変更できません。先に非公開に戻してください。');
    const query=editing?client().from('picspeak_assignments').update(value).eq('id',editing.id)
      :client().from('picspeak_assignments').insert({...value,is_published:false});
    const {data,error}=await query.select('id').single();if(error)throw error;
    if(!editing?.is_published){
      const {error:recError}=await client().rpc('picspeak_set_assignment_recipients',{
        p_assignment_id:data.id,p_audience_type:value.audience_type,p_student_ids:selected
      });
      if(recError)throw Error('課題は下書き保存されましたが、配布先の保存に失敗: '+recError.message);
    }
    editing={id:data.id,class_id:value.class_id,audience_type:value.audience_type,
      student_ids:selected,is_published:Boolean(editing?.is_published)};
    el('pslSave').textContent='💾 変更を保存';
    status('課題と配布先を保存しました。公開は課題一覧から操作できます。');await refresh();
  }));
  el('pslNew').addEventListener('click',clear);
  el('pslReload').addEventListener('click',()=>void runBusy(refresh));
  el('pslExport').addEventListener('click',exportCSV);
  el('pslCloseGrades').addEventListener('click',()=>{el('pslGradebook').hidden=true;});
  opener.addEventListener('click',()=>{
    opened=true;
    // Preserve compatibility with the existing class dropdown and catalog loaders.
    window.setTimeout(()=>{
      void runBusy(async()=>{await refresh();await loadRecipients(fields.classId.value);});
    },450);
  });
  // Old review area and checkbox stay as preview-only; publication is deliberate via the task list.
  if(oldReview)oldReview.insertAdjacentText('beforebegin','\n公開操作は下の PicSpeak β 課題一覧から行います。');
  fields.published.checked=false;fields.published.disabled=true;
  if(!PILOT){
    // Don't expose production LMS's student area until the full acceptance test.
    const note=document.createElement('p');note.className='psl-muted';
    note.textContent='β準備中：正式導入前に、公開先と成績の動作を一括確認してください。';
    section.prepend(note);
  }
});
