-- PicSpeak beta: independent picture-speaking assignments.
-- This migration is PREPARATION ONLY.
-- Do not apply to production until the integration is tested.

create table if not exists public.picspeak_assignments (
  id uuid primary key default gen_random_uuid(),

  class_id uuid not null
    references public.classes(id) on delete cascade,

  created_by uuid not null default auth.uid()
    references public.profiles(id),

  title text not null
    check (char_length(btrim(title)) between 1 and 200),

  theme_id text not null
    check (theme_id ~ '^([0-9]{3}|theme_l2_[0-9]{3})$'),

  level text not null
    check (level in (
      'elementary',
      'junior_high',
      'high_school'
    )),

  time_limit integer not null default 45
    check (time_limit in (30, 45, 60)),

  release_at timestamptz not null,
  due_at timestamptz not null,

  is_published boolean not null default false,

  created_at timestamptz not null default now(),

  constraint picspeak_assignment_dates_check
    check (due_at > release_at)
);

create index if not exists
  picspeak_assignments_class_idx
  on public.picspeak_assignments(class_id, release_at);

alter table public.picspeak_assignments
  enable row level security;

revoke all on public.picspeak_assignments
  from public, anon, authenticated;

grant select, insert, delete
  on public.picspeak_assignments
  to authenticated;

grant update (
  title,
  theme_id,
  level,
  time_limit,
  release_at,
  due_at,
  is_published
) on public.picspeak_assignments
  to authenticated;

drop policy if exists
  "picspeak teacher reads"
  on public.picspeak_assignments;

create policy "picspeak teacher reads"
  on public.picspeak_assignments
  for select to authenticated
  using (
    public.is_teacher_of_class(class_id)
  );

drop policy if exists
  "picspeak student reads published"
  on public.picspeak_assignments;

create policy "picspeak student reads published"
  on public.picspeak_assignments
  for select to authenticated
  using (
    is_published
    and public.is_student_in_class(class_id)
  );

drop policy if exists
  "picspeak teacher creates"
  on public.picspeak_assignments;

create policy "picspeak teacher creates"
  on public.picspeak_assignments
  for insert to authenticated
  with check (
    public.is_teacher_of_class(class_id)
    and created_by = auth.uid()
  );

drop policy if exists
  "picspeak teacher updates"
  on public.picspeak_assignments;

create policy "picspeak teacher updates"
  on public.picspeak_assignments
  for update to authenticated
  using (
    public.is_teacher_of_class(class_id)
  )
  with check (
    public.is_teacher_of_class(class_id)
  );

drop policy if exists
  "picspeak teacher deletes"
  on public.picspeak_assignments;

create policy "picspeak teacher deletes"
  on public.picspeak_assignments
  for delete to authenticated
  using (
    public.is_teacher_of_class(class_id)
  );