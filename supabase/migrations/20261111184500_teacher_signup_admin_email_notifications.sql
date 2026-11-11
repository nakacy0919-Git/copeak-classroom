-- Notify current Copeak Classroom platform admins when a teacher account is created.
-- Delivery is queued and is paused until two Supabase Vault secrets are installed:
--   copeak_resend_api_key  = Resend API key (create in the Resend dashboard)
--   copeak_resend_from     = Verified sender, e.g. "Copeak Classroom <notice@YOUR-VERIFIED-DOMAIN>"
-- Neither secret belongs in a GitHub file, browser, or chat.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.teacher_signup_mail (
  teacher_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','sending','sent','failed','skipped')),
  attempts integer not null default 0 check (attempts >= 0),
  request_id bigint,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

alter table private.teacher_signup_mail enable row level security;
revoke all on private.teacher_signup_mail from public, anon, authenticated;
create index if not exists teacher_signup_mail_due_idx
  on private.teacher_signup_mail(status, next_attempt_at);

create or replace function private.queue_teacher_signup_mail()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.profiles p
    where p.id = new.teacher_id
      and p.role = 'teacher'
      and p.teacher_status = 'pending'
  ) then
    insert into private.teacher_signup_mail(teacher_id)
    values (new.teacher_id)
    on conflict (teacher_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function private.queue_teacher_signup_mail() from public, anon, authenticated;
drop trigger if exists enqueue_teacher_signup_mail on public.teacher_details;
create trigger enqueue_teacher_signup_mail
  after insert on public.teacher_details
  for each row execute function private.queue_teacher_signup_mail();

create or replace function private.process_teacher_signup_mail()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_from text;
  v_to jsonb;
  v_item record;
  v_resp record;
  v_teacher record;
  v_body text;
  v_req bigint;
  v_enqueued integer := 0;
begin
  select s.decrypted_secret into v_key
    from vault.decrypted_secrets s where s.name = 'copeak_resend_api_key'
    order by s.created_at desc limit 1;
  select s.decrypted_secret into v_from
    from vault.decrypted_secrets s where s.name = 'copeak_resend_from'
    order by s.created_at desc limit 1;

  -- Do not attempt to send until a verified sender and API key are configured.
  if coalesce(trim(v_key), '') = '' or coalesce(trim(v_from), '') = '' then
    return 0;
  end if;

  for v_item in
    select * from private.teacher_signup_mail
    where status in ('pending', 'sending')
      and (status = 'sending' or next_attempt_at <= now())
    order by created_at
    limit 20 for update skip locked
  loop
    if v_item.status = 'sending' then
      select r.status_code, r.timed_out, r.error_msg, r.content
        into v_resp from net._http_response r where r.id = v_item.request_id
        order by r.created desc limit 1;

      if found then
        if v_resp.status_code between 200 and 299 then
          update private.teacher_signup_mail
             set status = 'sent', sent_at = now(), last_error = null
           where teacher_id = v_item.teacher_id;
          continue;
        end if;

        if v_item.attempts >= 5 then
          update private.teacher_signup_mail
             set status = 'failed', last_error = left(
               coalesce(v_resp.error_msg, v_resp.content, 'HTTP failure'), 300)
           where teacher_id = v_item.teacher_id;
        else
          update private.teacher_signup_mail
             set status = 'pending',
                 next_attempt_at = now() + make_interval(mins => least(60, 2 ^ v_item.attempts)::integer),
                 last_error = left(
                   coalesce(v_resp.error_msg, v_resp.content, 'HTTP failure'), 300)
           where teacher_id = v_item.teacher_id;
        end if;
        continue;
      end if;

      -- A lost response must not leave the item stuck indefinitely.
      if v_item.last_attempt_at > now() - interval '10 minutes' then
        continue;
      end if;
      if v_item.attempts >= 5 then
        update private.teacher_signup_mail
           set status='failed', last_error='No response after five attempts'
         where teacher_id=v_item.teacher_id;
      else
        update private.teacher_signup_mail
           set status='pending', next_attempt_at=now(),
               last_error='Response timed out; retrying with idempotency key'
         where teacher_id=v_item.teacher_id;
      end if;
      continue;
    end if;

    select p.display_name, p.created_at, p.teacher_status,
           td.email, td.school_name
      into v_teacher
      from public.profiles p
      join public.teacher_details td on td.teacher_id = p.id
      where p.id = v_item.teacher_id and p.role = 'teacher';

    if not found or v_teacher.teacher_status <> 'pending' then
      update private.teacher_signup_mail set status='skipped'
      where teacher_id=v_item.teacher_id;
      continue;
    end if;

    select coalesce(jsonb_agg(lower(u.email) order by u.email), '[]'::jsonb)
      into v_to
      from public.platform_admins pa
      join auth.users u on u.id = pa.user_id
      join public.profiles p on p.id = pa.user_id
     where u.email is not null and p.role = 'teacher'
       and p.teacher_status = 'approved';

    if jsonb_array_length(v_to) = 0 then
      continue;
    end if;

    v_body := format(
      'Copeak Classroomで新しい先生の登録申請がありました。%s%s氏名：%s%s学校名：%s%sメール：%s%s登録日時（日本時間）：%s%s%s承認待ち一覧（管理者ログインが必要です）：%s%s%sこのメールから直接承認はできません。管理者画面で登録内容をご確認ください。',
      E'\n', E'\n', coalesce(v_teacher.display_name, '—'), E'\n',
      coalesce(v_teacher.school_name, '—'), E'\n',
      coalesce(v_teacher.email, '—'), E'\n',
      to_char(v_teacher.created_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD HH24:MI'),
      E'\n', E'\n',
      'https://cc.pic-speak-story.com/admin.html?status=pending',
      E'\n', E'\n'
    );

    v_req := net.http_post(
      url := 'https://api.resend.com/emails',
      body := jsonb_build_object(
        'from', v_from,
        'to', v_to,
        'subject', '[Copeak Classroom] 新しい先生の承認申請',
        'text', v_body
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key,
        'Idempotency-Key', 'copeak-teacher-signup/' || v_item.teacher_id::text
      ),
      timeout_milliseconds := 10000
    );

    update private.teacher_signup_mail
       set status='sending', attempts=attempts+1, request_id=v_req,
           last_attempt_at=now(), last_error=null
     where teacher_id=v_item.teacher_id;
    v_enqueued := v_enqueued + 1;
  end loop;

  return v_enqueued;
end;
$$;

revoke all on function private.process_teacher_signup_mail() from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1 from cron.job where jobname='copeak-teacher-signup-mail'
  ) then
    perform cron.schedule(
      'copeak-teacher-signup-mail',
      '* * * * *',
      'select private.process_teacher_signup_mail();'
    );
  end if;
end;
$$;
