-- PicSpeak-only additive hotfix. Does NOT change Copeak assignments/submissions.
ALTER TABLE public.picspeak_assignments
  DROP CONSTRAINT picspeak_content_per_mode_check;
ALTER TABLE public.picspeak_assignments
  ADD CONSTRAINT picspeak_content_per_mode_check CHECK (
    (mode = 'snapshot' AND theme_id ~ '^([0-9]{3}|theme_l2_[0-9]{3})$')
    OR (mode = 'mosaic' AND theme_id ~ '^mosaic_[0-9]{3,4}$')
    OR (mode = 'detective' AND theme_id ~ '^detective_[0-9]{3}$')
    OR (mode = 'oralquest' AND theme_id ~ '^oq_[0-9]{3}$')
    OR (mode = 'story' AND theme_id ~ '^story[1-9][0-9]*$')
    OR (mode = 'picflash' AND theme_id ~ '^[a-z][a-z0-9_]{2,80}$')
  );

-- Points and completion are different metrics.
ALTER TABLE public.picspeak_attempts
  ADD COLUMN score_raw numeric(9,2) CHECK (score_raw BETWEEN 0 AND 1000000);

-- The original launch-token validation remains authoritative.
-- No student/browser permission is granted to update the attempts table.
CREATE FUNCTION public.picspeak_finish_attempt_v2(
 p_token text, p_run_id uuid,
 p_score_percent numeric, p_completion_percent numeric,
 p_wpm numeric, p_word_count integer,
 p_duration_seconds numeric, p_score_raw numeric DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
  v_attempt_id uuid;
BEGIN
  IF p_score_raw IS NOT NULL AND (p_score_raw < 0 OR p_score_raw > 1000000) THEN
    RAISE EXCEPTION 'Raw score out of range' USING ERRCODE='22023';
  END IF;
  v_result := public.picspeak_finish_attempt(
    p_token, p_run_id, p_score_percent, p_completion_percent,
    p_wpm, p_word_count, p_duration_seconds
  );
  v_attempt_id := (v_result ->> 'attempt_id')::uuid;
  UPDATE public.picspeak_attempts
     SET score_raw = p_score_raw
   WHERE id = v_attempt_id
     AND score_raw IS NULL;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.picspeak_finish_attempt_v2(text,uuid,numeric,numeric,numeric,integer,numeric,numeric) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.picspeak_finish_attempt_v2(text,uuid,numeric,numeric,numeric,integer,numeric,numeric) TO anon;
