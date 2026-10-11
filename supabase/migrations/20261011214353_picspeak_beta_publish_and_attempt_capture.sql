-- Applied on production Copeak Classroom Supabase at 2026-10-11 21:43 UTC.
-- Additive PicSpeak-only schema: never run this migration again against a DB where it is already applied.
ALTER TABLE public.picspeak_assignments
 ADD COLUMN mode text NOT NULL DEFAULT 'snapshot'
 CHECK (mode IN ('snapshot','mosaic','detective','oralquest','story','picflash')),
 ADD COLUMN pass_percent numeric(5,2) NOT NULL DEFAULT 70 CHECK(pass_percent BETWEEN 0 AND 100),
 ADD COLUMN pass_seconds numeric(7,2) NOT NULL DEFAULT 90 CHECK(pass_seconds BETWEEN 1 AND 1800);
ALTER TABLE public.picspeak_assignments DROP CONSTRAINT picspeak_assignments_theme_id_check;
ALTER TABLE public.picspeak_assignments ADD CONSTRAINT picspeak_content_per_mode_check CHECK (
 (mode IN ('snapshot','mosaic','detective','oralquest') AND theme_id ~ '^([0-9]{3}|theme_l2_[0-9]{3})$')
 OR (mode='story' AND theme_id ~ '^story[1-9][0-9]*$')
 OR (mode='picflash' AND theme_id ~ '^[a-z][a-z0-9_]{2,80}$')
);
ALTER TABLE public.picspeak_assignments DROP CONSTRAINT picspeak_beta_draft_only_chk;
GRANT UPDATE(is_published,mode,pass_percent,pass_seconds) ON public.picspeak_assignments TO authenticated;

CREATE TABLE public.picspeak_attempts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 assignment_id uuid NOT NULL REFERENCES public.picspeak_assignments(id) ON DELETE CASCADE,
 class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
 student_id uuid NOT NULL REFERENCES public.profiles(id),
 run_id uuid NOT NULL,
 mode text NOT NULL,
 score_percent numeric(5,2) CHECK(score_percent BETWEEN 0 AND 100),
 completion_percent numeric(5,2) CHECK(completion_percent BETWEEN 0 AND 100),
 wpm numeric(7,2) CHECK(wpm BETWEEN 0 AND 1000),
 word_count integer CHECK(word_count BETWEEN 0 AND 10000),
 duration_seconds numeric(8,2) CHECK(duration_seconds BETWEEN 0 AND 36000),
 score_verified boolean NOT NULL DEFAULT false CHECK(score_verified=false),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(assignment_id,student_id,run_id)
);
CREATE INDEX picspeak_attempts_class_assignment_idx ON public.picspeak_attempts(class_id,assignment_id,student_id,recorded_at DESC);
CREATE INDEX picspeak_attempts_student_idx ON public.picspeak_attempts(student_id,assignment_id,recorded_at DESC);
ALTER TABLE public.picspeak_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.picspeak_attempts FROM public,anon,authenticated;
GRANT SELECT ON public.picspeak_attempts TO authenticated;
CREATE POLICY "picspeak_teacher_results" ON public.picspeak_attempts FOR SELECT TO authenticated
USING(public.is_teacher_of_class(class_id));
CREATE POLICY "picspeak_student_own_results" ON public.picspeak_attempts FOR SELECT TO authenticated
USING(student_id=(select auth.uid()));

CREATE TABLE public.picspeak_launch_tokens(
 token_hash text PRIMARY KEY,
 assignment_id uuid NOT NULL REFERENCES public.picspeak_assignments(id) ON DELETE CASCADE,
 student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 issued_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL
);
CREATE INDEX picspeak_launch_tokens_student_idx ON public.picspeak_launch_tokens(student_id,assignment_id,expires_at);
ALTER TABLE public.picspeak_launch_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.picspeak_launch_tokens FROM public,anon,authenticated;

