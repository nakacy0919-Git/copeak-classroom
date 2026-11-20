/**
 * Teacher assignment grouping is display-only.
 * Class display-order, gradebook numbers and student assignment records are unchanged.
 */
import { sortClassAssignments } from './assignment-order.mjs';
import { isAssignmentEnded } from './teacher-assignment-collapse.mjs';

const FILTERS = new Set(['all', 'active', 'ended']);
const SORTS = new Set(['manual', 'number-asc', 'number-desc', 'due-asc', 'due-desc', 'title']);
export const normalizeAssignmentFilter = value => FILTERS.has(value) ? value : 'active';
export const normalizeAssignmentSort = value => SORTS.has(value) ? value : 'manual';

export function assignmentMatchesSearch(assignment, query = '') {
  const needle = String(query).normalize('NFKC').trim().toLocaleLowerCase();
  if (!needle) return true;
  const text = [
    assignment?.title, assignment?.category, assignment?.week_no,
    assignment?.gradebook_no, assignment?.class_assignment_no,
    assignment?.audience_type === 'targeted' ? '自習教材' : ''
  ].filter(value => value != null).join(' ').normalize('NFKC').toLocaleLowerCase();
  return needle.split(/\s+/).every(word => text.includes(word));
}

const dueTime = assignment => {
  const value = new Date(assignment?.due_at || '').getTime();
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
};
const assignmentNumber = item => Number(item?.class_assignment_no || item?.gradebook_no || item?.week_no || 0);

/** Preserve manual ordering as a stable tie-breaker for all client-only sort options. */
export function sortAssignmentGroup(items, mode = 'manual') {
  const normalized = normalizeAssignmentSort(mode);
  const ordered = sortClassAssignments(items);
  if (normalized === 'manual') return ordered;
  const indexed = new Map(ordered.map((item, i) => [item.id, i]));
  const tieBreak = (a, b) => indexed.get(a.id) - indexed.get(b.id);
  return ordered.sort((a, b) => {
    let primary = 0;
    if (normalized === 'number-asc') primary = assignmentNumber(a) - assignmentNumber(b);
    if (normalized === 'number-desc') primary = assignmentNumber(b) - assignmentNumber(a);
    if (normalized === 'due-asc') primary = dueTime(a) - dueTime(b);
    if (normalized === 'due-desc') primary = dueTime(b) - dueTime(a);
    if (normalized === 'title') primary = String(a.title || '').localeCompare(String(b.title || ''), 'ja');
    return primary || tieBreak(a, b);
  });
}

export function groupTeacherAssignments(items, { now = Date.now(), query = '', sort = 'manual' } = {}) {
  const original = [...(items || [])];
  const activeAll = original.filter(a => !isAssignmentEnded(a, now));
  const endedAll = original.filter(a => isAssignmentEnded(a, now));
  return {
    counts: { all: original.length, active: activeAll.length, ended: endedAll.length },
    active: sortAssignmentGroup(activeAll.filter(a => assignmentMatchesSearch(a, query)), sort),
    ended: sortAssignmentGroup(endedAll.filter(a => assignmentMatchesSearch(a, query)), sort)
  };
}

export function isAssignmentGroupCollapsed(group, preferences = {}) {
  const key = group === 'ended' ? '__group_ended' : '__group_active';
  return typeof preferences[key] === 'boolean' ? preferences[key] : group === 'ended';
}

/**
 * Swap two neighboring assignments within the same deadline group.
 * The opposite group retains its positions and relative order.
 */
export function moveTeacherAssignmentWithinGroup(items, assignmentId, direction, now = Date.now()) {
  const ordered = sortClassAssignments(items);
  if (![-1, 1].includes(direction)) return ordered;
  const from = ordered.findIndex(a => a.id === assignmentId);
  if (from < 0) return ordered;
  const ended = isAssignmentEnded(ordered[from], now);
  const peers = ordered.map((item, index) => ({ item, index }))
    .filter(row => isAssignmentEnded(row.item, now) === ended);
  const position = peers.findIndex(row => row.item.id === assignmentId);
  const target = peers[position + direction];
  if (!target) return ordered;
  const to = target.index;
  [ordered[from], ordered[to]] = [ordered[to], ordered[from]];
  return ordered;
}
