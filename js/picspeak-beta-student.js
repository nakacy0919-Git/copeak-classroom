import { getClient, demoRole } from './supabase.js';
import {bestAttempt,passByHistory,metric,headline,breakdown,condition} from './picspeak-assessment.js';

// Completely separate UI + tables from Copeak reading assignments/results.
document.addEventListener('DOMContentLoaded', () => {
  const list=document.getElementById('assignmentList');
  const dev=/^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  // Production rollout is opt-in until end-to-end acceptance: ?picspeak_beta=1
  if(!list||(!dev&&new URLSearchParams(location.search).get('picspeak_beta')!=='1'))return;
  const section=document.createElement('section');
  section.className='paper section psl-student-section';
  section.innerHTML=`
  <style>
    .psl-student-section{margin-top:18px;padding:18px;border:1px solid #dbeafe;border-radius:16px;background:#fff}
    .psl-student-section .psl-head{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px}
    .psl-student-section h2{font-size:1.25rem;margin:0}
    .psl-student-section .psl-grid{display:flex;flex-direction:column;gap:10px;margin-top:16px}
    .psl-student-section .psl-card{border:1px solid #dbe5f0;border-radius:14px;padding:15px;background:#f8fafc;display:grid;grid-template-columns:minmax(0,1fr) minmax(172px,auto);grid-template-areas:'state action' 'title action' 'subtitle action' 'metrics action' 'details details';align-items:center;column-gap:18px;row-gap:6px}
    .psl-student-section .psl-card h3{font-size:1rem;margin:0;grid-area:title}
    .psl-student-section .psl-muted{font-size:12px;color:#64748b}
    .psl-student-section .psl-chip{grid-area:state;font-size:12px;display:inline-block;padding:4px 9px;border-radius:99px;background:#e2e8f0;width:max-content}
    .psl-student-section .psl-chip.ok{background:#dcfce7;color:#166534}
    .psl-student-section button{border:0;border-radius:10px;padding:11px 12px;background:#2563eb;color:#fff;font-weight:750;cursor:pointer}
    .psl-student-section button:disabled{background:#94a3b8;cursor:not-allowed}
    .psl-student-section .psl-secondary{background:#e9eff8;color:#245288}
    .psl-student-section .psl-card>.psl-subtitle{grid-area:subtitle;margin:0}
    .psl-student-section .psl-card>.psl-card-actions{grid-area:action;display:flex;flex-direction:column;gap:8px;min-width:172px}
    .psl-student-section .psl-card-actions>.psl-challenge{background:#2563eb;color:#fff;font-size:15px;padding:14px 16px}
    @media(max-width:700px){.psl-student-section .psl-card{grid-template-columns:1fr;grid-template-areas:'state' 'title' 'subtitle' 'metrics' 'action' 'details'}.psl-student-section .psl-card>.psl-card-actions{min-width:0;flex-direction:row;flex-wrap:wrap}.psl-student-section .psl-card-actions>button{flex:1;min-width:135px}}
    .psl-student-section .psl-detail{grid-area:details;border-top:1px solid #e2e8f0;padding-top:10px}
    .psl-student-section .psl-scores{grid-area:metrics;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
    .psl-student-section .psl-scores>div{border-radius:8px;background:#eef4fa;text-align:center;padding:9px 4px}
    .psl-student-section .psl-scores strong{display:block;font-size:1.1rem}
    .psl-student-section .psl-trend{display:flex;align-items:end;gap:4px;height:48px;padding:2px}
    .psl-student-section .psl-trend span{display:block;width:18px;max-width:14%;border-radius:3px 3px 0 0;background:#60a5fa;min-height:2px}
  </style>
  <div class="psl-head"><div><div style="font-size:11px;letter-spacing:.1em;color:#2563eb;font-weight:800">PICTURE SPEAKING</div>
  <h2>PicSpeak 課題</h2><p class="psl-muted">画像描写・ストーリー・ゲームのスピーキング課題です。Copeak音読とは成績を分けて表示します。</p></div>
  <button type="button" id="pslStudentRefresh" class="psl-secondary">更新</button></div>
  <p id="pslStudentStatus" class="psl-muted" role="status"></p>
  <div id="pslStudentList" class="psl-grid"></div>`;
  list.closest('.student-roadmap,.section')?.insertAdjacentElement('afterend',section);
  const $=id=>section.querySelector('#'+id);
  const allowedHost='sxcbudhcxiblpdzpgfep.supabase.co';
  const PICSPEAK_HOME=(dev&&localStorage.getItem('copeak_picspeak_beta_base_url'))||'https://pic-speak-story.com/';
  const LABELS={snapshot:'SNAPSHOT',mosaic:'MOSAIC',detective:'DETECTIVE',oralquest:'ORAL QUEST',story:'STORY',picflash:'PIC FLASH'};
  let fetching=false,lastRefresh=0;
  const outstanding=new Map();
  window.addEventListener('message',event=>{
    if(event.data?.type!=='copeak-picspeak-ready'&&event.data?.type!=='copeak-picspeak-ack')return;
    const launch=outstanding.get(event.source);
    if(!launch||Date.now()>launch.expiresAt||event.origin!==launch.origin||event.data.assignment_id!==launch.assignmentId)return;
    if(event.data.type==='copeak-picspeak-ready'){
      event.source.postMessage({type:'copeak-picspeak-launch',assignment_id:launch.assignmentId,token:launch.token},launch.origin);
    }else{outstanding.delete(event.source);}
  });
  const sb=()=>{
    if(demoRole())return null;
    if(new URL(window.COPEAK_CONFIG?.supabaseUrl||'https://invalid.invalid').hostname!==allowedHost)throw Error('Classroomデータベースが異なります。');
    return getClient('student');
  };
  const fmt=val=>new Date(val).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
  async function refresh(force=false){
    if(fetching||(!force&&Date.now()-lastRefresh<5000))return;
    fetching=true;lastRefresh=Date.now();
    try{
      const client=sb();if(!client){$('pslStudentStatus').textContent='デモではPicSpeak課題は表示されません。';return;}
      const {data:auth}=await client.auth.getUser();if(!auth?.user){$('pslStudentStatus').textContent='ログインすると課題が表示されます。';return;}
      const [{data:assignments,error:e1},{data:attempts,error:e2}]=await Promise.all([
        client.from('picspeak_assignments').select('id,title,mode,theme_id,level,time_limit,due_at,pass_percent,pass_seconds,pass_correct,pass_reading_percent,pass_picture_percent,pass_qa_rating').eq('is_published',true).order('due_at',{ascending:true}).limit(250),
        client.from('picspeak_attempts').select('assignment_id,score_raw,score_percent,completion_percent,word_count,wpm,duration_seconds,metrics,recorded_at').order('recorded_at',{ascending:false}).limit(5000)
      ]);
      if(e1)throw e1;if(e2)throw e2;
      const byA=new Map();for(const record of attempts||[]){const rows=byA.get(record.assignment_id)||[];rows.push(record);byA.set(record.assignment_id,rows);}
      const host=$('pslStudentList');host.replaceChildren();
      for(const a of assignments||[]){
        const rows=byA.get(a.id)||[];
        const best=bestAttempt(a,rows);
        const pass=passByHistory(a,rows);
        const expired=Date.now()>new Date(a.due_at).getTime();
        const card=document.createElement('article');card.className='psl-card';
        const state=document.createElement('span');state.className='psl-chip'+(pass?' ok':'');state.textContent=pass?'合格':expired?'締切済み':rows.length?'練習中':'未完了';
        const h=document.createElement('h3');h.textContent=a.title;
        const small=document.createElement('p');small.className='psl-muted psl-subtitle';small.textContent=LABELS[a.mode]+' • '+a.level+' • 締切 '+fmt(a.due_at);
        const scores=document.createElement('div');scores.className='psl-scores';
        function addScoreMetric(title,value){const d=document.createElement('div'),strong=document.createElement('strong'),cap=document.createElement('span');strong.textContent=String(value);cap.textContent=title;cap.className='psl-muted';d.append(strong,cap);scores.append(d);}
        addScoreMetric(a.mode==='picflash'?'最速タイム':a.mode==='detective'?'発見率':a.mode==='oralquest'?'画像描写':a.mode==='story'?'情報伝達率':'最高達成率',best?headline(a,best):'—');
        addScoreMetric('練習回数',rows.length+'回');
        const totalWords=rows.reduce((n,r)=>n+(Number(r.word_count)||0),0);
        const third=a.mode==='picflash'?((best?.metrics?.correct??'—')+'/10問')
          :a.mode==='detective'?((best?.metrics?.found??'—')+'/'+(best?.metrics?.total??'—')+'件')
          :rows.some(r=>r.word_count!=null)?totalWords+'語':'—';
        addScoreMetric(a.mode==='picflash'?'正答数':a.mode==='detective'?'発見数':'累計発話単語数',third);
        const btn=document.createElement('button');btn.textContent=expired?'締切済み':'PicSpeakに挑戦！ ↗';btn.className='psl-challenge';btn.disabled=expired;
        btn.addEventListener('click',()=>void launch(a,btn));
        const detailsBtn=document.createElement('button');detailsBtn.className='psl-secondary';detailsBtn.textContent='成果を見る';
        const details=document.createElement('div');details.className='psl-detail';details.hidden=true;
        const dtext=document.createElement('p');dtext.className='psl-muted';
        dtext.textContent='練習 '+rows.length+'回 · '+breakdown(a,best)+' · 合格条件: '+condition(a)+' · '+(pass?'合格':'未達成');
        const trend=document.createElement('div');trend.className='psl-trend';trend.setAttribute('aria-label',a.mode==='picflash'?'タイム履歴':'達成率の推移');
        const sample=rows.slice(0,8).reverse();
        for(const r of sample){const bar=document.createElement('span');
          const value=a.mode==='picflash'?Math.max(0,100-(Number(r.duration_seconds)||100)):(metric(a,r)||0);
          bar.style.height=Math.max(4,Math.min(100,value))+'%';
          bar.title=fmt(r.recorded_at)+' '+breakdown(a,r);trend.append(bar);}
        details.append(dtext,trend);detailsBtn.addEventListener('click',()=>{details.hidden=!details.hidden;});
        const actions=document.createElement('div');actions.className='psl-card-actions';actions.append(btn,detailsBtn);card.append(state,h,small,scores,actions,details);host.append(card);
      }
      $('pslStudentStatus').textContent=(assignments||[]).length+'件のPicSpeak課題を表示しています。';
      if(!(assignments||[]).length)host.textContent='現在、公開中のPicSpeak課題はありません。';
    }catch(err){$('pslStudentStatus').textContent='PicSpeak課題の読込に失敗しました: '+(err.message||String(err));}
    finally{fetching=false;}
  }
  async function launch(a,button){
    // Open a tab synchronously to avoid Safari/iPad popup blocking after awaiting RPC.
    const tab=window.open('about:blank','_blank');
    if(!tab){$('pslStudentStatus').textContent='ブラウザのポップアップ許可が必要です。';return;}
    tab.document.title='PicSpeak 準備中';tab.document.body.textContent='PicSpeak課題を準備しています…';
    button.disabled=true;
    try{
      const {data,error}=await sb().rpc('picspeak_begin_attempt',{p_assignment_id:a.id});
      if(error)throw error;if(!data?.token)throw Error('起動認証を取得できません。');
      const path=data.mode==='story'?'story.html':data.mode==='picflash'?'picflash.html':'play.html';
      const base=new URL(PICSPEAK_HOME);
      if(!['https:','http:'].includes(base.protocol) || (!dev&&base.origin!=='https://pic-speak-story.com'))throw Error('PicSpeak接続先を確認してください。');
      const url=new URL(path,base);
      // No credential in the URL: the opened game requests it by postMessage.
      url.hash=new URLSearchParams({copeak_assignment:data.assignment_id,copeak_origin:location.origin,copeak_mode:data.mode,copeak_content:data.content_id,copeak_level:data.level,copeak_time:String(data.time_limit)}).toString();
      outstanding.set(tab,{assignmentId:data.assignment_id,token:data.token,origin:url.origin,expiresAt:Date.now()+120000});
      window.setTimeout(()=>outstanding.delete(tab),120000);
      tab.location.href=url.href;
    }catch(err){outstanding.delete(tab);if(tab&&!tab.closed)tab.close();$('pslStudentStatus').textContent='起動できません: '+(err.message||String(err));}
    finally{button.disabled=false;}
  }
  $('pslStudentRefresh').addEventListener('click',()=>void refresh(true));
  window.addEventListener('focus',()=>void refresh());
  window.addEventListener('pageshow',()=>void refresh());
  void refresh(true);
});