CREATE FUNCTION public.picspeak_begin_attempt(p_assignment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
 v_a public.picspeak_assignments%ROWTYPE;
 v_token text;
 v_student uuid := (select auth.uid());
BEGIN
 IF v_student IS NULL THEN RAISE EXCEPTION 'Sign-in required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_a FROM public.picspeak_assignments WHERE id=p_assignment_id;
 IF NOT FOUND OR NOT v_a.is_published OR v_a.release_at>now() OR v_a.due_at<=now()
  OR NOT public.is_student_in_class(v_a.class_id)
 THEN RAISE EXCEPTION 'Assignment not available' USING ERRCODE='42501'; END IF;
 IF (SELECT count(*) FROM public.picspeak_launch_tokens
    WHERE assignment_id=p_assignment_id AND student_id=v_student
    AND issued_at>now()-interval '1 hour')>=30
 THEN RAISE EXCEPTION 'Too many launches' USING ERRCODE='22023'; END IF;
 v_token := encode(extensions.gen_random_bytes(32),'hex');
 INSERT INTO public.picspeak_launch_tokens(token_hash,assignment_id,student_id,expires_at)
 VALUES(encode(extensions.digest(v_token,'sha256'),'hex'),v_a.id,v_student,
        least(now()+interval '2 hours',v_a.due_at+interval '10 minutes'));
 RETURN jsonb_build_object('token',v_token,'assignment_id',v_a.id,'mode',v_a.mode,
  'content_id',v_a.theme_id,'level',v_a.level,'time_limit',v_a.time_limit,
  'expires_at',least(now()+interval '2 hours',v_a.due_at+interval '10 minutes'));
END;
$$;
REVOKE ALL ON FUNCTION public.picspeak_begin_attempt(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.picspeak_begin_attempt(uuid) TO authenticated;

CREATE FUNCTION public.picspeak_finish_attempt(
 p_token text,p_run_id uuid,p_score_percent numeric,p_completion_percent numeric,
 p_wpm numeric,p_word_count integer,p_duration_seconds numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
 v_l public.picspeak_launch_tokens%ROWTYPE;
 v_a public.picspeak_assignments%ROWTYPE;
 v_id uuid;
BEGIN
 IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$'
  OR p_run_id IS NULL THEN RAISE EXCEPTION 'Invalid token or run ID' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_l FROM public.picspeak_launch_tokens
 WHERE token_hash=encode(extensions.digest(p_token,'sha256'),'hex') AND expires_at>now();
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid or expired launch' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_a FROM public.picspeak_assignments WHERE id=v_l.assignment_id;
 IF NOT FOUND OR NOT v_a.is_published OR now()>v_a.due_at+interval '10 minutes'
  OR NOT public.is_student_in_class_for_user(v_a.class_id,v_l.student_id)
 THEN RAISE EXCEPTION 'Assignment expired or unavailable' USING ERRCODE='42501'; END IF;
 IF p_score_percent IS NOT NULL AND (p_score_percent<0 OR p_score_percent>100)
  OR p_completion_percent IS NOT NULL AND (p_completion_percent<0 OR p_completion_percent>100)
  OR p_wpm IS NOT NULL AND (p_wpm<0 OR p_wpm>1000)
  OR p_word_count IS NOT NULL AND (p_word_count<0 OR p_word_count>10000)
  OR p_duration_seconds IS NOT NULL AND (p_duration_seconds<0 OR p_duration_seconds>36000)
 THEN RAISE EXCEPTION 'Result out of range' USING ERRCODE='22023'; END IF;
 IF NOT ((v_a.mode='picflash' AND p_duration_seconds IS NOT NULL)
   OR (v_a.mode<>'picflash' AND p_score_percent IS NOT NULL))
 THEN RAISE EXCEPTION 'Missing score' USING ERRCODE='22023'; END IF;
 INSERT INTO public.picspeak_attempts(
  assignment_id,class_id,student_id,run_id,mode,score_percent,
  completion_percent,wpm,word_count,duration_seconds)
 VALUES(v_a.id,v_a.class_id,v_l.student_id,p_run_id,v_a.mode,
  p_score_percent,p_completion_percent,p_wpm,p_word_count,p_duration_seconds)
 ON CONFLICT (assignment_id,student_id,run_id) DO NOTHING RETURNING id INTO v_id;
 IF v_id IS NULL THEN
  SELECT id INTO v_id FROM public.picspeak_attempts
  WHERE assignment_id=v_a.id AND student_id=v_l.student_id AND run_id=p_run_id;
 END IF;
 RETURN jsonb_build_object('attempt_id',v_id,'saved',true,'verified',false);
END;
$$;
CREATE FUNCTION public.is_student_in_class_for_user(p_class_id uuid,p_student_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT EXISTS(SELECT 1 FROM public.class_members
 WHERE class_id=p_class_id AND student_id=p_student_id);
$$;
REVOKE ALL ON FUNCTION public.is_student_in_class_for_user(uuid,uuid) FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.picspeak_finish_attempt(text,uuid,numeric,numeric,numeric,integer,numeric) FROM public,authenticated;
GRANT EXECUTE ON FUNCTION public.picspeak_finish_attempt(text,uuid,numeric,numeric,numeric,integer,numeric) TO anon;
