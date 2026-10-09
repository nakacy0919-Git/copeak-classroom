-- Additive admin inspection only. Existing score writes and RLS are unchanged.
create table public.classroom_diagnostics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  code text not null check (code in ('launch_preparation_failed','delivery_too_long','submission_save_failed','dashboard_refresh_failed')),
  reason text not null default 'unknown' check (reason in ('offline','permission','duplicate','invalid_data','unknown')),
  created_at timestamptz not null default now()
);
alter table public.classroom_diagnostics enable row level security;
revoke all on public.classroom_diagnostics from public, anon, authenticated;
create index classroom_diagnostics_assignment_time_idx on public.classroom_diagnostics(assignment_id,created_at desc);
create index classroom_diagnostics_user_time_idx on public.classroom_diagnostics(user_id,created_at desc);

create function public.report_classroom_diagnostic(p_assignment_id uuid,p_code text,p_reason text default 'unknown')
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_code is null or p_code not in ('launch_preparation_failed','delivery_too_long','submission_save_failed','dashboard_refresh_failed') then
    raise exception 'Invalid diagnostic code' using errcode='22023';
  end if;
  if p_reason is null or p_reason not in ('offline','permission','duplicate','invalid_data','unknown') then raise exception 'Invalid reason' using errcode='22023'; end if;
  if not exists(select 1 from public.assignments a where a.id=p_assignment_id and (
    (public.is_student_member_of_assignment_class(a.id,v_user) and (a.audience_type='class' or exists(
      select 1 from public.assignment_targets t where t.assignment_id=a.id and t.student_id=v_user)))
    or exists(select 1 from public.classes c where c.id=a.class_id and c.teacher_id=v_user)
  )) then raise exception 'Assignment access denied' using errcode='42501'; end if;
  -- Serialize per user to enforce deduplication and bounded storage even across tabs.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text,719));
  delete from public.classroom_diagnostics where user_id=v_user and created_at<now()-interval '30 days';
  if (select count(*) from public.classroom_diagnostics d where d.user_id=v_user and d.created_at>now()-interval '1 day') >= 100 then return; end if;
  if exists(select 1 from public.classroom_diagnostics d where d.user_id=v_user and d.assignment_id=p_assignment_id
    and d.code=p_code and d.created_at>now()-interval '1 minute') then return; end if;
  insert into public.classroom_diagnostics(user_id,assignment_id,code,reason) values(v_user,p_assignment_id,p_code,p_reason);
end $$;
revoke all on function public.report_classroom_diagnostic(uuid,text,text) from public,anon;
grant execute on function public.report_classroom_diagnostic(uuid,text,text) to authenticated;

