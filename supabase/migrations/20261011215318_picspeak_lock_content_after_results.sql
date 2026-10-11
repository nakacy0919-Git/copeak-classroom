-- Applied on production; freezes assignment content after first PicSpeak attempt.
CREATE FUNCTION public.picspeak_lock_started_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF (
  OLD.theme_id IS DISTINCT FROM NEW.theme_id OR
  OLD.mode IS DISTINCT FROM NEW.mode OR
  OLD.level IS DISTINCT FROM NEW.level OR
  OLD.time_limit IS DISTINCT FROM NEW.time_limit
 ) AND EXISTS (SELECT 1 FROM public.picspeak_attempts WHERE assignment_id=OLD.id)
 THEN
   RAISE EXCEPTION 'Cannot change PicSpeak content or mode after attempts have been recorded'
   USING ERRCODE='22023';
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.picspeak_lock_started_assignment() FROM public,anon,authenticated;
CREATE TRIGGER picspeak_content_lock BEFORE UPDATE ON public.picspeak_assignments
FOR EACH ROW EXECUTE FUNCTION public.picspeak_lock_started_assignment();
