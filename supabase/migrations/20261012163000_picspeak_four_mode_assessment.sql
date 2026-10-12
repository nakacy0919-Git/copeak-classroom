-- ADDITIVE PicSpeak-only schema change. Does not touch Copeak assignments/submissions.
ALTER TABLE public.picspeak_assignments
  ADD COLUMN pass_correct integer NOT NULL DEFAULT 8 CHECK(pass_correct BETWEEN 1 AND 10),
  ADD COLUMN pass_reading_percent numeric(5,2) NOT NULL DEFAULT 70 CHECK(pass_reading_percent BETWEEN 0 AND 100),
  ADD COLUMN pass_picture_percent numeric(5,2) NOT NULL DEFAULT 70 CHECK(pass_picture_percent BETWEEN 0 AND 100),
  ADD COLUMN pass_qa_rating integer NOT NULL DEFAULT 1 CHECK(pass_qa_rating IN (1,2));
GRANT UPDATE(pass_correct,pass_reading_percent,pass_picture_percent,pass_qa_rating)
  ON public.picspeak_assignments TO authenticated;
ALTER TABLE public.picspeak_attempts ADD COLUMN metrics jsonb NOT NULL DEFAULT '{}'::jsonb
  CHECK(jsonb_typeof(metrics)='object' AND octet_length(metrics::text)<=2048);