create function public.admin_inspect_activity(
  p_view text, p_teacher_id uuid default null, p_assignment_id uuid default null,
  p_student_id uuid default null, p_search text default '', p_page integer default 0, p_size integer default 8
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb; v_size integer := least(50,greatest(1,coalesce(p_size,8)));
  v_offset integer := least(100000,greatest(0,coalesce(p_page,0))) * v_size;
  v_search text := left(coalesce(p_search,''),100);
begin
  if auth.uid() is null or not public.is_platform_admin(auth.uid()) then
    raise exception 'Platform admin required' using errcode='42501';
  end if;
  if p_view='assignments' then
    if p_teacher_id is null then raise exception 'Teacher required' using errcode='22023'; end if;
    with filtered as (
      select a.id assignment_id,a.title,a.practice_mode,a.release_at,a.due_at,a.created_at,
        a.is_published,a.pass_enabled,a.pass_accuracy,a.pass_wpm,a.pass_comprehension,
        case when not a.is_published then 'draft' when a.release_at>now() then 'scheduled'
          when a.due_at<=now() then 'closed' else 'open' end delivery_status,
        (select string_agg(c.name,' / ' order by c.name,c.id) from public.classes c where c.id=a.class_id
          or exists(select 1 from public.assignment_classes ac where ac.assignment_id=a.id and ac.class_id=c.id)) class_names,
        (select count(distinct cm.student_id) from public.class_members cm where
          (cm.class_id=a.class_id or exists(select 1 from public.assignment_classes ac where ac.assignment_id=a.id and ac.class_id=cm.class_id))
          and (a.audience_type='class' or exists(select 1 from public.assignment_targets t where t.assignment_id=a.id and t.student_id=cm.student_id))) target_count,
        (select count(distinct s.student_id) from public.submissions s where s.assignment_id=a.id
          and public.is_student_member_of_assignment_class(a.id,s.student_id)
          and (a.audience_type='class' or exists(select 1 from public.assignment_targets t where t.assignment_id=a.id and t.student_id=s.student_id))) submitted_students,
        (select count(*) from public.submissions s where s.assignment_id=a.id) submission_count,
        (select count(*) from public.classroom_diagnostics d where d.assignment_id=a.id and d.created_at>now()-interval '7 days') recent_errors
      from public.assignments a join public.classes c on c.id=a.class_id
      where c.teacher_id=p_teacher_id and (v_search='' or strpos(lower(a.title),lower(v_search))>0 or exists(
        select 1 from public.classes cc where (cc.id=a.class_id or exists(select 1 from public.assignment_classes ac where ac.assignment_id=a.id and ac.class_id=cc.id))
        and strpos(lower(cc.name),lower(v_search))>0))
    ) select jsonb_build_object('total',(select count(*) from filtered),'items',coalesce((
      select jsonb_agg(to_jsonb(r)) from (select * from filtered order by created_at desc,assignment_id limit v_size offset v_offset) r),'[]'::jsonb)) into v_result;
  elsif p_view='students' then
    if p_assignment_id is null then raise exception 'Assignment required' using errcode='22023'; end if;
    with eligible as (
      select distinct cm.student_id from public.assignments a join public.class_members cm on
        (cm.class_id=a.class_id or exists(select 1 from public.assignment_classes ac where ac.assignment_id=a.id and ac.class_id=cm.class_id))
      where a.id=p_assignment_id and (a.audience_type='class' or exists(select 1 from public.assignment_targets t where t.assignment_id=a.id and t.student_id=cm.student_id))
    ), ids as (select student_id from eligible union select student_id from public.submissions where assignment_id=p_assignment_id union select student_id from public.manual_scores where assignment_id=p_assignment_id),
    filtered as (
      select p.id student_id,p.display_name student_name,exists(select 1 from eligible e where e.student_id=p.id) current_target,
        (select count(*) from public.submissions s where s.assignment_id=p_assignment_id and s.student_id=p.id) attempts,
        latest.accuracy,latest.wpm,latest.comprehension,latest.submitted_at,latest.practice_mode,
        round(coalesce(m.score,best.accuracy)) effective_accuracy,
        round(coalesce(m.wpm,best.wpm)) effective_wpm,
        round(coalesce(m.comprehension,best.comprehension)) effective_comprehension,
        case when not a.pass_enabled or (a.pass_accuracy is null and a.pass_wpm is null and a.pass_comprehension is null) then null else
          coalesce(a.pass_accuracy is null or round(coalesce(m.score,best.accuracy))>=a.pass_accuracy,false)
          and coalesce(a.pass_wpm is null or round(coalesce(m.wpm,best.wpm))>=a.pass_wpm,false)
          and coalesce(a.pass_comprehension is null or round(coalesce(m.comprehension,best.comprehension))>=a.pass_comprehension,false) end passed
      from ids join public.profiles p on p.id=ids.student_id join public.assignments a on a.id=p_assignment_id
      left join public.manual_scores m on m.assignment_id=a.id and m.student_id=p.id
      left join lateral(select max(s.accuracy) accuracy,max(s.wpm) wpm,max(s.comprehension) comprehension
        from public.submissions s where s.assignment_id=a.id and s.student_id=p.id) best on true
      left join lateral(select s.* from public.submissions s where s.assignment_id=p_assignment_id and s.student_id=p.id
        order by s.submitted_at desc,s.id desc limit 1) latest on true
      where v_search='' or strpos(lower(coalesce(p.display_name,'')),lower(v_search))>0
    ) select jsonb_build_object('total',(select count(*) from filtered),'items',coalesce((
      select jsonb_agg(to_jsonb(r)) from(select * from filtered order by student_name,student_id limit v_size offset v_offset)r),'[]'::jsonb)) into v_result;
  elsif p_view='history' then
    if p_assignment_id is null or p_student_id is null then raise exception 'Assignment and student required' using errcode='22023'; end if;
    with filtered as (select s.id,s.accuracy,s.wpm,s.comprehension,s.attempt_no,s.practice_mode,s.paced_target_wpm,s.vanish_level,s.submitted_at
      from public.submissions s where s.assignment_id=p_assignment_id and s.student_id=p_student_id)
    select jsonb_build_object('total',(select count(*) from filtered),'items',coalesce((select jsonb_agg(to_jsonb(r)) from(
      select * from filtered order by submitted_at desc,id desc limit v_size offset v_offset)r),'[]'::jsonb)) into v_result;
  elsif p_view='lesson' then
    if p_assignment_id is null then raise exception 'Assignment required' using errcode='22023'; end if;
    select jsonb_build_object('total',count(*),'items',coalesce(jsonb_agg(jsonb_build_object(
      'assignment_id',a.id,'lesson_type',a.lesson_type,'lesson_text',a.lesson_text,
      'lesson_translation',a.lesson_translation,'lesson_dialogue',a.lesson_dialogue)),'[]'::jsonb))
    into v_result from public.assignments a where a.id=p_assignment_id;
  elsif p_view='diagnostics' then
    with filtered as (
      select d.id,d.created_at,d.code,d.reason,p.display_name reporter_name,a.title,c.name class_name,tp.display_name teacher_name
      from public.classroom_diagnostics d join public.assignments a on a.id=d.assignment_id
      join public.classes c on c.id=a.class_id join public.profiles p on p.id=d.user_id join public.profiles tp on tp.id=c.teacher_id
      where d.created_at>now()-interval '30 days' and (p_teacher_id is null or c.teacher_id=p_teacher_id)
        and (p_assignment_id is null or a.id=p_assignment_id)
        and (v_search='' or strpos(lower(a.title||' '||coalesce(p.display_name,'')||' '||d.code),lower(v_search))>0)
    ) select jsonb_build_object('total',(select count(*) from filtered),'items',coalesce((select jsonb_agg(to_jsonb(r)) from(
      select * from filtered order by created_at desc,id desc limit v_size offset v_offset)r),'[]'::jsonb)) into v_result;
  else raise exception 'Invalid view' using errcode='22023'; end if;
  return v_result;
end $$;
revoke all on function public.admin_inspect_activity(text,uuid,uuid,uuid,text,integer,integer) from public,anon;
grant execute on function public.admin_inspect_activity(text,uuid,uuid,uuid,text,integer,integer) to authenticated;
create index if not exists submissions_assignment_student_time_idx on public.submissions(assignment_id,student_id,submitted_at desc,id desc);
