-- Copeak Classroom: preserve historical PASS on verified roster relink.
-- Exact production join_class_with_roster function as of 2026-11-18,
-- adding only a bounded insert of assignment_preserved_passes.
-- This is not a Vercel deployment or a released database migration.

CREATE OR REPLACE FUNCTION public.join_class_with_roster(p_code text, p_student_number text, p_pin text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    -- Preserve historical PASS when a verified roster seat is re-linked.
    -- Copy only PASS records for assignments linked to this class.
    -- Retain the old account's snapshot for other cross-posted classes.
    INSERT INTO public.assignment_preserved_passes (
      assignment_id, student_id, rule, preserved_at
    )
    SELECT p.assignment_id, auth.uid(), p.rule, p.preserved_at
    FROM public.assignment_preserved_passes p
    WHERE p.student_id = v_old_student_id
      AND EXISTS (
        SELECT 1 FROM public.assignment_classes ac
        WHERE ac.assignment_id = p.assignment_id
          AND ac.class_id = v_class.id
      )
    ON CONFLICT (assignment_id, student_id) DO NOTHING;

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
$function$;
