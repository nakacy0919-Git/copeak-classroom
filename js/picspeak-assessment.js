/* Shared, mode-aware PicSpeak beta assessment (unverified browser metrics).
   This NEVER accesses Copeak reading submissions or score tables. */
export const MODE_LABELS = Object.freeze({
  snapshot:'SNAPSHOT',mosaic:'MOSAIC',detective:'DETECTIVE',oralquest:'ORAL QUEST',story:'STORY',picflash:'PIC FLASH'
});
export const number = x => x===null||x===undefined||x===''?null:(Number.isFinite(Number(x))?Number(x):null);
export const metric = (a,r) => {
  if (!r) return null;
  if(a.mode==='picflash')return number(r.duration_seconds);
  if(a.mode==='oralquest')return number(r.metrics?.picture_completion??r.completion_percent);
  return number(r.completion_percent??r.score_percent);
};
export const successful = (a,r) => {
  if(!a||!r)return false;
  const m=r.metrics||{};
  if(a.mode==='picflash') {
    return m.total===10 && number(m.correct)!==null && number(m.skipped)!==null &&
      m.correct+m.skipped===10 && m.correct>=Number(a.pass_correct??8) &&
      number(r.duration_seconds)!==null && Number(r.duration_seconds)<=Number(a.pass_seconds??90) &&
      m.language==='en-US' && m.trial===true;
  }
  if(a.mode==='oralquest'){
    return m.stages_completed===3 &&
      number(m.reading_accuracy)!==null && m.reading_accuracy>=Number(a.pass_reading_percent??70) &&
      number(m.picture_completion)!==null && m.picture_completion>=Number(a.pass_picture_percent??70) &&
      number(m.qa1_rating)!==null && m.qa1_rating>=Number(a.pass_qa_rating??1) &&
      number(m.qa2_rating)!==null && m.qa2_rating>=Number(a.pass_qa_rating??1);
  }
  if(a.mode==='story' && Number(m.scenes_completed)!==4)return false;
  return metric(a,r)!==null && metric(a,r)>=Number(a.pass_percent??70);
};
export function bestAttempt(a,records){
  const rows=(records||[]).filter(r=>metric(a,r)!==null);
  if(a.mode==='picflash'){
    const wins=rows.filter(r=>successful(a,r));
    return (wins.length?wins:rows).slice().sort((x,y)=>metric(a,x)-metric(a,y))[0]||null;
  }
  return rows.slice().sort((x,y)=>metric(a,y)-metric(a,x))[0]||null;
}
export const passByHistory=(a,rows)=>(rows||[]).some(r=>successful(a,r));
export function headline(a,r){
  if(!r)return '—';
  const m=r.metrics||{};
  if(a.mode==='picflash')return `${number(r.duration_seconds)?.toFixed(1)??'—'}秒`;
  if(a.mode==='detective' && Number.isInteger(m.found))return `${metric(a,r)??'—'}%`;
  if(a.mode==='oralquest')return `${m.picture_completion??'—'}% (画像)`;
  return `${metric(a,r)??'—'}%`;
}
export function breakdown(a,r){
  if(!r)return '記録なし';
  const m=r.metrics||{};
  if(a.mode==='detective')return `発見 ${m.found??'—'}/${m.total??'—'}件 · 発見率 ${metric(a,r)??'—'}%`;
  if(a.mode==='story')return `4場面 ${m.scenes_completed??'—'}/4 · 要点 ${m.targets_found??'—'}/${m.targets_total??'—'} · 達成率 ${metric(a,r)??'—'}%`;
  if(a.mode==='oralquest')return `音読 ${m.reading_accuracy??'—'}% · 最初のQ&A ${grade(m.qa1_rating)} · 画像描写 ${m.picture_completion??'—'}% · 最後のQ&A ${grade(m.qa2_rating)}`;
  if(a.mode==='picflash')return `正答 ${m.correct??'—'}/${m.total??10}問 · スキップ ${m.skipped??'—'}問 · ${headline(a,r)}`;
  return `最高達成率 ${metric(a,r)??'—'}% · ${r.word_count??'—'}語`;
}
export const grade = n => n===2?'Excellent':n===1?'Good':n===0?'Try again':'—';
export function gradeLabel(a){
  return a.mode==='picflash'?'合格タイム（秒）':a.mode==='detective'?'発見率（%）':a.mode==='oralquest'?'画像描写率（%）':a.mode==='story'?'情報伝達率（%）':'最高達成率（%）';
}
export function condition(a){
  if(a.mode==='picflash')return `${a.pass_correct??8}/10問正解 ＋ ${a.pass_seconds??90}秒以内`;
  if(a.mode==='oralquest')return `音読${a.pass_reading_percent??70}%・画像${a.pass_picture_percent??70}%・Q&A ${grade(a.pass_qa_rating??1)}以上`;
  if(a.mode==='story')return `4場面完了 ＋ ${a.pass_percent??70}%以上`;
  return `${a.pass_percent??70}%以上`;
}
