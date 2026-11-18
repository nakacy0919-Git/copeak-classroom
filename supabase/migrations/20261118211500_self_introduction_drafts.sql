-- Personalized Copeak: Self-Introduction templates and private student drafts.
-- Production candidate only. Apply once with migration history after explicit release approval.
-- This file is forward-compatible with existing Text and Dialogue rows.
-- Existing databases only allow Text and Dialogue. Expand the CHECK atomically.
alter table public.assignments
  drop constraint if exists assignments_lesson_type_valid;
alter table public.assignments
  add constraint assignments_lesson_type_valid
  check (lesson_type in ('text', 'dialogue', 'self_intro'));

alter table public.assignments
  add column if not exists lesson_template jsonb;

-- Use a versioned, bounded template object for Self-Introduction assignments.
alter table public.assignments
  add constraint assignments_lesson_template_object_valid
  check (
    lesson_template is null
    or (
      jsonb_typeof(lesson_template) = 'object'
      and octet_length(lesson_template::text) <= 12000
    )
  );

-- Prevent a published Self-Introduction assignment from missing
-- a structurally usable teacher template. Leave legacy lessons untouched.
alter table public.assignments
  add constraint assignments_published_self_intro_template_valid
  check (
    lesson_type <> 'self_intro'
    or is_published is false
    or (
      lesson_template is not null
      and jsonb_typeof(lesson_template) = 'object'
      and lesson_template->>'version' = '1'
      and lesson_template->>'level' in ('beginner', 'intermediate', 'advanced')
      and jsonb_typeof(lesson_template->'expressions') = 'object'
      and case
        when jsonb_typeof(lesson_template->'fields') = 'array'
          then jsonb_array_length(lesson_template->'fields') between 2 and 12
        else false
      end
    )
  );

create table if not exists public.student_intro_drafts (
  assignment_id uuid not null
    references public.assignments(id) on delete cascade,
  student_id uuid not null
    references auth.users(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  expression_choices jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (assignment_id, student_id),
  constraint student_intro_drafts_answers_valid check (
    jsonb_typeof(answers) = 'object' and
    octet_length(answers::text) <= 12000
  ),
  constraint student_intro_drafts_expressions_valid check (
    jsonb_typeof(expression_choices) = 'object' and
    octet_length(expression_choices::text) <= 4000
  )
);

create index if not exists student_intro_drafts_student_id_idx
  on public.student_intro_drafts(student_id, updated_at desc);

-- Server-managed revision timestamp for optimistic concurrency.
-- Prevents stale browser tabs from silently replacing a newer student draft.
create or replace function public.touch_student_intro_draft_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and (
       new.assignment_id is distinct from old.assignment_id
       or new.student_id is distinct from old.student_id
     ) then
    raise exception 'Introduction draft ownership and assignment cannot be reassigned'
      using errcode = '23514';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

revoke all on function public.touch_student_intro_draft_updated_at() from public, anon;
grant execute on function public.touch_student_intro_draft_updated_at() to authenticated;

drop trigger if exists set_student_intro_draft_updated_at on public.student_intro_drafts;
create trigger set_student_intro_draft_updated_at
before insert or update on public.student_intro_drafts
for each row execute function public.touch_student_intro_draft_updated_at();

alter table public.student_intro_drafts enable row level security;

revoke all on table public.student_intro_drafts from public, anon, authenticated;
grant select, insert, update on table public.student_intro_drafts to authenticated;

-- Assignment RLS already restricts students to published assignments
-- addressed to them, including targeted and cross-posted assignments.
-- Check again that the assignment type is correct and the owner is a student.
create policy "student reads own introduction draft"
  on public.student_intro_drafts for select to authenticated
  using (
    student_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'student'
    )
    and exists (
      select 1 from public.assignments a
      where a.id = student_intro_drafts.assignment_id
        and a.is_published
        and a.lesson_type = 'self_intro'
    )
  );

create policy "student creates own introduction draft"
  on public.student_intro_drafts for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'student'
    )
    and exists (
      select 1 from public.assignments a
      where a.id = student_intro_drafts.assignment_id
        and a.is_published
        and a.lesson_type = 'self_intro'
    )
  );

create policy "student updates own introduction draft"
  on public.student_intro_drafts for update to authenticated
  using (
    student_id = (select auth.uid())
    and exists (
      select 1 from public.assignments a
      where a.id = student_intro_drafts.assignment_id
        and a.is_published
        and a.lesson_type = 'self_intro'
    )
  )
  with check (
    student_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'student'
    )
    and exists (
      select 1 from public.assignments a
      where a.id = student_intro_drafts.assignment_id
        and a.is_published
        and a.lesson_type = 'self_intro'
    )
  );
