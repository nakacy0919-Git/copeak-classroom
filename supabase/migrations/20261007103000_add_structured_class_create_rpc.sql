-- =========================================================
-- Copeak Classroom
-- Structured Class Creation RPC
-- =========================================================

create or replace function public.create_teacher_class_structured(
  p_name text,
  p_academic_year integer,
  p_grade_level integer,
  p_class_number integer,
  p_class_type text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare

  v_user_id uuid;
  v_school_id uuid;
  v_role text;
  v_class_id uuid;

begin

  v_user_id :=
    auth.uid();


  if v_user_id is null then

    raise exception
      'Not signed in.';

  end if;


  select
    role,
    school_id

  into
    v_role,
    v_school_id

  from public.profiles

  where id =
    v_user_id;


  if
    v_role is distinct from 'teacher'
  then

    raise exception
      'Only teachers can create classes.';

  end if;


  if not public.is_approved_teacher(
    v_user_id
  ) then

    raise exception
      'Approved teacher access required.'
      using errcode = '42501';

  end if;


  if
    v_school_id is null
  then

    raise exception
      'Teacher school is not registered.';

  end if;


  if
    trim(
      coalesce(
        p_name,
        ''
      )
    ) = ''
  then

    raise exception
      'Class name is required.';

  end if;


  if
    p_academic_year < 2000
    or
    p_academic_year > 2100
  then

    raise exception
      'Academic year is invalid.';

  end if;


  if
    p_grade_level is not null
    and
    p_grade_level not between 1 and 3
  then

    raise exception
      'Grade level must be 1, 2, or 3.';

  end if;


  if
    p_class_number is not null
    and
    p_class_number not between 1 and 99
  then

    raise exception
      'Class number is invalid.';

  end if;


  if
    p_class_type not in (
      'regular',
      'english_course',
      'tutor',
      'other'
    )
  then

    raise exception
      'Class type is invalid.';

  end if;


  if
    p_class_type in (
      'regular',
      'english_course'
    )
    and
    (
      p_grade_level is null
      or
      p_class_number is null
    )
  then

    raise exception
      'Grade and class number are required for regular classes.';

  end if;


  insert into public.classes (

    school_id,
    teacher_id,
    name,
    academic_year,
    grade_level,
    class_number,
    class_type

  )

  values (

    v_school_id,
    v_user_id,
    trim(p_name),
    p_academic_year,
    p_grade_level,
    p_class_number,
    p_class_type

  )

  returning id
  into v_class_id;


  return
    v_class_id;

end;
$$;


revoke all
on function public.create_teacher_class_structured(
  text,
  integer,
  integer,
  integer,
  text
)
from public, anon;


grant execute
on function public.create_teacher_class_structured(
  text,
  integer,
  integer,
  integer,
  text
)
to authenticated;