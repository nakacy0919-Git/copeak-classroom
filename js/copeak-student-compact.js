/* Copeak Classroom — Student Dashboard v3.2 / 2026-10-13
 * Presentation-only layer. Reads existing access-controlled Copeak/PicSpeak cards.
 * Score calculation, launch, filtering permissions and database writes are unchanged.
 */
(() => {
  'use strict';
  if (window.__csoV3Loaded) return;
  window.__csoV3Loaded = true;
  const scriptUrl = document.currentScript?.src || new URL('js/copeak-student-compact.js', location.href).href;
  const cssUrl = new URL('../css/copeak-student-dashboard-v3.css?v=20261117-card-design', scriptUrl);
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = cssUrl.href;
  link.id = 'csoV3Styles';
  document.head.append(link);
  const ruleStyle=makeRuleStyle();
  document.head.append(ruleStyle);
  function makeRuleStyle(){
    const style=document.createElement('style');
    style.textContent='#csoBoard .cso-pass-rule,#csoModal .cso-pass-rule{display:grid;gap:4px;margin:7px 0 9px;padding:8px 10px;border:1px solid #eedcc1;border-radius:10px;background:#fffbf2;color:#63451d;font-size:11px;line-height:1.45;white-space:normal;overflow-wrap:anywhere;text-align:left}#csoBoard .cso-pass-rule.is-passed,#csoModal .cso-pass-rule.is-passed{background:#f0faf3;border-color:#c7e3d0;color:#23543c}#csoBoard .cso-pass-rule strong,#csoModal .cso-pass-rule strong{font-size:12px;font-weight:800}#csoBoard .cso-pass-rule span,#csoModal .cso-pass-rule span{font-weight:650}#csoModal .cso-pass-rule{font-size:14px;padding:12px;margin-top:12px}#csoModal .cso-pass-rule strong{font-size:15px}#csoModal .cso-criteria .student-pass-guide{display:block!important;visibility:visible!important;font-size:13px;line-height:1.6;white-space:normal;color:#43564f}';
    return style;
  }

  const ICONS = {
    book: '<path d="M12 6.2c-2.6-2-5.9-2.3-9-1.3v13.5c3.3-1.2 6.5-.7 9 1.2m0-13.4c2.6-2 5.9-2.3 9-1.3v13.5c-3.3-1.2-6.5-.7-9 1.2m0-13.4v13.4"/>',
    photo: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.7" cy="9" r="1.5"/><path d="m4 17 5.3-5 3.6 3 3-3 5 5"/>',
    film: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 3v18M3 12h18"/>',
    search: '<circle cx="10.7" cy="10.7" r="6.2"/><path d="m16 16 5 5"/>',
    tiles: '<rect x="3" y="3" width="7" height="7" rx="1.3"/><rect x="14" y="3" width="7" height="7" rx="1.3"/><rect x="3" y="14" width="7" height="7" rx="1.3"/><rect x="14" y="14" width="7" height="7" rx="1.3"/>',
    microphone: '<rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M6 11.5a6 6 0 0 0 12 0M12 17.5v4m-4 0h8"/>',
    bolt: '<path d="m13.5 2-9 11h7l-1 9 9-12h-7z"/>',
    crown: '<path d="m3 8 4 4 5-7 5 7 4-4-2 11H5z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="2"/>',
    check: '<path d="m5 12 5 5L20 7"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
    alert: '<path d="M10.3 4 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0ZM12 9v4m0 4h.01"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    layers: '<path d="m12 3-9 5 9 5 9-5-9-5Zm-9 10 9 5 9-5m-18 5 9 5 9-5"/>',
    sparkles: '<path d="m12 2 1.4 5.6L19 9l-5.6 1.4L12 16l-1.4-5.6L5 9l5.6-1.4L12 2Zm6 13 .8 2.3L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.7L18 15Z"/>',
    x: '<path d="M5 5 19 19M19 5 5 19"/>'
  };
  const NAMES = {SNAPSHOT:'SNAPSHOT',MOSAIC:'MOSAIC',DETECTIVE:'DETECTIVE',ORALQUEST:'ORAL QUEST',STORY:'STORY',PICFLASH:'PIC FLASH'};
  const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);return el;};
  const icon=(name,size=20)=>{const wrap=make('span','cso-icon');wrap.setAttribute('aria-hidden','true');wrap.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]||ICONS.book}</svg>`;return wrap;};
  const num=(t)=>{const n=Number(t);return t!==''&&t!=null&&Number.isFinite(n)?n:null;};
  const clean=(s)=>String(s||'').replace(/\s+/g,' ').trim();
  const standardStatus=(row)=>row.done?'完了':row.upcoming?'公開前':row.overdue?'締切終了':/練習中|あと少し/.test(row.status)?'練習中':clean(row.status)||'未完了';
  const label=(row)=>row.type==='copeak'?'Copeak · 音読':'PicSpeak · '+(NAMES[row.mode?.replace(/\s/g,'')]||row.mode||'画像描写');
  const glyph=(row)=>row.type==='copeak'?'book':({SNAPSHOT:'photo',MOSAIC:'tiles',DETECTIVE:'search',ORALQUEST:'microphone',STORY:'film',PICFLASH:'bolt'})[row.mode?.replace(/\s/g,'')]||'photo';
  const main={status:'todo',source:'all',page:0,selected:null,items:[],modal:false,activeTrigger:null,prevOverflow:'',focusKey:null};
  let root,grid,nav,mini,stats,healthPanel,healthStatus,footer,dialog,dialogContent,dialogTitle,dialogType,dialogClose,dialogCTA,dialogNote,rankingTarget,readingList,picList,rankObserver;
  let observer,pending=false;
  const readingId=(card)=>card.querySelector('.start-btn')?.dataset.id;
  const identities=new WeakMap();let identityCounter=0;
  const stableKey=(element,prefix)=>{if(!identities.has(element))identities.set(element,prefix+':'+(++identityCounter));return identities.get(element);};
  function sourceRows(){
    const rows=[];
    readingList.querySelectorAll('.student-assignment-card').forEach((card,i)=>{
      const key=card.dataset.status||'';
      const status=clean(card.querySelector('.student-status-badge')?.textContent)||'未完了';
      const rank=card.querySelector('.student-assignment-rank-mini');
      const pct=card.querySelector('.student-pass-panel');
      rows.push({key:'c:'+(readingId(card)||i),type:'copeak',title:clean(card.querySelector('.assignment-title')?.textContent)||'Copeak課題',status,
        done:key==='done'||(!key&&/提出済み|完了|合格/.test(status)),upcoming:key==='upcoming'||/公開前/.test(status),overdue:key==='late'||/締切済み|締切終了/.test(status),
        assignmentNo:clean(card.dataset.assignmentNumber),assignmentLabel:clean(card.dataset.assignmentLabel),dueMs:num(card.dataset.dueMs),releaseMs:num(card.dataset.releaseMs),deadlineDate:clean(card.dataset.deadlineDate),source:card,rank,pct,acc:card.dataset.csoAccuracy||'',wpm:card.dataset.csoWpm||'',performance:card.dataset.csoPerformance||'',reads:card.dataset.csoReads||'0',latestAcc:card.dataset.csoLatestAccuracy||'',latestWpm:card.dataset.csoLatestWpm||'',deadline:clean(card.querySelector('.student-deadline-inline')?.textContent)||''});
    });
    picList?.querySelectorAll('.psl-card').forEach((card,i)=>{
      const status=clean(card.querySelector('.psl-chip')?.textContent)||'未完了';
      const subtitle=clean(card.querySelector('.psl-subtitle')?.textContent)||'';
      const mode=clean(subtitle.split(/[•·]/)[0]).toUpperCase();
      rows.push({key:card.dataset.csoAssignmentId?('p:'+card.dataset.csoAssignmentId):stableKey(card,'p'),type:'picspeak',title:clean(card.querySelector('h3')?.textContent)||'PicSpeak課題',mode,subtitle,status,
        done:/合格/.test(status),upcoming:/公開前/.test(status),overdue:/締切済み|締切終了/.test(status),source:card,
        headline:clean(card.querySelector('.psl-scores strong')?.textContent)});
    });
    return rows;
  }
  function liftRank(){
    const existing=document.getElementById('studentReadingRankCard');
    if(existing&&rankingTarget&&existing.parentElement!==rankingTarget){rankingTarget.append(existing);rankObserver?.disconnect();rankObserver=null;}
  }
  function build(){
    readingList=document.getElementById('assignmentList');
    const top=document.querySelector('.student-progress-hero');
    if(!readingList||!top)return false;
    root=make('section','cso-dashboard');root.id='csoBoard';root.setAttribute('aria-label','Copeak Classroom 学習ダッシュボード');
    const heading=make('header','cso-pagehead');
    const identity=make('div','cso-identity');identity.append(make('span','cso-overline','COPEAK CLASSROOM'),make('h1','','My Learning'));
    healthStatus=make('div','cso-health-signal');healthStatus.setAttribute('role','status');healthStatus.setAttribute('aria-live','polite');
    heading.append(identity,healthStatus);root.append(heading);
    healthPanel=make('section','cso-health-panel');healthPanel.setAttribute('aria-label','Copeakの課題達成状況');root.append(healthPanel);
    stats=make('div','cso-stats cso-health-scorestrip');root.append(stats);
    mini=make('div','cso-rankmini');root.append(mini);
    const taskTop=make('div','cso-task-head');const title=make('div');title.append(make('span','cso-overline','YOUR ASSIGNMENTS'),make('h2','','課題一覧'));const controls=make('div','cso-controls');nav=make('div','cso-tabs');nav.setAttribute('role','group');nav.setAttribute('aria-label','課題の絞り込み');
    for(const [id,text] of [['todo','未完了'],['done','完了'],['all','すべて']]){const b=make('button','cso-tab',text);b.type='button';b.dataset.status=id;b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>{main.status=id;main.page=0;render();});nav.append(b);}
    const source=make('select','cso-source-select');source.setAttribute('aria-label','課題の種類');for(const [id,text] of [['all','すべての種類'],['copeak','Copeak 音読'],['picspeak','PicSpeak 画像描写']]){const o=make('option','',text);o.value=id;source.append(o);}source.addEventListener('change',()=>{main.source=source.value;main.page=0;render();});source.id='csoSourceSelect';
    controls.append(nav,source);taskTop.append(title,controls);root.append(taskTop);
    const statusline=make('div','cso-statusline');statusline.id='csoStatusLine';statusline.setAttribute('role','status');root.append(statusline);
    grid=make('div','cso-grid');root.append(grid);
    footer=make('div','cso-footer');root.append(footer);
    root.insertAdjacentElement('beforeend',make('div','cso-layout-watermark','')); // no visible decoration; reserved for layout
    top.insertAdjacentElement('beforebegin',root);
    const layer=make('div','cso-modal');layer.id='csoModal';layer.hidden=true;layer.setAttribute('aria-hidden','true');
    dialog=make('section','cso-dialog');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','csoDialogTitle');
    const modalTop=make('div','cso-modal-top');const left=make('div');dialogType=make('div','cso-modaltype');dialogTitle=make('h2','cso-dialogtitle');dialogTitle.id='csoDialogTitle';left.append(dialogType,dialogTitle);dialogClose=make('button','cso-close');dialogClose.type='button';dialogClose.setAttribute('aria-label','閉じる');dialogClose.append(icon('x',22));dialogClose.addEventListener('click',closeModal);modalTop.append(left,dialogClose);dialog.append(modalTop);
    dialogContent=make('div','cso-modalcontent');dialog.append(dialogContent);
    const actions=make('div','cso-modalactions');dialogNote=make('span','cso-launch-note','課題へ進みます');dialogCTA=make('button','cso-primary');dialogCTA.type='button';dialogCTA.append(icon('arrow',22),make('span','','学習を始める'));actions.append(dialogNote,dialogCTA);dialog.append(actions);
    dialogCTA.addEventListener('click',()=>{
      const item=main.items.find(v=>v.key===main.selected);const start=item?.source?.querySelector('.start-btn,.psl-challenge');
      if(!start||start.disabled)return;
      start.click();closeModal();
    });
    layer.append(dialog);document.body.append(layer);layer.addEventListener('click',e=>{if(e.target===layer)closeModal();});
    layer.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();closeModal();return;}
      if(e.key!=='Tab')return;
      const nodes=[...dialog.querySelectorAll('button:not(:disabled),select:not(:disabled),a[href],input:not(:disabled),[tabindex]:not([tabindex="-1"])')].filter(n=>n.getClientRects().length);
      if(!nodes.length)return;
      if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes[nodes.length-1].focus();}
      else if(!e.shiftKey&&document.activeElement===nodes[nodes.length-1]){e.preventDefault();nodes[0].focus();}
    });
    document.body.classList.add('cso-v3');
    liftRank();
    if(!document.getElementById('studentReadingRankCard')){
      rankObserver=new MutationObserver(liftRank);rankObserver.observe(document.querySelector('#mainApp')||document.body,{childList:true,subtree:true});
    }
    return true;
  }
  function metricBox(glyphName,caption,value,sub){
    const el=make('div','cso-metric');const circle=make('span','cso-metric-icon');circle.append(icon(glyphName,22));const copy=make('div','cso-metric-text');copy.append(make('span','cso-metric-caption',caption),make('strong','cso-metric-value',value));if(sub)copy.append(make('span','cso-metric-sub',sub));el.append(circle,copy);return el;
  }
  function renderHealth(){
    let data=null;
    try{const raw=readingList.dataset.csoLearningHealth;if(raw)data=JSON.parse(raw);}catch{}
    const sig=JSON.stringify(data);
    if(healthPanel.dataset.healthSignature===sig)return;
    healthPanel.dataset.healthSignature=sig;
    healthStatus.replaceChildren();healthPanel.replaceChildren();
    if(!data){healthStatus.dataset.level='neutral';healthStatus.append(make('strong','','状況を確認中'));healthPanel.append(make('p','cso-health-loading','課題の状況を読み込んでいます。'));return;}
    const level=data.level;
    healthStatus.dataset.level=level;
    const light=make('span','cso-health-light');light.append(icon(level==='normal'?'check':level==='neutral'?'layers':level==='support'?'book':'clock',30));
    const statusText=make('div','cso-health-signal-text');statusText.append(make('small','','現在の学習状況'),make('strong','',data.title),make('span','',data.message));
    healthStatus.append(light,statusText);
    const left=make('div','cso-health-ringcard');
    const ring=make('div','cso-health-ring');
    const percent=data.percent;
    ring.style.setProperty('--health-pct',(percent??0)+'%');
    ring.setAttribute('role','img');ring.setAttribute('aria-label',percent===null?'課題の達成率：対象なし':'課題の達成率 '+percent+'パーセント');
    const center=make('div','cso-health-ringcenter');
    center.append(make('span','','課題の達成率'),make('strong','',percent===null?'—':percent+'%'),make('small','',data.complete+' / '+data.total+' 課題'));
    ring.append(center);left.append(ring,make('span','cso-health-scope','Copeak・公開開始済み'));
    const right=make('div','cso-health-right');
    const counts=make('div','cso-health-counts');
    const items=[
      ['total','layers','配信課題数',data.total,'公開開始済み'],
      ['pass','check','合格・完了',data.complete,'合格 '+data.passed+' / 基準なし完了 '+data.submittedComplete],
      ['incomplete','clock','未完了',data.incomplete,'挑戦済み・未合格'],
      ['missing','x','未提出',data.unsubmitted,'未着手']
    ];
    for(const [kind,glyph,label,value,note] of items){
      const cell=make('div','cso-health-count');cell.dataset.kind=kind;
      const labelRow=make('div','cso-health-count-label');labelRow.append(icon(glyph,19),make('span','',label));
      const valueRow=make('div','cso-health-count-value');valueRow.append(make('strong','',value),make('span','','件'));
      cell.append(labelRow,valueRow,make('small','',note));counts.append(cell);
    }
    right.append(counts);
    const notice=make('div','cso-health-notice');notice.dataset.level=level;
    const desc=make('div','cso-health-notice-copy');
    const message=data.overdue>0?'締切後の未完了 '+data.overdue+'件（未提出 '+data.overdueUnsubmitted+'件）':data.near>0?'締切が近い課題 '+data.near+'件':data.total-data.complete>0?'残り '+(data.total-data.complete)+'件':'すべて達成！';
    desc.append(make('strong','',message));
    desc.append(make('small','',data.message));
    notice.append(icon(level==='normal'?'check':level==='neutral'?'layers':level==='support'?'book':'clock',24),desc);
    if(data.total>data.complete){
      const action=make('button','cso-health-action','未完了の課題を確認');action.type='button';action.append(icon('arrow',16));
      action.addEventListener('click',()=>{main.status='todo';main.source='copeak';main.page=0;const sourceSelect=root.querySelector('#csoSourceSelect');if(sourceSelect)sourceSelect.value='copeak';render();root.querySelector('.cso-task-head')?.scrollIntoView({block:'start',behavior:'auto'});});
      notice.append(action);
    }
    right.append(notice);
    const foot=make('p','cso-health-foot','公開前 '+data.future+'件は達成率・学習状況表示の対象外。PicSpeakはこの集計に含みません。');
    right.append(foot);healthPanel.append(left,right);
  }
  function chip(name,txt){const c=make('span','cso-chip');c.append(icon(name,15),make('span','',txt));return c;}
  function renderRank(rows){
    // Preserve expanded state across data refreshes.
    let details=mini.querySelector('.cso-rankdetails');
    if(!details){
      details=make('details','cso-rankdetails');
      details.append(make('summary','','順位の詳細を表示'));
      rankingTarget=make('div','cso-rank-original');
      details.append(rankingTarget);
      mini.append(details);
    }else{
      rankingTarget=details.querySelector('.cso-rank-original');
    }
    for(const child of [...mini.children]){
      if(child!==details)child.remove();
    }
    const eyebrow=make('div','cso-side-eyebrow','CLASS PERFORMANCE');
    mini.insertBefore(eyebrow,details);
    const title=make('div','cso-side-heading');
    title.append(icon('crown',22),make('strong','','音読のクラス順位'));
    mini.insertBefore(title,details);
    const guide=make('p','cso-side-note','課題を選ぶとAccuracy・WPM・練習回数の順位を確認できます。');
    mini.insertBefore(guide,details);
    liftRank();
  }
  // Reading cards inherit class-local identifiers from student.js, never their
  // visible index (filters and pagination must not renumber a lesson).
  function assignmentTag(item){
    if(item.type!=='copeak')return '';
    return item.assignmentNo ? 'No. '+item.assignmentNo : item.assignmentLabel;
  }
  // Classify against the original timestamp, not translated display text.
  // Only open, unfinished work pulses; closing a lesson immediately stops it.
  function deadlineState(item, now=Date.now()){
    if(item.type!=='copeak'||!Number.isFinite(item.dueMs))return {kind:'normal',remaining:''};
    const left=item.dueMs-now;
    if(item.done)return {kind:'complete',remaining:''};
    if(left<=0)return {kind:'expired',remaining:''};
    if(item.upcoming||(Number.isFinite(item.releaseMs)&&item.releaseMs>now))return {kind:'normal',remaining:''};
    if(left>48*3600000)return {kind:'normal',remaining:''};
    const remaining=left>24*3600000?'あと2日':left>=3600000?'あと'+Math.ceil(left/3600000)+'時間':left>=60000?'あと'+Math.ceil(left/60000)+'分':'あと1分未満';
    return {kind:'urgent',remaining};
  }
  function passRule(item){
    if(item.type!=='copeak'||!item.pct)return null;
    const panel=item.pct, guide=clean(panel.querySelector('.student-pass-guide')?.textContent);
    const ja=!/Values|Your previous PASS/i.test(guide);
    const gauges=[...panel.querySelectorAll('.student-gauge-card')];
    const targets=gauges.map(g=>{
      const name=clean(g.querySelector('.student-gauge-label')?.textContent);
      const raw=clean(g.querySelector('.student-gauge-goal-text')?.textContent);
      const value=raw.match(/[0-9]+(?:\.[0-9]+)?%?/)?.[0];
      return name&&value?name+' '+value+(ja?'以上':'+'):'';
    }).filter(Boolean);
    const passed=panel.classList.contains('passed');
    const legacy=/旧基準|previous rule/i.test(clean(panel.querySelector('.student-pass-status')?.textContent));
    const both=targets.length>1;
    const separate=!passed&&both&&gauges.every(g=>g.classList.contains('reached'));
    const status=legacy?(ja?'合格済み（旧基準）':'PASS (previous rule)'):passed?(ja?'合格済み':'PASS'):separate?(ja?'未合格：別々の回で目標達成':'Not passed: targets met separately'):panel.classList.contains('waiting')?(ja?'未挑戦':'Not attempted'):(ja?'未合格':'Not passed');
    const instruction=legacy?'':ja?(both?'1回の音読で両方を同時達成':'1回の音読で設定基準を達成'):(both?'Meet both targets in the same reading':'Meet the target in one reading');
    return {status,targets,instruction,passed,ja};
  }
  function ruleNotice(item){
    const rule=passRule(item);if(!rule)return null;
    const node=make('div','cso-pass-rule'+(rule.passed?' is-passed':''));
    node.append(make('strong','',rule.status));
    if(rule.targets.length)node.append(make('span','',rule.targets.join(' ＋ ')));
    if(rule.instruction)node.append(make('span','',rule.instruction));
    return node;
  }
  function tile(item){
    const reading=item.type==='copeak', d=deadlineState(item);
    const b=make('button','cso-tile '+(reading?'cso-green cso-reading-card':'cso-pink')+(item.done?' cso-complete':'')+(item.overdue||d.kind==='expired'?' cso-expired':'')+(d.kind==='urgent'?' cso-deadline-urgent':''));
    b.type='button';const tag=assignmentTag(item);b.title=[tag,item.title].filter(Boolean).join(' | ');
    const currentStatus=d.kind==='urgent'?'締切間近':standardStatus(item);
    b.setAttribute('aria-label',[tag,item.title,standardStatus(item),reading&&item.deadlineDate?'締切 '+item.deadlineDate:'',d.remaining,'詳細を開く'].filter(Boolean).join('、'));
    const row=make('div','cso-tile-top');
    if(reading){
      const number=make('span','cso-assignment-number',tag||'クラス課題');
      row.append(number);
    }else{
      const kind=make('span','cso-tile-kind');kind.append(icon(glyph(item),16),make('span','',label(item)));row.append(kind);
    }
    const statusClass=item.done?'cso-state-done':d.kind==='urgent'?'cso-state-urgent':item.overdue?'cso-state-late':item.upcoming?'cso-state-next':/練習中/.test(item.status)?'cso-state-practice':'cso-state-todo';
    const state=make('span','cso-state '+statusClass);
    if(d.kind==='urgent')state.append(icon('alert',14));
    state.append(make('span','',currentStatus));
    if(d.kind==='urgent'&&standardStatus(item)!==currentStatus)state.title=standardStatus(item);
    row.append(state);b.append(row);
    const inner=make('div','cso-tile-middle');
    const textBlock=make('div','cso-tile-text');textBlock.append(make('strong','cso-tile-title',item.title));
    const stamp=make('span','cso-tile-illustration');stamp.append(icon(glyph(item),22));
    if(reading)inner.append(stamp,textBlock);else inner.append(textBlock,stamp);
    b.append(inner);
    const rule=ruleNotice(item);if(rule)b.append(rule);
    const foot=make('div','cso-tile-footer');
    if(reading){
      const deadline=make('span','cso-deadline-box cso-deadline-'+d.kind);
      deadline.append(icon('calendar',16));
      const date=make('span','cso-deadline-date');date.append(make('span','cso-deadline-caption','締切'),make('strong','',item.deadlineDate||'—'));deadline.append(date);
      if(d.remaining){const remaining=make('span','cso-deadline-remaining');remaining.append(icon('clock',13),make('span','',d.remaining));deadline.append(remaining);}
      foot.append(deadline);
    }else{
      const detail=item.headline&&item.headline!=='—'?'最高 '+item.headline:item.deadline||'';
      foot.append(make('span','cso-tile-data',detail||'タップして詳細を確認'));
    }
    foot.append(make('span','cso-tile-link',item.done?'成果を見る →':'課題を見る →'));b.append(foot);
    b.addEventListener('click',()=>{const latest=main.items.find(r=>r.key===item.key);if(latest)openModal(latest,b);});return b;
  }
  function render(){
    if(!root)return;
    main.items=sourceRows();
    const className=clean(document.getElementById('className')?.textContent);
    const classMatch=className.normalize('NFKC').match(/(\d+)\s*年\s*(\d+)\s*組/);
    root.querySelector('.cso-overline').textContent=classMatch
      ? `CLASS ${classMatch[1]}-${classMatch[2]}`
      : (className && className !== 'My Class' ? className : 'COPEAK CLASSROOM');
    const all=main.items,pending=all.filter(r=>!r.done),done=all.filter(r=>r.done),todo=pending.filter(r=>!r.overdue&&!r.upcoming);
    renderHealth();
    renderRank(all);
    stats.replaceChildren(metricBox('target','Copeak 平均Accuracy',clean(document.querySelector('#avgAccuracy')?.textContent)||'—','クラス課題の最高記録・教員修正反映'),metricBox('bolt','Copeak 最高WPM',clean(document.querySelector('#bestWpm')?.textContent)||'—','クラス課題の最高記録・教員修正反映'));
    for(const b of nav.querySelectorAll('button')){b.setAttribute('aria-pressed',String(b.dataset.status===main.status));b.textContent=(b.dataset.status==='todo'?'未完了':b.dataset.status==='done'?'完了':'すべて')+'  '+(b.dataset.status==='todo'?pending.length:b.dataset.status==='done'?done.length:all.length);}
    const filtered=all.filter(r=>(main.status==='all'||(main.status==='done'?r.done:!r.done))&&(main.source==='all'||r.type===main.source));
    // sourceRows reads the server-backed, class-ordered reading list. Preserve
    // that order for all filters, including "all", regardless of completion.
    const ordered=filtered;
    const limit=12,max=Math.max(0,Math.ceil(ordered.length/limit)-1);main.page=Math.min(Math.max(main.page,0),max);
    const statusLabel=main.status==='done'?'完了した課題':main.status==='todo'?'未完了の課題':'すべての課題';
    const sourceLabel=main.source==='copeak'?' · Copeak':main.source==='picspeak'?' · PicSpeak':'';
    root.querySelector('#csoStatusLine').textContent=`${statusLabel}${sourceLabel} ${ordered.length} 件 · 全 ${all.length} 件`;
    // Keep unchanged cards in place across the one-second countdown render.
    // This also preserves keyboard focus and the deadline pulse animation.
    const pageItems=ordered.slice(main.page*limit,(main.page+1)*limit);
    const signature=JSON.stringify([main.status,main.source,main.page,pageItems.map(item=>[item.key,item.title,item.assignmentNo,item.assignmentLabel,item.status,item.done,item.upcoming,item.overdue,item.deadlineDate,item.deadline,item.headline,item.mode,passRule(item),deadlineState(item)])]);
    if(grid.dataset.cardSignature!==signature){
      grid.dataset.cardSignature=signature;
      grid.replaceChildren();for(const item of pageItems)grid.append(tile(item));
      if(!filtered.length)grid.append(make('p','cso-empty',main.status==='todo'?'未完了の課題はありません。':'該当する課題はありません。'));
    }
    footer.replaceChildren();if(ordered.length>limit){const prev=make('button','cso-pagination','前へ');prev.type='button';prev.disabled=main.page<=0;prev.addEventListener('click',()=>{main.page--;render();});const cur=make('span','',`${main.page+1} / ${max+1} ページ`);const next=make('button','cso-pagination','次へ');next.type='button';next.disabled=main.page>=max;next.addEventListener('click',()=>{main.page++;render();});footer.append(prev,cur,next);}
    if(main.modal){const latest=all.find(r=>r.key===main.selected);if(latest)fillModal(latest);else closeModal();}
  }
  function kpi(key,value,hint,iconName){const el=make('div','cso-kpi');const at=make('div','cso-kpi-label');at.append(icon(iconName||'target',19),make('span','',key));el.append(at,make('strong','cso-kpi-number',value));if(hint)el.append(make('small','cso-kpi-note',hint));return el;}
  function getRankContent(item){const box=make('div','cso-modal-rank');const heading=make('h3','');heading.append(icon('crown',20),make('span','','この課題のクラス順位'));box.append(heading);
    if(item.type==='copeak'){
      const source=item.source.querySelector('.student-assignment-rank-mini');if(source)box.append(source.cloneNode(true));else box.append(make('p','','順位はまだ取得できていません。'));
      box.append(make('small','','Accuracy・WPM・練習回数を別々に集計しています。'));
    }else{box.append(make('p','','PicSpeakの順位集計は準備中です。成績は上の欄で確認できます。'));}
    return box;
  }
  function fillModal(item){
    const pink=item.type==='picspeak';dialog.classList.toggle('cso-modal-pink',pink);
    dialogType.textContent=[assignmentTag(item),item.type==='copeak'?'':label(item),standardStatus(item)].filter(Boolean).join('  /  ');dialogTitle.textContent=item.title;
    const start=item.source.querySelector('.start-btn,.psl-challenge');dialogCTA.disabled=!start||start.disabled;
    dialogCTA.querySelector('span:last-child').textContent=dialogCTA.disabled?'現在は開始できません':pink?'PicSpeakに挑戦する':'Copeakで音読を始める';
    dialogNote.textContent=dialogCTA.disabled?'公開日時または締切をご確認ください':'タップして教材を開きます';
    dialogContent.replaceChildren();
    const summary=make('div','cso-modal-grid');const left=make('div','cso-details-left');const right=make('div','cso-details-right');
    const description=make('section','cso-info-card');description.append(make('h3','','学習について'));const bits=make('div','cso-info-bits');bits.append(chip('layers',label(item)),chip('check',standardStatus(item)));if(item.deadline)bits.append(chip('clock',item.deadline));else if(item.subtitle){const d=item.subtitle.match(/締切.*/)?.[0];if(d)bits.append(chip('clock',d));}description.append(bits);
    if(item.type==='copeak'){
      const rule=ruleNotice(item);if(rule)description.append(rule);
      const panel=item.source.querySelector('.student-pass-panel');if(panel){const note=make('div','cso-criteria');const ja=passRule(item)?.ja!==false;note.append(make('h4','',ja?'項目別最高記録（参考・合格判定とは別）':'Separate personal bests — reference only'));const copy=panel.cloneNode(true);const title=copy.querySelector('.student-pass-title');if(title)title.textContent=ja?'項目別の目標と最高記録':'Individual targets and bests';copy.querySelectorAll('.student-gauge-goal-text,.student-gauge-goal-line span').forEach(el=>{el.textContent=el.textContent.replace(/合格/g,'目標');});note.append(copy);description.append(note);}
    }else{
      const details=item.source.querySelector('.psl-detail');if(details){const breakdown=details.cloneNode(true);breakdown.hidden=false;description.append(breakdown);}
    }
    left.append(description);
    const perf=make('section','cso-perf');perf.append(make('h3','','あなたの学習成果'));const quick=make('div','cso-kpis');
    if(pink){const scores=[...item.source.querySelectorAll('.psl-scores>div')];for(let i=0;i<Math.min(3,scores.length);i++){
      const value=clean(scores[i].querySelector('strong')?.textContent)||'—';const cap=clean(scores[i].querySelector('span')?.textContent)||['最高達成率','練習回数','累計単語'][i];quick.append(kpi(cap,value,'',i===0?'target':i===1?'layers':'microphone'));}
    }else{
      const acc=num(item.acc),wpm=num(item.wpm),performance=num(item.performance),reads=num(item.reads);
      quick.append(kpi('Accuracy',acc===null?'—':acc+'%','項目別最高記録（参考）・合格判定とは別','target'),kpi('WPM',wpm===null?'—':String(wpm),'項目別最高記録（参考）・合格判定とは別','bolt'),kpi('Reading Performance',performance===null?'—':performance+'/100','最高記録・教員修正反映','target'),kpi('音読回数',String(reads??0)+'回','提出された全音読記録','layers'));
      const latestA=num(item.latestAcc),latestW=num(item.latestWpm);
      if(latestA!==null||latestW!==null){const last=make('p','cso-kpi-note','最新の音読（参考）：Accuracy '+(latestA===null?'—':latestA+'%')+' / WPM '+(latestW===null?'—':latestW));last.style.margin='10px 0 0';perf.append(last);}
    }
    if(!quick.children.length)quick.append(kpi('成績','—','課題に取り組むと表示されます','target'));
    perf.append(quick);right.append(perf,getRankContent(item));
    const about=make('div','cso-coach');about.append(icon('sparkles',21),make('div','',item.done?'取り組みの成果を確認できます。':'少しずつの練習が、次の成長につながります。'));right.append(about);
    summary.append(left,right);dialogContent.append(summary);
  }
  function openModal(item,trigger){
    main.selected=item.key;main.activeTrigger=trigger;main.prevOverflow=document.body.style.overflow;main.modal=true;
    const m=document.getElementById('csoModal');m.hidden=false;m.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';fillModal(item);dialogClose.focus();
  }
  function closeModal(){
    if(!main.modal)return;main.modal=false;const m=document.getElementById('csoModal');m.hidden=true;m.setAttribute('aria-hidden','true');document.body.style.overflow=main.prevOverflow;
    if(main.activeTrigger?.isConnected)main.activeTrigger.focus();main.activeTrigger=null;
  }
  function update(){if(pending)return;pending=true;window.setTimeout(()=>{pending=false;render();},100);}
  function mount(){
    if(!build())return;
    picList=document.getElementById('pslStudentList');observer=new MutationObserver(update);
    observer.observe(readingList,{childList:true,attributes:true,attributeFilter:['data-cso-learning-health']});if(picList)observer.observe(picList,{childList:true});
    if(!picList){const waiting=new MutationObserver(()=>{const el=document.getElementById('pslStudentList');if(el){picList=el;observer.observe(picList,{childList:true});waiting.disconnect();update();}});waiting.observe(document.body,{childList:true,subtree:true});window.setTimeout(()=>waiting.disconnect(),30000);}
    for(const id of ['avgAccuracy','bestWpm','progressPct']){const el=document.getElementById(id);if(el)observer.observe(el,{childList:true,characterData:true,subtree:true});}
    render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
