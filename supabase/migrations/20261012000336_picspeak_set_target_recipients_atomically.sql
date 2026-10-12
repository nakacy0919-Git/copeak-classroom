-- Atomic, teacher-authorized PicSpeak recipient replacement.
CREATE OR REPLACE FUNCTION public.picspeak_set_assignment_recipients(
 p_assignment_id uuid,p_audience_type text,p_student_ids uuid[] DEFAULT array[]::uuid[]
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
 v_a public.picspeak_assignments%ROWTYPE;
 v_ids uuid[];
 v_count int;
BEGIN
 IF (SELECT auth.uid()) IS NULL THEN
   RAISE EXCEPTION 'Sign-in required' USING errcode='42501'; END IF;
 SELECT * INTO v_a FROM public.picspeak_assignments
   WHERE id=p_assignment_id FOR UPDATE;
 IF NOT FOUND OR NOT public.is_teacher_of_class(v_a.class_id) THEN
   RAISE EXCEPTION 'Assignment not accessible' USING errcode='42501'; END IF;
 IF v_a.is_published THEN
   RAISE EXCEPTION 'Unpublish before changing recipients' USING errcode='22023'; END IF;
 IF p_audience_type NOT IN ('targeted','class') OR p_audience_type IS NULL THEN
   RAISE EXCEPTION 'Invalid audience' USING errcode='22023'; END IF;
 SELECT coalesce(array_agg(DISTINCT x),array[]::uuid[])
 INTO v_ids FROM unnest(coalesce(p_student_ids,array[]::uuid[])) x WHERE x IS NOT NULL;
 v_count:=cardinality(v_ids);
 IF v_count>500 THEN RAISE EXCEPTION 'Too many recipients' USING errcode='22023'; END IF;
 IF p_audience_type='targeted' AND v_count=0 THEN
   RAISE EXCEPTION 'Select at least one student' USING errcode='22023'; END IF;
 IF p_audience_type='targeted' AND EXISTS(
   SELECT 1 FROM unnest(v_ids) AS s(student_id)
   WHERE NOT EXISTS (
     SELECT 1 FROM public.class_members cm
     WHERE cm.class_id=v_a.class_id AND cm.student_id=s.student_id
   )
 ) THEN RAISE EXCEPTION 'Recipient is not in this class' USING errcode='42501'; END IF;
 DELETE FROM public.picspeak_assignment_targets WHERE assignment_id=v_a.id;
 IF p_audience_type='targeted' THEN
   INSERT INTO public.picspeak_assignment_targets(assignment_id,student_id)
   SELECT v_a.id,unnest(v_ids);
 END IF;
 UPDATE public.picspeak_assignments
   SET audience_type=p_audience_type WHERE id=v_a.id;
 RETURN jsonb_build_object('saved',true,'audience_type',p_audience_type,
   'recipient_count',CASE WHEN p_audience_type='targeted' THEN v_count ELSE NULL END);
END;
$$;
REVOKE ALL ON FUNCTION public.picspeak_set_assignment_recipients(uuid,text,uuid[]) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.picspeak_set_assignment_recipients(uuid,text,uuid[]) TO authenticated;
