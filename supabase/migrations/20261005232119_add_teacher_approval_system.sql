begin;


-- ==========================================
-- TEACHER APPROVAL STATUS
-- ==========================================

alter table public.profiles
add column if not exists
teacher_status text;


alter table public.profiles
drop constraint if exists
profiles_teacher_status_check;


alter table public.profiles
add constraint
profiles_teacher_status_check

check (
  teacher_status is null
  or
  teacher_status in (
    'pending',
    'approved',
    'suspended',
    'rejected'
  )
);


-- Existing teachers must continue working.
update public.profiles

set teacher_status =
  'approved'

where
  role =
    'teacher'

  and

  teacher_status
    is null;


-- Student accounts never need a teacher status.
update public.profiles

set teacher_status =
  null

where role =
  'student';


create index if not exists
profiles_teacher_status_idx

on public.profiles(
  teacher_status
)

where role =
  'teacher';


-- ==========================================
-- PLATFORM ADMINS
-- ==========================================

create table if not exists
public.platform_admins (

  user_id uuid
    primary key
    references public.profiles(id)
    on delete cascade,

  created_at timestamptz
    not null
    default now()

);


alter table public.platform_admins
enable row level security;


-- ==========================================
-- TEACHER DETAILS
-- ==========================================

create table if not exists
public.teacher_details (

  teacher_id uuid
    primary key
    references public.profiles(id)
    on delete cascade,

  email text,

  school_name text,

  prefecture text,

  school_type text,

  subject text,

  planned_class_count integer,

  planned_student_count integer,

  phone text,

  use_purpose text,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  reviewed_at timestamptz,

  reviewed_by uuid
    references public.profiles(id)
    on delete set null,

  review_note text,

  constraint
  teacher_details_planned_class_count_check

  check (
    planned_class_count is null
    or
    (
      planned_class_count >= 1
      and
      planned_class_count <= 100
    )
  ),

  constraint
  teacher_details_planned_student_count_check

  check (
    planned_student_count is null
    or
    (
      planned_student_count >= 1
      and
      planned_student_count <= 10000
    )
  )

);


alter table public.teacher_details
enable row level security;


-- ==========================================
-- BACKFILL EXISTING TEACHERS
-- ==========================================

insert into public.teacher_details (

  teacher_id,
  email,
  school_name

)

select

  p.id,

  u.email,

  s.name

from public.profiles p

join auth.users u
  on u.id =
     p.id

left join public.schools s
  on s.id =
     p.school_id

where
  p.role =
    'teacher'

on conflict (
  teacher_id
)

do update set

  email =
    coalesce(
      public.teacher_details.email,
      excluded.email
    ),

  school_name =
    coalesce(
      public.teacher_details.school_name,
      excluded.school_name
    );


-- ==========================================
-- ADMIN CHECK
-- ==========================================

create or replace function
public.is_platform_admin(
  p_user_id uuid
)

returns boolean

language sql

stable

security definer

set search_path =
  public

as $$

  select exists(

    select 1

    from public.platform_admins pa

    where
      pa.user_id =
      p_user_id

  );

$$;


revoke all
on function
public.is_platform_admin(uuid)
from public;


grant execute
on function
public.is_platform_admin(uuid)
to authenticated;


-- ==========================================
-- APPROVED TEACHER CHECK
-- ==========================================

create or replace function
public.is_approved_teacher(
  p_user_id uuid
)

returns boolean

language sql

stable

security definer

set search_path =
  public

as $$

  select exists(

    select 1

    from public.profiles p

    where
      p.id =
        p_user_id

      and

      p.role =
        'teacher'

      and

      p.teacher_status =
        'approved'

  );

$$;


revoke all
on function
public.is_approved_teacher(uuid)
from public;


grant execute
on function
public.is_approved_teacher(uuid)
to authenticated;


-- ==========================================
-- CLASS TEACHER CHECK
-- Preserve owner + co-teacher support.
-- Approval is now required.
-- ==========================================

create or replace function
public.is_teacher_of_class(
  p_class_id uuid
)

returns boolean

language sql

stable

security definer

set search_path =
  public

as $$

  select

    public.is_approved_teacher(
      auth.uid()
    )

    and

    (

      exists(

        select 1

        from public.classes c

        where
          c.id =
            p_class_id

          and

          c.teacher_id =
            auth.uid()

      )

      or

      exists(

        select 1

        from public.class_teachers ct

        where
          ct.class_id =
            p_class_id

          and

          ct.teacher_id =
            auth.uid()

      )

    );

