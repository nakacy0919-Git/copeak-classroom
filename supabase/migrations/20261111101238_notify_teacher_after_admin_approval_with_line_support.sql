-- Automatically notify the teacher after an existing platform admin approves their registration.
-- The notification includes Copeak login instructions and a LINE support URL.
-- Secrets are referenced through Supabase Vault, never committed to the repository.

CREATE OR REPLACE FUNCTION public.admin_set_teacher_status(p_teacher_id uuid, p_status text, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
 v_previous_status text;
 v_teacher_email text;
 v_teacher_name text;
 v_approval_at timestamptz;
 v_token text;
 v_request_id bigint;
begin
 if not public.is_platform_admin(auth.uid()) then
   raise exception 'Admin access required.';
 end if;
 if p_status not in ('pending','approved','suspended','rejected') then
   raise exception 'Invalid teacher status.';
 end if;
 select p.teacher_status into v_previous_status
 from public.profiles p
 where p.id = p_teacher_id and p.role = 'teacher'
 for update;
 if not found then
   raise exception 'Teacher not found.';
 end if;
 update public.profiles set teacher_status=p_status where id=p_teacher_id;
 insert into public.teacher_details(
   teacher_id, reviewed_at, reviewed_by, review_note
 )
 values(
   p_teacher_id, now(), auth.uid(),
   nullif(trim(coalesce(p_note,'')),'')
 )
 on conflict (teacher_id)
 do update set
   reviewed_at=excluded.reviewed_at,
   reviewed_by=excluded.reviewed_by,
   review_note=excluded.review_note,
   updated_at=now();

 -- Notify only once on each real transition INTO approved.
 -- Other status updates, including an already approved account, send nothing.
 if p_status = 'approved' and v_previous_status is distinct from 'approved' then
   begin
     select u.email, p.display_name, td.reviewed_at
     into v_teacher_email, v_teacher_name, v_approval_at
     from public.profiles p
     join auth.users u on u.id=p.id
     join public.teacher_details td on td.teacher_id=p.id
     where p.id=p_teacher_id;
     if v_teacher_email is null or trim(v_teacher_email) = '' then
       raise warning 'Copeak approved teacher email missing';
       return;
     end if;
     select ds.decrypted_secret into v_token
     from vault.decrypted_secrets ds
     where ds.name='copeak_teacher_notify_token'
     limit 1;
     if v_token is null or length(v_token)<32 then
       raise warning 'Copeak approval notification token unavailable';
       return;
     end if;
     select net.http_post(
       url := 'https://ayrflycncfbvizlfchce.supabase.co/functions/v1/copeak-teacher-signup-notify',
       headers := jsonb_build_object(
         'Content-Type','application/json',
         'Authorization','Bearer '||v_token
       ),
       body := jsonb_build_object(
         'event','teacher_approved',
         'teacher_id',p_teacher_id,
         'email',lower(trim(v_teacher_email)),
         'teacher_name',coalesce(v_teacher_name,'先生'),
         'approval_id',to_char(v_approval_at at time zone 'UTC','YYYYMMDDHH24MISSUS')
       ),
       timeout_milliseconds := 18000
     ) into v_request_id;
   exception when others then
     -- Never let mail infrastructure block administrative approval.
     raise warning 'Copeak teacher approval notification enqueue failed: SQLSTATE %', SQLSTATE;
   end;
 end if;
end;
$function$
;
