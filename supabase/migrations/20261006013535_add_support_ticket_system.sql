begin;


create table public.support_tickets (

  id uuid
    primary key
    default gen_random_uuid(),

  teacher_id uuid
    not null
    references public.profiles(id)
    on delete cascade,

  subject text
    not null,

  category text
    not null
    default 'other',

  status text
    not null
    default 'open',

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  last_message_at timestamptz
    not null
    default now(),

  constraint support_ticket_category_check
  check (
    category in (
      'login',
      'student',
      'assignment',
      'microphone',
      'bug',
      'other'
    )
  ),

  constraint support_ticket_status_check
  check (
    status in (
      'open',
      'waiting_teacher',
      'resolved'
    )
  ),

  constraint support_ticket_subject_length_check
  check (
    char_length(subject)
    between 1 and 160
  )

);


create table public.support_messages (

  id uuid
    primary key
    default gen_random_uuid(),

  ticket_id uuid
    not null
    references public.support_tickets(id)
    on delete cascade,

  sender_id uuid
    not null
    references public.profiles(id)
    on delete cascade,

  body text
    not null,

  created_at timestamptz
    not null
    default now(),

  constraint support_message_body_length_check
  check (
    char_length(body)
    between 1 and 4000
  )

);


create index support_tickets_teacher_idx
on public.support_tickets(
  teacher_id,
  last_message_at desc
);


create index support_tickets_status_idx
on public.support_tickets(
  status,
  last_message_at desc
);


create index support_messages_ticket_idx
on public.support_messages(
  ticket_id,
  created_at
);


alter table public.support_tickets
enable row level security;


alter table public.support_messages
enable row level security;


create policy
"teachers read own support tickets"

on public.support_tickets

for select

to authenticated

using (
  teacher_id = auth.uid()
);


create policy
"admins read all support tickets"

on public.support_tickets

for select

to authenticated

using (
  public.is_platform_admin(
    auth.uid()
  )
);


create policy
"teachers read own support messages"

on public.support_messages

for select

to authenticated

using (

  exists(

    select 1
    from public.support_tickets t

    where
      t.id = support_messages.ticket_id

      and

      t.teacher_id = auth.uid()

  )

);


create policy
"admins read all support messages"

on public.support_messages

for select

to authenticated

using (
  public.is_platform_admin(
    auth.uid()
  )
);


grant select
on public.support_tickets
to authenticated;


grant select
on public.support_messages
to authenticated;


create or replace function
public.create_support_ticket(

  p_subject text,
  p_category text,
  p_body text

)

returns uuid

language plpgsql

security definer

set search_path = public

as $$

declare

  v_ticket_id uuid;

begin

  if not exists(

    select 1
    from public.profiles p

    where
      p.id = auth.uid()

      and

      p.role = 'teacher'

  ) then

    raise exception
      'Teacher account required.';

  end if;


  if char_length(
    trim(
      coalesce(
        p_subject,
        ''
      )
    )
  ) not between 1 and 160 then

    raise exception
      'Invalid subject.';

  end if;


  if p_category not in (

    'login',
    'student',
    'assignment',
    'microphone',
    'bug',
    'other'

  ) then

    raise exception
      'Invalid category.';

  end if;


  if char_length(
    trim(
      coalesce(
        p_body,
        ''
      )
    )
  ) not between 1 and 4000 then

    raise exception
      'Invalid message.';

  end if;


  insert into public.support_tickets(

    teacher_id,
    subject,
    category,
    status

  )

  values(

    auth.uid(),
    trim(p_subject),
    p_category,
    'open'

  )

  returning id
  into v_ticket_id;


  insert into public.support_messages(

    ticket_id,
    sender_id,
    body

  )

  values(

    v_ticket_id,
    auth.uid(),
    trim(p_body)

  );


  return v_ticket_id;

end;

$$;


revoke all
on function public.create_support_ticket(
  text,
  text,
  text
)
from public;


grant execute
on function public.create_support_ticket(
  text,
  text,
  text
)
to authenticated;


create or replace function
public.send_support_message(

  p_ticket_id uuid,
  p_body text

)

returns void

language plpgsql

security definer

set search_path = public

as $$

declare

  v_teacher_id uuid;
  v_is_admin boolean;

begin

  if char_length(
    trim(
      coalesce(
        p_body,
        ''
      )
    )
  ) not between 1 and 4000 then

    raise exception
      'Invalid message.';

  end if;


  select teacher_id

  into v_teacher_id

  from public.support_tickets

  where id = p_ticket_id;


  if v_teacher_id is null then

    raise exception
      'Support ticket not found.';

  end if;


  v_is_admin :=
    public.is_platform_admin(
      auth.uid()
    );


  if
    auth.uid() <> v_teacher_id

    and

    not v_is_admin
  then

    raise exception
      'Support ticket access denied.';

  end if;


  insert into public.support_messages(

    ticket_id,
    sender_id,
    body

  )

  values(

    p_ticket_id,
    auth.uid(),
    trim(p_body)

  );


  update public.support_tickets

  set
    last_message_at = now(),
    updated_at = now(),

    status =
      case

        when v_is_admin
        then 'waiting_teacher'

        else 'open'

      end

  where id = p_ticket_id;

end;

$$;


revoke all
on function public.send_support_message(
  uuid,
  text
)
from public;


grant execute
on function public.send_support_message(
  uuid,
  text
)
to authenticated;


create or replace function
public.admin_list_support_tickets()

returns table (

  ticket_id uuid,
  teacher_id uuid,
  teacher_name text,
  teacher_email text,
  subject text,
  category text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  last_message_at timestamptz

)

language plpgsql

security definer

set search_path = public

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

    t.id,
    t.teacher_id,
    p.display_name,
    td.email,
    t.subject,
    t.category,
    t.status,
    t.created_at,
    t.updated_at,
    t.last_message_at

  from public.support_tickets t

  join public.profiles p
    on p.id = t.teacher_id

  left join public.teacher_details td
    on td.teacher_id = t.teacher_id

  order by

    case

      when t.status = 'open'
      then 0

      when t.status = 'waiting_teacher'
      then 1

      else 2

    end,

    t.last_message_at desc;

end;

$$;


revoke all
on function public.admin_list_support_tickets()
from public;


grant execute
on function public.admin_list_support_tickets()
to authenticated;


create or replace function
public.admin_set_support_ticket_status(

  p_ticket_id uuid,
  p_status text

)

returns void

language plpgsql

security definer

set search_path = public

as $$

begin

  if not public.is_platform_admin(
    auth.uid()
  ) then

    raise exception
      'Admin access required.';

  end if;


  if p_status not in (

    'open',
    'waiting_teacher',
    'resolved'

  ) then

    raise exception
      'Invalid ticket status.';

  end if;


  update public.support_tickets

  set
    status = p_status,
    updated_at = now()

  where id = p_ticket_id;


  if not found then

    raise exception
      'Support ticket not found.';

  end if;

end;

$$;


revoke all
on function public.admin_set_support_ticket_status(
  uuid,
  text
)
from public;


grant execute
on function public.admin_set_support_ticket_status(
  uuid,
  text
)
to authenticated;


commit;