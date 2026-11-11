-- Notify approved platform administrators on new teacher registration only.
-- Requires Vault secret 'copeak_teacher_notify_token', created outside versioned migrations.

CREATE OR REPLACE FUNCTION public.queue_new_teacher_approval_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_token text;
 v_admins jsonb;
 v_name text;
 v_req_id bigint;
begin
 select ds.decrypted_secret into v_token
 from vault.decrypted_secrets ds
 where ds.name = 'copeak_teacher_notify_token' limit 1;
 if v_token is null or length(v_token) < 32 then
   raise warning 'Copeak teacher signup notice token is unavailable';
   return new;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id', pa.user_id, 'email', au.email)), '[]'::jsonb)
 into v_admins
 from public.platform_admins pa
 join auth.users au on au.id = pa.user_id
 join public.profiles ap on ap.id=pa.user_id
 where au.email is not null
   and ap.teacher_status = 'approved';
 if jsonb_array_length(v_admins) = 0 then
   raise warning 'Copeak teacher signup notice: no approved platform admin email';
   return new;
 end if;
 select coalesce(p.display_name, '未登録') into v_name
 from public.profiles p where p.id = new.teacher_id;
 select net.http_post(
   url := 'https://ayrflycncfbvizlfchce.supabase.co/functions/v1/copeak-teacher-signup-notify',
   headers := jsonb_build_object(
     'Content-Type', 'application/json',
     'Authorization', 'Bearer ' || v_token
   ),
   body := jsonb_build_object(
     'event', 'teacher_registered',
     'teacher_id', new.teacher_id,
     'teacher', jsonb_build_object(
       'name', coalesce(v_name,'未登録'),
       'school', coalesce(new.school_name,'未登録'),
       'email', lower(new.email)
     ),
     'admins', v_admins
   ),
   timeout_milliseconds := 18000
 ) into v_req_id;
 return new;
exception when others then
 raise warning 'Copeak teacher approval email enqueue failed: SQLSTATE %', SQLSTATE;
 return new;
end;
$function$
;

revoke all on function public.queue_new_teacher_approval_email() from public, anon, authenticated;

drop trigger if exists trg_new_teacher_approval_email on public.teacher_details;
create trigger trg_new_teacher_approval_email
 after insert on public.teacher_details for each row
 execute function public.queue_new_teacher_approval_email();
