create or replace function public.get_my_assignment_reading_rankings(p_class_id uuid)
returns table (
  assignment_id uuid,
  student_id uuid,
  best_accuracy numeric,
  best_wpm numeric,
  best_comprehension numeric,
  total_attempts bigint,
  accuracy_rank bigint,
  wpm_rank bigint,
  practice_rank bigint,
  total_students bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_student_in_class(p_class_id) then
    raise exception 'Student access required.' using errcode = '42501';
  end if;

  return query
  with eligible as (
    select
      a.id as assignment_id,
      cm.student_id
    from public.assignments a
    join public.class_members cm
      on cm.class_id = a.class_id
    where a.class_id = p_class_id
      and a.is_published = true
      and a.release_at <= now()
      and (
        a.audience_type = 'class'
        or exists (
          select 1
          from public.assignment_targets at
          where at.assignment_id = a.id
            and at.student_id = cm.student_id
        )
      )
  ),
  metrics as (
    select
      e.assignment_id,
      e.student_id,
      p.best_accuracy,
      p.best_wpm,
      p.best_comprehension,
      coalesce(p.total_attempts, 0)::bigint as total_attempts
    from eligible e
    left join public.student_assignment_progress p
      on p.assignment_id = e.assignment_id
     and p.student_id = e.student_id
  ),
  ranked as (
    select
      m.*,
      case
        when m.best_accuracy is null then null
        else rank() over (
          partition by m.assignment_id
          order by m.best_accuracy desc nulls last
        )
      end as accuracy_rank,
      case
        when m.best_wpm is null then null
        else rank() over (
          partition by m.assignment_id
          order by m.best_wpm desc nulls last
        )
      end as wpm_rank,
      case
        when m.total_attempts <= 0 then null
        else rank() over (
          partition by m.assignment_id
          order by m.total_attempts desc
        )
      end as practice_rank,
      count(*) over (
        partition by m.assignment_id
      )::bigint as total_students
    from metrics m
  )
  select
    r.assignment_id,
    r.student_id,
    r.best_accuracy,
    r.best_wpm,
    r.best_comprehension,
    r.total_attempts,
    r.accuracy_rank,
    r.wpm_rank,
    r.practice_rank,
    r.total_students
  from ranked r
  where r.student_id = auth.uid()
  order by r.assignment_id;
end;
$$;


create or replace function public.get_teacher_assignment_reading_rankings(p_class_id uuid)
returns table (
  assignment_id uuid,
  student_id uuid,
  best_accuracy numeric,
  best_wpm numeric,
  best_comprehension numeric,
  total_attempts bigint,
  accuracy_rank bigint,
  wpm_rank bigint,
  practice_rank bigint,
  total_students bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_teacher_of_class(p_class_id) then
    raise exception 'Teacher access required.' using errcode = '42501';
  end if;

  return query
  with eligible as (
    select
      a.id as assignment_id,
      cm.student_id
    from public.assignments a
    join public.class_members cm
      on cm.class_id = a.class_id
    where a.class_id = p_class_id
      and a.is_published = true
      and a.release_at <= now()
      and (
        a.audience_type = 'class'
        or exists (
          select 1
          from public.assignment_targets at
          where at.assignment_id = a.id
            and at.student_id = cm.student_id
        )
      )
  ),
  metrics as (
    select
      e.assignment_id,
      e.student_id,
      p.best_accuracy,
      p.best_wpm,
      p.best_comprehension,
      coalesce(p.total_attempts, 0)::bigint as total_attempts
    from eligible e
    left join public.student_assignment_progress p
      on p.assignment_id = e.assignment_id
     and p.student_id = e.student_id
  ),
  ranked as (
    select
      m.*,
      case
        when m.best_accuracy is null then null
        else rank() over (
          partition by m.assignment_id
          order by m.best_accuracy desc nulls last
        )
      end as accuracy_rank,
      case
        when m.best_wpm is null then null
        else rank() over (
          partition by m.assignment_id
          order by m.best_wpm desc nulls last
        )
      end as wpm_rank,
      case
        when m.total_attempts <= 0 then null
        else rank() over (
          partition by m.assignment_id
          order by m.total_attempts desc
        )
      end as practice_rank,
      count(*) over (
        partition by m.assignment_id
      )::bigint as total_students
    from metrics m
  )
  select
    r.assignment_id,
    r.student_id,
    r.best_accuracy,
    r.best_wpm,
    r.best_comprehension,
    r.total_attempts,
    r.accuracy_rank,
    r.wpm_rank,
    r.practice_rank,
    r.total_students
  from ranked r
  order by
    r.assignment_id,
    r.accuracy_rank nulls last,
    r.wpm_rank nulls last,
    r.student_id;
end;
$$;


revoke all
  on function public.get_my_assignment_reading_rankings(uuid)
  from public;

revoke all
  on function public.get_teacher_assignment_reading_rankings(uuid)
  from public;

grant execute
  on function public.get_my_assignment_reading_rankings(uuid)
  to authenticated;

grant execute
  on function public.get_teacher_assignment_reading_rankings(uuid)
  to authenticated;


revoke all
  on function public.update_student_assignment_progress_from_submission()
  from public;

revoke all
  on function public.update_student_assignment_progress_from_submission()
  from anon;

revoke all
  on function public.update_student_assignment_progress_from_submission()
  from authenticated;
