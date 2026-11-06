const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Diagnose metadata expiry only. R2 object presence and retention policy
 * are separate concerns and must not be inferred from this timestamp.
 */
export function getAssignmentAudioState(assignment, now = Date.now()) {
  if (!assignment?.audio_object_key) return { status: 'none', expiresAt: null };
  const expiry = Date.parse(assignment.audio_expires_at || '');
  if (!Number.isFinite(expiry)) return { status: 'unknown', expiresAt: null };
  if (expiry <= now) return { status: 'expired', expiresAt: expiry };
  if (expiry - now <= 3 * MS_PER_DAY) {
    return { status: 'expiring', expiresAt: expiry };
  }
  return { status: 'active', expiresAt: expiry };
}
