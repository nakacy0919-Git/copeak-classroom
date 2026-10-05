create table if not exists public.student_assignment_progress (
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  total_attempts integer not null default 0 check (total_attempts >= 0),
  best_accuracy numeric null check (
    best_accuracy is null
    or (best_accuracy >= 0 and best_accuracy <= 100)
  ),
  best_wpm numeric null check (
    best_wpm is null
    or best_wpm >= 0
  ),
  best_comprehension numeric null check (
    best_comprehension is null
    or (
      best_comprehension >= 0
      and best_comprehension <= 100
    )
  ),
  first_attempt_at timestamptz null,
  last_attempt_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (assignment_id, student_id)
);

create index if not exists student_assignment_progress_class_idx
  on public.student_assignment_progress(class_id);

create index if not exists student_assignment_progress_student_idx
  on public.student_assignment_progress(student_id);

create index if not exists student_assignment_progress_last_attempt_idx
  on public.student_assignment_progress(last_attempt_at desc);


alter table public.student_assignment_progress
  enable row level security;

revoke all
  on table public.student_assignment_progress
  from anon;

revoke all
  on table public.student_assignment_progress
  from authenticated;

grant select
  on table public.student_assignment_progress
  to authenticated;


drop policy if exists
  "students read own progress"
  on public.student_assignment_progress;

create policy
  "students read own progress"
on public.student_assignment_progress
for select
to authenticated
using (
  student_id = auth.uid()
  and public.is_student_in_class(class_id)
);


drop policy if exists
  "teachers read class progress"
  on public.student_assignment_progress;

create policy
  "teachers read class progress"
on public.student_assignment_progress
for select
to authenticated
using (
  public.is_teacher_of_class(class_id)
);


create or replace function
  public.update_student_assignment_progress_from_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_id uuid;
begin

  select a.class_id
    into v_class_id
  from public.assignments a
  where a.id = new.assignment_id;


  if v_class_id is null then
    return new;
  end if;


  insert into public.student_assignment_progress (
    assignment_id,
    student_id,
    class_id,
    total_attempts,
    best_accuracy,
    best_wpm,
    best_comprehension,
    first_attempt_at,
    last_attempt_at,
    created_at,
    updated_at
  )
  values (
    new.assignment_id,
    new.student_id,
    v_class_id,
    1,
    new.accuracy,
    new.wpm,
    new.comprehension,
    coalesce(new.submitted_at, now()),
    coalesce(new.submitted_at, now()),
    now(),
    now()
  )
  on conflict (assignment_id, student_id)
  do update set

    class_id =
      excluded.class_id,

    total_attempts =
      public.student_assignment_progress.total_attempts + 1,

    best_accuracy =
      case
        when excluded.best_accuracy is null
          then public.student_assignment_progress.best_accuracy
        when public.student_assignment_progress.best_accuracy is null
          then excluded.best_accuracy
        else greatest(
          public.student_assignment_progress.best_accuracy,
          excluded.best_accuracy
        )
      end,

    best_wpm =
      case
        when excluded.best_wpm is null
          then public.student_assignment_progress.best_wpm
        when public.student_assignment_progress.best_wpm is null
          then excluded.best_wpm
        else greatest(
          public.student_assignment_progress.best_wpm,
          excluded.best_wpm
        )
      end,

    best_comprehension =
      case
        when excluded.best_comprehension is null
          then public.student_assignment_progress.best_comprehension
        when public.student_assignment_progress.best_comprehension is null
          then excluded.best_comprehension
        else greatest(
          public.student_assignment_progress.best_comprehension,
          excluded.best_comprehension
        )
      end,

    first_attempt_at =
      case
        when public.student_assignment_progress.first_attempt_at is null
          then excluded.first_attempt_at
        else least(
          public.student_assignment_progress.first_attempt_at,
          excluded.first_attempt_at
        )
      end,

    last_attempt_at =
      case
        when public.student_assignment_progress.last_attempt_at is null
          then excluded.last_attempt_at
        else greatest(
          public.student_assignment_progress.last_attempt_at,
          excluded.last_attempt_at
        )
      end,

    updated_at =
      now();


  return new;
end;
$$;


drop trigger if exists
  submissions_update_student_assignment_progress
  on public.submissions;

create trigger
  submissions_update_student_assignment_progress
after insert
on public.submissions
for each row
execute function
  public.update_student_assignment_progress_from_submission();


insert into public.student_assignment_progress (
  assignment_id,
  student_id,
  class_id,
  total_attempts,
  best_accuracy,
  best_wpm,
  best_comprehension,
  first_attempt_at,
  last_attempt_at,
  created_at,
  updated_at
)
select
  s.assignment_id,
  s.student_id,
  a.class_id,
  count(*)::integer,
  max(s.accuracy),
  max(s.wpm),
  max(s.comprehension),
  min(s.submitted_at),
  max(s.submitted_at),
  now(),
  now()
from public.submissions s
join public.assignments a
  on a.id = s.assignment_id
group by
  s.assignment_id,
  s.student_id,
  a.class_id
on conflict (assignment_id, student_id)
do update set
  class_id =
    excluded.class_id,
  total_attempts =
    excluded.total_attempts,
  best_accuracy =
    excluded.best_accuracy,
  best_wpm =
    excluded.best_wpm,
  best_comprehension =
    excluded.best_comprehension,
  first_attempt_at =
    excluded.first_attempt_at,
  last_attempt_at =
    excluded.last_attempt_at,
  updated_at =
    now();


create or replace function
  public.get_my_class_reading_rank(
    p_class_id uuid
  )
