-- Retire the legacy once-per-minute teacher signup email poller.
-- Future registration notification and approval confirmation continue on
-- their event-driven paths; historical queue data and functions are preserved.

do $$
begin
  if exists (
    select 1
      from cron.job
     where jobname = 'copeak-teacher-signup-mail'
  ) then
    perform cron.unschedule('copeak-teacher-signup-mail');
  end if;
end;
$$;

drop trigger if exists enqueue_teacher_signup_mail
  on public.teacher_details;
