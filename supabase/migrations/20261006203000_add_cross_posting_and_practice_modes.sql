-- =========================================================
-- Copeak Classroom
-- Cross-posting + Practice Mode foundation
-- 2026-10-06
-- =========================================================

-- =========================================================
-- 1. ASSIGNMENT PRACTICE POLICY
-- =========================================================

alter table public.assignments
  add column practice_mode text not null default 'free';

alter table public.assignments
  add column mode_locked boolean not null default false;

alter table public.assignments
  add column paced_target_wpm integer;

alter table public.assignments
  add column vanish_level integer;


alter table public.assignments
  add constraint assignments_practice_mode_valid
  check (
    practice_mode in (
      'free',
      'reading',
      'paced',
      'vanish',
      'shadowing'
    )
  );


alter table public.assignments
  add constraint assignments_paced_target_wpm_valid
  check (
    paced_target_wpm is null
    or (
      paced_target_wpm >= 40
      and paced_target_wpm <= 300
    )
  );


alter table public.assignments
  add constraint assignments_vanish_level_valid
  check (
    vanish_level is null
    or (
      vanish_level >= 1
      and vanish_level <= 5
    )
  );


-- =========================================================
-- 2. RECORD ACTUAL PRACTICE MODE ON SUBMISSION
-- =========================================================

alter table public.submissions
  add column practice_mode text;

alter table public.submissions
  add column paced_target_wpm integer;

alter table public.submissions
  add column vanish_level integer;


alter table public.submissions
  add constraint submissions_practice_mode_valid
  check (
    practice_mode is null
    or practice_mode in (
      'reading',
      'paced',
      'vanish',
      'shadowing'
    )
  );


alter table public.submissions
  add constraint submissions_paced_target_wpm_valid
  check (
    paced_target_wpm is null
    or (
      paced_target_wpm >= 40
      and paced_target_wpm <= 300
    )
  );


alter table public.submissions
  add constraint submissions_vanish_level_valid
  check (
    vanish_level is null
    or (
      vanish_level >= 1
      and vanish_level <= 5
    )
  );


-- =========================================================
-- 3. CROSS-POSTING TABLE
-- One assignment can belong to multiple classes.
--
-- assignments.class_id remains as the primary / legacy class
-- for backward compatibility.
-- =========================================================

create table public.assignment_classes (

  assignment_id uuid not null
    references public.assignments(id)
    on delete cascade,

  class_id uuid not null
    references public.classes(id)
    on delete cascade,

  created_at timestamptz not null
    default now(),

  primary key (
    assignment_id,
    class_id
  )
);


create index assignment_classes_class_id_idx
  on public.assignment_classes(
    class_id,
    assignment_id
  );


-- =========================================================
-- 4. BACKFILL ALL EXISTING ASSIGNMENTS
-- Existing assignments automatically receive their legacy
-- class_id as their first assignment_classes row.
-- =========================================================

insert into public.assignment_classes (
  assignment_id,
  class_id
)
select
  id,
  class_id
from public.assignments
on conflict do nothing;


-- =========================================================
-- 5. HELPER:
-- Is this assignment distributed to this class?
-- =========================================================

create or replace function public.is_assignment_in_class(
  p_assignment_id uuid,
  p_class_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.assignment_classes ac
      where
        ac.assignment_id = p_assignment_id
        and ac.class_id = p_class_id
    )
    or
    exists (
      select 1
      from public.assignments a
      where
        a.id = p_assignment_id
        and a.class_id = p_class_id
    );
$$;


-- =========================================================
-- 6. HELPER:
-- Teacher access to an assignment through ANY target class
-- =========================================================

create or replace function public.is_teacher_of_assignment(
  p_assignment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.assignment_classes ac
      where
        ac.assignment_id = p_assignment_id
        and public.is_teacher_of_class(
          ac.class_id
        )
    )
    or
    exists (
      select 1
      from public.assignments a
      where
        a.id = p_assignment_id
        and public.is_teacher_of_class(
          a.class_id
        )
    );
$$;


-- =========================================================
-- 7. HELPER:
-- Is student in ANY class receiving the assignment?
-- =========================================================

create or replace function public.is_student_member_of_assignment_class(
  p_assignment_id uuid,
  p_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.assignment_classes ac
      join public.class_members cm
        on cm.class_id = ac.class_id
      where
        ac.assignment_id = p_assignment_id
        and cm.student_id = p_student_id
    )
    or
    exists (
      select 1
      from public.assignments a
      join public.class_members cm
        on cm.class_id = a.class_id
      where
        a.id = p_assignment_id
        and cm.student_id = p_student_id
    );
$$;


-- =========================================================
-- 8. ASSIGNMENT_CLASSES RLS
-- =========================================================

alter table public.assignment_classes
  enable row level security;


create policy "assignment class participant read"
on public.assignment_classes
for select
to authenticated
using (
  public.is_teacher_of_assignment(
    assignment_id
  )
  or
  public.is_student_in_class(
    class_id
  )
);


create policy "teacher inserts assignment classes"
on public.assignment_classes
for insert
to authenticated
with check (
  public.is_teacher_of_assignment(
    assignment_id
  )
  and
  public.is_teacher_of_class(
    class_id
  )
);


create policy "teacher deletes assignment classes"
on public.assignment_classes
for delete
to authenticated
using (
  public.is_teacher_of_assignment(
    assignment_id
  )
  and
  public.is_teacher_of_class(
    class_id
  )
);


-- =========================================================
-- 9. UPDATE ASSIGNMENT READ POLICY
-- Students can see an assignment if they belong to ANY
-- distributed class.
-- =========================================================

drop policy if exists
  "assignment participant read"
on public.assignments;


