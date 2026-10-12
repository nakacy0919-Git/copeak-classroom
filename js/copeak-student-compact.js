/* Copeak Classroom | Student Focus Board
 * 2026-10-12: Compact first-screen assignments and keyboard-accessible detail modal.
 * Existing cards and their actual launch handlers remain the source of truth.
 */
(() => {
  'use strict';

  const css = `
  #csoBoard, #csoModal {box-sizing:border-box;font-family:inherit}
  #csoBoard *, #csoModal *{box-sizing:border-box}
  #csoBoard [hidden], #csoModal [hidden]{display:none!important}
  body.cso-enabled .student-next-assignment,
  body.cso-enabled .student-metrics,
  body.cso-enabled .student-roadmap,
  body.cso-enabled .psl-student-section {display:none!important}
  body.cso-enabled .student-progress-hero {padding:18px 22px!important;margin-bottom:10px!important;min-height:0!important;gap:15px!important}
  body.cso-enabled .student-progress-copy h1{font-size:clamp(23px,2.7vw,32px)!important;line-height:1.15;margin:4px 0!important}
  body.cso-enabled .student-progress-copy p{margin:4px 0!important;font-size:12px}
  body.cso-enabled .student-progress-summary{padding:13px 16px!important;min-height:0!important}
  #csoBoard{border:1px solid #d8e7e0;border-radius:19px;background:#fff;padding:18px 18px 13px;margin:0 0 12px;box-shadow:0 8px 25px rgba(20,64,49,.035);max-width:100%;min-width:0}
  #csoBoard .cso-top{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap}
  #csoBoard h2{margin:0;font-size:19px;line-height:1.3;color:#123e32;letter-spacing:-.035em}
  #csoBoard .cso-eyebrow{display:block;color:#087b61;font-size:10px;font-weight:850;letter-spacing:.13em;margin-bottom:4px}
  #csoBoard .cso-help{color:#6b7f77;font-size:11px;margin:3px 0 0}
  #csoBoard .cso-counts{display:flex;gap:7px;align-items:stretch;flex-wrap:wrap}
  #csoBoard .cso-count{display:flex;align-items:baseline;gap:6px;border-radius:10px;background:#f1f7f4;padding:9px 12px;color:#45695e;font-size:11px;font-weight:750;white-space:nowrap}
  #csoBoard .cso-count strong{font-size:19px;line-height:1;color:#0c785d;font-variant-numeric:tabular-nums}
  #csoBoard .cso-count.cso-urgent{background:#fff2e6;color:#ae6327}
  #csoBoard .cso-count.cso-urgent strong{color:#ba5b17}
  #csoBoard .cso-tally{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin:12px 0 10px;color:#586c66;font-size:11px}
  #csoBoard .cso-tally>span{padding:5px 9px;border-radius:7px;background:#f2f6f5}
  #csoBoard .cso-tally .cso-read{background:#e9f7f1;color:#006f55}
  #csoBoard .cso-tally .cso-pic{background:#eeefff;color:#4b47aa}
  #csoBoard .cso-filters{display:flex;gap:5px;flex-wrap:wrap;align-items:center}
  #csoBoard button{cursor:pointer;font-family:inherit}
  #csoBoard .cso-filter{border:1px solid #dce7e3;background:#fff;border-radius:9px;padding:7px 11px;font-size:12px;font-weight:750;color:#56716a;white-space:nowrap}
  #csoBoard .cso-filter[aria-pressed="true"]{background:#007e62;color:#fff;border-color:#007e62}
  #csoBoard .cso-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:12px 0 9px}
  #csoBoard .cso-tile{position:relative;min-width:0;width:100%;min-height:104px;text-align:left;padding:10px 12px;border-radius:12px;border:1px solid #d8e9e1;border-left:4px solid #009a71;background:#f6fcf9;display:flex;flex-direction:column;gap:5px;transition:transform .14s,box-shadow .14s,border-color .14s}
  #csoBoard .cso-tile:hover,#csoBoard .cso-tile:focus-visible{transform:translateY(-2px);box-shadow:0 9px 18px rgba(0,79,62,.10);outline:2px solid #80c2ad;outline-offset:0}
  #csoBoard .cso-tile.cso-picspeak{border-color:#dce0fd;border-left-color:#6661dc;background:#f7f7ff}
  #csoBoard .cso-tile.cso-picspeak:hover,#csoBoard .cso-tile.cso-picspeak:focus-visible{outline-color:#adaaf3}
  #csoBoard .cso-tile.cso-done{background:#fbfdfc;border-left-color:#a3b5ad;opacity:.82}
  #csoBoard .cso-tile.cso-overdue{border-left-color:#e98443;background:#fffbf7}
  #csoBoard .cso-mode{font-size:10px;line-height:1.2;font-weight:850;letter-spacing:.035em;color:#007e62;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #csoBoard .cso-picspeak .cso-mode{color:#5956b7}
  #csoBoard .cso-title{color:#193d33;font-size:13px;line-height:1.35;font-weight:800;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;overflow:hidden;min-height:18px;word-break:break-word}
  #csoBoard .cso-bottom{display:flex;justify-content:space-between;align-items:center;gap:4px;margin-top:auto;font-size:10px;color:#61766c}
  #csoBoard .cso-action{font-weight:800;color:#007c64;white-space:nowrap}
  #csoBoard .cso-picspeak .cso-action{color:#5b53bb}
  #csoBoard .cso-badge{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:72%}
  #csoBoard .cso-tile.cso-done .cso-action{color:#698178}
  #csoBoard .cso-empty{grid-column:1/-1;text-align:center;color:#657a71;font-size:13px;padding:22px 14px;background:#f7faf9;border-radius:11px}
  #csoBoard .cso-bottomrow{min-height:31px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
  #csoBoard .cso-page{display:flex;align-items:center;justify-content:center;gap:10px;font-size:11px;color:#63786f;margin:auto}
  #csoBoard .cso-page button{border:1px solid #d7e5de;background:#fff;border-radius:7px;padding:6px 10px;font-size:12px;font-weight:700}
  #csoBoard .cso-page button:disabled{opacity:.35;cursor:default}
  #csoBoard .cso-ranking{border-top:1px solid #edf1ef;margin-top:9px;padding-top:9px;min-width:0}
  #csoBoard .cso-ranking>summary{cursor:pointer;list-style:none;color:#527166;font-size:12px;font-weight:750;display:flex;align-items:center;gap:7px}
  #csoBoard .cso-ranking>summary::-webkit-details-marker{display:none}
  #csoBoard .cso-ranking>summary::before{content:'▸';font-size:12px;color:#0a8464}
  #csoBoard .cso-ranking[open]>summary::before{content:'▾'}
  #csoBoard .cso-ranking #studentReadingRankCard{margin:10px 0 0!important;padding:14px!important;box-shadow:none!important;border:1px solid #e6efea!important;max-width:100%}
  #csoBoard .cso-ranking .student-rank-heading p{display:none}
  #csoBoard .cso-ranking .student-rank-heading h2{font-size:15px}
  #csoModal{position:fixed;inset:0;z-index:2147482000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(8,28,24,.60);backdrop-filter:blur(4px)}
  #csoModal[hidden]{display:none!important}
  #csoModal .cso-dialog{width:min(850px,100%);max-height:min(92dvh,960px);display:flex;flex-direction:column;background:#fff;border-radius:20px;box-shadow:0 24px 80px rgba(0,0,0,.25);overflow:hidden}
  #csoModal .cso-dialogtop{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;border-bottom:1px solid #e1eae7;padding:17px 19px;background:linear-gradient(110deg,#f1faf6,#fff)}
  #csoModal .cso-dialogtop.cso-picspeak{background:linear-gradient(110deg,#f1f0ff,#fff)}
  #csoModal .cso-modaltype{font-size:11px;font-weight:850;color:#007c62;letter-spacing:.09em;margin-bottom:5px}
  #csoModal .cso-picspeak .cso-modaltype{color:#5f57c9}
  #csoModal .cso-modaltitle{font-size:clamp(17px,2.6vw,22px);line-height:1.3;font-weight:850;margin:0;color:#143a30;word-break:break-word}
  #csoModal .cso-modalstatus{color:#6e8179;font-size:12px;margin-top:5px}
  #csoModal .cso-close{flex:none;border:1px solid #d9e8e1;background:#fff;color:#315449;border-radius:10px;padding:8px 11px;font-size:18px;line-height:1;cursor:pointer}
  #csoModal .cso-close:hover{background:#eef7f3}
  #csoModal .cso-modalbody{padding:16px 19px 22px;overflow-y:auto;overscroll-behavior:contain;min-height:0}
  #csoModal .cso-quickstats{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:12px}
  #csoModal .cso-quickstat{display:flex;gap:6px;align-items:baseline;background:#f1f7f4;border-radius:10px;padding:11px 14px;min-width:115px;color:#527167;font-size:12px}
  #csoModal .cso-quickstat strong{font-size:20px;color:#00816a}
  #csoModal .cso-source .student-assignment-card{margin:0!important;max-width:none!important}
  #csoModal .cso-source .psl-card{border:1px solid #dce0f1;border-radius:12px;background:#f9faff;padding:14px;display:grid;grid-template-columns:minmax(0,1fr) minmax(150px,180px);gap:8px;align-items:center}
  #csoModal .cso-source .psl-card>h3{margin:0;grid-column:1;font-size:17px;color:#223956}
  #csoModal .cso-source .psl-card>.psl-chip{grid-column:1;justify-self:start;background:#e2e8f0;border-radius:20px;padding:4px 9px;font-size:11px}
  #csoModal .cso-source .psl-card>.psl-chip.ok{background:#dcfce7;color:#166534}
  #csoModal .cso-source .psl-subtitle{grid-column:1;color:#64748b;font-size:12px;margin:0}
  #csoModal .cso-source .psl-scores{grid-column:1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
  #csoModal .cso-source .psl-scores>div{text-align:center;background:#eef1fb;border-radius:9px;padding:10px 5px;font-size:11px;color:#5a6580}
  #csoModal .cso-source .psl-scores strong{display:block;font-size:19px;color:#283d73}
  #csoModal .cso-source .psl-card-actions{grid-column:2;grid-row:1 / span 4;display:flex;flex-direction:column;gap:9px}
  #csoModal .cso-source .psl-card-actions button{border:0;border-radius:10px;background:#e8ecfa;color:#344f89;font-weight:800;padding:12px 10px;cursor:pointer}
  #csoModal .cso-source .psl-card-actions .psl-challenge{background:#4e57d8;color:#fff}
  #csoModal .cso-source .psl-card-actions button:disabled{background:#d3dae7;color:#8592a8;cursor:not-allowed}
  #csoModal .cso-source .psl-detail{grid-column:1 / -1;border-top:1px solid #dce0ef;padding-top:10px;font-size:12px;color:#536577}
  #csoModal .cso-source .psl-trend{display:flex;align-items:end;height:62px;gap:5px}
  #csoModal .cso-source .psl-trend span{display:block;width:20px;min-height:3px;background:#818cf8;border-radius:4px 4px 0 0}
  #csoModal .cso-hint{font-size:11px;color:#789086;margin:12px 0 0;text-align:center}
  @media(max-width:900px){#csoBoard .cso-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
  @media(max-width:710px){#csoBoard .cso-grid{grid-template-columns:repeat(2,minmax(0,1fr))}#csoBoard .cso-top{align-items:flex-start}#csoBoard .cso-tile{min-height:94px}body.cso-enabled .student-progress-hero{padding:13px!important}#csoBoard{padding:12px}}
  @media(max-width:550px){#csoModal{padding:8px}#csoModal .cso-dialog{border-radius:14px;max-height:95dvh}#csoModal .cso-modalbody{padding:12px}#csoModal .cso-dialogtop{padding:12px}#csoModal .cso-source .psl-card{grid-template-columns:1fr}#csoModal .cso-source .psl-card-actions{grid-column:1;grid-row:auto;flex-direction:row;flex-wrap:wrap}#csoModal .cso-source .psl-card-actions button{flex:1;min-width:110px}#csoModal .cso-source .psl-scores{grid-column:1}#csoBoard .cso-grid{gap:7px}#csoBoard .cso-tile{padding:9px}#csoBoard .cso-count{padding:7px 9px}}
  @media(prefers-reduced-motion:reduce){#csoBoard .cso-tile{transition:none}#csoModal{backdrop-filter:none}}
  `;

  const state = {filter:'todo',page:0,selected:null,items:[],modalOpen:false,restoreFocus:null,prevOverflow:''};
  let board, grid, tally, totals, filters, pager, modal, modalBody, modalTitle, modalType, modalStatus, modalTop;
  let readingList, picList, rankPanel, rankWatch;
  let pendingRender = false;
  const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
  const short=(s,n=115)=>String(s||'').slice(0,n);
  const M_LABEL={SNAPSHOT:'SNAPSHOT',MOSAIC:'MOSAIC',DETECTIVE:'DETECTIVE',ORALQUEST:'ORAL QUEST',STORY:'STORY',PICFLASH:'PIC FLASH'};

  function mountBoard(){
    readingList=document.getElementById('assignmentList');
    const hero=document.querySelector('.student-progress-hero');
    if(!readingList||!hero)return false;
    const st=make('style');st.id='csoStyles';st.textContent=css;document.head.append(st);
    board=make('section');board.id='csoBoard';board.setAttribute('aria-label','課題一覧・学習状況');
    const head=make('div','cso-top');
    const title=make('div');title.append(make('span','cso-eyebrow','YOUR TASKS'),make('h2','','取り組む課題'),make('p','cso-help','カードを押すと成績と挑戦ボタンが表示されます'));
    head.append(title);totals=make('div','cso-counts');head.append(totals);board.append(head);
    tally=make('div','cso-tally');board.append(tally);
    const filterWrap=make('div','cso-filters');
    for(const [value,label] of [['todo','未完了'],['done','完了・合格'],['all','すべて']]){
      const b=make('button','cso-filter',label);b.type='button';b.dataset.filter=value;b.setAttribute('aria-pressed','false');
      b.addEventListener('click',()=>{state.filter=value;state.page=0;render();});filterWrap.append(b);
    }
    board.append(filterWrap);filters=filterWrap;
    grid=make('div','cso-grid');board.append(grid);
    pager=make('div','cso-bottomrow');board.append(pager);
    const rank=make('details','cso-ranking');rank.id='csoRanking';
    rank.append(make('summary','','📊 課題別クラス順位を見る（必要なときだけ開く）'));
    rankPanel=make('div');rank.append(rankPanel);board.append(rank);
    hero.insertAdjacentElement('afterend',board);
    buildModal();document.body.classList.add('cso-enabled');
    moveRanking();
    if(!document.getElementById('studentReadingRankCard')){
      rankWatch=new MutationObserver(()=>moveRanking());rankWatch.observe(document.body,{childList:true,subtree:false});
      const metrics=document.querySelector('.student-metrics');if(metrics?.parentElement && metrics.parentElement!==document.body){rankWatch.disconnect();rankWatch.observe(metrics.parentElement,{childList:true});}
    }
    return true;
  }

  function moveRanking(){
    const rank=document.getElementById('studentReadingRankCard');
    if(rank&&rankPanel&&rank.parentElement!==rankPanel){rankPanel.append(rank);rankWatch?.disconnect();rankWatch=null;}
  }

  function buildModal(){
    modal=make('div');modal.id='csoModal';modal.hidden=true;modal.setAttribute('aria-hidden','true');
    const dialog=make('section','cso-dialog');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','csoModalTitle');
    modalTop=make('header','cso-dialogtop');
    const summary=make('div');modalType=make('div','cso-modaltype');modalTitle=make('h2','cso-modaltitle');modalTitle.id='csoModalTitle';modalStatus=make('div','cso-modalstatus');summary.append(modalType,modalTitle,modalStatus);
    const close=make('button','cso-close','×');close.type='button';close.setAttribute('aria-label','詳細を閉じる');close.addEventListener('click',closeModal);
    modalTop.append(summary,close);dialog.append(modalTop);modalBody=make('div','cso-modalbody');dialog.append(modalBody);modal.append(dialog);document.body.append(modal);
    modal.addEventListener('click',e=>{if(e.target===modal)closeModal();});
    modal.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();closeModal();return;}
      if(e.key!=='Tab')return;
      const active=[...dialog.querySelectorAll('button:not(:disabled),select:not(:disabled),a[href],input:not(:disabled),[tabindex]:not([tabindex="-1"])')].filter(x=>x.getClientRects().length);
      if(!active.length)return;
      const first=active[0],last=active[active.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    });
  }

  function closeModal(){
    if(!state.modalOpen)return;
    state.modalOpen=false;modal.hidden=true;modal.setAttribute('aria-hidden','true');document.body.style.overflow=state.prevOverflow;
    state.restoreFocus?.isConnected&&state.restoreFocus.focus();state.restoreFocus=null;
  }

  const keyOf=(type,card,i)=>type+':'+(card.querySelector('.start-btn')?.dataset.id||card.querySelector('h3')?.textContent?.trim()||card.querySelector('.assignment-title')?.textContent?.trim()||i);
  function readItems(){
    const rows=[];
    readingList.querySelectorAll('.student-assignment-card').forEach((card,i)=>{
      const title=card.querySelector('.assignment-title')?.textContent?.trim()||'Copeak課題';
      const status=card.querySelector('.student-status-badge')?.textContent?.trim()||'未完了';
      const k=card.dataset.status||'';
      const done=k==='done'||(!k&&!/未完了|未達成|未着手|練習中/.test(status)&&/提出済み|完了|completed|合格/i.test(status));
      const upcoming=k==='upcoming'||/公開前/.test(status);
      const overdue=k==='late'||/締切終了|締切済み/.test(status);
      rows.push({key:keyOf('copeak',card,i),type:'copeak',title,status,done,upcoming,overdue,source:card,
        accuracy:card.dataset.csoAccuracy||'',wpm:card.dataset.csoWpm||''});
    });
    if(picList){picList.querySelectorAll('.psl-card').forEach((card,i)=>{
      const title=card.querySelector('h3')?.textContent?.trim()||'PicSpeak課題';
      const status=card.querySelector('.psl-chip')?.textContent?.trim()||'未完了';
      const subtitle=card.querySelector('.psl-subtitle')?.textContent?.trim()||'';
      const mode=(subtitle.split(/[•·]/)[0]||'').trim().toUpperCase();
      rows.push({key:keyOf('picspeak',card,i),type:'picspeak',title,status,subtitle,mode,done:/合格/.test(status),upcoming:/公開前/.test(status),overdue:/締切済み|締切終了/.test(status),source:card});
    });}
    return rows;
  }

  function addCount(n,label,urgent=false){const c=make('div','cso-count'+(urgent?' cso-urgent':''));c.append(make('strong','',n),make('span','',label));totals.append(c);}
  function addTally(s,cls){tally.append(make('span',cls,s));}

  function render(){
    if(!board)return;
    state.items=readItems();
    const all=state.items,pending=all.filter(x=>!x.done),done=all.filter(x=>x.done);
    const pendingRead=pending.filter(x=>x.type==='copeak').length;
    const pendingPic=pending.filter(x=>x.type==='picspeak').length;
    totals.replaceChildren();addCount(pending.length,'件 未完了',pending.length>0);addCount(done.length,'件 完了・合格');
    tally.replaceChildren();addTally('Copeak 残り '+pendingRead+'件','cso-read');addTally('PicSpeak 残り '+pendingPic+'件','cso-pic');
    const accuracy=document.getElementById('avgAccuracy')?.textContent?.trim(),wpm=document.getElementById('bestWpm')?.textContent?.trim();
    if(accuracy&&accuracy!=='—')addTally('平均 Accuracy '+accuracy,'');
    if(wpm&&wpm!=='—')addTally('最高 WPM '+wpm,'');
    const view=state.filter==='all'?all:(state.filter==='done'?done:pending);
    const pageSize=12,maxPage=Math.max(0,Math.ceil(view.length/pageSize)-1);
    state.page=Math.max(0,Math.min(state.page,maxPage));
    grid.replaceChildren();
    const slice=view.slice(state.page*pageSize,(state.page+1)*pageSize);
    for(const item of slice){
      const b=make('button','cso-tile cso-'+item.type+(item.done?' cso-done':'')+(item.overdue?' cso-overdue':''));b.type='button';b.title=item.title+' — '+item.status;
      b.setAttribute('aria-label',((item.type==='copeak'?'Copeak':'PicSpeak '+(item.mode||''))+' '+item.title+'。'+item.status+'。詳細を見る'));
      b.append(make('span','cso-mode',item.type==='copeak'?'● COPEAK · 音読':'◆ PICSPEAK · '+(M_LABEL[item.mode?.replace(/\s/g,'')]||item.mode||'画像描写')),
        make('strong','cso-title',item.title));
      const bottom=make('div','cso-bottom');bottom.append(make('span','cso-badge',item.status),make('span','cso-action',item.done?'成果を見る ↗':'詳細を見る ↗'));b.append(bottom);
      b.addEventListener('click',()=>openModal(item,b));grid.append(b);
    }
    if(!slice.length)grid.append(make('div','cso-empty',state.filter==='todo'?'未完了の課題はありません。':'該当する課題はありません。'));
    for(const f of filters.querySelectorAll('button'))f.setAttribute('aria-pressed',String(f.dataset.filter===state.filter));
    pager.replaceChildren();
    if(view.length>pageSize){
      const pag=make('div','cso-page');const prev=make('button','','← 前へ');prev.type='button';prev.disabled=state.page===0;prev.addEventListener('click',()=>{state.page--;render();});
      const curr=make('span','',`${state.page+1} / ${maxPage+1} ページ・${view.length}件`);
      const next=make('button','','次へ →');next.type='button';next.disabled=state.page===maxPage;next.addEventListener('click',()=>{state.page++;render();});pag.append(prev,curr,next);pager.append(pag);
    }else{pager.append(make('span','cso-help',view.length?`${view.length}件を表示中`:'結果はありません'));}
    if(state.modalOpen){
      const refreshed=all.find(x=>x.key===state.selected);
      if(refreshed)showModalContent(refreshed);else closeModal();
    }
  }

  function openModal(item,origin){
    state.selected=item.key;state.restoreFocus=origin;state.prevOverflow=document.body.style.overflow;
    state.modalOpen=true;modal.hidden=false;modal.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';showModalContent(item);
    modal.querySelector('.cso-close').focus();
  }

  function showModalContent(item){
    modalTop.classList.toggle('cso-picspeak',item.type==='picspeak');
    modalType.textContent=item.type==='copeak'?'COPEAK · 音読の成果':'PICSPEAK · '+(item.mode||'画像描写')+'の成果';
    modalTitle.textContent=item.title;modalStatus.textContent=item.status;
    modalBody.replaceChildren();
    if(item.type==='copeak'){
      const quick=make('div','cso-quickstats');
      for(const [label,val] of [['Accuracy',item.accuracy===''?'—':`${Math.round(Number(item.accuracy)*10)/10}%`],['WPM',item.wpm===''?'—':`${Math.round(Number(item.wpm))}`]]){
        const box=make('div','cso-quickstat');box.append(make('strong','',val),make('span','',label));quick.append(box);
      }
      modalBody.append(quick);
    }
    const host=make('div','cso-source');
    const clone=item.source.cloneNode(true);
    clone.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
    clone.querySelectorAll('[onclick]').forEach(el=>el.removeAttribute('onclick'));
    clone.addEventListener('click',event=>{
      const button=event.target.closest('button');if(!button)return;
      event.preventDefault();event.stopPropagation();
      const pos=[...clone.querySelectorAll('button')].indexOf(button);
      const original=[...item.source.querySelectorAll('button')][pos];
      if(!original||original.disabled)return;
      original.click();
      const origDetail=item.source.querySelector('.psl-detail');const copyDetail=clone.querySelector('.psl-detail');
      if(origDetail&&copyDetail)copyDetail.hidden=origDetail.hidden;
      if(original.classList.contains('start-btn')||original.classList.contains('psl-challenge'))closeModal();
    });
    host.append(clone);modalBody.append(host);
    modalBody.append(make('p','cso-hint','閉じる：× または Esc キー／課題を始める場合は上のボタンを押してください'));
  }

  function scheduleRender(){
    if(pendingRender)return;pendingRender=true;
    window.setTimeout(()=>{pendingRender=false;render();},100);
  }
  function mount(){
    if(!mountBoard())return;
    picList=document.getElementById('pslStudentList');
    const observer=new MutationObserver(scheduleRender);
    observer.observe(readingList,{childList:true});
    if(picList)observer.observe(picList,{childList:true});
    if(!picList){
      const watch=new MutationObserver(()=>{
        picList=document.getElementById('pslStudentList');
        if(picList){observer.observe(picList,{childList:true});watch.disconnect();scheduleRender();}
      });watch.observe(document.body,{childList:true,subtree:true});
      window.setTimeout(()=>watch.disconnect(),30000);
    }
    for(const id of ['avgAccuracy','bestWpm']){
      const el=document.getElementById(id);
      if(el)observer.observe(el,{childList:true,characterData:true,subtree:true});
    }
    render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
