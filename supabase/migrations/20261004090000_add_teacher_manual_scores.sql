create table if not exists public.manual_scores (
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  score numeric not null check (score >= 0 and score <= 100),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (assignment_id, student_id)
);

alter table public.manual_scores enable row level security;

drop policy if exists "teachers read manual scores"
on public.manual_scores;

create policy "teachers read manual scores"
on public.manual_scores
for select
to authenticated
using (
  exists (
    select 1
    from public.assignments a
    where a.id = manual_scores.assignment_id
      and public.is_teacher_of_class(a.class_id)
  )
);

grant select
on public.manual_scores
to authenticated;

create or replace function public.set_manual_score(
  p_assignment_id uuid,
  p_student_id uuid,
  p_score numeric
)
returns void
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
  where a.id = p_assignment_id;

  if v_class_id is null then
    raise exception 'Assignment not found.';
  end if;

  if not public.is_teacher_of_class(v_class_id) then
    raise exception 'Teacher access required.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.class_members cm
    where cm.class_id = v_class_id
      and cm.student_id = p_student_id
  ) then
    raise exception 'Student is not a member of this class.';
  end if;

  if p_score is null then

    delete from public.manual_scores
    where assignment_id = p_assignment_id
      and student_id = p_student_id;

    return;
  end if;

  if p_score < 0 or p_score > 100 then
    raise exception 'Score must be between 0 and 100.';
  end if;

  insert into public.manual_scores (
    assignment_id,
    student_id,
    score,
    updated_by,
    updated_at
  )
  values (
    p_assignment_id,
    p_student_id,
    p_score,
    auth.uid(),
    now()
  )

  on conflict (
    assignment_id,
    student_id
  )

  do update set
    score = excluded.score,
    updated_by = auth.uid(),
    updated_at = now();

end;
$$;

grant execute
on function public.set_manual_score(
  uuid,
  uuid,
  numeric
)
to authenticated;
