/**
 * Device-local display state for teacher assignment cards.
 * This does not change deadlines, publication, ordering, or student data.
 */
export function isAssignmentEnded(assignment, now = Date.now()) {
  if (!assignment?.due_at) return false;
  const dueAt = new Date(assignment.due_at).getTime();
  return Number.isFinite(dueAt) && dueAt <= now;
}

export function isAssignmentCollapsed(assignment, preferences = {}, now = Date.now()) {
  const id = String(assignment?.id ?? '');
  if (Object.prototype.hasOwnProperty.call(preferences, id) &&
      typeof preferences[id] === 'boolean') {
    return preferences[id];
  }
  return isAssignmentEnded(assignment, now);
}

function safePreferences(value) {
  const result = Object.create(null);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  for (const [id, collapsed] of Object.entries(value)) {
    if (id !== '__proto__' && typeof collapsed === 'boolean') result[id] = collapsed;
  }
  return result;
}

export function createTeacherAssignmentCollapseStore(storage) {
  const fallback = new Map();
  const keyFor = classId =>
    `copeak_teacher_assignment_collapse_v1:${encodeURIComponent(String(classId || 'unknown'))}`;

  function read(classId) {
    const key = keyFor(classId);
    try {
      const serialized = storage?.getItem(key);
      if (serialized != null) {
        const state = safePreferences(JSON.parse(serialized));
        fallback.set(key, state);
        return state;
      }
    } catch { /* Storage may be unavailable in private mode; keep in-memory state. */ }
    if (!fallback.has(key)) fallback.set(key, Object.create(null));
    return fallback.get(key);
  }

  function set(classId, assignmentId, collapsed) {
    if (!classId || !assignmentId || typeof collapsed !== 'boolean') return;
    const key = keyFor(classId);
    const state = read(classId);
    state[String(assignmentId)] = collapsed;
    fallback.set(key, state);
    try { storage?.setItem(key, JSON.stringify(state)); } catch { /* UI still works in this tab. */ }
  }

  return { read, set };
}
