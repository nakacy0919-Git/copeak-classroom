-- PicSpeak-only automatic account relink sync.
-- This trigger runs AFTER the existing Classroom roster join has completed.
-- It never changes Copeak assignments, submissions, or the existing join RPC.
CREATE FUNCTION public.picspeak_follow_roster_account_relink()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  IF NEW.linked_student_id IS NULL
    OR OLD.linked_student_id IS NULL
    OR NEW.linked_student_id=OLD.linked_student_id
    OR NEW.class_id<>OLD.class_id
  THEN
    RETURN NEW;
  END IF;

  -- Existing Copeak join_class_with_roster adds new membership before relinking the roster.
  IF NOT EXISTS (
    SELECT 1 FROM public.class_members cm
    WHERE cm.class_id=NEW.class_id AND cm.student_id=NEW.linked_student_id
  ) THEN
    RETURN NEW;
  END IF;

  BEGIN
    -- Recipients follow a roster seat when the student signs in with a new account.
    -- Avoid PK conflicts if both accounts had already been assigned.
    UPDATE public.picspeak_assignment_targets t
       SET student_id=NEW.linked_student_id
      FROM public.picspeak_assignments a
     WHERE t.assignment_id=a.id
       AND a.class_id=NEW.class_id
       AND t.student_id=OLD.linked_student_id
       AND NOT EXISTS (
         SELECT 1 FROM public.picspeak_assignment_targets duplicate
          WHERE duplicate.assignment_id=t.assignment_id
            AND duplicate.student_id=NEW.linked_student_id
       );

    -- Preserve the PicSpeak speaking results of the same seat, separately from Copeak.
    UPDATE public.picspeak_attempts pa
       SET student_id=NEW.linked_student_id
     WHERE pa.class_id=NEW.class_id
       AND pa.student_id=OLD.linked_student_id
       AND NOT EXISTS (
         SELECT 1 FROM public.picspeak_attempts duplicate
          WHERE duplicate.assignment_id=pa.assignment_id
            AND duplicate.student_id=NEW.linked_student_id
            AND duplicate.run_id=pa.run_id
       );
  EXCEPTION WHEN OTHERS THEN
    -- Never interrupt the existing Copeak student's class enrollment on a PicSpeak issue.
    RAISE WARNING 'PicSpeak roster relink sync skipped; existing Classroom join unaffected';
  END;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.picspeak_follow_roster_account_relink() FROM public,anon,authenticated;
CREATE TRIGGER picspeak_follow_roster_account_relink
AFTER UPDATE OF linked_student_id ON public.class_roster
FOR EACH ROW
WHEN (OLD.linked_student_id IS DISTINCT FROM NEW.linked_student_id)
EXECUTE FUNCTION public.picspeak_follow_roster_account_relink();
