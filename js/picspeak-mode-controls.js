/* PicSpeak teacher: incremental mode-specific grading inputs, without rewriting the saved form. */
(() => {
  const css=`#picSpeakBetaPanel .psm-fields{display:flex;flex-wrap:wrap;gap:10px;margin:10px 0;align-items:end}
    #picSpeakBetaPanel .psm-field{display:grid;gap:5px;min-width:145px;max-width:195px;font-size:12px;font-weight:750;color:#35534b}
    #picSpeakBetaPanel .psm-field input,#picSpeakBetaPanel .psm-field select{width:100%;background:#fff;padding:10px;border:1px solid #c6dbd1;border-radius:9px;font:inherit}
    #picSpeakBetaPanel .psm-field[hidden]{display:none!important}
    #picSpeakBetaPanel .psv4-shell .psm-level-is-hidden{display:none!important}
    #picSpeakBetaPanel .psv4-statsrow.psm-stats-flash{grid-template-columns:repeat(2,minmax(0,1fr))}`;
  function init(){
    const mode=document.getElementById('pslMode');const old=document.getElementById('pslPassPercent');
    const level=document.getElementById('picSpeakBetaLevel');
    if(!mode||!old||!level||document.getElementById('pslPassCorrect'))return false;
    const style=document.createElement('style');style.id='psmCriteriaCss';style.textContent=css;document.head.append(style);
    const host=document.createElement('div');host.className='psm-fields';host.setAttribute('aria-label','モード別合格条件');
    const make=(id,label,min,max,value)=>{
      const box=document.createElement('label');box.className='psm-field';box.dataset.criteria=id;
      const text=document.createElement('span');text.textContent=label;
      const input=document.createElement('input');input.type='number';input.id=id;
      input.min=String(min);input.max=String(max);input.step='1';input.value=String(value);
      box.append(text,input);host.append(box);return box;
    };
    const fCorrect=make('pslPassCorrect','必要正答数（10問中）',1,10,8);
    const fReading=make('pslPassReading','音読一致率（%）',0,100,70);
    const fPicture=make('pslPassPicture','画像描写達成率（%）',0,100,70);
    const fQA=make('pslPassQA','Q&A評価（Good以上=1）',1,2,1);
    const container=document.querySelector('#picSpeakBetaPanel .psv4-statsrow');
    (container?.parentElement || old.closest('.psl-grid') || old.parentElement).append(host);
    const sync=()=>{
      const flash=mode.value==='picflash',oral=mode.value==='oralquest';
      fCorrect.hidden=!flash;fReading.hidden=!oral;fPicture.hidden=!oral;fQA.hidden=!oral;
      // The grade bands are real teaching/assessment choices in five activities.
      // PIC FLASH uses category, question count and trial time, not school level.
      // Keep the actual select and saved value untouched; hide only its visible wrapper.
      const levelWrapper=level.closest('label') || level.parentElement;
      if(levelWrapper){
        levelWrapper.hidden=flash;
        levelWrapper.classList.toggle('psm-level-is-hidden',flash);
      }
      document.querySelector('#picSpeakBetaPanel .psv4-statsrow')
        ?.classList.toggle('psm-stats-flash',flash);
      const description=document.querySelector('#picSpeakBetaPanel .psv4-statsrow')
        ?.closest('.psv4-card')?.querySelector('.psv4-head .psv4-description');
      if(description)description.textContent=flash?'時間・正答数・合格タイム':oral?'レベル・時間・段階別合格条件':'レベル・時間・合格ライン';
      const hint=document.querySelector('#picSpeakBetaPanel .psv4-conditions-help');
      if(hint)hint.textContent=flash?'正答数とペナルティ込みの時間で合否を判定します。':oral?'音読・画像描写・2つのQ&Aの全条件を満たすと合格です。':mode.value==='story'?'4場面を終え、情報伝達率で合否を判定します。':mode.value==='detective'?'発見した間違いの割合で合否を判定します。':'目標表現の達成率で合否を判定します。';
    };
    mode.addEventListener('change',sync);sync();return true;
  }
  let attempts=0;
  const observer=new MutationObserver(()=>{if(init()){observer.disconnect();clearInterval(retry);}});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  const retry=setInterval(()=>{attempts++;if(init()||attempts>50){clearInterval(retry);observer.disconnect();}},300);
  if(document.readyState!=='loading')init();
})();
