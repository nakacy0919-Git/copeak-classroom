-- Exact SQL of production migration 20261011213040_picspeak_beta_isolated_drafts.
-- Applied ONLY to Copeak Classroom main Supabase by explicit user request.
-- This file is history for consistency. Never blindly run supabase db push.
-- Only creates independent PicSpeak beta assignment drafts.
create table public.picspeak_assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  created_by uuid not null default auth.uid()
    references public.profiles(id),
  title text not null
    check (char_length(btrim(title)) between 1 and 200),
  theme_id text not null
    check (theme_id ~ '^([0-9]{3}|theme_l2_[0-9]{3})$'),
  level text not null
    check (level in ('elementary','junior_high','high_school')),
  time_limit integer not null default 45
    check (time_limit in (30,45,60)),
  release_at timestamptz not null,
  due_at timestamptz not null,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  constraint picspeak_assignments_dates_chk check (due_at>release_at),
  constraint picspeak_beta_draft_only_chk check (is_published=false)
);
create index picspeak_assignments_class_idx
  on public.picspeak_assignments(class_id,created_at desc);
alter table public.picspeak_assignments enable row level security;
revoke all on public.picspeak_assignments from public,anon,authenticated;
grant select,insert,delete on public.picspeak_assignments to authenticated;
grant update(title,theme_id,level,time_limit,release_at,due_at)
  on public.picspeak_assignments to authenticated;
create policy "picspeak_teacher_read"
on public.picspeak_assignments for select to authenticated
using (public.is_teacher_of_class(class_id));
create policy "picspeak_student_published_read"
on public.picspeak_assignments for select to authenticated
using (
  is_published and release_at<=now() and
  public.is_student_in_class(class_id)
);
create policy "picspeak_teacher_insert_draft"
on public.picspeak_assignments for insert to authenticated
with check(
  created_by=(select auth.uid())
  and public.is_teacher_of_class(class_id)
  and is_published=false
);
create policy "picspeak_teacher_update_draft"
on public.picspeak_assignments for update to authenticated
using(public.is_teacher_of_class(class_id))
with check(public.is_teacher_of_class(class_id) and is_published=false);
create policy "picspeak_teacher_delete_draft"
on public.picspeak_assignments for delete to authenticated
using(public.is_teacher_of_class(class_id));