create policy "assignment participant read"
on public.assignments
for select
to authenticated
using (
  public.is_teacher_of_assignment(
    id
  )
  or
  (
    is_published
    and
    public.is_student_member_of_assignment_class(
      id,
      auth.uid()
    )
    and
    (
      audience_type = 'class'
      or
      exists (
        select 1
        from public.assignment_targets at
        where
          at.assignment_id = assignments.id
          and at.student_id = auth.uid()
      )
    )
  )
);


-- =========================================================
-- 10. SUBMISSION ACCESS
-- =========================================================

create or replace function public.can_submit_assignment(
  p_assignment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assignments a
    where
      a.id = p_assignment_id
      and a.is_published
      and
      public.is_student_member_of_assignment_class(
        a.id,
        auth.uid()
      )
      and
      (
        a.audience_type = 'class'
        or
        exists (
          select 1
          from public.assignment_targets at
          where
            at.assignment_id = a.id
            and at.student_id = auth.uid()
        )
      )
  );
$$;


create or replace function public.can_read_submission(
  p_assignment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_teacher_of_assignment(
      p_assignment_id
    );
$$;


-- =========================================================
-- 11. TARGETED ASSIGNMENT SUPPORT
-- Keep existing behavior, but validate students against any
-- class attached to the assignment.
-- =========================================================

create or replace function public.set_assignment_targets(
  p_assignment_id uuid,
  p_student_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare

  v_primary_class_id uuid;

  v_invalid_count integer := 0;

  v_target_count integer := 0;

begin


  -- =======================================================
  -- Targeted delivery is Primary-Class only in v1.
  --
  -- Class-wide assignments may be Cross-posted.
  -- Individual targeting must remain inside assignments.class_id.
  -- =======================================================

  select
    a.class_id

  into
    v_primary_class_id

  from public.assignments a

  where
    a.id =
      p_assignment_id;


  if v_primary_class_id is null then

    raise exception
      'Assignment not found';

  end if;


  -- Only a teacher of the Primary Class may configure
  -- individual student targets.

  if not public.is_teacher_of_class(
    v_primary_class_id
  ) then

    raise exception
      'Primary-class teacher access required.'
      using errcode = '42501';

  end if;


  -- Count distinct non-null requested targets.

  select
    count(*)::integer

  into
    v_target_count

  from (

    select distinct
      x.student_id

    from unnest(
      coalesce(
        p_student_ids,
        '{}'::uuid[]
      )
    ) as x(student_id)

    where
      x.student_id is not null

  ) requested;


  -- Every targeted student must belong to the Primary Class.

  select
    count(*)::integer

  into
    v_invalid_count

  from (

    select distinct
      x.student_id

    from unnest(
      coalesce(
        p_student_ids,
        '{}'::uuid[]
      )
    ) as x(student_id)

    where
      x.student_id is not null

  ) requested

  left join public.class_members cm
    on cm.class_id =
      v_primary_class_id

   and cm.student_id =
      requested.student_id

  where
    cm.student_id is null;


  if v_invalid_count > 0 then

    raise exception
      'Targeted students must belong to the Primary Class.'
      using errcode = '42501';

  end if;


  -- Replace target list.

  delete from public.assignment_targets

  where
    assignment_id =
      p_assignment_id;


  insert into public.assignment_targets (
    assignment_id,
    student_id
  )

  select distinct
    p_assignment_id,
    x.student_id

  from unnest(
    coalesce(
      p_student_ids,
      '{}'::uuid[]
    )
  ) as x(student_id)

  where
    x.student_id is not null;


  if v_target_count > 0 then

    -- -----------------------------------------------------
    -- Targeted v1:
    -- collapse distribution back to Primary Class only.
    -- -----------------------------------------------------

    delete from public.assignment_classes

    where
      assignment_id =
        p_assignment_id

      and

      class_id <>
        v_primary_class_id;


    insert into public.assignment_classes (
      assignment_id,
      class_id
    )

    values (
      p_assignment_id,
      v_primary_class_id
    )

    on conflict do nothing;


    update public.assignments

    set
      audience_type =
        'targeted'

    where
      id =
        p_assignment_id;


  else

    -- -----------------------------------------------------
    -- No targets:
    -- assignment returns to class-wide delivery.
    --
    -- IMPORTANT:
    -- Existing Cross-post class links are preserved.
    -- -----------------------------------------------------

    update public.assignments

    set
      audience_type =
        'class'

    where
      id =
        p_assignment_id;

  end if;


end;
$$;

-- =========================================================
-- 12. PROGRESS TRIGGER
-- Store the class the student actually belongs to.
-- This is essential for cross-posted assignments.
-- =========================================================

create or replace function public.update_student_assignment_progress_from_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_id uuid;
begin

  select
    ac.class_id
  into
    v_class_id
  from public.assignment_classes ac
  join public.class_members cm
    on cm.class_id = ac.class_id
   and cm.student_id = new.student_id
  join public.assignments a
    on a.id = ac.assignment_id
  where
    ac.assignment_id = new.assignment_id
  order by
    case
      when ac.class_id = a.class_id
        then 0
      else 1
    end,
    ac.class_id
  limit 1;


  if v_class_id is null then

    select
      a.class_id
    into
      v_class_id
    from public.assignments a
    where
      a.id = new.assignment_id;
  end if;


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
    coalesce(
      new.submitted_at,
      now()
    ),
    coalesce(
      new.submitted_at,
      now()
    ),
    now(),
    now()

  )

  on conflict (
    assignment_id,
    student_id
  )

  do update set

    class_id =
      excluded.class_id,

    total_attempts =
      public.student_assignment_progress.total_attempts
      + 1,

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


-- =========================================================
-- 13. TEACHER ASSIGNMENT RANKINGS
-- Rankings remain class-specific even when an assignment is
-- cross-posted.
-- =========================================================

create or replace function public.get_teacher_assignment_reading_rankings(
  p_class_id uuid
)
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

  if not public.is_teacher_of_class(
    p_class_id
  ) then

    raise exception
      'Teacher access required.'
      using errcode = '42501';
  end if;


  return query

  with eligible as (

    select

      a.id as assignment_id,

      cm.student_id

    from public.assignment_classes ac

    join public.assignments a
      on a.id = ac.assignment_id

    join public.class_members cm
      on cm.class_id = ac.class_id

    where
      ac.class_id = p_class_id
      and a.is_published = true
      and a.release_at <= now()
      and
      (
        a.audience_type = 'class'

        or

        exists (

          select 1
          from public.assignment_targets at

          where
            at.assignment_id = a.id
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

      coalesce(
        p.total_attempts,
        0
      )::bigint
        as total_attempts

    from eligible e

    left join public.student_assignment_progress p
      on p.assignment_id = e.assignment_id
     and p.student_id = e.student_id
  ),

  ranked as (

    select

      m.*,

      case
        when m.best_accuracy is null
          then null

        else rank() over (
          partition by m.assignment_id
          order by
            m.best_accuracy desc nulls last
        )
      end
        as accuracy_rank,

      case
        when m.best_wpm is null
          then null

        else rank() over (
          partition by m.assignment_id
          order by
            m.best_wpm desc nulls last
        )
      end
        as wpm_rank,

      case
        when m.total_attempts <= 0
          then null

        else rank() over (
          partition by m.assignment_id
          order by
            m.total_attempts desc
        )
      end
        as practice_rank,

      count(*) over (
        partition by m.assignment_id
      )::bigint
        as total_students

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


-- =========================================================
-- 14. STUDENT ASSIGNMENT RANKINGS
-- =========================================================

create or replace function public.get_my_assignment_reading_rankings(
  p_class_id uuid
)
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

  if not public.is_student_in_class(
    p_class_id
  ) then

    raise exception
      'Student access required.'
      using errcode = '42501';
  end if;


  return query

  with eligible as (

    select

      a.id as assignment_id,

      cm.student_id

    from public.assignment_classes ac

    join public.assignments a
      on a.id = ac.assignment_id

    join public.class_members cm
      on cm.class_id = ac.class_id

    where
      ac.class_id = p_class_id
      and a.is_published = true
      and a.release_at <= now()
      and
      (
        a.audience_type = 'class'

        or

        exists (

          select 1
          from public.assignment_targets at

          where
            at.assignment_id = a.id
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

      coalesce(
        p.total_attempts,
        0
      )::bigint
        as total_attempts

    from eligible e

    left join public.student_assignment_progress p
      on p.assignment_id = e.assignment_id
     and p.student_id = e.student_id
  ),

  ranked as (

    select

      m.*,

      case
        when m.best_accuracy is null
          then null

        else rank() over (
          partition by m.assignment_id
          order by
            m.best_accuracy desc nulls last
        )
      end
        as accuracy_rank,

      case
        when m.best_wpm is null
          then null

        else rank() over (
          partition by m.assignment_id
          order by
            m.best_wpm desc nulls last
        )
      end
        as wpm_rank,

      case
        when m.total_attempts <= 0
          then null

        else rank() over (
          partition by m.assignment_id
          order by
            m.total_attempts desc
        )
      end
        as practice_rank,

      count(*) over (
        partition by m.assignment_id
      )::bigint
        as total_students

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

  where
    r.student_id = auth.uid()

  order by
    r.assignment_id;

end;
$$;


-- =========================================================
-- 15. MANUAL SCORE SUPPORT FOR CROSS-POSTED CLASSES
-- =========================================================

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

  select
    ac.class_id
  into
    v_class_id

  from public.assignment_classes ac

  join public.class_members cm
    on cm.class_id = ac.class_id
   and cm.student_id = p_student_id

  where
    ac.assignment_id = p_assignment_id
    and public.is_teacher_of_class(
      ac.class_id
    )

  limit 1;


  if v_class_id is null then

    raise exception
      'Teacher access or class membership required.'
      using errcode = '42501';
  end if;


  if p_score is null then

    delete from public.manual_scores

    where
      assignment_id = p_assignment_id
      and student_id = p_student_id;

    return;
  end if;


  if
    p_score < 0
    or p_score > 100
  then

    raise exception
      'Score must be between 0 and 100.';
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

    score =
      excluded.score,

    updated_by =
      auth.uid(),

    updated_at =
      now();

end;
$$;


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

  select
    ac.class_id
  into
    v_class_id

  from public.assignment_classes ac

  join public.class_members cm
    on cm.class_id = ac.class_id
   and cm.student_id = p_student_id

  where
    ac.assignment_id = p_assignment_id
    and public.is_teacher_of_class(
      ac.class_id
    )

  limit 1;


  if v_class_id is null then

    raise exception
      'Teacher access or class membership required.'
      using errcode = '42501';
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
      and
      (
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


  delete from public.manual_scores

  where
    assignment_id = p_assignment_id
    and student_id = p_student_id
    and score is null
    and wpm is null
    and comprehension is null;

end;
$$;

-- =========================================================
-- COPEAK CROSS POSTING HARDENING v1
-- =========================================================


-- =========================================================
-- 16. PRACTICE POLICY CONSISTENCY
-- Paced requires a target WPM.
-- Vanish requires a level.
-- Shadowing requires an uploaded audio source.
-- =========================================================

alter table public.assignments
  add constraint assignments_paced_policy_valid
  check (
    (
      practice_mode = 'paced'
      and paced_target_wpm is not null
    )
    or
    (
      practice_mode <> 'paced'
      and paced_target_wpm is null
    )
  );


alter table public.assignments
  add constraint assignments_vanish_policy_valid
  check (
    (
      practice_mode = 'vanish'
      and vanish_level is not null
    )
    or
    (
      practice_mode <> 'vanish'
      and vanish_level is null
    )
  );


alter table public.assignments
  add constraint assignments_shadowing_audio_valid
  check (
    practice_mode <> 'shadowing'
    or audio_object_key is not null
    or audio_url is not null
  );


-- =========================================================
-- 17. CROSS-POSTING MUST USE RPC
-- Direct writes to assignment_classes are not needed.
-- =========================================================

drop policy if exists
  "teacher inserts assignment classes"
on public.assignment_classes;


drop policy if exists
  "teacher deletes assignment classes"
on public.assignment_classes;


revoke insert, update, delete
on public.assignment_classes
from anon, authenticated;


grant select
on public.assignment_classes
to authenticated;


-- =========================================================
-- 18. SET ASSIGNMENT CLASSES
-- The legacy assignments.class_id is always retained as
-- the primary class.
-- =========================================================

create or replace function public.set_assignment_classes(
  p_assignment_id uuid,
  p_class_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_primary_class_id uuid;
  v_invalid_count integer;
begin

  select
    a.class_id
  into
    v_primary_class_id
  from public.assignments a
  where
    a.id = p_assignment_id;


  if v_primary_class_id is null then
    raise exception
      'Assignment not found';
  end if;


  if not public.is_teacher_of_class(
    v_primary_class_id
  ) then

    raise exception
      'Teacher access required.'
      using errcode = '42501';
  end if;


  select
    count(*)
  into
    v_invalid_count
  from (

    select distinct
      x.class_id

    from unnest(
      coalesce(
        p_class_ids,
        '{}'::uuid[]
      )
    ) as x(class_id)

    where
      x.class_id is not null

      and
      x.class_id <>
        v_primary_class_id

  ) requested

  left join public.classes c
    on c.id =
      requested.class_id

  where
    c.id is null
    or not public.is_teacher_of_class(
      requested.class_id
    );


  if v_invalid_count > 0 then

    raise exception
      'One or more selected classes are not available to this teacher.'
      using errcode = '42501';
  end if;


  delete from public.assignment_classes
  where
    assignment_id =
      p_assignment_id;


  insert into public.assignment_classes (
    assignment_id,
    class_id
  )

  values (
    p_assignment_id,
    v_primary_class_id
  );


  insert into public.assignment_classes (
    assignment_id,
    class_id
  )

  select distinct
    p_assignment_id,
    x.class_id

  from unnest(
    coalesce(
      p_class_ids,
      '{}'::uuid[]
    )
  ) as x(class_id)

  where
    x.class_id is not null
    and
    x.class_id <>
      v_primary_class_id

  on conflict do nothing;

end;
$$;


revoke all
on function public.set_assignment_classes(
  uuid,
  uuid[]
)
from public;


grant execute
on function public.set_assignment_classes(
  uuid,
  uuid[]
)
to authenticated;


-- =========================================================
-- 19. PRACTICE-MODE-AWARE SUBMISSION VALIDATION
--
-- practice_mode = free:
--   Any Copeak mode is accepted.
--
-- practice_mode != free:
--   The actual Copeak mode must match.
--
-- Paced:
--   The pace setting must also match.
--
-- Vanish:
--   The vanish level must also match.
--
-- Accuracy / actual WPM pass criteria remain separate.
-- =========================================================

create or replace function public.can_submit_assignment_result(
  p_assignment_id uuid,
  p_practice_mode text,
  p_paced_target_wpm integer,
  p_vanish_level integer
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$

  select exists (

    select 1

    from public.assignments a

    where
      a.id =
        p_assignment_id

      and
      a.is_published = true

      and
      a.release_at <= now()

      and
      now() < a.due_at

      and
      public.is_student_member_of_assignment_class(
        a.id,
        auth.uid()
      )

      and
      (
        a.audience_type = 'class'

        or

        exists (

          select 1

          from public.assignment_targets at

          where
            at.assignment_id = a.id
            and
            at.student_id = auth.uid()
        )
      )

      and
      (
        a.practice_mode = 'free'

        or

        (
          p_practice_mode =
            a.practice_mode

          and
          (
            a.practice_mode <> 'paced'

            or

            p_paced_target_wpm =
              a.paced_target_wpm
          )

          and
          (
            a.practice_mode <> 'vanish'

            or

            p_vanish_level =
              a.vanish_level
          )
        )
      )
  );

$$;


revoke all
on function public.can_submit_assignment_result(
  uuid,
  text,
  integer,
  integer
)
from public;


grant execute
on function public.can_submit_assignment_result(
  uuid,
  text,
  integer,
  integer
)
to authenticated;


-- =========================================================
-- 20. SUBMISSION RLS
-- DB itself now rejects a result produced in the wrong mode.
-- Existing free assignments remain backward compatible.
-- =========================================================

drop policy if exists
  "student inserts own submission"
on public.submissions;


create policy "student inserts own submission"
on public.submissions
for insert
to authenticated
with check (

  student_id =
    auth.uid()

  and

  public.can_submit_assignment_result(

    assignment_id,
    practice_mode,
    paced_target_wpm,
    vanish_level

  )
);


-- =========================================================
-- 21. FINAL CROSS-POST CLASS-BOUNDARY HARDENING
--
-- Teacher visibility is CLASS based:
--
-- Main teacher:
--   If the teacher teaches Classes 1-9,
--   the teacher can see Classes 1-9.
--
-- Sub teacher:
--   If the teacher teaches Classes 6-9,
--   the teacher can see only Classes 6-9.
--
-- Being a teacher of ANY class attached to an assignment
-- must NOT grant access to students in every attached class.
-- =========================================================


-- =========================================================
-- 21-A. ASSIGNMENT_CLASSES SELECT
--
-- Teachers may see only bridge rows for classes
-- they actually teach.
--
-- Students may see only bridge rows for classes
-- they belong to.
-- =========================================================

drop policy if exists
  "assignment class participant read"
on public.assignment_classes;


create policy "assignment class participant read"
on public.assignment_classes
for select
to authenticated
using (

  public.is_teacher_of_class(
    class_id
  )

  or

  public.is_student_in_class(
    class_id
  )

);


-- =========================================================
-- 21-B. TEACHER ACCESS TO ONE STUDENT'S RESULT
--
-- The teacher must teach at least one class that:
--
--   1. is attached to this assignment
--   2. contains this student
--
-- This prevents a teacher of Class 6 from reading
-- a Class 1 student's result merely because the same
-- assignment was cross-posted to both classes.
-- =========================================================

create or replace function
public.can_read_assignment_student(
  p_assignment_id uuid,
  p_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$

  select exists (

    select 1

    from public.assignment_classes ac

    join public.class_members cm
      on cm.class_id =
        ac.class_id
     and cm.student_id =
        p_student_id

    where
      ac.assignment_id =
        p_assignment_id

      and

      public.is_teacher_of_class(
        ac.class_id
      )

  )

  or

  -- Legacy safety fallback.
  -- Existing assignments.class_id remains the
  -- primary class and is backfilled into
  -- assignment_classes by this migration.
  exists (

    select 1

    from public.assignments a

    join public.class_members cm
      on cm.class_id =
        a.class_id
     and cm.student_id =
        p_student_id

    where
      a.id =
        p_assignment_id

      and

      public.is_teacher_of_class(
        a.class_id
      )

  );

$$;


revoke all
on function public.can_read_assignment_student(
  uuid,
  uuid
)
from public;


grant execute
on function public.can_read_assignment_student(
  uuid,
  uuid
)
to authenticated;


-- =========================================================
-- 21-C. SUBMISSION CLASS BOUNDARY
--
-- RESTRICTIVE means this rule is AND-ed with the existing
-- SELECT permissions.
--
-- Therefore:
--
-- Student:
--   may read own submission
--
-- Teacher:
--   may read a student's submission only when teacher and
--   student share a class attached to this assignment.
--
-- An existing broad assignment-level policy can no longer
-- expose submissions from another teacher's classes.
-- =========================================================

drop policy if exists
  "submission class boundary"
on public.submissions;


create policy "submission class boundary"
on public.submissions
as restrictive
for select
to authenticated
using (

  student_id =
    auth.uid()

  or

  public.can_read_assignment_student(
    assignment_id,
    student_id
  )

);


-- =========================================================
-- END FINAL CROSS-POST CLASS-BOUNDARY HARDENING
-- =========================================================


-- =========================================================
-- 22. FINAL MANUAL SCORE CLASS-BOUNDARY HARDENING
--
-- Manual-score READ access follows the same
-- assignment + student + teacher-class rule as submissions.
--
-- Main teacher:
--   sees students in every class they teach.
--
-- Sub teacher:
--   sees only students in classes they teach.
--
-- Student:
--   existing own-score policy remains unchanged.
-- =========================================================

drop policy if exists
  "teachers read manual scores"
on public.manual_scores;


create policy "teachers read manual scores"
on public.manual_scores
for select
to authenticated
using (

  public.can_read_assignment_student(
    assignment_id,
    student_id
  )

);


-- =========================================================
-- END FINAL MANUAL SCORE CLASS-BOUNDARY HARDENING
-- =========================================================


-- =========================================================
-- 23. CROSS-POST ROSTER RELINK HARDENING
--
-- When a roster seat is linked to a new student account,
-- move class-owned learning data from the old account.
--
-- IMPORTANT:
-- Assignment ownership is determined through
-- assignment_classes, NOT only assignments.class_id.
--
-- This allows a secondary Cross-post class to retain:
--   submissions
--   progress
--   assignment targets
--   manual scores
-- =========================================================

create or replace function public.join_class_with_roster(
  p_code text,
  p_student_number text,
  p_pin text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare

  v_class public.classes%rowtype;

  v_roster public.class_roster%rowtype;

  v_role text;

  v_old_student_id uuid;

begin


  select role
  into v_role
  from public.profiles
  where id = auth.uid();


  if v_role is distinct from 'student' then

    raise exception
      'Only students can join a class.';

  end if;


  select *
  into v_class
  from public.classes
  where class_code =
    upper(
      trim(p_code)
    );


  if v_class.id is null then

    raise exception
      'Class code not found.';

  end if;


  select *
  into v_roster
  from public.class_roster
  where
    class_id = v_class.id

    and student_number =
      trim(p_student_number)

    and join_pin =
      trim(p_pin)
  for update;


  if v_roster.id is null then

    raise exception
      'Student number or Join PIN is incorrect.';

  end if;


  v_old_student_id =
    v_roster.linked_student_id;


  -- =======================================================
  -- Existing roster seat is being linked to a new account.
  -- Transfer this CLASS'S learning data.
  -- =======================================================

  if
    v_old_student_id is not null

    and

    v_old_student_id <> auth.uid()
  then


    -- -----------------------------------------------------
    -- Submissions
    --
    -- Cross-post aware:
    -- assignment must be attached to this class.
    -- -----------------------------------------------------

    update public.submissions s

    set student_id =
      auth.uid()

    where
      s.student_id =
        v_old_student_id

      and

      exists (

        select 1

        from public.assignment_classes ac

        where
          ac.assignment_id =
            s.assignment_id

          and

          ac.class_id =
            v_class.id

      );


    -- -----------------------------------------------------
    -- Aggregate progress
    --
    -- Progress already has its own class_id.
    -- Merge if the destination account already has progress.
    -- -----------------------------------------------------

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

      p.assignment_id,

      auth.uid(),

      p.class_id,

      p.total_attempts,

      p.best_accuracy,

      p.best_wpm,

      p.best_comprehension,

      p.first_attempt_at,

      p.last_attempt_at,

      p.created_at,

      now()

    from public.student_assignment_progress p

    where
      p.class_id =
        v_class.id

      and

      p.student_id =
        v_old_student_id

    on conflict (
      assignment_id,
      student_id
    )

    do update set

      class_id =
        excluded.class_id,

      total_attempts =
        public.student_assignment_progress.total_attempts
        +
        excluded.total_attempts,

      best_accuracy =
        case

          when
            public.student_assignment_progress.best_accuracy
            is null
          then
            excluded.best_accuracy

          when
            excluded.best_accuracy
            is null
          then
            public.student_assignment_progress.best_accuracy

          else
            greatest(
              public.student_assignment_progress.best_accuracy,
              excluded.best_accuracy
            )

        end,

      best_wpm =
        case

          when
            public.student_assignment_progress.best_wpm
            is null
          then
            excluded.best_wpm

          when
            excluded.best_wpm
            is null
          then
            public.student_assignment_progress.best_wpm

          else
            greatest(
              public.student_assignment_progress.best_wpm,
              excluded.best_wpm
            )

        end,

      best_comprehension =
        case

          when
            public.student_assignment_progress.best_comprehension
            is null
          then
            excluded.best_comprehension

          when
            excluded.best_comprehension
            is null
          then
            public.student_assignment_progress.best_comprehension

          else
            greatest(
              public.student_assignment_progress.best_comprehension,
              excluded.best_comprehension
            )

        end,

      first_attempt_at =
        case

          when
            public.student_assignment_progress.first_attempt_at
            is null
          then
            excluded.first_attempt_at

          when
            excluded.first_attempt_at
            is null
          then
            public.student_assignment_progress.first_attempt_at

          else
            least(
              public.student_assignment_progress.first_attempt_at,
              excluded.first_attempt_at
            )

        end,

      last_attempt_at =
        case

          when
            public.student_assignment_progress.last_attempt_at
            is null
          then
            excluded.last_attempt_at

          when
            excluded.last_attempt_at
            is null
          then
            public.student_assignment_progress.last_attempt_at

          else
            greatest(
              public.student_assignment_progress.last_attempt_at,
              excluded.last_attempt_at
            )

        end,

      updated_at =
        now();


    delete from public.student_assignment_progress

    where
      class_id =
        v_class.id

      and

      student_id =
        v_old_student_id;


    -- -----------------------------------------------------
    -- Individual assignment targets
    --
    -- v1 targeted assignments normally remain Primary Class
    -- only, but using assignment_classes here is future-safe.
    -- -----------------------------------------------------

    insert into public.assignment_targets (

      assignment_id,
      student_id,
      created_at

    )

    select

      t.assignment_id,

      auth.uid(),

      t.created_at

    from public.assignment_targets t

    where
      t.student_id =
        v_old_student_id

      and

      exists (

        select 1

        from public.assignment_classes ac

        where
          ac.assignment_id =
            t.assignment_id

          and

          ac.class_id =
            v_class.id

      )

    on conflict (
      assignment_id,
      student_id
    )

    do nothing;


    delete from public.assignment_targets t

    where
      t.student_id =
        v_old_student_id

      and

      exists (

        select 1

        from public.assignment_classes ac

        where
          ac.assignment_id =
            t.assignment_id

          and

          ac.class_id =
            v_class.id

      );


    -- -----------------------------------------------------
    -- Manual scores
    -- -----------------------------------------------------

    insert into public.manual_scores (

      assignment_id,
      student_id,
      score,
      updated_by,
      created_at,
      updated_at,
      wpm,
      comprehension

    )

    select

      m.assignment_id,

      auth.uid(),

      m.score,

      m.updated_by,

      m.created_at,

      m.updated_at,

      m.wpm,

      m.comprehension

    from public.manual_scores m

    where
      m.student_id =
        v_old_student_id

      and

      exists (

        select 1

        from public.assignment_classes ac

        where
          ac.assignment_id =
            m.assignment_id

          and

          ac.class_id =
            v_class.id

      )

    on conflict (
      assignment_id,
      student_id
    )

    do update set

      score =
        case

          when
            excluded.updated_at
            >=
            public.manual_scores.updated_at
          then
            excluded.score

          else
            public.manual_scores.score

        end,

      wpm =
        case

          when
            excluded.updated_at
            >=
            public.manual_scores.updated_at
          then
            excluded.wpm

          else
            public.manual_scores.wpm

        end,

      comprehension =
        case

          when
            excluded.updated_at
            >=
            public.manual_scores.updated_at
          then
            excluded.comprehension

          else
            public.manual_scores.comprehension

        end,

      updated_by =
        case

          when
            excluded.updated_at
            >=
            public.manual_scores.updated_at
          then
            excluded.updated_by

          else
            public.manual_scores.updated_by

        end,

      created_at =
        least(
          public.manual_scores.created_at,
          excluded.created_at
        ),

      updated_at =
        greatest(
          public.manual_scores.updated_at,
          excluded.updated_at
        );


    delete from public.manual_scores m

    where
      m.student_id =
        v_old_student_id

      and

      exists (

        select 1

        from public.assignment_classes ac

        where
          ac.assignment_id =
            m.assignment_id

          and

          ac.class_id =
            v_class.id

      );


    -- -----------------------------------------------------
    -- Remove only the OLD account's membership
    -- in this class.
    -- -----------------------------------------------------

    delete from public.class_members

    where
      class_id =
        v_class.id

      and

      student_id =
        v_old_student_id;


  end if;


  -- =======================================================
  -- Attach current account to this class.
  -- =======================================================

  insert into public.class_members (
    class_id,
    student_id
  )

  values (
    v_class.id,
    auth.uid()
  )

  on conflict do nothing;


  update public.class_roster

  set linked_student_id =
    auth.uid()

  where id =
    v_roster.id;


  update public.profiles

  set
    school_id =
      v_class.school_id,

    display_name =
      v_roster.display_name

  where id =
    auth.uid();


  return v_class.id;


end;
$$;


revoke all
on function public.join_class_with_roster(
  text,
  text,
  text
)
from public;


grant execute
on function public.join_class_with_roster(
  text,
  text,
  text
)
to authenticated;


-- =========================================================
-- END CROSS-POST ROSTER RELINK HARDENING
-- =========================================================


-- =========================================================
-- 24. CROSS-POST ROSTER DELETE HARDENING
--
-- Roster deletion must use assignment_classes rather than
-- only assignments.class_id.
--
-- If a student still belongs to another class receiving
-- the SAME shared assignment, assignment-level data is kept.
--
-- Class-specific progress is removed only for the class
-- being removed.
-- =========================================================


-- =========================================================
-- 24-A. DELETE ONE ROSTER STUDENT
-- =========================================================

create or replace function public.teacher_delete_roster_student(
  p_roster_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare

  v_class_id uuid;

  v_student_id uuid;

  v_submission_count integer := 0;

begin


  select
    class_id,
    linked_student_id

  into
    v_class_id,
    v_student_id

  from public.class_roster

  where id =
    p_roster_id

  for update;


  if v_class_id is null then

    raise exception
      'Roster student not found.';

  end if;


  if not public.is_teacher_of_class(
    v_class_id
  ) then

    raise exception
      'You do not have permission to manage this class.';

  end if;


  if v_student_id is not null then


    -- -----------------------------------------------------
    -- Submissions
    --
    -- Delete only when:
    --   assignment is attached to this class
    --   AND student has no other receiving-class membership
    --   for the same assignment.
    -- -----------------------------------------------------

    delete from public.submissions s

    where
      s.student_id =
        v_student_id

      and

      exists (

        select 1

        from public.assignment_classes ac

        where
          ac.assignment_id =
            s.assignment_id

          and

          ac.class_id =
            v_class_id

      )

      and

      not exists (

        select 1

        from public.assignment_classes ac_other

        join public.class_members cm_other
          on cm_other.class_id =
            ac_other.class_id

         and cm_other.student_id =
            v_student_id

        where
          ac_other.assignment_id =
            s.assignment_id

          and

          ac_other.class_id <>
            v_class_id

      );


    get diagnostics
      v_submission_count =
        row_count;


    -- -----------------------------------------------------
    -- Class-specific aggregate progress
    -- -----------------------------------------------------

    update public.student_assignment_progress p

    set

      class_id = (

        select
          ac_other.class_id

        from public.assignment_classes ac_other

        join public.class_members cm_other
          on cm_other.class_id =
            ac_other.class_id

         and cm_other.student_id =
            p.student_id

        join public.assignments a
          on a.id =
            p.assignment_id

        where
          ac_other.assignment_id =
            p.assignment_id

          and

          ac_other.class_id <>
            v_class_id

        order by

          case
            when ac_other.class_id = a.class_id
              then 0
            else 1
          end,

          ac_other.class_id

        limit 1

      ),

      updated_at =
        now()

    where
      p.class_id =
        v_class_id

      and

      p.student_id =
        v_student_id

      and

      exists (

        select 1

        from public.assignment_classes ac_other

        join public.class_members cm_other
          on cm_other.class_id =
            ac_other.class_id

         and cm_other.student_id =
            p.student_id

        where
          ac_other.assignment_id =
            p.assignment_id

          and

          ac_other.class_id <>
            v_class_id

      );


    -- No remaining receiving class:
    -- remove the aggregate row.

    delete from public.student_assignment_progress p

    where
      p.class_id =
        v_class_id

      and

      p.student_id =
        v_student_id;


    -- -----------------------------------------------------
    -- Individual assignment targets
    --
    -- Preserve target when student still belongs to another
    -- receiving class for that same assignment.
    -- -----------------------------------------------------

    delete from public.assignment_targets t

    where
      t.student_id =
        v_student_id

      and

      exists (

        select 1

        from public.assignment_classes ac

        where
          ac.assignment_id =
            t.assignment_id

          and

          ac.class_id =
            v_class_id

      )

      and

      not exists (

        select 1

        from public.assignment_classes ac_other

        join public.class_members cm_other
          on cm_other.class_id =
            ac_other.class_id

         and cm_other.student_id =
            v_student_id

        where
          ac_other.assignment_id =
            t.assignment_id

          and

          ac_other.class_id <>
            v_class_id

      );


    -- -----------------------------------------------------
    -- Manual scores
    --
    -- Same assignment-level preservation rule.
    -- -----------------------------------------------------

    delete from public.manual_scores m

    where
      m.student_id =
        v_student_id

      and

      exists (

        select 1

        from public.assignment_classes ac

        where
          ac.assignment_id =
            m.assignment_id

          and

          ac.class_id =
            v_class_id

      )

      and

      not exists (

        select 1

        from public.assignment_classes ac_other

        join public.class_members cm_other
          on cm_other.class_id =
            ac_other.class_id

         and cm_other.student_id =
            v_student_id

        where
          ac_other.assignment_id =
            m.assignment_id

          and

          ac_other.class_id <>
            v_class_id

      );


    -- -----------------------------------------------------
    -- Remove membership only from this class.
    -- -----------------------------------------------------

    delete from public.class_members

    where
      class_id =
        v_class_id

      and

      student_id =
        v_student_id;


  end if;


  delete from public.class_roster

  where id =
    p_roster_id;


  return
    v_submission_count;


end;
$$;


revoke all
on function public.teacher_delete_roster_student(
  uuid
)
from public;


grant execute
on function public.teacher_delete_roster_student(
  uuid
)
to authenticated;



-- =========================================================
-- 24-B. CLEAR WHOLE CLASS ROSTER
-- =========================================================

create or replace function public.teacher_clear_class_roster(
  p_class_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare

  v_roster_count integer := 0;

  v_joined_count integer := 0;

  v_submission_count integer := 0;

  v_member_count integer := 0;

begin


  -- -----------------------------------------------------
  -- Permission
  -- -----------------------------------------------------

  if not public.is_teacher_of_class(
    p_class_id
  ) then

    raise exception
      'You do not have permission to manage this class.';

  end if;


  -- -----------------------------------------------------
  -- Counts before deletion
  -- -----------------------------------------------------

  select

    count(*)::integer,

    count(*) filter (
      where linked_student_id is not null
    )::integer

  into
    v_roster_count,
    v_joined_count

  from public.class_roster

  where
    class_id =
      p_class_id;


  -- -----------------------------------------------------
  -- Submissions
  --
  -- Delete assignment-level result only when the student
  -- does NOT remain in another class receiving that same
  -- shared assignment.
  -- -----------------------------------------------------

  delete from public.submissions s

  where

    s.student_id in (

      select
        linked_student_id

      from public.class_roster

      where
        class_id =
          p_class_id

        and

        linked_student_id
          is not null

    )

    and

    exists (

      select 1

      from public.assignment_classes ac

      where
        ac.assignment_id =
          s.assignment_id

        and

        ac.class_id =
          p_class_id

    )

    and

    not exists (

      select 1

      from public.assignment_classes ac_other

      join public.class_members cm_other
        on cm_other.class_id =
          ac_other.class_id

       and cm_other.student_id =
          s.student_id

      where
        ac_other.assignment_id =
          s.assignment_id

        and

        ac_other.class_id <>
          p_class_id

    );


  get diagnostics
    v_submission_count =
      row_count;


  -- -----------------------------------------------------
  -- Aggregate progress belongs explicitly to a class.
  -- -----------------------------------------------------

  update public.student_assignment_progress p

  set

    class_id = (

      select
        ac_other.class_id

      from public.assignment_classes ac_other

      join public.class_members cm_other
        on cm_other.class_id =
          ac_other.class_id

       and cm_other.student_id =
          p.student_id

      join public.assignments a
        on a.id =
          p.assignment_id

      where
        ac_other.assignment_id =
          p.assignment_id

        and

        ac_other.class_id <>
          p_class_id

      order by

        case
          when ac_other.class_id = a.class_id
            then 0
          else 1
        end,

        ac_other.class_id

      limit 1

    ),

    updated_at =
      now()

  where
    p.class_id =
      p_class_id

    and

    p.student_id in (

      select
        linked_student_id

      from public.class_roster

      where
        class_id =
          p_class_id

        and

        linked_student_id
          is not null

    )

    and

    exists (

      select 1

      from public.assignment_classes ac_other

      join public.class_members cm_other
        on cm_other.class_id =
          ac_other.class_id

       and cm_other.student_id =
          p.student_id

      where
        ac_other.assignment_id =
          p.assignment_id

        and

        ac_other.class_id <>
          p_class_id

    );


  -- Rows that still point to this class have no other
  -- receiving-class membership and can be removed.

  delete from public.student_assignment_progress p

  where
    p.class_id =
      p_class_id

    and

    p.student_id in (

      select
        linked_student_id

      from public.class_roster

      where
        class_id =
          p_class_id

        and

        linked_student_id
          is not null

    );


  -- -----------------------------------------------------
  -- Individual targets
  -- -----------------------------------------------------

  delete from public.assignment_targets t

  where

    t.student_id in (

      select
        linked_student_id

      from public.class_roster

      where
        class_id =
          p_class_id

        and

        linked_student_id
          is not null

    )

    and

    exists (

      select 1

      from public.assignment_classes ac

      where
        ac.assignment_id =
          t.assignment_id

        and

        ac.class_id =
          p_class_id

    )

    and

    not exists (

      select 1

      from public.assignment_classes ac_other

      join public.class_members cm_other
        on cm_other.class_id =
          ac_other.class_id

       and cm_other.student_id =
          t.student_id

      where
        ac_other.assignment_id =
          t.assignment_id

        and

        ac_other.class_id <>
          p_class_id

    );


  -- -----------------------------------------------------
  -- Manual scores
  -- -----------------------------------------------------

  delete from public.manual_scores m

  where

    m.student_id in (

      select
        linked_student_id

      from public.class_roster

      where
        class_id =
          p_class_id

        and

        linked_student_id
          is not null

    )

    and

    exists (

      select 1

      from public.assignment_classes ac

      where
        ac.assignment_id =
          m.assignment_id

        and

        ac.class_id =
          p_class_id

    )

    and

    not exists (

      select 1

      from public.assignment_classes ac_other

      join public.class_members cm_other
        on cm_other.class_id =
          ac_other.class_id

       and cm_other.student_id =
          m.student_id

      where
        ac_other.assignment_id =
          m.assignment_id

        and

        ac_other.class_id <>
          p_class_id

    );


  -- -----------------------------------------------------
  -- Remove class membership
  -- -----------------------------------------------------

  delete from public.class_members

  where

    class_id =
      p_class_id

    and

    student_id in (

      select
        linked_student_id

      from public.class_roster

      where
        class_id =
          p_class_id

        and

        linked_student_id
          is not null

    );


  get diagnostics
    v_member_count =
      row_count;


  -- -----------------------------------------------------
  -- Finally clear roster
  -- -----------------------------------------------------

  delete from public.class_roster

  where
    class_id =
      p_class_id;


  return jsonb_build_object(

    'roster_count',
      v_roster_count,

    'joined_count',
      v_joined_count,

    'submission_count',
      v_submission_count,

    'member_count',
      v_member_count

  );


end;
$$;


revoke all
on function public.teacher_clear_class_roster(
  uuid
)
from public;


grant execute
on function public.teacher_clear_class_roster(
  uuid
)
to authenticated;


-- =========================================================
-- END CROSS-POST ROSTER DELETE HARDENING
-- =========================================================
