-- Separate stable class-assignment numbers from internal assignment IDs.
-- This migration never changes week_no, assignment IDs, submissions, or manual scores.
alter table public.assignments
  add column if not exists gradebook_no integer;

-- Preserve historical gaps caused by deleted class tasks; remove only gaps
-- introduced by individual/targeted assignments that still exist.
update public.assignments as a
set gradebook_no = a.week_no - (
  select count(*)::integer
  from public.assignments as targeted
  where targeted.class_id = a.class_id
    and targeted.audience_type = 'targeted'
    and targeted.week_no < a.week_no
)
where a.audience_type = 'class' and a.gradebook_no is null;

update public.assignments
set gradebook_no = null
where audience_type = 'targeted' and gradebook_no is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.assignments'::regclass
      and conname = 'assignments_gradebook_number_valid'
  ) then
    alter table public.assignments
      add constraint assignments_gradebook_number_valid
      check (gradebook_no is null or gradebook_no > 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.assignments'::regclass
      and conname = 'assignments_targeted_gradebook_number_null'
  ) then
    alter table public.assignments
      add constraint assignments_targeted_gradebook_number_null
      check (audience_type <> 'targeted' or gradebook_no is null);
  end if;
end $$;

create unique index if not exists assignments_class_gradebook_number_unique
  on public.assignments (class_id, gradebook_no)
  where gradebook_no is not null;

comment on column public.assignments.gradebook_no is
  'Teacher-facing number for class assignments only; NULL for individual self-study. week_no remains an internal immutable ordering key.';
