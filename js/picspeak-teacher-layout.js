/**
 * PicSpeak assignment workspace: visual-only redesign.
 * Moves ORIGINAL field nodes (never clones, never rewires saving/authentication).
 * Isolated from Copeak reading UI and all Supabase data modifications.
 */
(() => {
  'use strict';
  const STYLES = `
    #picSpeakBetaPanel.psv-ready{padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important;max-width:none!important}
    #picSpeakBetaPanel.psv-ready .psv-legacy-hidden{display:none!important}
    #picSpeakBetaPanel.psv-ready .psl-teacher-section{display:block!important;border:0!important;padding:0!important;margin:0!important;background:transparent!important;box-shadow:none!important}
    #picSpeakBetaPanel .psv-shell{--psv-ink:#18332f;--psv-brand:#087e6a;--psv-line:#dfebea;--psv-muted:#617777;color:var(--psv-ink);font-size:14px}
    #picSpeakBetaPanel .psv-shell *{box-sizing:border-box}
    #picSpeakBetaPanel .psv-shell .psv-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:2px 0 18px}
    #picSpeakBetaPanel .psv-shell .psv-head h2{margin:0;font-size:23px;line-height:1.35;color:#173630;font-weight:850}
    #picSpeakBetaPanel .psv-shell .psv-head p{margin:7px 0 0;color:var(--psv-muted);font-size:13px}
    #picSpeakBetaPanel .psv-shell .psv-headmark{font-size:11px;letter-spacing:.09em;font-weight:850;color:#008b73;margin-bottom:5px}
    #picSpeakBetaPanel .psv-shell .psv-pill{border:1px solid #bce7dc;padding:7px 11px;border-radius:999px;color:#08755f;background:#edf9f5;font-size:12px;font-weight:800;white-space:nowrap}
    #picSpeakBetaPanel .psv-shell .psv-layout{display:grid;grid-template-columns:minmax(0,1.85fr) minmax(275px,.9fr);gap:16px;align-items:start}
    #picSpeakBetaPanel .psv-shell .psv-main{display:grid;gap:13px;min-width:0}
    #picSpeakBetaPanel .psv-shell .psv-card{border:1px solid var(--psv-line);background:#fff;border-radius:16px;padding:18px 20px;box-shadow:0 3px 14px rgba(15,52,45,.035);min-width:0}
    #picSpeakBetaPanel .psv-shell .psv-cardhead{display:flex;align-items:center;gap:11px;margin-bottom:16px}
    #picSpeakBetaPanel .psv-shell .psv-step{display:flex;align-items:center;justify-content:center;width:28px;height:28px;flex:0 0 28px;border-radius:9px;background:#e8f7f1;color:#067963;font-size:14px;font-weight:900}
    #picSpeakBetaPanel .psv-shell .psv-cardtitle{margin:0;font-size:16px;line-height:1.3;font-weight:850;color:#173932}
    #picSpeakBetaPanel .psv-shell .psv-cardsub{font-size:11px;color:#70817e;margin-top:3px}
    #picSpeakBetaPanel .psv-shell .psv-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 14px;min-width:0}
    #picSpeakBetaPanel .psv-shell .psv-grid .psv-wide{grid-column:1/-1}
    #picSpeakBetaPanel .psv-shell .psv-control{display:flex!important;flex-direction:column!important;align-items:stretch!important;justify-content:flex-start!important;gap:7px!important;min-width:0!important;height:auto!important;max-height:none!important;font-size:13px!important;font-weight:750!important;color:#27463d!important}
    #picSpeakBetaPanel .psv-shell .psv-control>input,#picSpeakBetaPanel .psv-shell .psv-control>select{width:100%!important;min-width:0!important;max-width:100%!important;height:42px!important;min-height:42px!important;padding:8px 12px!important;background:#fff!important;border:1px solid #c9d8d4!important;border-radius:9px!important;font:inherit!important;font-weight:500!important;line-height:1.45!important;color:#193d36!important;box-shadow:none!important;margin:0!important}
    #picSpeakBetaPanel .psv-shell .psv-control>input:focus,#picSpeakBetaPanel .psv-shell .psv-control>select:focus{outline:2px solid #60c4a9!important;outline-offset:1px!important}
    #picSpeakBetaPanel .psv-shell .psv-control>input[type=checkbox]{width:18px!important;min-width:18px!important;height:18px!important;min-height:18px!important;padding:0!important;accent-color:#087e6a}
    #picSpeakBetaPanel .psv-shell .psv-help{font-size:12px;line-height:1.6;color:var(--psv-muted);margin:10px 0 0}
    #picSpeakBetaPanel .psv-shell .psv-recipient-section{margin-top:13px;border:1px solid #e1e9e8;border-radius:11px;background:#f9fcfb;padding:13px}
    #picSpeakBetaPanel .psv-shell .psv-recipient-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;font-size:12px;color:#42665c}
    #picSpeakBetaPanel .psv-shell .psv-recipient-count{font-weight:850;color:#087e6a}
    #picSpeakBetaPanel .psv-shell #pslRecipientList{height:auto;max-height:178px;overflow-y:auto;background:#fff;border:1px solid #d4e3df;border-radius:9px;padding:4px 7px}
    #picSpeakBetaPanel .psv-shell #pslRecipientList label{display:flex!important;flex-direction:row!important;align-items:center!important;gap:10px!important;font-size:13px!important;padding:7px 8px!important;min-height:35px!important}
    #picSpeakBetaPanel .psv-shell #pslRecipientList label[hidden]{display:none!important}
    #picSpeakBetaPanel .psv-shell #pslRecipientList input{height:17px!important;width:17px!important;min-width:17px!important;padding:0!important;accent-color:#087e6a}
    #picSpeakBetaPanel .psv-shell #pslRecipientStatus{margin:7px 0 0;font-size:11px!important;color:#6a8079}
    #picSpeakBetaPanel .psv-shell .psv-sidebar{min-width:0;position:sticky;top:12px;display:grid;gap:12px}
    #picSpeakBetaPanel .psv-shell .psv-preview{padding:14px 14px 15px;border-radius:15px;background:#fff;border:1px solid var(--psv-line)}
    #picSpeakBetaPanel .psv-shell .psv-preview h3{margin:0 0 11px;font-size:13px;color:#284a3f}
    #picSpeakBetaPanel .psv-shell .psv-preview-img{width:100%;aspect-ratio:16/9;display:block;object-fit:cover;border-radius:10px;background:linear-gradient(135deg,#ecf6f1,#e7edf8)}
    #picSpeakBetaPanel .psv-shell .psv-preview-placeholder{display:flex;align-items:center;justify-content:center;min-height:145px;border-radius:10px;background:#e9f3f1;text-align:center;color:#789089;padding:15px;font-size:13px}
    #picSpeakBetaPanel .psv-shell .psv-preview-title{font-size:14px;font-weight:800;margin-top:10px;overflow-wrap:anywhere}
    #picSpeakBetaPanel .psv-shell .psv-preview-meta{color:#6c807b;font-size:12px;line-height:1.6;margin-top:4px}
    #picSpeakBetaPanel .psv-shell .psv-preview-status{background:#f2f9f6;border:1px solid #d8eade;border-radius:11px;padding:11px 13px;color:#285f4e;font-size:12px;line-height:1.65}
    #picSpeakBetaPanel .psv-shell .psv-preview-status strong{display:block;font-size:12px;margin-bottom:3px}
    #picSpeakBetaPanel .psv-shell .psv-savebar{margin:0;padding:14px 17px;border:1px solid #d4e8df;border-radius:13px;background:#f2faf6;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
    #picSpeakBetaPanel .psv-shell .psv-savebar .psv-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    #picSpeakBetaPanel .psv-shell .psv-savebar button{font:inherit;font-size:13px;cursor:pointer;padding:10px 16px!important;height:43px;border-radius:9px}
    #picSpeakBetaPanel .psv-shell #pslSave{background:#07866c!important;color:white!important;border:1px solid #07866c!important;font-weight:800!important;min-width:154px}
    #picSpeakBetaPanel .psv-shell #pslNew{background:white!important;color:#245b4f!important;border:1px solid #cce0d9!important}
    #picSpeakBetaPanel .psv-shell #pslMessage{margin:0!important;font-size:12px!important;min-height:0!important;max-width:320px}
    #picSpeakBetaPanel .psv-shell .psv-list{margin-top:17px;padding:20px;background:#fff;border:1px solid var(--psv-line);border-radius:16px}
    #picSpeakBetaPanel .psv-shell .psv-listhead{display:flex;justify-content:space-between;align-items:center;gap:15px;flex-wrap:wrap;margin-bottom:10px}
    #picSpeakBetaPanel .psv-shell .psv-listhead h3{margin:0!important;font-size:18px!important;color:#173932}
    #picSpeakBetaPanel .psv-shell .psv-list #pslReload{font-size:12px;padding:8px 12px;background:#eff6f3;color:#24554b;border:1px solid #d1e5de;border-radius:9px}
    #picSpeakBetaPanel .psv-shell #pslList{margin-top:8px}
    #picSpeakBetaPanel .psv-shell #pslList .psl-card{border:1px solid #e2ebe9!important;background:#f9fbfa!important;border-radius:12px!important;padding:14px 16px!important;margin:10px 0!important}
    #picSpeakBetaPanel .psv-shell .psv-list #pslGradebook{overflow-x:auto}
    #picSpeakBetaPanel .psv-shell [hidden]{display:none!important}
    #picSpeakBetaPanel .psv-shell .psv-invalid{border:1px solid #efc2bc;background:#fff8f7;color:#a33531;border-radius:11px;padding:12px;font-size:13px}
    @media(max-width:1000px){#picSpeakBetaPanel .psv-shell .psv-layout{grid-template-columns:minmax(0,1fr) minmax(225px,.73fr)}#picSpeakBetaPanel .psv-shell .psv-card{padding:15px}}
    @media(max-width:740px){#picSpeakBetaPanel .psv-shell .psv-layout{grid-template-columns:1fr}#picSpeakBetaPanel .psv-shell .psv-sidebar{position:static;grid-row:1}#picSpeakBetaPanel .psv-shell .psv-preview img{max-height:200px}#picSpeakBetaPanel .psv-shell .psv-grid{grid-template-columns:1fr}#picSpeakBetaPanel .psv-shell .psv-head{align-items:flex-start}#picSpeakBetaPanel .psv-shell .psv-pill{white-space:normal}}
    @media(prefers-reduced-motion:reduce){#picSpeakBetaPanel .psv-shell *{scroll-behavior:auto!important}}
  `;

  const $ = id => document.getElementById(id);
  const make = (tag, cls, text) => {
    const element = document.createElement(tag);
    if (cls) element.className = cls;
    if (text != null) element.textContent = text;
    return element;
  };
  function appendField(container, id, { wide = false, label = null } = {}) {
    const el = $(id);
    if (!el) throw new Error(`Missing PicSpeak input: ${id}`);
    let control = el.closest('label');
    if (!control || !control.contains(el)) {
      control = el.parentElement;
    }
    if (!control || !control.closest('#picSpeakBetaPanel')) throw new Error(`PicSpeak field outside panel: ${id}`);
    // Never move a whole existing grid, and never move a wrapper with multiple fields.
    const controls = control.querySelectorAll('input,select,textarea');
    if (controls.length !== 1 || controls[0] !== el) throw new Error(`Unsupported PicSpeak wrapper: ${id}`);
    control.classList.add('psv-control');
    if (wide) control.classList.add('psv-wide');
    if (label) {
      const labelNode = Array.from(control.childNodes).find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
      if (labelNode) labelNode.textContent = label;
      else if (!control.querySelector('label')) {
        const text = make('span', 'psv-field-label', label);
        control.prepend(text);
      }
    }
    container.append(control);
    return el;
  }
  function card(parent, step, heading, subheading) {
    const section = make('section', 'psv-card');
    const header = make('div','psv-cardhead');
    header.append(make('span','psv-step',String(step)));
    const t = make('div');
    t.append(make('h3','psv-cardtitle',heading),make('div','psv-cardsub',subheading));
    header.append(t);
    section.append(header);
    parent.append(section);
    return section;
  }
  function init() {
    const beta = $('picSpeakBetaPanel');
    const section = beta?.querySelector('.psl-teacher-section');
    if (!beta || !section || beta.classList.contains('psv-ready')) return false;
    const required = [
      'pslMode','picSpeakBetaTheme','picSpeakBetaLevel','picSpeakBetaDuration',
      'picSpeakBetaAssignmentTitle','picSpeakBetaClass','picSpeakBetaRelease',
      'picSpeakBetaDue','pslPassPercent','pslPassSeconds','pslAudience',
      'pslStudentFilter','pslRecipientList','pslRecipientStatus',
      'pslSave','pslNew','pslReload','pslMessage','pslList','pslGradebook'
    ];
    if (required.some(id => !$(id))) return false;
    // Verify every wrapper BEFORE relocating anything; otherwise a layout change
    // could detach a live editor control if a different beta version is installed.
    const controlsToMove=[
      'pslMode','picSpeakBetaTheme','picSpeakBetaLevel','picSpeakBetaDuration',
      'pslPassPercent','pslPassSeconds','picSpeakBetaAssignmentTitle',
      'picSpeakBetaClass','pslAudience','pslStudentFilter',
      'picSpeakBetaRelease','picSpeakBetaDue'
    ];
    for(const id of controlsToMove){
      const control=$(id);
      const wrapper=control.closest('label')||control.parentElement;
      if(!wrapper||!beta.contains(wrapper)||
         wrapper.querySelectorAll('input,select,textarea').length!==1||
         wrapper.querySelector('input,select,textarea')!==control){
        console.warn('PicSpeak layout not applied. Unsupported field structure:',id);
        return false;
      }
    }
    if ($('psvLayoutStyle')) return true;
    const style = make('style'); style.id='psvLayoutStyle';style.textContent=STYLES;
    document.head.append(style);
    const shell = make('div','psv-shell');
    const head = make('header','psv-head');
    const headInfo = make('div');
    headInfo.append(make('div','psv-headmark','ASSIGNMENT MANAGER'),make('h2','', 'PicSpeak 課題の作成・管理'),make('p','', '必要な項目を順番に設定し、最後に保存します。'));
    head.append(headInfo,make('span','psv-pill','画像描写・スピーキング専用'));
    const layout = make('div','psv-layout'), main = make('div','psv-main'), aside = make('aside','psv-sidebar');
    layout.append(main,aside);shell.append(head,layout);

    const lesson=card(main,1,'教材を選ぶ','練習モードと画像教材を指定します');
    const lessonGrid=make('div','psv-grid');lesson.append(lessonGrid);
    appendField(lessonGrid,'pslMode');
    appendField(lessonGrid,'picSpeakBetaTheme');

    const settings=card(main,2,'学習条件','レベル・制限時間・合格ライン');
    const settingsGrid=make('div','psv-grid');settings.append(settingsGrid);
    appendField(settingsGrid,'picSpeakBetaLevel');
    appendField(settingsGrid,'picSpeakBetaDuration');
    const percentField=appendField(settingsGrid,'pslPassPercent').closest('.psv-control');percentField.classList.add('psv-metric-percent');
    const secondsField=appendField(settingsGrid,'pslPassSeconds').closest('.psv-control');secondsField.classList.add('psv-metric-seconds');
    settings.append(make('p','psv-help','SNAPSHOTなどは「達成率（％）」で判定します。PIC FLASHのみ「秒数」で判定します。'));

    const delivery=card(main,3,'課題名と配布先','Testなど特定の生徒にも個別配布できます');
    const deliveryGrid=make('div','psv-grid');delivery.append(deliveryGrid);
    appendField(deliveryGrid,'picSpeakBetaAssignmentTitle',{wide:true});
    appendField(deliveryGrid,'picSpeakBetaClass');
    appendField(deliveryGrid,'pslAudience');
    const recipients = make('div','psv-recipient-section');
    recipients.id = 'psvRecipientSection';
    const toolbar=make('div','psv-recipient-bar');
    toolbar.append(make('span','', '配布する生徒'),make('span','psv-recipient-count','0名を選択'));
    recipients.append(toolbar);
    appendField(recipients,'pslStudentFilter');
    recipients.append($('pslRecipientList'),$('pslRecipientStatus'));
    delivery.append(recipients);
    delivery.append(make('p','psv-help','「生徒を指定」を推奨します。クラス全員への配布は明示的に切り替えてください。'));

    const publish=card(main,4,'公開期間と保存','公開日時と締切を設定します');
    const publishGrid=make('div','psv-grid');publish.append(publishGrid);
    appendField(publishGrid,'picSpeakBetaRelease');
    appendField(publishGrid,'picSpeakBetaDue');
    publish.append(make('p','psv-help','保存時は下書きです。公開する場合は、下の「保存済み課題」から公開してください。'));
    const bar=make('div','psv-savebar');
    const buttons=make('div','psv-actions');buttons.append($('pslSave'),$('pslNew'));
    bar.append(buttons,$('pslMessage'));main.append(bar);

    const preview=make('section','psv-preview');
    preview.append(make('h3','','選択した教材のプレビュー'));
    const image=make('img','psv-preview-img');image.alt='教材プレビュー'; image.loading='lazy';
    const placeholder=make('div','psv-preview-placeholder','教材を選ぶと画像が表示されます');
    preview.append(image,placeholder);
    const previewTitle=make('div','psv-preview-title','—'),previewMeta=make('div','psv-preview-meta','—');
    preview.append(previewTitle,previewMeta);
    const info=make('div','psv-preview-status');info.append(make('strong','','配布前に必ず確認'),document.createTextNode('公開先と課題名を確認してから保存してください。成績はCopeak音読と分けて管理します。'));
    aside.append(preview,info);

    const saved=make('section','psv-list');
    const savedHead=make('div','psv-listhead'); savedHead.append(make('h3','','保存済みのPicSpeak課題'),$('pslReload'));
    saved.append(savedHead,$('pslList'),$('pslGradebook'));
    shell.append(saved);section.append(shell);
    // Hide obsolete preview and duplicate beta fields without removing DOM nodes.
    // This also supports beta panels where the manager is nested in another div.
    for(const child of Array.from(section.children)){
      if(child!==shell)child.classList.add('psv-legacy-hidden');
    }
    for(let current=section;current!==beta;current=current.parentElement){
      const parent=current.parentElement;
      if(!parent||!beta.contains(parent))break;
      for(const child of Array.from(parent.children)){
        if(child!==current)child.classList.add('psv-legacy-hidden');
      }
    }
    beta.classList.add('psv-ready');

    const src=$('picSpeakBetaImage');
    const mode=$('pslMode'),theme=$('picSpeakBetaTheme'),level=$('picSpeakBetaLevel'),duration=$('picSpeakBetaDuration'),audience=$('pslAudience'),recList=$('pslRecipientList');
    let imageError=false;
    function update(){
      const m=mode.value,flash=m==='picflash';
      secondsField.hidden=!flash;percentField.hidden=flash;
      recipients.hidden=audience.value!=='targeted';
      const count=recList.querySelectorAll('input[type="checkbox"]:checked').length;
      toolbar.lastChild.textContent = count+'名を選択';
      const option=theme.selectedOptions?.[0];
      previewTitle.textContent=option?.textContent?.trim() || '教材を選択してください';
      const modeName=mode.selectedOptions?.[0]?.textContent?.trim() || m;
      const levelName=level.selectedOptions?.[0]?.textContent?.trim() || level.value;
      previewMeta.textContent=modeName+' · '+levelName+' · '+duration.value+'秒';
      const url=src?.getAttribute('src');
      const show=!!url && !flash && m!=='story' && !imageError;
      image.hidden=!show;placeholder.hidden=show;
      placeholder.textContent=flash?'PIC FLASH：単語のタイムアタック教材です':m==='story'?'STORY：ストーリーのRetelling教材です':'教材画像を読み込み中です';
      if(show && image.getAttribute('src')!==url)image.src=url;
    }
    image.addEventListener('error',()=>{imageError=true;update();});
    for(const field of [mode,theme,level,duration,audience])field.addEventListener('change',()=>{imageError=false;setTimeout(update,0);});
    recList.addEventListener('change',update);
    if(src)new MutationObserver(()=>{imageError=false;update();}).observe(src,{attributes:true,attributeFilter:['src']});
    new MutationObserver(update).observe(recList,{childList:true,subtree:false});
    const list=$('pslList');
    list.addEventListener('click',()=>{setTimeout(()=>{imageError=false;update();},150);});
    // The existing editor assigns values synchronously after async class and recipient fetches.
    const observer=new MutationObserver(()=>{imageError=false;update();});
    observer.observe(theme,{childList:true});
    update();
    return true;
  }
  function boot() {
    if(init())return;
    // Initial beta editor is built by a separate module on DOMContentLoaded.
    let tries=0;
    const interval=setInterval(()=>{tries++;if(init()||tries>=30)clearInterval(interval);},100);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,150));
  else setTimeout(boot,150);
})();
