-- Class-specific Reading Assignments display order.
-- No change to gradebook_no, week_no, submission rows, or class rankings.
-- Apply before deploying the teacher/student JavaScript that selects display_order.
alter table public.assignment_classes
  add column if not exists display_order integer;

-- Repair any missing primary-class bridge rows created before cross-posting.
insert into public.assignment_classes (assignment_id, class_id)
select a.id, a.class_id from public.assignments a
on conflict (assignment_id, class_id) do nothing;

-- Stable initial order for current materials, per receiving class.
with numbered as (
  select ac.assignment_id, ac.class_id,
    row_number() over (
      partition by ac.class_id
      order by a.week_no, a.id
    )::integer as ordinal
  from public.assignment_classes ac
  join public.assignments a on a.id = ac.assignment_id
)
update public.assignment_classes ac
set display_order = numbered.ordinal
from numbered
where ac.assignment_id = numbered.assignment_id
  and ac.class_id = numbered.class_id
  and ac.display_order is null;

-- An invoker RPC updates the complete ordering transactionally.
-- A teacher may only modify a class that the teacher manages.
drop policy if exists "teacher updates class assignment order"
  on public.assignment_classes;
create policy "teacher updates class assignment order"
on public.assignment_classes
for update to authenticated
using (public.is_teacher_of_class(class_id))
with check (public.is_teacher_of_class(class_id));

grant update (display_order) on public.assignment_classes to authenticated;

create or replace function public.reorder_class_assignments(
  p_class_id uuid,
  p_assignment_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_link_count integer;
  v_matched_count integer;
begin
  if (select auth.uid()) is null or
     not public.is_teacher_of_class(p_class_id) then
    raise exception 'Teacher access to class required' using errcode = '42501';
  end if;

  if p_assignment_ids is null
     or cardinality(p_assignment_ids) = 0
     or array_position(p_assignment_ids, null) is not null
     or exists (
       select 1 from unnest(p_assignment_ids) as entry(assignment_id)
       group by entry.assignment_id having count(*) > 1
     )
  then
    raise exception 'Invalid assignment ordering' using errcode = '22023';
  end if;

  select count(*) into v_link_count
  from public.assignment_classes ac where ac.class_id = p_class_id;
  select count(*) into v_matched_count
  from public.assignment_classes ac
  where ac.class_id = p_class_id
    and ac.assignment_id = any(p_assignment_ids);

  if v_link_count <> cardinality(p_assignment_ids)
     or v_matched_count <> v_link_count then
    raise exception 'Assignment list has changed, please reload'
      using errcode = '22023';
  end if;

  update public.assignment_classes ac
  set display_order = ranked.position::integer
  from unnest(p_assignment_ids) with ordinality as ranked(assignment_id, position)
  where ac.class_id = p_class_id
    and ac.assignment_id = ranked.assignment_id;
end;
$$;

revoke execute on function public.reorder_class_assignments(uuid,uuid[])
from public, anon;
grant execute on function public.reorder_class_assignments(uuid,uuid[])
to authenticated;

comment on column public.assignment_classes.display_order is
'Display order per receiving class, independent of Gradebook IDs.';
