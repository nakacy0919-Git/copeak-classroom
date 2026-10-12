-- Additive PicSpeak-only migration; existing Copeak assignments/submissions are untouched.
-- New beta assignments default to individual delivery (fail closed).
ALTER TABLE public.picspeak_assignments
  ADD COLUMN audience_type text NOT NULL DEFAULT 'targeted'
  CHECK (audience_type IN ('targeted','class'));
GRANT UPDATE(audience_type) ON public.picspeak_assignments TO authenticated;

CREATE TABLE public.picspeak_assignment_targets (
  assignment_id uuid NOT NULL REFERENCES public.picspeak_assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (assignment_id,student_id)
);
CREATE INDEX picspeak_targets_student_idx
  ON public.picspeak_assignment_targets(student_id,assignment_id);
ALTER TABLE public.picspeak_assignment_targets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.picspeak_assignment_targets FROM public,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.picspeak_assignment_targets TO authenticated;

CREATE POLICY "picspeak_teacher_target_read"
ON public.picspeak_assignment_targets FOR SELECT TO authenticated
USING (EXISTS(
  SELECT 1 FROM public.picspeak_assignments a
  WHERE a.id=assignment_id AND public.is_teacher_of_class(a.class_id)
));
CREATE POLICY "picspeak_student_own_target_read"
ON public.picspeak_assignment_targets FOR SELECT TO authenticated
USING(student_id=(SELECT auth.uid()));
CREATE POLICY "picspeak_teacher_target_insert"
ON public.picspeak_assignment_targets FOR INSERT TO authenticated
WITH CHECK(EXISTS(
  SELECT 1 FROM public.picspeak_assignments a
  WHERE a.id=assignment_id AND public.is_teacher_of_class(a.class_id)
));
CREATE POLICY "picspeak_teacher_target_delete"
ON public.picspeak_assignment_targets FOR DELETE TO authenticated
USING(EXISTS(
  SELECT 1 FROM public.picspeak_assignments a
  WHERE a.id=assignment_id AND public.is_teacher_of_class(a.class_id)
));

CREATE FUNCTION public.picspeak_target_integrity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_class_id uuid; v_published boolean;
BEGIN
 SELECT class_id,is_published INTO v_class_id,v_published
 FROM public.picspeak_assignments
 WHERE id=(CASE WHEN tg_op='DELETE' THEN old.assignment_id ELSE new.assignment_id END);
 IF v_class_id IS NULL THEN
   IF tg_op='DELETE' THEN RETURN old; END IF;
   RAISE EXCEPTION 'Assignment not found' USING errcode='23503';
 END IF;
 IF v_published THEN
   RAISE EXCEPTION 'Unpublish assignment before changing its recipients' USING errcode='22023';
 END IF;
 IF tg_op='INSERT' AND NOT EXISTS(
   SELECT 1 FROM public.class_members cm
   WHERE cm.class_id=v_class_id AND cm.student_id=new.student_id
 ) THEN RAISE EXCEPTION 'Student is not a member of this class' USING errcode='42501'; END IF;
 IF tg_op='DELETE' THEN RETURN old; END IF;
 RETURN new;
END;
$$;
REVOKE ALL ON FUNCTION public.picspeak_target_integrity() FROM public,anon,authenticated;
CREATE TRIGGER picspeak_targets_integrity_guard
BEFORE INSERT OR DELETE ON public.picspeak_assignment_targets
FOR EACH ROW EXECUTE FUNCTION public.picspeak_target_integrity();

CREATE FUNCTION public.picspeak_publish_target_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF new.is_published AND new.audience_type='targeted' AND NOT EXISTS(
   SELECT 1 FROM public.picspeak_assignment_targets t
   JOIN public.class_members cm
     ON cm.student_id=t.student_id AND cm.class_id=new.class_id
   WHERE t.assignment_id=new.id
 ) THEN
   RAISE EXCEPTION 'Select at least one class member before publishing' USING errcode='22023';
 END IF;
 RETURN new;
END;
$$;
REVOKE ALL ON FUNCTION public.picspeak_publish_target_guard() FROM public,anon,authenticated;
CREATE TRIGGER picspeak_publish_target_guard
BEFORE INSERT OR UPDATE OF is_published,audience_type ON public.picspeak_assignments
FOR EACH ROW EXECUTE FUNCTION public.picspeak_publish_target_guard();

