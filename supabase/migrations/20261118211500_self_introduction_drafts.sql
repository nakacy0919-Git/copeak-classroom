-- Personalized Copeak: Self-Introduction templates and private student drafts.
-- This migration is staged in Git only. Do not apply to production without a separate review.
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
