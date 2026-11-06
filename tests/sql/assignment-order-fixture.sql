-- Isolated CI database only. No production credentials, user data, or external services.
create role authenticated;
create role anon;
create schema auth;
grant usage on schema auth to authenticated;
create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to authenticated;

create table public.classes (id uuid primary key);
create table public.class_teachers (
  class_id uuid not null references public.classes(id),
  teacher_id uuid not null,
  primary key(class_id,teacher_id)
);
create table public.assignments (
  id uuid primary key,
  class_id uuid not null references public.classes(id),
  week_no integer not null,
  gradebook_no integer
);
create table public.assignment_classes (
  assignment_id uuid not null references public.assignments(id),
  class_id uuid not null references public.classes(id),
  primary key (assignment_id, class_id)
);
create function public.is_teacher_of_class(p_class_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists(
    select 1 from public.class_teachers ct
    where ct.class_id = p_class_id and ct.teacher_id = auth.uid()
  );
$$;

alter table public.assignment_classes enable row level security;
grant usage on schema public to authenticated;
grant select on public.assignment_classes to authenticated;
create policy "teacher can read class distribution"
on public.assignment_classes for select to authenticated
using(public.is_teacher_of_class(class_id));

insert into public.classes(id) values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');
insert into public.class_teachers(class_id,teacher_id) values
 ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333'),
 ('22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444');
insert into public.assignments(id,class_id,week_no,gradebook_no) values
 ('00000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111',1,1),
 ('00000000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111',2,2),
 ('00000000-0000-4000-8000-000000000003','22222222-2222-4222-8222-222222222222',3,3);
insert into public.assignment_classes(assignment_id,class_id) values
 ('00000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111'),
 ('00000000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111'),
 ('00000000-0000-4000-8000-000000000003','22222222-2222-4222-8222-222222222222'),
 ('00000000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222');