returns table (
  student_id uuid,
  avg_accuracy numeric,
  avg_wpm numeric,
  total_attempts bigint,
  completed_assignments bigint,
  accuracy_rank bigint,
  wpm_rank bigint,
  practice_rank bigint,
  total_students bigint,
  accuracy_participants bigint,
  wpm_participants bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin

  if not public.is_student_in_class(p_class_id) then
    raise exception
      'Student access required.'
      using errcode = '42501';
  end if;


  return query

  with metrics as (

    select
      cm.student_id,

      avg(p.best_accuracy)
        filter (
          where a.id is not null
          and p.best_accuracy is not null
        ) as avg_accuracy,

      avg(p.best_wpm)
        filter (
          where a.id is not null
          and p.best_wpm is not null
        ) as avg_wpm,

      coalesce(
        sum(p.total_attempts)
          filter (
            where a.id is not null
          ),
        0
      )::bigint
        as total_attempts,

      count(p.assignment_id)
        filter (
          where a.id is not null
        )::bigint
        as completed_assignments

    from public.class_members cm

    left join public.student_assignment_progress p
      on p.class_id = cm.class_id
     and p.student_id = cm.student_id

    left join public.assignments a
      on a.id = p.assignment_id
     and a.class_id = p_class_id
     and a.is_published = true
     and a.audience_type = 'class'
     and a.release_at <= now()

    where cm.class_id = p_class_id

    group by
      cm.student_id
  ),

  ranked as (

    select
      m.*,

      case
        when m.avg_accuracy is null
          then null
        else rank() over (
          order by m.avg_accuracy desc nulls last
        )
      end
        as accuracy_rank,

      case
        when m.avg_wpm is null
          then null
        else rank() over (
          order by m.avg_wpm desc nulls last
        )
      end
        as wpm_rank,

      case
        when m.total_attempts <= 0
          then null
        else rank() over (
          order by m.total_attempts desc
        )
      end
        as practice_rank,

      count(*) over ()::bigint
        as total_students,

      count(m.avg_accuracy) over ()::bigint
        as accuracy_participants,

      count(m.avg_wpm) over ()::bigint
        as wpm_participants

    from metrics m
  )

  select
    r.student_id,
    r.avg_accuracy,
    r.avg_wpm,
    r.total_attempts,
    r.completed_assignments,
    r.accuracy_rank,
    r.wpm_rank,
    r.practice_rank,
    r.total_students,
    r.accuracy_participants,
    r.wpm_participants

  from ranked r

  where r.student_id = auth.uid();

end;
$$;


create or replace function
  public.get_teacher_class_reading_rankings(
    p_class_id uuid
  )
returns table (
  student_id uuid,
  avg_accuracy numeric,
  avg_wpm numeric,
  total_attempts bigint,
  completed_assignments bigint,
  accuracy_rank bigint,
  wpm_rank bigint,
  practice_rank bigint,
  total_students bigint,
  accuracy_participants bigint,
  wpm_participants bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin

  if not public.is_teacher_of_class(p_class_id) then
    raise exception
      'Teacher access required.'
      using errcode = '42501';
  end if;


  return query

  with metrics as (

    select
      cm.student_id,

      avg(p.best_accuracy)
        filter (
          where a.id is not null
          and p.best_accuracy is not null
        ) as avg_accuracy,

      avg(p.best_wpm)
        filter (
          where a.id is not null
          and p.best_wpm is not null
        ) as avg_wpm,

      coalesce(
        sum(p.total_attempts)
          filter (
            where a.id is not null
          ),
        0
      )::bigint
        as total_attempts,

      count(p.assignment_id)
        filter (
          where a.id is not null
        )::bigint
        as completed_assignments

    from public.class_members cm

    left join public.student_assignment_progress p
      on p.class_id = cm.class_id
     and p.student_id = cm.student_id

    left join public.assignments a
      on a.id = p.assignment_id
     and a.class_id = p_class_id
     and a.is_published = true
     and a.audience_type = 'class'
     and a.release_at <= now()

    where cm.class_id = p_class_id

    group by
      cm.student_id
  ),

  ranked as (

    select
      m.*,

      case
        when m.avg_accuracy is null
          then null
        else rank() over (
          order by m.avg_accuracy desc nulls last
        )
      end
        as accuracy_rank,

      case
        when m.avg_wpm is null
          then null
        else rank() over (
          order by m.avg_wpm desc nulls last
        )
      end
        as wpm_rank,

      case
        when m.total_attempts <= 0
          then null
        else rank() over (
          order by m.total_attempts desc
        )
      end
        as practice_rank,

      count(*) over ()::bigint
        as total_students,

      count(m.avg_accuracy) over ()::bigint
        as accuracy_participants,

      count(m.avg_wpm) over ()::bigint
        as wpm_participants

    from metrics m
  )

  select
    r.student_id,
    r.avg_accuracy,
    r.avg_wpm,
    r.total_attempts,
    r.completed_assignments,
    r.accuracy_rank,
    r.wpm_rank,
    r.practice_rank,
    r.total_students,
    r.accuracy_participants,
    r.wpm_participants

  from ranked r

  order by
    r.accuracy_rank nulls last,
    r.wpm_rank nulls last,
    r.student_id;

end;
$$;


revoke all
  on function public.get_my_class_reading_rank(uuid)
  from public;

revoke all
  on function public.get_teacher_class_reading_rankings(uuid)
  from public;

grant execute
  on function public.get_my_class_reading_rank(uuid)
  to authenticated;

grant execute
  on function public.get_teacher_class_reading_rankings(uuid)
  to authenticated;