CREATE FUNCTION public.picspeak_is_selected_student(p_assignment_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT EXISTS(SELECT 1 FROM public.picspeak_assignment_targets t
   WHERE t.assignment_id=p_assignment_id AND t.student_id=(SELECT auth.uid()));
$$;
REVOKE ALL ON FUNCTION public.picspeak_is_selected_student(uuid) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.picspeak_is_selected_student(uuid) TO authenticated;

DROP POLICY "picspeak_student_published_read" ON public.picspeak_assignments;
CREATE POLICY "picspeak_student_published_read"
ON public.picspeak_assignments FOR SELECT TO authenticated
USING (
  is_published AND release_at<=now()
  AND public.is_student_in_class(class_id)
  AND (audience_type='class' OR public.picspeak_is_selected_student(id))
);

CREATE OR REPLACE FUNCTION public.picspeak_begin_attempt(p_assignment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
 v_a public.picspeak_assignments%ROWTYPE;
 v_token text;
 v_student uuid := (SELECT auth.uid());
BEGIN
 IF v_student IS NULL THEN RAISE EXCEPTION 'Sign-in required' USING errcode='42501'; END IF;
 SELECT * INTO v_a FROM public.picspeak_assignments WHERE id=p_assignment_id;
 IF NOT FOUND OR NOT v_a.is_published OR v_a.release_at>now() OR v_a.due_at<=now()
   OR NOT public.is_student_in_class(v_a.class_id)
 THEN RAISE EXCEPTION 'Assignment not available' USING errcode='42501'; END IF;
 IF v_a.audience_type='targeted' AND NOT EXISTS(
   SELECT 1 FROM public.picspeak_assignment_targets t
   WHERE t.assignment_id=v_a.id AND t.student_id=v_student
 ) THEN RAISE EXCEPTION 'Assignment not available' USING errcode='42501'; END IF;
 IF (SELECT count(*) FROM public.picspeak_launch_tokens
     WHERE assignment_id=p_assignment_id AND student_id=v_student
       AND issued_at>now()-interval '1 hour')>=30
 THEN RAISE EXCEPTION 'Too many launches' USING errcode='22023'; END IF;
 v_token:=encode(extensions.gen_random_bytes(32),'hex');
 INSERT INTO public.picspeak_launch_tokens(token_hash,assignment_id,student_id,expires_at)
 VALUES(encode(extensions.digest(v_token,'sha256'),'hex'),v_a.id,v_student,
        least(now()+interval '2 hours',v_a.due_at+interval '10 minutes'));
 RETURN jsonb_build_object('token',v_token,'assignment_id',v_a.id,'mode',v_a.mode,
   'content_id',v_a.theme_id,'level',v_a.level,'time_limit',v_a.time_limit,
   'expires_at',least(now()+interval '2 hours',v_a.due_at+interval '10 minutes'));
END;
$$;

CREATE OR REPLACE FUNCTION public.picspeak_finish_attempt(
 p_token text,p_run_id uuid,p_score_percent numeric,p_completion_percent numeric,
 p_wpm numeric,p_word_count integer,p_duration_seconds numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
 v_l public.picspeak_launch_tokens%ROWTYPE;
 v_a public.picspeak_assignments%ROWTYPE;
 v_id uuid;
BEGIN
 IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' OR p_run_id IS NULL
 THEN RAISE EXCEPTION 'Invalid token or run ID' USING errcode='22023'; END IF;
 SELECT * INTO v_l FROM public.picspeak_launch_tokens
 WHERE token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
   AND expires_at>now();
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid or expired launch' USING errcode='42501'; END IF;
 SELECT * INTO v_a FROM public.picspeak_assignments WHERE id=v_l.assignment_id;
 IF NOT FOUND OR NOT v_a.is_published OR now()>v_a.due_at+interval '10 minutes'
   OR NOT public.is_student_in_class_for_user(v_a.class_id,v_l.student_id)
 THEN RAISE EXCEPTION 'Assignment expired or unavailable' USING errcode='42501'; END IF;
 IF v_a.audience_type='targeted' AND NOT EXISTS(
   SELECT 1 FROM public.picspeak_assignment_targets t
   WHERE t.assignment_id=v_a.id AND t.student_id=v_l.student_id
 ) THEN RAISE EXCEPTION 'Assignment no longer assigned' USING errcode='42501'; END IF;
 IF (p_score_percent IS NOT NULL AND (p_score_percent<0 OR p_score_percent>100))
 OR (p_completion_percent IS NOT NULL AND (p_completion_percent<0 OR p_completion_percent>100))
 OR (p_wpm IS NOT NULL AND (p_wpm<0 OR p_wpm>1000))
 OR (p_word_count IS NOT NULL AND (p_word_count<0 OR p_word_count>10000))
 OR (p_duration_seconds IS NOT NULL AND (p_duration_seconds<0 OR p_duration_seconds>36000))
 THEN RAISE EXCEPTION 'Result out of range' USING errcode='22023'; END IF;
 IF NOT (
   (v_a.mode='picflash' AND p_duration_seconds IS NOT NULL)
   OR (v_a.mode<>'picflash' AND p_score_percent IS NOT NULL)
 ) THEN RAISE EXCEPTION 'Missing score' USING errcode='22023'; END IF;
 INSERT INTO public.picspeak_attempts(
   assignment_id,class_id,student_id,run_id,mode,score_percent,
   completion_percent,wpm,word_count,duration_seconds)
 VALUES(v_a.id,v_a.class_id,v_l.student_id,p_run_id,v_a.mode,
        p_score_percent,p_completion_percent,p_wpm,p_word_count,p_duration_seconds)
 ON CONFLICT (assignment_id,student_id,run_id) DO NOTHING
 RETURNING id INTO v_id;
 IF v_id IS NULL THEN
   SELECT id INTO v_id FROM public.picspeak_attempts
   WHERE assignment_id=v_a.id AND student_id=v_l.student_id AND run_id=p_run_id;
 END IF;
 RETURN jsonb_build_object('attempt_id',v_id,'saved',true,'verified',false);
END;
$$;
