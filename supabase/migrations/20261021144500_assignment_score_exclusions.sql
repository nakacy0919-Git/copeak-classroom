-- Copeak Classroom: add optional teacher-controlled accuracy exclusions.
-- Existing assignments keep [] so their scores remain unchanged.
-- This migration is independent of the grade book pagination fix.
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS score_exclusions jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.assignments.score_exclusions IS
  'Teacher-approved phrases omitted from Copeak Accuracy calculation only; WPM and original lesson text are unchanged.';
