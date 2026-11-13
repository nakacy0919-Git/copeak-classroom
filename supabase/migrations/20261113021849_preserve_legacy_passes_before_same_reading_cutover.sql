-- Snapshot of PASS decisions made under the original independent-best policy.
-- The same-reading-only rule was deployed at 2026-11-11 08:10:07.099 UTC.
-- Run once; do not dynamically award future passes under the old policy.
CREATE TABLE IF NOT EXISTS public.assignment_preserved_passes (
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  rule text NOT NULL DEFAULT 'legacy_independent_best_20261111',
  preserved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (assignment_id, student_id)
);

ALTER TABLE public.assignment_preserved_passes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assignment_preserved_passes FROM anon;
GRANT SELECT ON public.assignment_preserved_passes TO authenticated;

CREATE POLICY "student and class teachers read preserved passes"
ON public.assignment_preserved_passes FOR SELECT TO authenticated
USING (
  (SELECT auth.uid()) = student_id
  OR public.can_read_assignment_student(assignment_id, student_id)
);

WITH cutoff AS (
  SELECT '2026-11-11 08:10:07.099+00'::timestamptz AS at
), best_accuracy AS (
  SELECT DISTINCT ON (s.student_id, s.assignment_id)
    s.student_id, s.assignment_id, s.accuracy, s.submitted_at
  FROM public.submissions s CROSS JOIN cutoff c
  WHERE s.submitted_at < c.at
  ORDER BY s.student_id, s.assignment_id, s.accuracy DESC NULLS LAST, s.submitted_at ASC, s.id ASC
), best_wpm AS (
  SELECT DISTINCT ON (s.student_id, s.assignment_id)
    s.student_id, s.assignment_id, s.wpm, s.submitted_at
  FROM public.submissions s CROSS JOIN cutoff c
  WHERE s.submitted_at < c.at
  ORDER BY s.student_id, s.assignment_id, s.wpm DESC NULLS LAST, s.submitted_at ASC, s.id ASC
), historical_keys AS (
  SELECT student_id, assignment_id FROM best_accuracy
  UNION
  SELECT student_id, assignment_id FROM best_wpm
  UNION
  SELECT m.student_id, m.assignment_id
  FROM public.manual_scores m CROSS JOIN cutoff c
  WHERE m.updated_at < c.at
), effective_at_cutover AS (
  SELECT k.student_id, k.assignment_id, a.pass_accuracy, a.pass_wpm,
    CASE
      WHEN m.score IS NOT NULL AND (ba.submitted_at IS NULL OR m.updated_at >= ba.submitted_at)
      THEN round(m.score)
      ELSE round(ba.accuracy)
    END AS accuracy,
    CASE
      WHEN m.wpm IS NOT NULL AND (bw.submitted_at IS NULL OR m.updated_at >= bw.submitted_at)
      THEN round(m.wpm)
      ELSE round(bw.wpm)
    END AS wpm
  FROM historical_keys k
  JOIN public.assignments a ON a.id = k.assignment_id
  LEFT JOIN best_accuracy ba ON ba.student_id = k.student_id AND ba.assignment_id = k.assignment_id
  LEFT JOIN best_wpm bw ON bw.student_id = k.student_id AND bw.assignment_id = k.assignment_id
  LEFT JOIN public.manual_scores m ON m.student_id = k.student_id AND m.assignment_id = k.assignment_id
    AND m.updated_at < (SELECT at FROM cutoff)
  WHERE a.pass_enabled = true AND (a.pass_accuracy IS NOT NULL OR a.pass_wpm IS NOT NULL)
)
INSERT INTO public.assignment_preserved_passes (student_id, assignment_id)
SELECT student_id, assignment_id
FROM effective_at_cutover
WHERE (pass_accuracy IS NULL OR accuracy >= pass_accuracy)
  AND (pass_wpm IS NULL OR wpm >= pass_wpm)
ON CONFLICT (assignment_id, student_id) DO NOTHING;