$$;


-- ==========================================
-- AUTH USER CREATION
-- Teacher => pending
-- Student => no teacher_status
-- ==========================================

create or replace function
public.handle_new_user()

returns trigger

language plpgsql

security definer

set search_path =
  public

as $$

declare

  v_is_teacher boolean;

  v_class_count integer;

  v_student_count integer;

begin

  v_is_teacher :=
    (
      new.raw_user_meta_data
        ->> 'role'
    ) =
    'teacher';


  insert into public.profiles(

    id,
    display_name,
    role,
    teacher_status

  )

  values(

    new.id,

    coalesce(

      nullif(
        new.raw_user_meta_data
          ->> 'display_name',
        ''
      ),

      split_part(
        coalesce(
          new.email,
          ''
        ),
        '@',
        1
      )

    ),

    case

      when v_is_teacher
      then 'teacher'

      else 'student'

    end,

    case

      when v_is_teacher
      then 'pending'

      else null

    end

  )

  on conflict (
    id
  )

  do nothing;


  if v_is_teacher then

    v_class_count :=

      case

        when coalesce(
          new.raw_user_meta_data
            ->> 'planned_class_count',
          ''
        )
        ~ '^[0-9]+$'

        then (
          new.raw_user_meta_data
            ->> 'planned_class_count'
        )::integer

        else null

      end;


    v_student_count :=

      case

        when coalesce(
          new.raw_user_meta_data
            ->> 'planned_student_count',
          ''
        )
        ~ '^[0-9]+$'

        then (
          new.raw_user_meta_data
            ->> 'planned_student_count'
        )::integer

        else null

      end;


    insert into public.teacher_details(

      teacher_id,
      email,
      school_name,
      prefecture,
      school_type,
      subject,
      planned_class_count,
      planned_student_count,
      phone,
      use_purpose

    )

    values(

      new.id,

      lower(
        coalesce(
          new.email,
          ''
        )
      ),

      nullif(
        trim(
          coalesce(
            new.raw_user_meta_data
              ->> 'school_name',
            ''
          )
        ),
        ''
      ),

      nullif(
        trim(
          coalesce(
            new.raw_user_meta_data
              ->> 'prefecture',
            ''
          )
        ),
        ''
      ),

      nullif(
        trim(
          coalesce(
            new.raw_user_meta_data
              ->> 'school_type',
            ''
          )
        ),
        ''
      ),

      nullif(
        trim(
          coalesce(
            new.raw_user_meta_data
              ->> 'subject',
            ''
          )
        ),
        ''
      ),

      v_class_count,

      v_student_count,

      nullif(
        trim(
          coalesce(
            new.raw_user_meta_data
              ->> 'phone',
            ''
          )
        ),
        ''
      ),

      nullif(
        trim(
          coalesce(
            new.raw_user_meta_data
              ->> 'use_purpose',
            ''
          )
        ),
        ''
      )

    )

    on conflict (
      teacher_id
    )

    do nothing;

  end if;


  return new;

end;

$$;


-- ==========================================
-- RLS: ADMIN TABLE
-- ==========================================

drop policy if exists
"platform admin reads own membership"
on public.platform_admins;


create policy
"platform admin reads own membership"

on public.platform_admins

for select

to authenticated

using (
  user_id =
    auth.uid()
);


-- ==========================================
-- RLS: TEACHER DETAILS
-- ==========================================

drop policy if exists
"teacher reads own details"
on public.teacher_details;


create policy
"teacher reads own details"

on public.teacher_details

for select

to authenticated

using (
  teacher_id =
    auth.uid()
);


drop policy if exists
"platform admin reads teacher details"
on public.teacher_details;


create policy
"platform admin reads teacher details"

on public.teacher_details

for select

to authenticated

using (
  public.is_platform_admin(
    auth.uid()
  )
);


grant select
on
  public.platform_admins,
  public.teacher_details
to authenticated;


-- Keep profile approval fields server controlled.
revoke update
on public.profiles
from authenticated;


grant update(
  display_name,
  school_id
)
on public.profiles
to authenticated;


-- ==========================================
-- SCHOOL CREATE
-- ==========================================

drop policy if exists
"teacher creates school"
on public.schools;


create policy
"teacher creates school"

on public.schools

for insert

to authenticated

