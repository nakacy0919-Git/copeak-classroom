// Load every submission relevant to the selected class instead of relying on
// the PostgREST default 1,000-row limit. Keep the database records unchanged.
const PAGE_SIZE = 500;

export async function fetchGradebookSubmissions(sb, assignmentIds, studentIds) {
  if (!assignmentIds.length || !studentIds.length) return [];

  const allRows = [];
  const classStudentIds = new Set(studentIds);
  const relevantAssignments = new Set(assignmentIds);

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await sb
      .from('submissions')
      .select('id,assignment_id,student_id,accuracy,wpm,comprehension,submitted_at')
      .in('assignment_id', assignmentIds)
      .in('student_id', studentIds)
      .order('submitted_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Grade Bookの提出履歴取得に失敗しました (${offset}件目以降): ${error.message || String(error)}`);
    }
    if (!Array.isArray(data)) {
      throw new Error('Grade Bookの提出履歴の取得結果が不正です。');
    }

    for (const row of data) {
      if (classStudentIds.has(row.student_id) && relevantAssignments.has(row.assignment_id)) {
        allRows.push(row);
      }
    }

    if (data.length < PAGE_SIZE) return allRows;
  }
}
