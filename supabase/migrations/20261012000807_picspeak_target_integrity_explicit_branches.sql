-- More robust trigger branching for INSERT and DELETE; PicSpeak only.
CREATE OR REPLACE FUNCTION public.picspeak_target_integrity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_class_id uuid; v_published boolean;
BEGIN
 IF tg_op='DELETE' THEN
   SELECT class_id,is_published INTO v_class_id,v_published
     FROM public.picspeak_assignments WHERE id=old.assignment_id;
 ELSE
   SELECT class_id,is_published INTO v_class_id,v_published
     FROM public.picspeak_assignments WHERE id=new.assignment_id;
 END IF;
 IF v_class_id IS NULL THEN
   IF tg_op='DELETE' THEN RETURN old; END IF;
   RAISE EXCEPTION 'Assignment not found' USING errcode='23503';
 END IF;
 IF v_published THEN
   RAISE EXCEPTION 'Unpublish assignment before changing its recipients' USING errcode='22023';
 END IF;
 IF tg_op='INSERT' THEN
   IF NOT EXISTS(
     SELECT 1 FROM public.class_members cm
     WHERE cm.class_id=v_class_id AND cm.student_id=new.student_id
   ) THEN
     RAISE EXCEPTION 'Student is not a member of this class' USING errcode='42501';
   END IF;
   RETURN new;
 END IF;
 RETURN old;
END;
$$;
REVOKE ALL ON FUNCTION public.picspeak_target_integrity() FROM public,anon,authenticated;
