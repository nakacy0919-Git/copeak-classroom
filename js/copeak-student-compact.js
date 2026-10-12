/* Copeak Classroom — Student Dashboard v3 / 2026-10-13
 * Presentation-only layer. Reads existing access-controlled Copeak/PicSpeak cards.
 * Score calculation, launch, filtering permissions and database writes are unchanged.
 */
(() => {
  'use strict';
  if (window.__csoV3Loaded) return;
  window.__csoV3Loaded = true;
  const scriptUrl = document.currentScript?.src || new URL('js/copeak-student-compact.js', location.href).href;
  const cssUrl = new URL('../css/copeak-student-dashboard-v3.css', scriptUrl);
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = cssUrl.href;
  link.id = 'csoV3Styles';
  document.head.append(link);

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
  let root,grid,nav,hero,mini,stats,footer,dialog,dialogContent,dialogTitle,dialogType,dialogClose,dialogCTA,dialogNote,rankingTarget,readingList,picList,rankObserver;
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
        source:card,rank,pct,acc:card.dataset.csoAccuracy||'',wpm:card.dataset.csoWpm||'',deadline:clean(card.querySelector('.student-deadline-inline')?.textContent)||''});
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
    const identity=make('div','cso-identity');identity.append(make('span','cso-overline','MY LEARNING'),make('h1','','マイ・ダッシュボード'));
    const overview=make('div','cso-headerprogress');overview.append(make('span','','学習の進捗'));const gauge=make('div','cso-hprogress');const bar=make('span');bar.id='csoHeaderBar';gauge.append(bar);overview.append(gauge,make('strong',''));overview.querySelector('strong').id='csoHeaderRatio';
    heading.append(identity,overview);root.append(heading);
    const topGrid=make('div','cso-topgrid');hero=make('div','cso-feature');mini=make('div','cso-rankmini');topGrid.append(hero,mini);root.append(topGrid);
    stats=make('div','cso-stats');root.append(stats);
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
  function renderHero(rows){
    const todo=rows.filter(r=>!r.done&&!r.upcoming&&!r.overdue);const next=todo[0]||rows.find(r=>!r.done)||rows[0];
    hero.replaceChildren();hero.classList.toggle('cso-hero-pink',next?.type==='picspeak');
    const content=make('div','cso-feature-content');
    if(!next){content.append(make('span','cso-feature-pill','学習ダッシュボード'),make('h2','','課題の公開をお待ちください'),make('p','cso-feature-description','新しい課題が公開されると、ここに表示されます。'));}
    else{
      content.append(make('span','cso-feature-pill',todo.length?'次の課題':next.done?'取り組みの記録':'課題を確認'),make('h2','',next.title));
      const type=make('div','cso-featuretype');type.append(icon(glyph(next),18),make('span','',label(next)));content.append(type);
      const hints=make('div','cso-featurechips');if(next.deadline)hints.append(chip('clock',next.deadline));else if(next.subtitle){const suffix=next.subtitle.match(/締切.*/)?.[0];if(suffix)hints.append(chip('clock',suffix));}
      hints.append(chip('layers',standardStatus(next)));content.append(hints);
      const button=make('button','cso-feature-button',todo.length?'この課題を見る':next.done?'成果を見る':'課題の詳細');button.type='button';button.append(icon('arrow',18));button.addEventListener('click',()=>openModal(next,button));content.append(button);
    }
    const deco=make('div','cso-feature-art');deco.setAttribute('aria-hidden','true');deco.append(icon(next?glyph(next):'book',106),make('span','cso-orb cso-orb-a'),make('span','cso-orb cso-orb-b'),make('span','cso-orb cso-orb-c'));hero.append(content,deco);
  }
  function chip(name,txt){const c=make('span','cso-chip');c.append(icon(name,15),make('span','',txt));return c;}
  function renderRank(rows){
    // Preserve the live, access-controlled ranking panel across dashboard rerenders.
    const originalRank=document.getElementById('studentReadingRankCard');
    if(originalRank)originalRank.remove();
    mini.replaceChildren();mini.append(make('div','cso-side-eyebrow','CLASS PERFORMANCE'));
    const title=make('div','cso-side-heading');title.append(icon('crown',22),make('strong','','クラス順位'));mini.append(title);
    const candidate=rows.find(r=>r.type==='copeak'&&r.source.querySelector('.student-assignment-rank-mini'));
    if(candidate){
      mini.append(make('div','cso-side-caption',candidate.title));
      const cloned=candidate.source.querySelector('.student-assignment-rank-mini').cloneNode(true);const host=make('div','cso-rank-summary');host.append(cloned);mini.append(host);
    }else mini.append(make('p','cso-side-note','音読課題の成績があると順位が表示されます。'));
    const details=make('details','cso-rankdetails');details.append(make('summary','','順位の詳しい情報を見る'));
    rankingTarget=make('div','cso-rank-original');details.append(rankingTarget);mini.append(details);
    if(originalRank)rankingTarget.append(originalRank);else liftRank();
  }
  function tile(item){
    const b=make('button','cso-tile '+(item.type==='picspeak'?'cso-pink':'cso-green')+(item.done?' cso-complete':'')+(item.overdue?' cso-expired':''));b.type='button';b.title=item.title;
    b.setAttribute('aria-label',`${label(item)}、${item.title}、${standardStatus(item)}。詳細を開く`);
    const row=make('div','cso-tile-top');const kind=make('span','cso-tile-kind');kind.append(icon(glyph(item),16),make('span','',label(item)));
    const state=make('span','cso-state '+(item.done?'cso-state-done':item.overdue?'cso-state-late':item.upcoming?'cso-state-next':/練習中/.test(item.status)?'cso-state-practice':'cso-state-todo'),standardStatus(item));row.append(kind,state);b.append(row);
    const inner=make('div','cso-tile-middle');inner.append(make('strong','cso-tile-title',item.title));const stamp=make('span','cso-tile-illustration');stamp.append(icon(glyph(item),40));inner.append(stamp);b.append(inner);
    const foot=make('div','cso-tile-footer');let detail=item.type==='picspeak'&&item.headline&&item.headline!=='—'?'最高 '+item.headline:item.deadline||'';
    foot.append(make('span','cso-tile-data',detail||'タップして詳細を確認'),make('span','cso-tile-link',item.done?'成果を見る ↗':'課題を見る ↗'));b.append(foot);
    b.addEventListener('click',()=>openModal(item,b));return b;
  }
  function render(){
    if(!root)return;
    main.items=sourceRows();
    const className=clean(document.getElementById('className')?.textContent);
    root.querySelector('.cso-overline').textContent=className&&className!=='My Class'?className+' · MY LEARNING':'MY LEARNING';
    const all=main.items,pending=all.filter(r=>!r.done),done=all.filter(r=>r.done),todo=pending.filter(r=>!r.overdue&&!r.upcoming);
    const pct=all.length?Math.round(100*done.length/all.length):0;
    root.querySelector('#csoHeaderBar').style.width=pct+'%';root.querySelector('#csoHeaderRatio').textContent=`${done.length}/${all.length} · ${pct}%`;
    renderHero(all);renderRank(all);
    stats.replaceChildren(metricBox('layers','残っている課題',String(pending.length)+' 件','公開前・期限切れを含む'),metricBox('check','完了した課題',`${done.length} / ${all.length}`,'Copeak提出・PicSpeak合格'),metricBox('target','Copeak 平均Accuracy',clean(document.querySelector('#avgAccuracy')?.textContent)||'—','音読の記録'),metricBox('bolt','Copeak 最高WPM',clean(document.querySelector('#bestWpm')?.textContent)||'—','音読の記録'));
    for(const b of nav.querySelectorAll('button')){b.setAttribute('aria-pressed',String(b.dataset.status===main.status));b.textContent=(b.dataset.status==='todo'?'未完了':b.dataset.status==='done'?'完了':'すべて')+'  '+(b.dataset.status==='todo'?pending.length:b.dataset.status==='done'?done.length:all.length);}
    const filtered=all.filter(r=>(main.status==='all'||(main.status==='done'?r.done:!r.done))&&(main.source==='all'||r.type===main.source));
    const ordered=filtered.slice().sort((a,b)=>Number(a.done)-Number(b.done));
    const limit=12,max=Math.max(0,Math.ceil(ordered.length/limit)-1);main.page=Math.min(Math.max(main.page,0),max);
    root.querySelector('#csoStatusLine').textContent=`今すぐ取り組める ${todo.length} 件 · 全 ${all.length} 件から表示中 ${ordered.length} 件`;
    grid.replaceChildren();for(const item of ordered.slice(main.page*limit,(main.page+1)*limit))grid.append(tile(item));
    if(!filtered.length)grid.append(make('p','cso-empty',main.status==='todo'?'未完了の課題はありません。':'該当する課題はありません。'));
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
    dialogType.textContent=label(item)+'  /  '+standardStatus(item);dialogTitle.textContent=item.title;
    const start=item.source.querySelector('.start-btn,.psl-challenge');dialogCTA.disabled=!start||start.disabled;
    dialogCTA.querySelector('span:last-child').textContent=dialogCTA.disabled?'現在は開始できません':pink?'PicSpeakに挑戦する':'Copeakで音読を始める';
    dialogNote.textContent=dialogCTA.disabled?'公開日時または締切をご確認ください':'タップして教材を開きます';
    dialogContent.replaceChildren();
    const summary=make('div','cso-modal-grid');const left=make('div','cso-details-left');const right=make('div','cso-details-right');
    const art=make('div','cso-study-art');art.append(icon(glyph(item),82));const artCopy=make('div');artCopy.append(make('span','',pink?'PICTURE SPEAKING':'READING PRACTICE'),make('strong','',pink?'画像を見て、英語で伝えよう':'英語を声に出して、力を伸ばそう'));art.append(artCopy);left.append(art);
    const description=make('section','cso-info-card');description.append(make('h3','','学習について'));const bits=make('div','cso-info-bits');bits.append(chip('layers',label(item)),chip('check',standardStatus(item)));if(item.deadline)bits.append(chip('clock',item.deadline));else if(item.subtitle){const d=item.subtitle.match(/締切.*/)?.[0];if(d)bits.append(chip('clock',d));}description.append(bits);
    if(item.type==='copeak'){
      const panel=item.source.querySelector('.student-pass-panel');if(panel){const note=make('div','cso-criteria');note.append(make('h4','','合格基準と進捗'));note.append(panel.cloneNode(true));description.append(note);}
    }else{
      const details=item.source.querySelector('.psl-detail');if(details){const breakdown=details.cloneNode(true);breakdown.hidden=false;description.append(breakdown);}
    }
    left.append(description);
    const perf=make('section','cso-perf');perf.append(make('h3','','あなたの学習成果'));const quick=make('div','cso-kpis');
    if(pink){const scores=[...item.source.querySelectorAll('.psl-scores>div')];for(let i=0;i<Math.min(3,scores.length);i++){
      const value=clean(scores[i].querySelector('strong')?.textContent)||'—';const cap=clean(scores[i].querySelector('span')?.textContent)||['最高達成率','練習回数','累計単語'][i];quick.append(kpi(cap,value,'',i===0?'target':i===1?'layers':'microphone'));}
    }else{
      const acc=num(item.acc),wpm=num(item.wpm);quick.append(kpi('Accuracy',acc===null?'—':acc.toFixed(1)+'%','音読の正確率','target'),kpi('WPM',wpm===null?'—':Math.round(wpm).toString(),'1分間に読む単語数','bolt'));
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
    observer.observe(readingList,{childList:true});if(picList)observer.observe(picList,{childList:true});
    if(!picList){const waiting=new MutationObserver(()=>{const el=document.getElementById('pslStudentList');if(el){picList=el;observer.observe(picList,{childList:true});waiting.disconnect();update();}});waiting.observe(document.body,{childList:true,subtree:true});window.setTimeout(()=>waiting.disconnect(),30000);}
    for(const id of ['avgAccuracy','bestWpm','progressPct']){const el=document.getElementById(id);if(el)observer.observe(el,{childList:true,characterData:true,subtree:true});}
    render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
