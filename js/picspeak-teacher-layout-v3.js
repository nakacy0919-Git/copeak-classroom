/**
 * PicSpeak assignment editor v3: Copeak-inspired compact 2-column workspace.
 * Presentation only. Moves LIVE, already-wired form elements; never copies them
 * and never creates, publishes or changes assignments programmatically.
 * Requires the original PicSpeak editor and v2 layout to initialize first.
 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const create = (tag, className = '', label) => {
    const node = document.createElement(tag);
    node.className = className;
    if (label !== undefined) node.textContent = label;
    return node;
  };
  const css = `
    #picSpeakBetaPanel.psv3-ready{background:transparent!important;box-shadow:none!important}
    #picSpeakBetaPanel.psv3-ready .psv-shell{display:none!important}
    #picSpeakBetaPanel .psv3-shell{--ps3-green:#087c65;--ps3-text:#153c33;--ps3-line:#dbe7e4;--ps3-muted:#667e77;color:var(--ps3-text);font-family:inherit;font-size:14px}
    #picSpeakBetaPanel .psv3-shell *{box-sizing:border-box}
    #picSpeakBetaPanel .psv3-shell [hidden]{display:none!important}
    #picSpeakBetaPanel .psv3-shell .psv3-title{margin:0 0 4px;font-size:21px;font-weight:850;color:#153c33}
    #picSpeakBetaPanel .psv3-shell .psv3-subtitle{font-size:12px;color:var(--ps3-muted);margin:0 0 16px}
    #picSpeakBetaPanel .psv3-shell .psv3-card{background:#fff;border:1px solid var(--ps3-line);border-radius:15px;padding:17px 18px;min-width:0}
    #picSpeakBetaPanel .psv3-shell .psv3-cardhead{display:flex;align-items:center;gap:9px;margin:0 0 12px}
    #picSpeakBetaPanel .psv3-shell .psv3-icon{display:flex;align-items:center;justify-content:center;flex:0 0 27px;width:27px;height:27px;background:#e7f6f0;border-radius:8px;color:var(--ps3-green);font-weight:850}
    #picSpeakBetaPanel .psv3-shell .psv3-cardtitle{font-size:15px;font-weight:850;margin:0}
    #picSpeakBetaPanel .psv3-shell .psv3-carddesc{font-size:11px;color:var(--ps3-muted);margin:2px 0 0}
    #picSpeakBetaPanel .psv3-shell .psv3-top{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;align-items:start}
    #picSpeakBetaPanel .psv3-shell .psv3-bottom{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;margin-top:14px;align-items:start}
    #picSpeakBetaPanel .psv3-shell .psv3-formrow{display:flex;align-items:flex-end;flex-wrap:wrap;gap:12px}
    #picSpeakBetaPanel .psv3-shell .psv3-formrow>.psv-control{flex:1 1 155px;max-width:235px}
    #picSpeakBetaPanel .psv3-shell .psv3-fullrow>.psv-control{max-width:100%;width:100%}
    #picSpeakBetaPanel .psv3-shell .psv-control{display:flex!important;flex-direction:column!important;gap:6px!important;min-width:0!important;align-items:stretch!important;justify-content:flex-start!important;font-size:12px!important;font-weight:750!important;color:#335950!important;margin:0!important;height:auto!important}
    #picSpeakBetaPanel .psv3-shell .psv-control>input:not([type=checkbox]),#picSpeakBetaPanel .psv3-shell .psv-control>select{width:100%!important;max-width:100%!important;min-width:0!important;height:42px!important;min-height:42px!important;line-height:1.5!important;padding:8px 11px!important;border:1px solid #cddbd6!important;border-radius:9px!important;background:#fff!important;color:#193b33!important;box-shadow:none!important;font-size:13px!important;font-weight:550!important;margin:0!important}
    #picSpeakBetaPanel .psv3-shell .psv-control>input:focus-visible,#picSpeakBetaPanel .psv3-shell .psv-control>select:focus-visible,#picSpeakBetaPanel .psv3-shell button:focus-visible{outline:2px solid #15a888!important;outline-offset:2px}
    #picSpeakBetaPanel .psv3-shell .psv-control[hidden]{display:none!important}
    #picSpeakBetaPanel .psv3-shell .psv3-name{margin-bottom:14px}
    #picSpeakBetaPanel .psv3-shell .psv3-name .psv-control{max-width:720px}
    #picSpeakBetaPanel .psv3-shell .psv3-image{width:100%;max-width:450px;aspect-ratio:16/9;object-fit:cover;display:block;border-radius:12px;background:#ecf3f1;border:1px solid var(--ps3-line)}
    #picSpeakBetaPanel .psv3-shell .psv3-image-fallback{display:grid;place-items:center;min-height:170px;background:#f0f6f3;border-radius:12px;color:#587870;text-align:center;font-size:13px;padding:15px}
    #picSpeakBetaPanel .psv3-shell .psv3-image-title{font-size:14px;font-weight:800;margin:10px 0 4px;overflow-wrap:anywhere}
    #picSpeakBetaPanel .psv3-shell .psv3-image-meta{color:#789087;font-size:11px;margin:0 0 12px}
    #picSpeakBetaPanel .psv3-shell .psv3-lesson-selects{display:flex;flex-wrap:wrap;gap:10px;margin-top:13px}
    #picSpeakBetaPanel .psv3-shell .psv3-lesson-selects>.psv-control{flex:1 1 170px;max-width:260px}
    #picSpeakBetaPanel .psv3-shell .psv3-delivery-class{max-width:360px;margin-bottom:12px}
    #picSpeakBetaPanel .psv3-shell .psv3-audience-tabs{display:flex;gap:6px;padding:4px;background:#f0f5f3;border:1px solid #d8e7e0;border-radius:11px;width:max-content;max-width:100%;margin:0 0 12px}
    #picSpeakBetaPanel .psv3-shell .psv3-audience-button{cursor:pointer;border:0;background:transparent;border-radius:8px;padding:9px 12px;font-size:12px;font-weight:750;color:#3f625a;line-height:1.35}
    #picSpeakBetaPanel .psv3-shell .psv3-audience-button[aria-pressed=true]{color:#fff;background:var(--ps3-green);box-shadow:0 1px 5px #12382926}
    #picSpeakBetaPanel .psv3-shell .psv3-select-holder{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;pointer-events:none;clip-path:inset(50%)}
    #picSpeakBetaPanel .psv3-shell .psv3-recipient{border:1px solid #e0ebe7;background:#f8fbf9;border-radius:11px;padding:11px}
    #picSpeakBetaPanel .psv3-shell .psv3-recipient-summary{font-size:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 8px;color:#406359}
    #picSpeakBetaPanel .psv3-shell .psv3-recipient-summary b{color:#087c65}
    #picSpeakBetaPanel .psv3-shell #pslRecipientList{max-height:166px!important;min-height:0!important;height:auto!important;overflow-y:auto!important;border:1px solid #dce9e5;border-radius:9px;background:#fff;padding:4px 7px;margin:6px 0 0}
    #picSpeakBetaPanel .psv3-shell #pslRecipientList label{display:flex!important;flex-direction:row!important;gap:9px!important;align-items:center!important;padding:7px 8px!important;min-height:32px!important;font-weight:500!important;font-size:13px!important}
    #picSpeakBetaPanel .psv3-shell #pslRecipientList input[type=checkbox]{width:17px!important;height:17px!important;min-width:17px!important;accent-color:var(--ps3-green)!important}
    #picSpeakBetaPanel .psv3-shell #pslRecipientStatus{font-size:11px!important;color:#6a837a;margin:6px 0 0!important}
    #picSpeakBetaPanel .psv3-shell .psv3-delivery-warning{font-size:12px;border:1px solid #f4d7b3;border-radius:10px;background:#fff8ef;padding:11px;color:#96531c}
    #picSpeakBetaPanel .psv3-shell .psv3-help{font-size:11px;color:#6d847b;line-height:1.6;margin:11px 0 0}
    #picSpeakBetaPanel .psv3-shell .psv3-metrics>.psv-control{flex:1 1 132px;max-width:182px}
    #picSpeakBetaPanel .psv3-shell .psv3-dates{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}
    #picSpeakBetaPanel .psv3-shell .psv3-dates>.psv-control{max-width:100%}
    #picSpeakBetaPanel .psv3-shell .psv3-savebar{background:#f1faf6;border:1px solid #d3e7de;padding:15px 18px;border-radius:13px;margin:14px 0;display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap}
    #picSpeakBetaPanel .psv3-shell .psv3-actions{display:flex;flex-wrap:wrap;align-items:center;gap:9px}
    #picSpeakBetaPanel .psv3-shell .psv3-actions button{border-radius:9px!important;padding:11px 17px!important;font-size:13px!important;font-weight:800!important;cursor:pointer}
    #picSpeakBetaPanel .psv3-shell #pslSave{background:#087f68!important;border:1px solid #087f68!important;color:#fff!important;min-width:160px}
    #picSpeakBetaPanel .psv3-shell #pslNew,#picSpeakBetaPanel .psv3-shell .psv3-to-list{background:#fff!important;border:1px solid #c8dfd5!important;color:#235b4d!important}
    #picSpeakBetaPanel .psv3-shell .psv3-savehelp{font-size:12px;line-height:1.6;color:#42695c;max-width:360px}
    #picSpeakBetaPanel .psv3-shell #pslMessage{font-size:12px!important;margin:8px 0!important}
    #picSpeakBetaPanel .psv3-shell .psv3-list{background:#fff;border:1px solid var(--ps3-line);border-radius:15px;padding:17px 18px}
    #picSpeakBetaPanel .psv3-shell .psv3-listheader{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 10px}
    #picSpeakBetaPanel .psv3-shell .psv3-listheader h3{margin:0;font-size:17px}
    #picSpeakBetaPanel .psv3-shell #pslList .psl-card{background:#f9fbfa!important;border-radius:11px!important;border:1px solid #e1eae7!important;padding:13px!important;margin:9px 0!important}
    #picSpeakBetaPanel .psv3-shell .psv3-list #pslReload{font:inherit;font-size:12px;background:#edf4f1;color:#285e51;border:1px solid #cadfd6;border-radius:9px;padding:8px 12px;cursor:pointer}
    #picSpeakBetaPanel .psv3-shell .psv3-publish{background:#087f68!important;color:white!important;border:1px solid #087f68!important;border-radius:8px!important;padding:8px 12px!important;font-weight:800!important}
    #picSpeakBetaPanel .psv3-shell .psv3-grade-wrap{overflow-x:auto}
    @media(max-width:950px){#picSpeakBetaPanel .psv3-shell .psv3-top{grid-template-columns:1fr 1fr}#picSpeakBetaPanel .psv3-shell .psv3-bottom{grid-template-columns:1fr}#picSpeakBetaPanel .psv3-shell .psv3-dates{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:720px){#picSpeakBetaPanel .psv3-shell .psv3-top,#picSpeakBetaPanel .psv3-shell .psv3-bottom{grid-template-columns:1fr}#picSpeakBetaPanel .psv3-shell .psv3-dates{grid-template-columns:1fr}#picSpeakBetaPanel .psv3-shell .psv3-card{padding:14px}#picSpeakBetaPanel .psv3-shell .psv3-formrow>.psv-control{max-width:100%}}
  `;

  function init() {
    const beta = $('picSpeakBetaPanel');
    if (!beta || !beta.classList.contains('psv-ready') || beta.classList.contains('psv3-ready')) return false;
    const section=beta.querySelector('.psl-teacher-section');
    const oldShell=section?.querySelector('.psv-shell');
    if (!section || !oldShell) return false;
    const ids=['pslMode','picSpeakBetaTheme','picSpeakBetaLevel','picSpeakBetaDuration','pslPassPercent','pslPassSeconds','picSpeakBetaAssignmentTitle','picSpeakBetaClass','pslAudience','pslStudentFilter','pslRecipientList','pslRecipientStatus','picSpeakBetaRelease','picSpeakBetaDue','pslSave','pslNew','pslMessage','pslReload','pslList','pslGradebook'];
    if (ids.some(id=>!$(id))) return false;
    // The v2 shell is the only accepted starting state. Check all fields first.
    const fieldIds=['pslMode','picSpeakBetaTheme','picSpeakBetaLevel','picSpeakBetaDuration','pslPassPercent','pslPassSeconds','picSpeakBetaAssignmentTitle','picSpeakBetaClass','pslAudience','pslStudentFilter','picSpeakBetaRelease','picSpeakBetaDue'];
    const wrappers = new Map();
    for (const id of fieldIds) {
      const el=$(id), wrap=el.closest('.psv-control');
      if(!wrap || !oldShell.contains(wrap) || wrap.querySelectorAll('input,select,textarea').length!==1) {
        console.warn('PicSpeak v3 skipped: unsafe wrapper',id);return false;
      }
      wrappers.set(id,wrap);
    }
    for (const id of ['pslRecipientList','pslRecipientStatus','pslSave','pslNew','pslMessage','pslReload','pslList','pslGradebook']) {
      if (!oldShell.contains($(id))) {console.warn('PicSpeak v3 skipped: detached element',id);return false;}
    }
    const style=create('style');style.id='psv3LayoutStyles';style.textContent=css;document.head.append(style);
    const formField=(parent,id)=>{parent.append(wrappers.get(id));return $(id);};
    const sectionHead=(parent,icon,title,desc)=>{
      const h=create('div','psv3-cardhead');h.append(create('span','psv3-icon',icon));
      const content=create('div');content.append(create('h3','psv3-cardtitle',title),create('p','psv3-carddesc',desc));h.append(content);parent.append(h);
    };
    const card=(parent,icon,title,desc)=>{const el=create('section','psv3-card');sectionHead(el,icon,title,desc);parent.append(el);return el;};
    const shell=create('div','psv3-shell');
    shell.append(create('h2','psv3-title','PicSpeak 課題設定'),create('p','psv3-subtitle','教材と配布先を選び、学習条件を決めて保存します。公開は確認後に行います。'));
    const nameRow=create('div','psv3-name');formField(nameRow,'picSpeakBetaAssignmentTitle');shell.append(nameRow);
    const top=create('div','psv3-top');shell.append(top);
    const visual=card(top,'1','教材を選ぶ','教材画像を確認しながら選択します');
    const image=create('img','psv3-image');image.alt='選択中のPicSpeak教材';image.loading='lazy';
    const fallback=create('div','psv3-image-fallback','教材のプレビュー');
    const imageTitle=create('div','psv3-image-title');const imageMeta=create('p','psv3-image-meta');
    visual.append(image,fallback,imageTitle,imageMeta);
    const lessonControls=create('div','psv3-lesson-selects');formField(lessonControls,'pslMode');formField(lessonControls,'picSpeakBetaTheme');visual.append(lessonControls);

    const delivery=card(top,'2','配布先を選ぶ','クラス全員か、生徒を指定して配布します');
    const classRow=create('div','psv3-delivery-class');formField(classRow,'picSpeakBetaClass');delivery.append(classRow);
    const audienceSelect=$('pslAudience');const audienceHolder=create('div','psv3-select-holder');
    formField(audienceHolder,'pslAudience');delivery.append(audienceHolder);
    const tabs=create('div','psv3-audience-tabs');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','配布対象');
    const individual=create('button','psv3-audience-button','👤 生徒を指定');individual.type='button';individual.dataset.audience='targeted';
    const all=create('button','psv3-audience-button','👥 クラス全員');all.type='button';all.dataset.audience='class';
    tabs.append(individual,all);delivery.append(tabs);
    const recipients=create('section','psv3-recipient');recipients.id='psv3Recipients';
    const recipientSummary=create('div','psv3-recipient-summary');recipientSummary.append(create('span','','配布する生徒'),create('b','','0名を選択'));
    recipients.append(recipientSummary);
    formField(recipients,'pslStudentFilter');
    recipients.append($('pslRecipientList'),$('pslRecipientStatus'));delivery.append(recipients);
    const warning=create('div','psv3-delivery-warning','注意：クラス全員への配布が選ばれています。公開前に対象クラスをご確認ください。');delivery.append(warning);
    const hint=create('p','psv3-help','個別配布の場合は、生徒のチェックを入れてから保存してください。');delivery.append(hint);

    const bottom=create('div','psv3-bottom');shell.append(bottom);
    const metric=card(bottom,'3','学習条件','時間と合格基準を設定します');
    const metricControls=create('div','psv3-formrow psv3-metrics');
    for(const id of ['picSpeakBetaLevel','picSpeakBetaDuration','pslPassPercent','pslPassSeconds'])formField(metricControls,id);
    metric.append(metricControls,create('p','psv3-help','画像描写の合否は達成率（%）で判定します。PIC FLASHのみクリアタイム（秒）です。'));
    const calendar=card(bottom,'4','公開日・締切','まず保存し、内容を確認してから公開します');
    const dates=create('div','psv3-dates');formField(dates,'picSpeakBetaRelease');formField(dates,'picSpeakBetaDue');calendar.append(dates);
    calendar.append(create('p','psv3-help','個別配布の対象を最終確認してから公開してください。'));

    const savebar=create('div','psv3-savebar');const actions=create('div','psv3-actions');
    actions.append($('pslSave'),$('pslNew'));const goList=create('button','psv3-to-list','保存済み課題を確認 ↓');goList.type='button';actions.append(goList);
    const saveRight=create('div');saveRight.append(create('div','psv3-savehelp','① 下書き保存 → ② 下の課題一覧で「公開する」を選択'),$('pslMessage'));
    savebar.append(actions,saveRight);shell.append(savebar);
    const list=card(shell,'✓','保存済み課題・公開操作','保存後に対象生徒を確認し、課題一覧から公開します');list.id='psv3SavedList';list.classList.add('psv3-list');
    const listHead=create('div','psv3-listheader');listHead.append(create('h3','','PicSpeak課題一覧'),$('pslReload'));list.append(listHead,$('pslList'));
    const gradeWrap=create('div','psv3-grade-wrap');gradeWrap.append($('pslGradebook'));list.append(gradeWrap);
    section.append(shell);
    // Old v2 remains in the DOM, but now contains none of the live inputs.
    beta.classList.add('psv3-ready');
    const outerHeading=beta.previousElementSibling;
    if(outerHeading?.classList.contains('psw-ps-heading'))outerHeading.style.display='none';
    goList.addEventListener('click',()=>list.scrollIntoView({behavior:'smooth',block:'start'}));
    for(const b of [individual,all]) b.addEventListener('click',()=>{
      audienceSelect.value=b.dataset.audience;
      audienceSelect.dispatchEvent(new Event('change',{bubbles:true}));
      refresh();
    });
    const theme=$('picSpeakBetaTheme'),mode=$('pslMode'),level=$('picSpeakBetaLevel'),time=$('picSpeakBetaDuration');
    const source=$('picSpeakBetaImage'); const listCheckboxes=$('pslRecipientList');
    let lastPreview='', broken='';
    function refresh(){
      const flash=mode.value==='picflash';
      wrappers.get('pslPassPercent').hidden=flash;
      wrappers.get('pslPassSeconds').hidden=!flash;
      const targeted=audienceSelect.value!=='class';
      recipients.hidden=!targeted;warning.hidden=targeted;hint.hidden=!targeted;
      for(const b of [individual,all])b.setAttribute('aria-pressed',String(b.dataset.audience===audienceSelect.value));
      recipientSummary.querySelector('b').textContent=listCheckboxes.querySelectorAll('input[type=checkbox]:checked').length+'名を選択';
      imageTitle.textContent=theme.selectedOptions?.[0]?.textContent?.trim()||'教材を選択してください';
      imageMeta.textContent=[mode.selectedOptions?.[0]?.textContent?.trim(),level.selectedOptions?.[0]?.textContent?.trim(),time.selectedOptions?.[0]?.textContent?.trim()].filter(Boolean).join(' · ');
      const src=source?.getAttribute('src')||'';
      const show=!!src && !flash && mode.value!=='story' && src!==broken;
      image.hidden=!show;fallback.hidden=show;
      fallback.textContent=flash?'PIC FLASH：タイムアタック教材':mode.value==='story'?'STORY：Retelling教材':'画像を選択してください';
      if(show && src!==lastPreview){lastPreview=src;image.src=src;}
    }
    image.addEventListener('error',()=>{broken=lastPreview;refresh();});
    for(const el of [audienceSelect,mode,theme,level,time])el.addEventListener('change',()=>setTimeout(refresh,0));
    listCheckboxes.addEventListener('change',refresh);
    const savedList=$('pslList');
    function markPublish(){
      for(const button of savedList.querySelectorAll('button')){
        const value=(button.textContent||'').trim();
        button.classList.toggle('psv3-publish',/^(公開|公開する|Publish)$/i.test(value));
      }
    }
    savedList.addEventListener('click',()=>setTimeout(()=>{refresh();markPublish();},200));
    new MutationObserver(markPublish).observe(savedList,{childList:true,subtree:true});
    markPublish();
    if(source)new MutationObserver(()=>{broken='';refresh();}).observe(source,{attributes:true,attributeFilter:['src']});
    new MutationObserver(refresh).observe(listCheckboxes,{childList:true,subtree:false});
    new MutationObserver(refresh).observe(theme,{childList:true});
    refresh();
    return true;
  }
  let started=false;
  function boot(){
    if(started)return;
    if(init()){started=true;return;}
    let tries=0;
    const timer=setInterval(()=>{tries++;if(init()||tries>=100){started=true;clearInterval(timer);}},100);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,350));
  else setTimeout(boot,350);
})();
