-- Each receiving class owns its stable assignment number.
-- Do not change assignment ids, week_no, gradebook_no, submissions or grades.
alter table public.assignment_classes
  add column if not exists class_assignment_no integer;

-- Keep the original number when unique within the class, preferring its
-- owning-class assignment. Cross-post collisions receive numbers above
-- the largest existing number for that receiving class.
with candidates as (
  select ac.class_id, ac.assignment_id, a.gradebook_no, a.audience_type,
         a.week_no, ac.display_order,
         row_number() over (
           partition by ac.class_id, a.gradebook_no
           order by (a.class_id = ac.class_id) desc,
                    ac.display_order nulls last, a.week_no, a.id
         ) as same_number_rank
  from public.assignment_classes ac
  join public.assignments a on a.id = ac.assignment_id
),
kept as (
  select class_id, assignment_id, gradebook_no as new_number
  from candidates
  where audience_type is distinct from 'targeted'
    and gradebook_no > 0 and same_number_rank = 1
),
extras as (
  select c.class_id, c.assignment_id,
         row_number() over (
           partition by c.class_id
           order by c.display_order nulls last, c.week_no, c.assignment_id
         ) as extra_rank
  from candidates c
  left join kept k
    on k.class_id = c.class_id and k.assignment_id = c.assignment_id
  where c.audience_type is distinct from 'targeted'
    and k.assignment_id is null
),
class_max as (
  select class_id, max(new_number) as max_number
  from kept group by class_id
),
resolved as (
  select class_id, assignment_id, new_number from kept
  union all
  select e.class_id, e.assignment_id,
         (coalesce(m.max_number, 0) + e.extra_rank)::integer as new_number
  from extras e
  left join class_max m on m.class_id = e.class_id
)
update public.assignment_classes ac
set class_assignment_no = r.new_number
from resolved r
where ac.class_id = r.class_id and ac.assignment_id = r.assignment_id;

-- Individual self-study assignments deliberately do not get a class No.
update public.assignment_classes ac
set class_assignment_no = null
from public.assignments a
where a.id = ac.assignment_id and a.audience_type = 'targeted';

alter table public.assignment_classes
  add constraint assignment_classes_class_assignment_no_positive
  check (class_assignment_no is null or class_assignment_no > 0);

create unique index if not exists assignment_classes_class_assignment_no_unique
  on public.assignment_classes (class_id, class_assignment_no)
  where class_assignment_no is not null;

comment on column public.assignment_classes.class_assignment_no is
  'Stable class-specific No. for class reading assignments. NULL for targeted self-study; independent of source assignment gradebook_no and display_order.';

-- Assign a fresh number whenever a lesson is linked to a receiving class.
-- The per-class advisory transaction lock serializes concurrent postings.
create or replace function public.number_new_class_assignment_link()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_audience text;
begin
  select a.audience_type into v_audience
  from public.assignments a where a.id = new.assignment_id;

  if v_audience = 'targeted' then
    new.class_assignment_no := null;
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.class_id::text, 20261110)
  );
  select coalesce(max(ac.class_assignment_no), 0) + 1
  into new.class_assignment_no
  from public.assignment_classes ac where ac.class_id = new.class_id;

  return new;
end;
$$;

revoke all on function public.number_new_class_assignment_link() from public, anon, authenticated;
drop trigger if exists number_new_class_assignment_link
  on public.assignment_classes;
create trigger number_new_class_assignment_link
before insert on public.assignment_classes
for each row execute function public.number_new_class_assignment_link();

-- Changing a lesson from individual study to class-wide (or vice versa)
-- updates the number for every receiving class without affecting grades.
create or replace function public.sync_assignment_link_numbers_on_audience_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_class_id uuid;
declare v_next integer;
begin
  if old.audience_type is not distinct from new.audience_type then
    return new;
  end if;

  if new.audience_type = 'targeted' then
    update public.assignment_classes
    set class_assignment_no = null
    where assignment_id = new.id;
  else
    for v_class_id in
      select class_id from public.assignment_classes
      where assignment_id = new.id order by class_id
    loop
      perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(v_class_id::text, 20261110)
      );
      select coalesce(max(class_assignment_no), 0) + 1 into v_next
      from public.assignment_classes
      where class_id = v_class_id;
      update public.assignment_classes
      set class_assignment_no = v_next
      where class_id = v_class_id and assignment_id = new.id;
    end loop;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_assignment_link_numbers_on_audience_change() from public, anon, authenticated;
drop trigger if exists sync_assignment_link_numbers_on_audience_change
  on public.assignments;
create trigger sync_assignment_link_numbers_on_audience_change
after update of audience_type on public.assignments
for each row execute function public.sync_assignment_link_numbers_on_audience_change();

-- An existing assignment must keep its class number and display position
-- when its content or cross-posting choices are saved. The old RPC deleted
-- every link and then recreated it, silently losing both attributes.
create or replace function public.set_assignment_classes(
  p_assignment_id uuid,
  p_class_ids uuid[] default '{}'::uuid[]
)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_primary_class_id uuid;
  v_invalid_count integer;
begin
  select a.class_id into v_primary_class_id
  from public.assignments a where a.id = p_assignment_id;

  if v_primary_class_id is null then
    raise exception 'Assignment not found';
  end if;

  if not public.is_teacher_of_class(v_primary_class_id) then
    raise exception 'Teacher access required.' using errcode = '42501';
  end if;

  select count(*) into v_invalid_count
  from (
    select distinct x.class_id
    from unnest(coalesce(p_class_ids, '{}'::uuid[])) as x(class_id)
    where x.class_id is not null and x.class_id <> v_primary_class_id
  ) requested
  left join public.classes c on c.id = requested.class_id
  where c.id is null or not public.is_teacher_of_class(requested.class_id);

  if v_invalid_count > 0 then
    raise exception 'One or more selected classes are not available to this teacher.'
      using errcode = '42501';
  end if;

  -- Delete only links that are no longer selected.
  delete from public.assignment_classes ac
  where ac.assignment_id = p_assignment_id
    and ac.class_id <> v_primary_class_id
    and not (ac.class_id = any(coalesce(p_class_ids, '{}'::uuid[])));

  -- The primary class remains linked. Unchanged links retain their numbers.
  insert into public.assignment_classes (assignment_id, class_id)
  values (p_assignment_id, v_primary_class_id)
  on conflict (assignment_id, class_id) do nothing;

  insert into public.assignment_classes (assignment_id, class_id)
  select distinct p_assignment_id, x.class_id
  from unnest(coalesce(p_class_ids, '{}'::uuid[])) as x(class_id)
  where x.class_id is not null and x.class_id <> v_primary_class_id
  on conflict (assignment_id, class_id) do nothing;
end;
$$;

revoke all on function public.set_assignment_classes(uuid, uuid[]) from public, anon;
grant execute on function public.set_assignment_classes(uuid, uuid[]) to authenticated;
