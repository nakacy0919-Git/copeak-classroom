alter table public.manual_scores
  alter column score drop not null;

alter table public.manual_scores
  add column if not exists wpm numeric,
  add column if not exists comprehension numeric;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'manual_scores_wpm_check'
      and conrelid = 'public.manual_scores'::regclass
  ) then

    alter table public.manual_scores
      add constraint manual_scores_wpm_check
      check (
        wpm is null
        or wpm >= 0
      );

  end if;


  if not exists (
    select 1
    from pg_constraint
    where conname = 'manual_scores_comprehension_check'
      and conrelid = 'public.manual_scores'::regclass
  ) then

    alter table public.manual_scores
      add constraint manual_scores_comprehension_check
      check (
        comprehension is null
        or (
          comprehension >= 0
          and comprehension <= 100
        )
      );

  end if;
end $$;


create or replace function public.set_manual_metric(
  p_assignment_id uuid,
  p_student_id uuid,
  p_metric text,
  p_value numeric
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


  if not public.is_teacher_of_class(
    v_class_id
  ) then

    raise exception
      'Teacher access required.'
      using errcode = '42501';

  end if;


  if not exists (
    select 1
    from public.class_members cm
    where cm.class_id = v_class_id
      and cm.student_id = p_student_id
  ) then

    raise exception
      'Student is not a member of this class.';

  end if;


  if p_metric not in (
    'accuracy',
    'wpm',
    'comprehension'
  ) then

    raise exception
      'Unsupported metric.';

  end if;


  if p_value is not null then

    if
      p_metric in (
        'accuracy',
        'comprehension'
      )
      and (
        p_value < 0
        or p_value > 100
      )
    then

      raise exception
        'Score must be between 0 and 100.';

    end if;


    if
      p_metric = 'wpm'
      and p_value < 0
    then

      raise exception
        'WPM must be 0 or greater.';

    end if;

  end if;


  insert into public.manual_scores (
    assignment_id,
    student_id,
    score,
    wpm,
    comprehension,
    updated_by,
    updated_at
  )
  values (
    p_assignment_id,
    p_student_id,

    case
      when p_metric = 'accuracy'
        then p_value
      else null
    end,

    case
      when p_metric = 'wpm'
        then p_value
      else null
    end,

    case
      when p_metric = 'comprehension'
        then p_value
      else null
    end,

    auth.uid(),
    now()
  )

  on conflict (
    assignment_id,
    student_id
  )

  do update set

    score =
      case
        when p_metric = 'accuracy'
          then p_value
        else manual_scores.score
      end,

    wpm =
      case
        when p_metric = 'wpm'
          then p_value
        else manual_scores.wpm
      end,

    comprehension =
      case
        when p_metric = 'comprehension'
          then p_value
        else manual_scores.comprehension
      end,

    updated_by =
      auth.uid(),

    updated_at =
      now();


  delete
  from public.manual_scores
  where assignment_id = p_assignment_id
    and student_id = p_student_id
    and score is null
    and wpm is null
    and comprehension is null;

end;
$$;


grant execute
on function public.set_manual_metric(
  uuid,
  uuid,
  text,
  numeric
)
to authenticated;
