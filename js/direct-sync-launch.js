// A credential is transferred only to the exact popup opened for this launch.
// No access/refresh token or submission credential is put in a URL.
export function createSyncLaunchManager({ client, studentId, copeakOrigin, onSynced }) {
  const launches = new Map();
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  async function register(popup, assignmentId, nonce) {
    for (const [key, item] of launches) if (item.popup.closed) launches.delete(key);
    const { data, error } = await client.rpc('issue_assignment_submission_credential', {
      p_assignment_id: assignmentId
    });
    if (error) throw error;
    if (!data || data.assignmentId !== assignmentId || data.studentId !== studentId) {
      throw new Error('Submission credential identity mismatch');
    }
    launches.set(nonce, { popup, assignmentId, credential: data });
  }
  async function receive(event) {
    if (event.origin !== copeakOrigin) return false;
    const message = event.data;
    const launch = launches.get(message?.nonce);
    if (!launch || event.source !== launch.popup || message.assignmentId !== launch.assignmentId) return false;
    if (message.type === 'copeak-classroom-sync-ready' && launch.credential) {
      launch.popup.postMessage({ type: 'copeak-classroom-credential', nonce: message.nonce,
        credential: launch.credential }, copeakOrigin);
      return true;
    }
    if (message.type === 'copeak-classroom-credential-received') {
      launch.credential = null;
      return true;
    }
    if (message.type === 'copeak-classroom-direct-synced' && uuid.test(message.resultId || '')) {
      await onSynced(message);
      return true;
    }
    return false;
  }
  return { register, receive };
}
