/**
 * Class-specific ordering is presentation only. Never rewrite week_no,
 * gradebook_no, assignment IDs, submissions, or leaderboard rankings.
 */
export function sortClassAssignments(items) {
  return [...(items || [])].sort((a, b) => {
    const aOrder = Number(a.class_display_order);
    const bOrder = Number(b.class_display_order);
    const aIndex = Number.isInteger(aOrder) && aOrder > 0 ? aOrder : Infinity;
    const bIndex = Number.isInteger(bOrder) && bOrder > 0 ? bOrder : Infinity;
    return aIndex - bIndex ||
      Number(a.week_no || 0) - Number(b.week_no || 0) ||
      String(a.id).localeCompare(String(b.id));
  });
}

export function moveClassAssignment(items, id, direction) {
  const ordered = sortClassAssignments(items);
  const from = ordered.findIndex(item => item.id === id);
  const to = from + direction;
  if (from < 0 || ![-1, 1].includes(direction) || to < 0 || to >= ordered.length) {
    return ordered;
  }
  const [moved] = ordered.splice(from, 1);
  ordered.splice(to, 0, moved);
  return ordered;
}
