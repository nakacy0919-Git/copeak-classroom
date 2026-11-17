// Advisory learning status only. Never modifies assignment completion or grades.
// Input is the complete authorized Copeak assignment list, not a filtered card list.
export function summarizeLearningHealth(rows,now=Date.now()){
  const HOUR=3600000;
  const result={total:0,passed:0,submittedComplete:0,complete:0,incomplete:0,unsubmitted:0,future:0,overdue:0,overdueUnsubmitted:0,near:0,agedOpen:0,agedPending:0,percent:null,level:'neutral',title:'課題なし',message:'公開された課題がありません。'};
  for(const row of rows||[]){
    const release=Number.isFinite(row.releaseMs)?row.releaseMs:null;
    const due=Number.isFinite(row.dueMs)?row.dueMs:null;
    if(release!==null&&release>now){result.future++;continue;}
    result.total++;
    if(release!==null&&now-release>=48*HOUR)result.agedOpen++;
    if(row.complete){
      result.complete++;
      if(row.passed)result.passed++;else result.submittedComplete++;
      continue;
    }
    if(row.attempted)result.incomplete++;else result.unsubmitted++;
    if(release!==null&&now-release>=48*HOUR)result.agedPending++;
    if(due!==null){
      if(due<=now){result.overdue++;if(!row.attempted)result.overdueUnsubmitted++;}
      else if(due-now<=48*HOUR)result.near++;
    }
  }
  if(!result.total)return result;
  result.percent=Math.round(result.complete/result.total*100);
  if(result.overdue>0||result.near>=3){
    result.level='danger';result.title='危険';
    result.message=result.overdue>0?'締切を過ぎた未完了課題が '+result.overdue+' 件あります。': '締切48時間以内の未完了課題が '+result.near+' 件あります。';
  }else if(result.near>0||(result.agedPending>=3&&result.agedPending/result.agedOpen>=0.4)){
    result.level='warning';result.title='注意';
    result.message=result.near>0?'締切48時間以内の未完了課題が '+result.near+' 件あります。':'公開から2日以上経過した未完了課題が '+result.agedPending+' 件あります。';
  }else{
    result.level='normal';result.title='正常';result.message=result.complete===result.total?'すべての公開課題を達成しました！':'今のところ締切に余裕があります。計画的に取り組みましょう。';
  }
  return result;
}
