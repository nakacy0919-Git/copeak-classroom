/**
 * PicSpeak v4 teacher editor: presentation-only replacement for v3.
 * Relocates the ORIGINAL live controls, never clones inputs or changes submission logic.
 * Existing publication handler in picspeak-beta-drafts.js is the ONLY publish path.
 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const node = (tag, cls = '', text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const css = `
    #picSpeakBetaPanel.psv4-ready .psv-shell,#picSpeakBetaPanel.psv4-ready .psv3-shell{display:none!important}
    #picSpeakBetaPanel .psv4-shell{--ink:#173d34;--brand:#07836b;--line:#d9e8e2;--muted:#677e77;font:inherit;color:var(--ink);max-width:1180px;margin:auto}
    #picSpeakBetaPanel .psv4-shell *,#picSpeakBetaPanel .psv4-shell *::before,#picSpeakBetaPanel .psv4-shell *::after{box-sizing:border-box}
    #picSpeakBetaPanel .psv4-shell [hidden]{display:none!important}
    #picSpeakBetaPanel .psv4-header{display:flex;align-items:center;gap:10px;margin:0 0 13px}
    #picSpeakBetaPanel .psv4-header h2{font-size:21px;line-height:1.3;font-weight:850;margin:0}
    #picSpeakBetaPanel .psv4-header p{font-size:12px;color:var(--muted);margin:3px 0 0}
    #picSpeakBetaPanel .psv4-grid{display:grid;grid-template-columns:minmax(0,1.02fr) minmax(0,1fr);gap:14px;align-items:start}
    #picSpeakBetaPanel .psv4-column{min-width:0;display:grid;gap:12px}
    #picSpeakBetaPanel .psv4-card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:17px 18px;min-width:0}
    #picSpeakBetaPanel .psv4-head{display:flex;align-items:center;gap:10px;margin:0 0 13px}
    #picSpeakBetaPanel .psv4-number{display:grid;place-items:center;background:#e5f6ef;color:#007b62;font-size:13px;font-weight:850;border-radius:9px;width:30px;height:30px;flex:0 0 30px}
    #picSpeakBetaPanel .psv4-title{font-size:15px;margin:0;font-weight:850}
    #picSpeakBetaPanel .psv4-description{font-size:11px;color:var(--muted);margin:2px 0 0}
    #picSpeakBetaPanel .psv4-controlrow{display:grid;grid-template-columns:minmax(0,165px) minmax(0,1fr);gap:10px;align-items:end}
    #picSpeakBetaPanel .psv4-statsrow{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
    #picSpeakBetaPanel .psv4-control{display:flex!important;flex-direction:column!important;gap:5px!important;align-items:stretch!important;justify-content:start!important;min-width:0!important;width:100%!important;margin:0!important;height:auto!important;font-weight:750!important;font-size:12px!important;color:#35534b!important}
    #picSpeakBetaPanel .psv4-control input:not([type=checkbox]),#picSpeakBetaPanel .psv4-control select{background:#fff!important;border:1px solid #c6dbd1!important;border-radius:9px!important;box-shadow:none!important;min-height:42px!important;height:42px!important;padding:8px 11px!important;width:100%!important;min-width:0!important;max-width:100%!important;font-size:13px!important;color:#133b32!important;margin:0!important}
    #picSpeakBetaPanel .psv4-control :is(select,input):focus-visible,#picSpeakBetaPanel .psv4-shell button:focus-visible{outline:2px solid #079b79!important;outline-offset:2px!important}
    #picSpeakBetaPanel .psv4-fullfield{max-width:660px;margin-bottom:13px}
    #picSpeakBetaPanel .psv4-preview{margin:12px 0 0;overflow:hidden;border-radius:11px;border:1px solid #e0ebe6;background:#f2f7f5}
    #picSpeakBetaPanel .psv4-preview img{display:block;aspect-ratio:16/9;width:100%;object-fit:contain;max-height:265px;background:#edf3f0}
    #picSpeakBetaPanel .psv4-image-placeholder{min-height:166px;display:flex;align-items:center;justify-content:center;text-align:center;color:#668078;font-size:13px;padding:20px}
    #picSpeakBetaPanel .psv4-caption{padding:8px 11px;font-size:12px;color:#32594f;background:#fff;font-weight:700;overflow-wrap:anywhere}
    #picSpeakBetaPanel .psv4-conditions-help{font-size:11px;line-height:1.45;color:var(--muted);margin:10px 0 0}
    #picSpeakBetaPanel .psv4-class{max-width:380px}
    #picSpeakBetaPanel .psv4-tabs{display:grid;grid-template-columns:1fr 1fr;gap:5px;max-width:370px;padding:4px;border-radius:12px;border:1px solid #d2e5dd;background:#f2f6f4;margin:12px 0}
    #picSpeakBetaPanel .psv4-audience-button{border:0;border-radius:8px;padding:10px 12px;min-height:39px;background:transparent;color:#46665a;font-size:13px;font-weight:750;cursor:pointer}
    #picSpeakBetaPanel .psv4-audience-button[aria-pressed=true]{background:#087e69;color:#fff;box-shadow:0 1px 4px #16372a20}
    #picSpeakBetaPanel .psv4-recipient{border:1px solid #d9e9e2;background:#f8fbf9;border-radius:11px;padding:11px 12px}
    #picSpeakBetaPanel .psv4-recipientbar{display:flex;align-items:center;justify-content:space-between;margin:0 0 7px;gap:9px;font-size:12px;color:#42655b}
    #picSpeakBetaPanel .psv4-recipientbar strong{color:#007a63}
    #picSpeakBetaPanel .psv4-shell #pslRecipientList{border:1px solid #d9e5df!important;background:white!important;max-height:230px!important;min-height:0!important;height:auto!important;overflow-y:auto!important;border-radius:9px!important;padding:4px!important;margin:0!important}
    #picSpeakBetaPanel .psv4-shell #pslRecipientList label{display:flex!important;gap:10px!important;align-items:center!important;min-height:34px!important;padding:6px 9px!important;font-size:13px!important;font-weight:550!important;cursor:pointer!important;flex-direction:row!important}
    #picSpeakBetaPanel .psv4-shell #pslRecipientList input[type=checkbox]{height:17px!important;width:17px!important;min-width:17px!important;margin:0!important;accent-color:#058a72!important}
    #picSpeakBetaPanel .psv4-shell #pslRecipientStatus{font-size:11px!important;color:var(--muted)!important;margin:8px 0 0!important}
    #picSpeakBetaPanel .psv4-warning{border:1px solid #f3d2a4;color:#854d19;background:#fff7eb;border-radius:9px;padding:11px;font-size:12px;line-height:1.55}
    #picSpeakBetaPanel .psv4-hidden-holder{display:none!important}
    #picSpeakBetaPanel .psv4-dates{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    #picSpeakBetaPanel .psv4-actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap;padding:15px 0 10px}
    #picSpeakBetaPanel .psv4-actions button{padding:11px 18px!important;border-radius:9px!important;font-size:13px!important;font-weight:800!important;min-height:42px!important;cursor:pointer}
    #picSpeakBetaPanel .psv4-actions #pslSave{background:#fff!important;border:1px solid #b7d7cb!important;color:#086d59!important}
    #picSpeakBetaPanel .psv4-actions #psv4Publish{background:#087c67!important;border:1px solid #087c67!important;color:white!important}
    #picSpeakBetaPanel .psv4-actions #psv4Publish:disabled{cursor:not-allowed!important;opacity:.5!important}
    #picSpeakBetaPanel .psv4-actions #pslMessage{font-size:12px!important;flex:1 1 280px}
    #picSpeakBetaPanel .psv4-saved{border:1px solid var(--line);background:white;border-radius:14px;padding:17px 18px;margin-top:12px}
    #picSpeakBetaPanel .psv4-saved-header{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px}
    #picSpeakBetaPanel .psv4-saved-header h3{font-size:16px;margin:0;font-weight:850}
    #picSpeakBetaPanel .psv4-saved #pslList .psl-card{border:1px solid #e0eae5!important;background:#f9fbfa!important;border-radius:11px!important;padding:12px!important;margin:8px 0!important}
    #picSpeakBetaPanel .psv4-grades{overflow:auto}
    @media(max-width:850px){#picSpeakBetaPanel .psv4-grid{grid-template-columns:1fr}#picSpeakBetaPanel .psv4-controlrow{grid-template-columns:minmax(0,145px) minmax(0,1fr)}}
    @media(max-width:520px){#picSpeakBetaPanel .psv4-card{padding:13px}#picSpeakBetaPanel .psv4-statsrow{grid-template-columns:1fr 1fr}#picSpeakBetaPanel .psv4-dates{grid-template-columns:1fr}#picSpeakBetaPanel .psv4-controlrow{grid-template-columns:1fr}}
  `;
  function install() {
    const panel=$('picSpeakBetaPanel');
    if (!panel?.classList.contains('psv3-ready') || panel.classList.contains('psv4-ready')) return false;
    const section=panel.querySelector('.psl-teacher-section'),old=section?.querySelector('.psv3-shell');
    if (!section || !old) return false;
    const controls=['picSpeakBetaAssignmentTitle','pslMode','picSpeakBetaTheme','picSpeakBetaLevel','picSpeakBetaDuration','pslPassPercent','pslPassSeconds','picSpeakBetaClass','pslAudience','pslStudentFilter','picSpeakBetaRelease','picSpeakBetaDue'];
    const other=['pslRecipientList','pslRecipientStatus','pslSave','pslNew','pslReload','pslMessage','pslList','pslGradebook'];
    if ([...controls,...other].some(id=>!$(id) || !old.contains($(id)))) return false;
    // Cache live nodes before moving them into the detached new shell.
    const refs=new Map([...controls,...other,'picSpeakBetaImage'].map(id=>[id,$(id)]));
    const get=id=>refs.get(id);
    const wrappers=new Map();
    for (const id of controls){const el=$(id),w=el.closest('.psv-control');if(!w || !old.contains(w) || w.querySelectorAll('input,select,textarea').length!==1)return false;wrappers.set(id,w);}
    const style=node('style');style.id='psv4LayoutStyle';style.textContent=css;document.head.append(style);
    const form=(where,id)=>{const w=wrappers.get(id);w.classList.add('psv4-control');where.append(w);return get(id);};
    const card=(where,num,title,desc)=>{const c=node('section','psv4-card');const h=node('div','psv4-head');const info=node('div');info.append(node('h3','psv4-title',title),node('p','psv4-description',desc));h.append(node('span','psv4-number',String(num)),info);c.append(h);where.append(c);return c;};
    const shell=node('section','psv4-shell');
    const heading=node('header','psv4-header');const info=node('div');info.append(node('h2','','PicSpeak 課題の作成・管理'),node('p','','教材・学習条件・配布先・公開期間を設定します。'));heading.append(info);shell.append(heading);
    const name=node('div','psv4-fullfield');form(name,'picSpeakBetaAssignmentTitle');shell.append(name);
    const grid=node('div','psv4-grid');const left=node('div','psv4-column'),right=node('div','psv4-column');grid.append(left,right);shell.append(grid);
    const lesson=card(left,1,'教材を選ぶ','練習モードと画像教材を指定');const lessonRow=node('div','psv4-controlrow');form(lessonRow,'pslMode');form(lessonRow,'picSpeakBetaTheme');lesson.append(lessonRow);
    const preview=node('figure','psv4-preview');const previewImg=node('img');previewImg.alt='選択中のPicSpeak教材';previewImg.loading='eager';const placeholder=node('div','psv4-image-placeholder','教材を選択すると画像が表示されます');preview.append(previewImg,placeholder);lesson.append(preview);
    const metrics=card(left,2,'学習条件','レベル・時間・合格ライン');const metricsRow=node('div','psv4-statsrow');['picSpeakBetaLevel','picSpeakBetaDuration','pslPassPercent','pslPassSeconds'].forEach(id=>form(metricsRow,id));metrics.append(metricsRow,node('p','psv4-conditions-help','画像描写は達成率（%）で合否を判定します。PIC FLASHはクリアタイム（秒）です。'));
    const delivery=card(right,3,'配布先','クラスと配布範囲を選択');const classWrap=node('div','psv4-class');form(classWrap,'picSpeakBetaClass');delivery.append(classWrap);
    const hiddenHolder=node('div','psv4-hidden-holder');form(hiddenHolder,'pslAudience');form(hiddenHolder,'pslStudentFilter');hiddenHolder.append(get('pslNew'),get('pslReload'));delivery.append(hiddenHolder);
    const audience=get('pslAudience'),tabs=node('div','psv4-tabs');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','配布範囲');
    const classBtn=node('button','psv4-audience-button','クラス全員'),targetBtn=node('button','psv4-audience-button','個別配布');
    for(const [button,value] of [[classBtn,'class'],[targetBtn,'targeted']]){button.type='button';button.dataset.audience=value;button.addEventListener('click',()=>{audience.value=value;audience.dispatchEvent(new Event('change',{bubbles:true}));syncAudience();});}tabs.append(classBtn,targetBtn);delivery.append(tabs);
    const recipientBox=node('div','psv4-recipient');const rb=node('div','psv4-recipientbar');rb.append(node('span','','配布する生徒（出席番号順）'));const counter=node('strong','','0名選択');rb.append(counter);recipientBox.append(rb,get('pslRecipientList'),get('pslRecipientStatus'));delivery.append(recipientBox);
    const warning=node('div','psv4-warning','クラス全員に配布します。公開前に配布先を必ず確認してください。');delivery.append(warning);
    const schedule=card(right,4,'公開日・締切','公開期間を設定');const dates=node('div','psv4-dates');form(dates,'picSpeakBetaRelease');form(dates,'picSpeakBetaDue');schedule.append(dates);
    const actions=node('div','psv4-actions');actions.append(get('pslSave'));
    const publish=node('button');publish.type='button';publish.id='psv4Publish';publish.textContent='Publish Assignment';publish.disabled=true;publish.title='まず下書きを保存してください';actions.append(publish,get('pslMessage'));shell.append(actions);
    const list=node('section','psv4-saved');const lh=node('div','psv4-saved-header');lh.append(node('h3','','保存済みのPicSpeak課題'));list.append(lh,get('pslList'));const grades=node('div','psv4-grades');grades.append(get('pslGradebook'));list.append(grades);shell.append(list);
    section.append(shell);
    // The previous v2 and v3 shells stay in DOM, but no live input remains there.
    const mode=get('pslMode'),theme=get('picSpeakBetaTheme'),classSelect=get('picSpeakBetaClass'),recipients=get('pslRecipientList'),percent=wrappers.get('pslPassPercent'),seconds=wrappers.get('pslPassSeconds');
    // Display only: keep option values (lesson IDs and mode IDs) unchanged.
    const modeLabels={snapshot:'SNAPSHOT',mosaic:'MOSAIC',detective:'DETECTIVE',oralquest:'ORAL QUEST',story:'STORY',picflash:'PIC FLASH'};
    function shortenModeLabels(){
      for(const option of mode.options){
        const label=modeLabels[option.value];
        if(label && option.textContent!==label)option.textContent=label;
      }
    }
    function shortenNewLessonLabels(){
      for(const option of theme.options){
        const match=/^theme_l2_(\d{3})$/i.exec(option.value);
        if(!match)continue; // Keep legacy [301] and other mode titles intact.
        const number=String(Number(match[1]));
        const original=(option.textContent||'').trim();
        const name=original
          .replace(/^\[\s*theme_l2_\d{3}\s*\]\s*/i,'')
          .replace(/^theme_l2_\d{3}\s*/i,'')
          .replace(/^\[\s*\d{1,3}\s*\]\s*/,'')
          .trim();
        if(!name)continue;
        const label=`[${number}] ${name}`;
        if(option.textContent!==label)option.textContent=label;
      }
    }
    shortenModeLabels();shortenNewLessonLabels();
    // Preserve native <select> option values/IDs; change only the displayed class labels.
    function simplifyClasses(){
      const opts=Array.from(classSelect.options);const names=opts.map(o=>o.textContent.replace(/\s*[（(][0-9a-fA-F]{6,8}[)）]\s*$/,'').trim());const seen=new Map();
      opts.forEach((o,i)=>{const name=names[i];if(!name)return;const count=(seen.get(name)||0)+1;seen.set(name,count);const label=count>1?`${name}（別クラス ${count}）`:name;if(o.textContent!==label)o.textContent=label;});
    }
    const collator=new Intl.Collator('ja',{numeric:true,sensitivity:'base'});
    const seatNumber=label=>{const match=(label.textContent||'').match(/[（(]\s*(\d{1,3})\s*[)）]\s*$/);return match?Number(match[1]):Number.POSITIVE_INFINITY;};
    let sorting=false;
    function sortRecipients(){
      if(sorting)return;const labels=Array.from(recipients.children).filter(n=>n.matches?.('label'));
      const sorted=[...labels].sort((a,b)=>seatNumber(a)-seatNumber(b)||collator.compare(a.textContent,b.textContent));
      if(sorted.some((n,i)=>n!==labels[i])){sorting=true;recipients.append(...sorted);sorting=false;}
      counter.textContent=recipients.querySelectorAll('input[type=checkbox]:checked').length+'名選択';
    }
    function syncAudience(){const isTarget=audience.value!=='class';recipientBox.hidden=!isTarget;warning.hidden=isTarget;targetBtn.setAttribute('aria-pressed',String(isTarget));classBtn.setAttribute('aria-pressed',String(!isTarget));}
    function syncMetrics(){const flash=mode.value==='picflash';percent.hidden=flash;seconds.hidden=!flash;}
    // Image previews come from the PicSpeak lesson IDs, NOT the hidden legacy img src.
    const imageRoot='https://www.pic-speak-story.com/assets/images/';
    function pathFor(modeValue,id){
      if(modeValue==='snapshot'){
        if(/^theme_l2_\d{3}$/.test(id))return 'l2_'+id.slice(-3)+'.webp';
        if(/^(theme_)?\d{3,4}$/.test(id))return id.replace('theme_','')+'.webp';
      }
      if(modeValue==='mosaic' && /^mosaic_\d{3,4}$/.test(id))return 'mosaic/'+id.split('_')[1]+'.webp';
      if(modeValue==='detective' && /^detective_\d{3}$/.test(id))return 'detective/dete'+id.slice(-3)+'.webp';
      if(modeValue==='oralquest' && /^oq_\d{3}$/.test(id))return 'oralquest/oq'+id.slice(-3)+'.webp';
      return '';
    }
    let lastPreviewPath='',previewFailed='';
    function syncPreview(){
      const modeValue=mode.value,id=theme.value;
      const path=pathFor(modeValue,id);
      if(path!==lastPreviewPath){lastPreviewPath=path;previewFailed='';previewImg.removeAttribute('src');}
      const show=Boolean(path && previewFailed!==path);
      previewImg.hidden=!show;placeholder.hidden=show;
      if(show && !previewImg.getAttribute('src'))previewImg.src=imageRoot+path;
      if(!show)placeholder.textContent=modeValue==='story'?'STORYの場面画像は学習開始後に表示されます':modeValue==='picflash'?'PIC FLASH：単語タイムアタック':path?'プレビュー画像を取得できません':'教材を選択してください';
    }
    previewImg.addEventListener('error',()=>{previewFailed=lastPreviewPath;syncPreview();});
    // A saved draft may be published only through the ORIGINAL guarded list button.
    // Saving the draft remains a separate, explicit action; never publish automatically.
    let savedSnapshot=null;
    const valueSignature=()=>JSON.stringify([get('picSpeakBetaAssignmentTitle').value,mode.value,theme.value,classSelect.value,audience.value,get('picSpeakBetaLevel').value,get('picSpeakBetaDuration').value,get('pslPassPercent').value,get('pslPassSeconds').value,get('picSpeakBetaRelease').value,get('picSpeakBetaDue').value,Array.from(recipients.querySelectorAll('input[type=checkbox]:checked')).map(el=>el.value).sort()]);
    function matchingCard(){
      const title=get('picSpeakBetaAssignmentTitle').value.trim();if(!title)return null;
      const candidates=Array.from(get('pslList').querySelectorAll('.psl-card')).filter(card=>card.querySelector('strong')?.textContent?.trim()===title && (card.querySelector('.psl-muted')?.textContent||'').includes(theme.value));
      return candidates.length===1?candidates[0]:null;
    }
    function syncPublish(){
      const card=matchingCard(),pub=Array.from(card?.querySelectorAll('button')||[]).find(b=>b.textContent.trim()==='公開する');
      const valid=Boolean(savedSnapshot && savedSnapshot===valueSignature() && pub);
      publish.disabled=!valid;publish.title=valid?'配布先を確認して公開します':'公開前に「下書き保存」を押してください';
    }
    publish.addEventListener('click',()=>{const card=matchingCard();const pub=Array.from(card?.querySelectorAll('button')||[]).find(b=>b.textContent.trim()==='公開する');if(!publish.disabled && savedSnapshot===valueSignature() && pub){pub.click();}else{publish.disabled=true;}});
    const saveButton=get('pslSave');
    function syncSaveLabel(){
      const text=(saveButton.textContent||'').trim();
      const label=text.includes('変更')?'変更を保存':'下書き保存';
      if(text!==label)saveButton.textContent=label;
    }
    new MutationObserver(syncSaveLabel).observe(saveButton,{childList:true,characterData:true,subtree:true});
    syncSaveLabel();
    const msg=get('pslMessage');new MutationObserver(()=>{
      const v=msg.textContent||'';
      if(v.includes('課題と配布先を保存しました')){
        savedSnapshot=valueSignature();
        msg.textContent='下書きを保存しました。';
      }else if(v.includes('編集中:') || v.includes('新規課題') || v.includes('エラー:') || v.includes('公開'))savedSnapshot=null;
      syncPublish();
    }).observe(msg,{childList:true,characterData:true,subtree:true});
    const saved=get('pslList');new MutationObserver(syncPublish).observe(saved,{childList:true,subtree:false});
    for(const el of [mode,theme,get('picSpeakBetaLevel'),get('picSpeakBetaDuration'),get('picSpeakBetaAssignmentTitle'),classSelect,audience,get('pslPassPercent'),get('pslPassSeconds'),get('picSpeakBetaRelease'),get('picSpeakBetaDue')])el.addEventListener('change',()=>{syncPreview();syncMetrics();syncAudience();simplifyClasses();syncPublish();});
    get('picSpeakBetaAssignmentTitle').addEventListener('input',syncPublish);
    recipients.addEventListener('change',()=>{sortRecipients();syncPublish();});
    audience.addEventListener('change',syncAudience);
    new MutationObserver(()=>{sortRecipients();syncPublish();}).observe(recipients,{childList:true,subtree:false});
    new MutationObserver(()=>{simplifyClasses();}).observe(classSelect,{childList:true});
    new MutationObserver(()=>{shortenNewLessonLabels();syncPreview();syncPublish();}).observe(theme,{childList:true});
    const oldImage=get('picSpeakBetaImage');if(oldImage)new MutationObserver(syncPreview).observe(oldImage,{attributes:true,attributeFilter:['src']});
    sortRecipients();syncAudience();syncMetrics();simplifyClasses();syncPreview();syncPublish();
    panel.classList.add('psv4-ready');
    return true;
  }
  let finished=false;
  function boot(){if(finished)return;const p=$('picSpeakBetaPanel');if(p?.classList.contains('psv4-ready')){finished=true;return;}if(install()){finished=true;return;}if(++boot.attempts>=120){finished=true;console.warn('PicSpeak v4 not applied: expected v3 form not found; existing editor preserved.');return;}setTimeout(boot,100);}
  boot.attempts=0;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,500));else setTimeout(boot,500);
})();
