/* Copeak Classroom + PicSpeak visual overview.
 * Mirrors only cards already rendered by existing access-controlled loaders.
 * Original cards stay in DOM with original launch/graph handlers intact.
 */
(() => {
 'use strict';
 const css=`
 #csoBoard{border:1px solid #d9e7e1;border-radius:17px;background:white;padding:15px;margin:12px 0 16px;max-width:100%}
 #csoBoard [hidden]{display:none!important}
 #csoBoard .cso-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
 #csoBoard h2{font-size:17px;margin:0;color:#143e34}
 #csoBoard .cso-filters{display:flex;gap:6px;flex-wrap:wrap}
 #csoBoard button{cursor:pointer}
 #csoBoard .cso-filter{border:1px solid #dce8e4;background:#f5f8f7;border-radius:9px;padding:8px 12px;font-size:12px;font-weight:750;color:#346156}
 #csoBoard .cso-filter[aria-pressed=true]{background:#007a63;color:#fff}
 #csoBoard .cso-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:13px 0}
 #csoBoard .cso-tile{min-width:0;border:1px solid #d9e7e1;border-radius:12px;background:#f7faf9;text-align:left;padding:11px;display:flex;flex-direction:column;gap:6px;min-height:96px}
 #csoBoard .cso-tile[aria-current=true]{outline:2px solid #0b8c74;outline-offset:0;background:#eefaf5}
 #csoBoard .cso-mode{font-size:10px;font-weight:850;letter-spacing:.06em;color:#00765c}
 #csoBoard .cso-tile strong{font-size:13px;color:#173c34;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 #csoBoard .cso-state{color:#637972;font-size:11px}
 #csoBoard .cso-pages{display:flex;justify-content:center;gap:12px;align-items:center;font-size:12px;color:#637972}
 #csoBoard .cso-pages button{padding:7px 11px;border-radius:8px;border:1px solid #d9e7e1;background:white}
 #csoBoard .cso-preview{border-top:1px solid #d9e7e1;margin-top:12px;padding-top:14px}
 #csoBoard .cso-preview>.cso-message{font-size:13px;color:#637972;padding:16px;text-align:center}
 #csoBoard .cso-preview .student-assignment-card,#csoBoard .cso-preview .psl-card{margin:0!important;max-width:none!important}
 #csoBoard .cso-caption{font-size:11px;color:#637972;margin:3px 0}
 #csoBoard .cso-preview .psl-card{border:1px solid #dbe5f0;border-radius:12px;background:#f8fafc;padding:14px;display:grid;grid-template-columns:minmax(0,1fr) 180px;gap:8px}
 #csoBoard .cso-preview .psl-card>h3{margin:0;grid-column:1;font-size:16px}
 #csoBoard .cso-preview .psl-card>.psl-chip{grid-column:1;justify-self:start;background:#e2e8f0;border-radius:24px;padding:5px 9px;font-size:11px}
 #csoBoard .cso-preview .psl-card>.psl-chip.ok{background:#dcfce7;color:#166534}
 #csoBoard .cso-preview .psl-subtitle{grid-column:1;color:#64748b;font-size:12px;margin:0}
 #csoBoard .cso-preview .psl-scores{grid-column:1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
 #csoBoard .cso-preview .psl-scores>div{text-align:center;border-radius:9px;padding:10px;background:#eef4fa;font-size:11px}
 #csoBoard .cso-preview .psl-scores strong{display:block;font-size:18px}
 #csoBoard .cso-preview .psl-card-actions{grid-column:2;grid-row:1 / span 4;display:flex;flex-direction:column;gap:8px;justify-content:center}
 #csoBoard .cso-preview .psl-card-actions button{border:0;border-radius:10px;background:#e6edf6;color:#1e4e7c;font-weight:750;padding:13px 10px}
 #csoBoard .cso-preview .psl-card-actions .psl-challenge{background:#2563eb;color:white}
 #csoBoard .cso-preview .psl-detail{grid-column:1 / -1;border-top:1px solid #dbe5f0;padding-top:10px;font-size:12px}
 #csoBoard .cso-preview .psl-trend{display:flex;align-items:end;height:48px;gap:4px}
 #csoBoard .cso-preview .psl-trend span{display:block;background:#60a5fa;width:18px;min-height:3px;border-radius:3px 3px 0 0}
 @media(max-width:600px){#csoBoard .cso-preview .psl-card{grid-template-columns:1fr}#csoBoard .cso-preview .psl-card-actions{grid-column:1;grid-row:auto;flex-direction:row}#csoBoard .cso-preview .psl-scores{grid-column:1}}
 body.cso-enabled #assignmentList,body.cso-enabled .psl-student-section{display:none!important}
 @media(max-width:800px){#csoBoard .cso-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
 @media(max-width:530px){#csoBoard .cso-grid{grid-template-columns:repeat(2,minmax(0,1fr))}#csoBoard .cso-tile{min-height:80px;padding:8px}}
 `;
 const state={filter:'todo',page:0,selected:null,items:[],signature:''};
 let board,grid,preview,pages,count,readingList,picList;
 const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!=null)el.textContent=text;return el;};
 function create(){
   readingList=document.getElementById('assignmentList');
   if(!readingList)return false;
   const style=make('style');style.textContent=css;style.id='csoStyles';document.head.append(style);
   board=make('section');board.id='csoBoard';board.setAttribute('aria-label','課題一覧');
   const header=make('div','cso-head');const heading=make('div');heading.append(make('h2','','課題一覧'),make('p','cso-caption','課題を選ぶと学習内容・成果グラフ・挑戦ボタンを表示します。'));
   header.append(heading);const filters=make('div','cso-filters');
   for(const [value,label] of [['todo','未完了'],['done','合格・完了'],['all','すべて']]){
     const btn=make('button','cso-filter',label);btn.type='button';btn.dataset.filter=value;btn.addEventListener('click',()=>{state.filter=value;state.page=0;render();});filters.append(btn);
   }
   header.append(filters);board.append(header);count=make('p','cso-caption');board.append(count);
   grid=make('div','cso-grid');board.append(grid);
   pages=make('div','cso-pages');board.append(pages);
   preview=make('div','cso-preview');board.append(preview);
   readingList.parentElement.insertBefore(board,readingList);
   document.body.classList.add('cso-enabled');
   return true;
 }
 const cardKey=(type,card,i)=>type+':'+(card.querySelector('.start-btn')?.dataset.id||card.querySelector('h3')?.textContent?.trim()||i);
 function readItems(){
   const list=[];
   const reading=readingList.querySelectorAll('.student-assignment-card');
   reading.forEach((card,i)=>{
     const title=card.querySelector('.assignment-title')?.textContent?.trim()||'Copeak課題';
     const status=card.querySelector('.student-status-badge')?.textContent?.trim()||'未完了';
     const statusKey=card.dataset.status||'';
     const done=!/未完了|未達成|練習中|未着手/.test(status) && /合格|完了|completed|pass/i.test(status+' '+statusKey);
     list.push({key:cardKey('copeak',card,i),type:'copeak',title,status,done,source:card});
   });
   if(picList){
     picList.querySelectorAll('.psl-card').forEach((card,i)=>{
       const title=card.querySelector('h3')?.textContent?.trim()||'PicSpeak課題';
       const status=card.querySelector('.psl-chip')?.textContent?.trim()||'未完了';
       const done=/合格/.test(status);
       const subtitle=card.querySelector('.psl-subtitle')?.textContent?.trim()||'';
       list.push({key:cardKey('picspeak',card,i),type:'picspeak',title,status,subtitle,done,source:card});
     });
   }
   return list;
 }
 function cloneDetail(item){
   preview.replaceChildren();
   if(!item){preview.append(make('div','cso-message','課題を選ぶと詳細が表示されます。'));return;}
   const clone=item.source.cloneNode(true);
   clone.querySelectorAll('[id]').forEach(x=>x.removeAttribute('id'));
   clone.querySelectorAll('[onclick]').forEach(x=>x.removeAttribute('onclick'));
   // Cards' events are delegated to original DOM or captured in their original closures.
   // Forward clicks to exactly corresponding original buttons; do not recreate launch logic.
   clone.addEventListener('click',event=>{
     const button=event.target.closest('button');if(!button)return;
     event.preventDefault();event.stopPropagation();
     const buttons=[...clone.querySelectorAll('button')];const pos=buttons.indexOf(button);
     const original=[...item.source.querySelectorAll('button')][pos];
     if(!original||original.disabled)return;
     original.click();
     const cloneDetail=clone.querySelector('.psl-detail');const originalDetail=item.source.querySelector('.psl-detail');
     if(cloneDetail&&originalDetail)cloneDetail.hidden=originalDetail.hidden;
   });
   preview.append(clone);
 }
 function render(){
   if(!board)return;
   state.items=readItems();
   let shown=state.items.filter(x=>state.filter==='all'||(state.filter==='done'?x.done:!x.done));
   const maxPage=Math.max(0,Math.ceil(shown.length/12)-1);
   state.page=Math.max(0,Math.min(state.page,maxPage));
   const windowed=shown.slice(state.page*12,state.page*12+12);
   const keys=new Set(shown.map(x=>x.key));
   if(!keys.has(state.selected))state.selected=windowed[0]?.key||null;
   grid.replaceChildren();
   for(const item of windowed){
     const btn=make('button','cso-tile');btn.type='button';btn.setAttribute('aria-current',String(state.selected===item.key));
     const short=make('span','cso-mode',item.type==='copeak'?'Copeak · 音読':'PicSpeak · '+((item.subtitle||'').split(' · ')[0]));
     btn.append(short,make('strong','',item.title),make('span','cso-state',item.status));
     btn.addEventListener('click',()=>{state.selected=item.key;render();});grid.append(btn);
   }
   count.textContent=`全${state.items.length}件 · 表示${shown.length}件（Copeak ${state.items.filter(x=>x.type==='copeak').length}件 / PicSpeak ${state.items.filter(x=>x.type==='picspeak').length}件）`;
   for(const b of board.querySelectorAll('.cso-filter'))b.setAttribute('aria-pressed',String(b.dataset.filter===state.filter));
   pages.replaceChildren();
   if(shown.length>12){
     const before=make('button','','前へ');before.disabled=state.page<=0;before.addEventListener('click',()=>{state.page--;render();});
     const label=make('span','',`${state.page+1} / ${maxPage+1}`);
     const next=make('button','','次へ');next.disabled=state.page>=maxPage;next.addEventListener('click',()=>{state.page++;render();});
     pages.append(before,label,next);
   }
   cloneDetail(shown.find(x=>x.key===state.selected)||windowed[0]||null);
 }
 function mount(){if(!board&&!create())return;
   picList=document.getElementById('pslStudentList');
   const changed=()=>{clearTimeout(mount.pending);mount.pending=setTimeout(render,90);};
   const o=new MutationObserver(changed);o.observe(readingList,{childList:true});
   if(picList)o.observe(picList,{childList:true});
   render();
   // PicSpeak section may be inserted after the reading section.
   if(!picList){const watch=new MutationObserver(()=>{picList=document.getElementById('pslStudentList');if(picList){o.observe(picList,{childList:true});watch.disconnect();render();}});watch.observe(document.body,{childList:true,subtree:true});setTimeout(()=>watch.disconnect(),15000);}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
