import { manualMetricOverride } from './manual-score-precedence.mjs';

// One gradebook policy for teacher, CSV and student views.
// Equal bests keep the first attempt (input is ordered by submitted_at, id).
export const scoreKey = row => `${row.student_id}|${row.assignment_id}`;
export function bestMetricMap(rows, metric, keyOf=scoreKey) {
  const map=new Map();
  for(const row of rows||[]){
    if(metric==='comprehension'&&row.score_version!=='wcpm-v1')continue;
    const raw=row[metric];
    if(raw===null||raw===undefined||raw===''||!Number.isFinite(Number(raw)))continue;
    const key=keyOf(row),current=map.get(key);
    if(!current||Number(raw)>Number(current[metric]))map.set(key,row);
  }
  return map;
}
export function effectiveMetric(manualRow,automaticRow,metric) {
  const override=manualMetricOverride(manualRow,automaticRow,metric);
  if(override!==null)return override;
  const raw=automaticRow?.[metric];
  return raw===null||raw===undefined||raw===''||!Number.isFinite(Number(raw))?null:Math.round(Number(raw));
}
export function countAttempts(rows,keyOf=scoreKey) {
  const map=new Map();
  for(const row of rows||[]){const key=keyOf(row);map.set(key,(map.get(key)||0)+1);}
  return map;
}
export function summarizeScores(values) {
  const rows=values.filter(v=>v!==null&&v!==undefined&&Number.isFinite(v));
  return {average:rows.length?Math.round(rows.reduce((a,b)=>a+b,0)/rows.length):null,maximum:rows.length?Math.max(...rows):null};
}
