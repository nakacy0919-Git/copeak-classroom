-- =========================================================
-- Copeak Classroom
-- Structured Class Metadata
-- =========================================================
--
-- grade_level:
--   1 / 2 / 3
--   NULL = grade-independent class
--
-- class_number:
--   1 ... 99
--   NULL = non-homeroom / special class
--
-- class_type:
--   regular
--   english_course
--   tutor
--   other
--
-- Existing classes are preserved and backfilled from name.
-- =========================================================


alter table public.classes
  add column if not exists grade_level integer;


alter table public.classes
  add column if not exists class_number integer;


alter table public.classes
  add column if not exists class_type text;


-- =========================================================
-- VALIDATION
-- =========================================================

alter table public.classes
  drop constraint if exists classes_grade_level_valid;


alter table public.classes
  add constraint classes_grade_level_valid
  check (
    grade_level is null
    or grade_level between 1 and 3
  );


alter table public.classes
  drop constraint if exists classes_class_number_valid;


alter table public.classes
  add constraint classes_class_number_valid
  check (
    class_number is null
    or class_number between 1 and 99
  );


alter table public.classes
  drop constraint if exists classes_class_type_valid;


alter table public.classes
  add constraint classes_class_type_valid
  check (
    class_type in (
      'regular',
      'english_course',
      'tutor',
      'other'
    )
  );


-- =========================================================
-- BACKFILL EXISTING CLASS NAMES
--
-- Supported examples:
--
--   3年12組
--   ３年１２組
--   1-4
--   2-13
--
-- Full-width digits are normalized first.
-- =========================================================

with normalized as (

  select
    id,

    translate(
      name,
      '０１２３４５６７８９',
      '0123456789'
    ) as normalized_name

  from public.classes

),

parsed as (

  select
    id,
    normalized_name,

    case

      when
        normalized_name ~ '^[123]年[[:space:]]*[0-9]{1,2}組'
      then
        substring(
          normalized_name
          from '^([123])年'
        )::integer

      when
        normalized_name ~ '^[123][[:space:]]*-[[:space:]]*[0-9]{1,2}$'
      then
        substring(
          normalized_name
          from '^([123])'
        )::integer

      else
        null

    end as parsed_grade,

    case

      when
        normalized_name ~ '^[123]年[[:space:]]*[0-9]{1,2}組'
      then
        substring(
          normalized_name
          from '年[[:space:]]*([0-9]{1,2})組'
        )::integer

      when
        normalized_name ~ '^[123][[:space:]]*-[[:space:]]*[0-9]{1,2}$'
      then
        substring(
          normalized_name
          from '-[[:space:]]*([0-9]{1,2})$'
        )::integer

      else
        null

    end as parsed_number

  from normalized
)


update public.classes c

set
  grade_level =
    coalesce(
      c.grade_level,
      p.parsed_grade
    ),

  class_number =
    coalesce(
      c.class_number,
      p.parsed_number
    )

from parsed p

where
  p.id = c.id

  and
  (
    c.grade_level is null
    or
    c.class_number is null
  );


-- =========================================================
-- BACKFILL CLASS TYPE
-- =========================================================

update public.classes

set class_type =
  case

    when
      lower(name) like '%english%'
    then
      'english_course'

    when
      lower(name) like '%tutor%'
    then
      'tutor'

    when
      grade_level is not null
      and
      class_number is not null
    then
      'regular'

    else
      'other'

  end

where
  class_type is null;

-- =========================================================
-- FUTURE DEFAULT
--
-- Old class-creation paths remain compatible.
-- =========================================================

alter table public.classes
  alter column class_type
  set default 'regular';


alter table public.classes
  alter column class_type
  set not null;


-- =========================================================
-- SORTING INDEX
-- =========================================================

create index if not exists
  classes_teacher_structured_sort_idx

on public.classes (
  teacher_id,
  academic_year,
  grade_level,
  class_number,
  class_type
);


-- =========================================================
-- DOCUMENTATION
-- =========================================================

comment on column public.classes.grade_level
is
  'School grade level: 1, 2, 3. NULL for non-grade classes.';


comment on column public.classes.class_number
is
  'Homeroom/class number. NULL for special classes.';


comment on column public.classes.class_type
is
  'Class type: regular, english_course, tutor, other.';