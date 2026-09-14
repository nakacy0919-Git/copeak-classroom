-- Copeak Classroom MVP schema
-- Run this entire file in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid references public.schools(id) on delete set null,
  display_name text not null,
  role text not null check (role in ('teacher','student')),
  created_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  academic_year int,
  class_code text not null unique default upper(substr(encode(gen_random_bytes(6),'hex'),1,6)),
  created_at timestamptz not null default now()
);

create table if not exists public.class_members (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id,student_id)
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  title text not null,
  category text,
  week_no int not null check (week_no > 0),
  release_at timestamptz not null,
  due_at timestamptz not null,
  copeak_url text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  unique(class_id,week_no)
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  accuracy numeric(5,2) check (accuracy between 0 and 100),
  wpm numeric(7,2) check (wpm >= 0),
  comprehension numeric(5,2) check (comprehension between 0 and 100),
  attempt_no int not null default 1 check (attempt_no > 0),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists submissions_student_idx on public.submissions(student_id);
create index if not exists submissions_assignment_idx on public.submissions(assignment_id);
create index if not exists assignments_class_idx on public.assignments(class_id,week_no);

-- Create profile automatically from signup metadata.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,display_name,role)
  values(new.id,coalesce(nullif(new.raw_user_meta_data->>'display_name',''),split_part(new.email,'@',1)),
         case when new.raw_user_meta_data->>'role'='teacher' then 'teacher' else 'student' end)
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Student joins a class with one code; no teacher/server setup on the student side.
create or replace function public.join_class_by_code(p_code text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_class public.classes%rowtype; v_role text;
begin
  select role into v_role from public.profiles where id=auth.uid();
  if v_role <> 'student' then raise exception 'Only students can join a class.'; end if;
  select * into v_class from public.classes where class_code=upper(trim(p_code));
  if v_class.id is null then raise exception 'Class code not found.'; end if;
  insert into public.class_members(class_id,student_id) values(v_class.id,auth.uid()) on conflict do nothing;
  update public.profiles set school_id=v_class.school_id where id=auth.uid();
  return v_class.id;
end; $$;
revoke all on function public.join_class_by_code(text) from public;
grant execute on function public.join_class_by_code(text) to authenticated;

alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;

-- Security-definer helpers keep RLS policies simple and avoid recursive-policy loops.
create or replace function public.is_teacher_of_class(p_class_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.classes c where c.id=p_class_id and c.teacher_id=auth.uid());
$$;
create or replace function public.is_student_in_class(p_class_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.class_members cm where cm.class_id=p_class_id and cm.student_id=auth.uid());
$$;
create or replace function public.is_teacher_of_student(p_student_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.class_members cm
    join public.classes c on c.id=cm.class_id
    where cm.student_id=p_student_id and c.teacher_id=auth.uid()
  );
$$;
create or replace function public.can_read_submission(p_assignment_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.assignments a
    join public.classes c on c.id=a.class_id
    where a.id=p_assignment_id and c.teacher_id=auth.uid()
  );
$$;
create or replace function public.can_submit_assignment(p_assignment_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.assignments a
    join public.class_members cm on cm.class_id=a.class_id
    where a.id=p_assignment_id and cm.student_id=auth.uid()
  );
$$;

-- PROFILES
create policy "profile self read" on public.profiles for select to authenticated using (id=auth.uid());
create policy "teacher reads own class students" on public.profiles for select to authenticated using (public.is_teacher_of_student(id));
create policy "profile self update" on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());

-- SCHOOLS
create policy "school members read" on public.schools for select to authenticated using (
  created_by=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.school_id=schools.id)
);
create policy "teacher creates school" on public.schools for insert to authenticated with check (
  created_by=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='teacher')
);

-- CLASSES
create policy "class participants read" on public.classes for select to authenticated using (
  teacher_id=auth.uid() or public.is_student_in_class(id)
);
create policy "teacher creates class" on public.classes for insert to authenticated with check (
  teacher_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='teacher' and p.school_id=classes.school_id)
);
create policy "teacher updates class" on public.classes for update to authenticated using (teacher_id=auth.uid()) with check (teacher_id=auth.uid());
create policy "teacher deletes class" on public.classes for delete to authenticated using (teacher_id=auth.uid());

-- CLASS MEMBERS
create policy "membership read" on public.class_members for select to authenticated using (
  student_id=auth.uid() or public.is_teacher_of_class(class_id)
);

-- ASSIGNMENTS
create policy "assignment participant read" on public.assignments for select to authenticated using (
  public.is_teacher_of_class(class_id) or (is_published and public.is_student_in_class(class_id))
);
create policy "teacher inserts assignments" on public.assignments for insert to authenticated with check (public.is_teacher_of_class(class_id));
create policy "teacher updates assignments" on public.assignments for update to authenticated using (public.is_teacher_of_class(class_id)) with check (public.is_teacher_of_class(class_id));
create policy "teacher deletes assignments" on public.assignments for delete to authenticated using (public.is_teacher_of_class(class_id));

-- SUBMISSIONS
create policy "submission owner teacher read" on public.submissions for select to authenticated using (
  student_id=auth.uid() or public.can_read_submission(assignment_id)
);
create policy "student inserts own submission" on public.submissions for insert to authenticated with check (
  student_id=auth.uid() and public.can_submit_assignment(assignment_id)
);

-- Privileges: do NOT grant profile role updates to clients.
grant usage on schema public to authenticated;
grant select on public.schools,public.profiles,public.classes,public.class_members,public.assignments,public.submissions to authenticated;
grant insert on public.schools,public.classes,public.assignments,public.submissions to authenticated;
grant update(display_name,school_id) on public.profiles to authenticated;
grant update,delete on public.classes,public.assignments to authenticated;