-- Launch tokens are 256-bit random bearer credentials. Attempts remain unverified.
CREATE FUNCTION public.picspeak_finish_attempt_v3(
 p_token text,p_run_id uuid,p_score_percent numeric,p_completion_percent numeric,
 p_wpm numeric,p_word_count integer,p_duration_seconds numeric,
 p_score_raw numeric DEFAULT NULL,p_metrics jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_a public.picspeak_assignments%ROWTYPE;
        v_result jsonb; v_attempt uuid; m jsonb:=coalesce(p_metrics,'{}'::jsonb);
        correct_n numeric;skip_n numeric;total_n numeric;
BEGIN
 IF jsonb_typeof(m)<>'object' OR octet_length(m::text)>2048 THEN
   RAISE EXCEPTION 'Invalid metrics object' USING ERRCODE='22023'; END IF;
 IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
   RAISE EXCEPTION 'Invalid token' USING ERRCODE='22023'; END IF;
 SELECT a.* INTO v_a FROM public.picspeak_assignments a
 JOIN public.picspeak_launch_tokens t ON t.assignment_id=a.id
 WHERE t.token_hash=encode(extensions.digest(p_token,'sha256'),'hex') AND t.expires_at>now();
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid or expired token' USING ERRCODE='42501'; END IF;
 IF v_a.mode='picflash' THEN
   IF m->>'trial' IS DISTINCT FROM 'true' OR m->>'language' IS DISTINCT FROM 'en-US'
     OR jsonb_typeof(m->'correct') IS DISTINCT FROM 'number'
     OR jsonb_typeof(m->'skipped') IS DISTINCT FROM 'number'
     OR jsonb_typeof(m->'total') IS DISTINCT FROM 'number'
     OR (m->>'total')::numeric<>10 THEN
      RAISE EXCEPTION 'PIC FLASH requires verified game-count fields' USING ERRCODE='22023'; END IF;
   correct_n:=(m->>'correct')::numeric;skip_n:=(m->>'skipped')::numeric;total_n:=(m->>'total')::numeric;
   IF correct_n<>trunc(correct_n) OR skip_n<>trunc(skip_n) OR correct_n<0 OR skip_n<0
     OR correct_n+skip_n<>10 OR p_duration_seconds IS NULL THEN
     RAISE EXCEPTION 'PIC FLASH counts inconsistent' USING ERRCODE='22023'; END IF;
   IF p_completion_percent IS NULL OR abs(p_completion_percent-correct_n*10)>0.51 THEN
      RAISE EXCEPTION 'PIC FLASH accuracy inconsistent' USING ERRCODE='22023'; END IF;
 ELSIF v_a.mode='detective' THEN
   IF jsonb_typeof(m->'found') IS DISTINCT FROM 'number' OR jsonb_typeof(m->'total') IS DISTINCT FROM 'number'
      OR (m->>'total')::numeric NOT BETWEEN 1 AND 100
      OR (m->>'found')::numeric NOT BETWEEN 0 AND (m->>'total')::numeric
      OR (m->>'found')::numeric<>trunc((m->>'found')::numeric)
      OR (m->>'total')::numeric<>trunc((m->>'total')::numeric)
   THEN RAISE EXCEPTION 'DETECTIVE result missing counts' USING ERRCODE='22023'; END IF;
   IF p_completion_percent IS NULL OR abs(p_completion_percent-100*(m->>'found')::numeric/(m->>'total')::numeric)>1 THEN
      RAISE EXCEPTION 'DETECTIVE completion inconsistent' USING ERRCODE='22023'; END IF;
 ELSIF v_a.mode='story' THEN
   IF jsonb_typeof(m->'scenes_completed') IS DISTINCT FROM 'number' OR jsonb_typeof(m->'targets_found') IS DISTINCT FROM 'number'
     OR jsonb_typeof(m->'targets_total') IS DISTINCT FROM 'number'
     OR (m->>'scenes_completed')::numeric<>4
     OR (m->>'targets_total')::numeric<=0
     OR (m->>'targets_found')::numeric NOT BETWEEN 0 AND (m->>'targets_total')::numeric
   THEN RAISE EXCEPTION 'STORY requires four scenes and valid target counts' USING ERRCODE='22023'; END IF;
   IF p_completion_percent IS NULL OR abs(p_completion_percent-100*(m->>'targets_found')::numeric/(m->>'targets_total')::numeric)>1 THEN
     RAISE EXCEPTION 'STORY completion inconsistent' USING ERRCODE='22023'; END IF;
 ELSIF v_a.mode='oralquest' THEN
   IF jsonb_typeof(m->'reading_accuracy') IS DISTINCT FROM 'number'
     OR jsonb_typeof(m->'picture_completion') IS DISTINCT FROM 'number'
     OR jsonb_typeof(m->'qa1_rating') IS DISTINCT FROM 'number'
     OR jsonb_typeof(m->'qa2_rating') IS DISTINCT FROM 'number'
     OR jsonb_typeof(m->'stages_completed') IS DISTINCT FROM 'number'
     OR (m->>'stages_completed')::numeric<>3
     OR (m->>'reading_accuracy')::numeric NOT BETWEEN 0 AND 100
     OR (m->>'picture_completion')::numeric NOT BETWEEN 0 AND 100
     OR (m->>'qa1_rating')::numeric NOT IN (0,1,2)
     OR (m->>'qa2_rating')::numeric NOT IN (0,1,2)
   THEN RAISE EXCEPTION 'ORAL QUEST stage metrics incomplete' USING ERRCODE='22023'; END IF;
   IF p_completion_percent IS NULL OR abs(p_completion_percent-(m->>'picture_completion')::numeric)>0.51 THEN
     RAISE EXCEPTION 'ORAL QUEST picture completion inconsistent' USING ERRCODE='22023'; END IF;
 END IF;
 -- v2 performs expiring token validation, enrolled/targeted access checks, rate limiting and deduplication.
 v_result:=public.picspeak_finish_attempt_v2(p_token,p_run_id,p_score_percent,
   p_completion_percent,p_wpm,p_word_count,p_duration_seconds,p_score_raw);
 v_attempt:=(v_result->>'attempt_id')::uuid;
 UPDATE public.picspeak_attempts pa SET metrics=m
   WHERE pa.id=v_attempt AND pa.metrics='{}'::jsonb;
 RETURN v_result;
END; $$;
REVOKE ALL ON FUNCTION public.picspeak_finish_attempt_v3(text,uuid,numeric,numeric,numeric,integer,numeric,numeric,jsonb)
  FROM public,authenticated;
GRANT EXECUTE ON FUNCTION public.picspeak_finish_attempt_v3(text,uuid,numeric,numeric,numeric,integer,numeric,numeric,jsonb)
  TO anon;

-- Protect published assignment grading criteria once submissions exist.
CREATE OR REPLACE FUNCTION public.picspeak_lock_started_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF (OLD.theme_id IS DISTINCT FROM NEW.theme_id OR OLD.mode IS DISTINCT FROM NEW.mode OR
     OLD.level IS DISTINCT FROM NEW.level OR OLD.time_limit IS DISTINCT FROM NEW.time_limit OR
     OLD.pass_percent IS DISTINCT FROM NEW.pass_percent OR OLD.pass_seconds IS DISTINCT FROM NEW.pass_seconds OR
     OLD.pass_correct IS DISTINCT FROM NEW.pass_correct OR
     OLD.pass_reading_percent IS DISTINCT FROM NEW.pass_reading_percent OR
     OLD.pass_picture_percent IS DISTINCT FROM NEW.pass_picture_percent OR
     OLD.pass_qa_rating IS DISTINCT FROM NEW.pass_qa_rating)
    AND EXISTS(SELECT 1 FROM public.picspeak_attempts WHERE assignment_id=OLD.id)
 THEN RAISE EXCEPTION 'Cannot change grading criteria after attempts exist' USING ERRCODE='22023'; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.picspeak_lock_started_assignment() FROM public,anon,authenticated;