with check (

  created_by =
    auth.uid()

  and

  public.is_approved_teacher(
    auth.uid()
  )

);


-- ==========================================
-- CLASS CREATE
-- ==========================================

drop policy if exists
"teacher creates class"
on public.classes;


create policy
"teacher creates class"

on public.classes

for insert

to authenticated

with check (

  teacher_id =
    auth.uid()

  and

  public.is_approved_teacher(
    auth.uid()
  )

  and

  exists(

    select 1

    from public.profiles p

    where
      p.id =
        auth.uid()

      and

      p.school_id =
        classes.school_id

  )

);


-- ==========================================
-- CLASS UPDATE
-- ==========================================

drop policy if exists
"teacher updates class"
on public.classes;


create policy
"teacher updates class"

on public.classes

for update

to authenticated

using (

  teacher_id =
    auth.uid()

  and

  public.is_approved_teacher(
    auth.uid()
  )

)

with check (

  teacher_id =
    auth.uid()

  and

  public.is_approved_teacher(
    auth.uid()
  )

);


-- ==========================================
-- CLASS DELETE
-- ==========================================

drop policy if exists
"teacher deletes class"
on public.classes;


create policy
"teacher deletes class"

on public.classes

for delete

to authenticated

using (

  teacher_id =
    auth.uid()

  and

  public.is_approved_teacher(
    auth.uid()
  )

);


-- ==========================================
-- ADMIN: LIST TEACHERS
-- ==========================================

create or replace function
public.admin_list_teachers()

returns table (

  teacher_id uuid,

  display_name text,

  email text,

  teacher_status text,

  school_name text,

  prefecture text,

  school_type text,

  subject text,

  planned_class_count integer,

  planned_student_count integer,

  phone text,

  use_purpose text,

  registered_at timestamptz,

  reviewed_at timestamptz,

  review_note text

)

language plpgsql

security definer

set search_path =
  public

as $$

begin

  if not public.is_platform_admin(
    auth.uid()
  ) then

    raise exception
      'Admin access required.';

  end if;


  return query

  select

    p.id,

    p.display_name,

    td.email,

    p.teacher_status,

    td.school_name,

    td.prefecture,

    td.school_type,

    td.subject,

    td.planned_class_count,

    td.planned_student_count,

    td.phone,

    td.use_purpose,

    p.created_at,

    td.reviewed_at,

    td.review_note

  from public.profiles p

  left join public.teacher_details td
    on td.teacher_id =
       p.id

  where
    p.role =
      'teacher'

  order by
    case
      when p.teacher_status = 'pending'
      then 0
      else 1
    end,
    p.created_at desc;

end;

$$;


revoke all
on function
public.admin_list_teachers()
from public;


grant execute
on function
public.admin_list_teachers()
to authenticated;


-- ==========================================
-- ADMIN: REVIEW TEACHER
-- ==========================================

create or replace function
public.admin_set_teacher_status(

  p_teacher_id uuid,

  p_status text,

  p_note text
    default null

)

returns void

language plpgsql

security definer

set search_path =
  public

as $$

begin

  if not public.is_platform_admin(
    auth.uid()
  ) then

    raise exception
      'Admin access required.';

  end if;


  if p_status not in (
    'pending',
    'approved',
    'suspended',
    'rejected'
  ) then

    raise exception
      'Invalid teacher status.';

  end if;


  if not exists(

    select 1

    from public.profiles p

    where
      p.id =
        p_teacher_id

      and

      p.role =
        'teacher'

  ) then

    raise exception
      'Teacher not found.';

  end if;


  update public.profiles

  set teacher_status =
    p_status

  where id =
    p_teacher_id;


  insert into public.teacher_details(

    teacher_id,
    reviewed_at,
    reviewed_by,
    review_note

  )

  values(

    p_teacher_id,
    now(),
    auth.uid(),
    nullif(
      trim(
        coalesce(
          p_note,
          ''
        )
      ),
      ''
    )

  )

  on conflict (
    teacher_id
  )

  do update set

    reviewed_at =
      excluded.reviewed_at,

    reviewed_by =
      excluded.reviewed_by,

    review_note =
      excluded.review_note,

    updated_at =
      now();

end;

$$;


revoke all
on function
public.admin_set_teacher_status(
  uuid,
  text,
  text
)
from public;


grant execute
on function
public.admin_set_teacher_status(
  uuid,
  text,
  text
)
to authenticated;


commit;