// Failure reports only: no scores, lesson text, audio, URLs or credentials.
const key = 'copeak-classroom-diagnostics-v1';
const allowed = new Set(['launch_preparation_failed','delivery_too_long','submission_save_failed','dashboard_refresh_failed']);
let busy = false;
function read() {
  try { const rows = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(rows) ? rows.filter(r => r && allowed.has(r.code) && typeof r.userId === 'string' && typeof r.assignmentId === 'string' && Number.isFinite(r.at) && Date.now()-r.at < 7*86400000).slice(-20) : [];
  } catch { return []; }
}
function write(rows) { try { localStorage.setItem(key, JSON.stringify(rows.slice(-20))); } catch { /* Reporting must never interrupt Classroom. */ } }
export async function flushClassroomDiagnostics(client, userId) {
  if (busy || !userId || !navigator.onLine) return;
  busy = true;
  try {
    for (const row of read().filter(r=>r.userId===userId)) {
      const { error } = await client.rpc('report_classroom_diagnostic', {p_assignment_id:row.assignmentId,p_code:row.code,p_reason:row.reason||'unknown'});
      // No retries for permission failures (membership may have changed).
      if (error && error.code !== '42501' && error.code !== '22023') break;
      write(read().filter(r=>r.id!==row.id));
    }
  } catch { /* Leave queued reports for the next online event or failure. */ }
  finally { busy = false; }
}
export function reportClassroomDiagnostic(client,userId,assignmentId,code,reason = 'unknown') {
  if (!userId || !assignmentId || !allowed.has(code)) return;
  const rows=read();
  if (!rows.some(r=>r.userId===userId && r.assignmentId===assignmentId && r.code===code && Date.now()-r.at<60000)) {
    rows.push({id:crypto.randomUUID(),userId,assignmentId,code,reason,at:Date.now()});write(rows);
  }
  void flushClassroomDiagnostics(client,userId);
}
