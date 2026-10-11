-- Mirror of the live, PicSpeak-only rate guard (see live migration list for actual version).
CREATE INDEX picspeak_assignments_creator_idx ON public.picspeak_assignments(created_by);
CREATE INDEX picspeak_launch_tokens_assignment_idx ON public.picspeak_launch_tokens(assignment_id);
CREATE FUNCTION public.picspeak_attempt_rate_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF (SELECT count(*) FROM public.picspeak_attempts
     WHERE assignment_id=NEW.assignment_id AND student_id=NEW.student_id
       AND recorded_at>now()-interval '1 hour')>=100
 THEN RAISE EXCEPTION 'Too many attempts in one hour' USING ERRCODE='22023'; END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.picspeak_attempt_rate_guard() FROM public,anon,authenticated;
CREATE TRIGGER picspeak_attempt_rate_check
BEFORE INSERT ON public.picspeak_attempts
FOR EACH ROW EXECUTE FUNCTION public.picspeak_attempt_rate_guard();
