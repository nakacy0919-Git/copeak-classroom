-- A small, isolated PostgreSQL fixture for the unapplied Self-Introduction migration.
-- Use a brand-new throwaway database; NEVER run this against the live Supabase project.
create schema if not exists auth;
-- Roles are cluster-global; an earlier CI fixture may already have created them.
do $
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
end;
$;
grant usage on schema public, auth to authenticated, anon;

create function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create table auth.users(id uuid primary key);
create table public.profiles(id uuid primary key, role text not null);
create table public.assignment_access(assignment_id uuid not null, student_id uuid not null);
create table public.assignments(
  id uuid primary key,
  lesson_type text not null default 'text',
  is_published boolean not null default false,
  constraint assignments_lesson_type_valid check(lesson_type in ('text','dialogue'))
);

alter table public.profiles enable row level security;
create policy "read own test profile" on public.profiles
for select to authenticated using (id = (select auth.uid()));
grant select on public.profiles to authenticated;
grant select on public.assignment_access to authenticated;

alter table public.assignments enable row level security;
create policy "read assigned test lesson" on public.assignments
for select to authenticated using (
  is_published and exists (
    select 1 from public.assignment_access ac
    where ac.assignment_id = assignments.id and ac.student_id = (select auth.uid())
  )
);
grant select on public.assignments to authenticated;

insert into auth.users values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222'),
 ('33333333-3333-4333-8333-333333333333');
insert into public.profiles values
 ('11111111-1111-4111-8111-111111111111','student'),
 ('22222222-2222-4222-8222-222222222222','student'),
 ('33333333-3333-4333-8333-333333333333','teacher');
insert into public.assignments values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','text',true),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','text',true),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','text',false);
insert into public.assignment_access values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','22222222-2222-4222-8222-222222222222');
