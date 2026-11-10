-- In cross-posted classes, keep the earliest lesson's original No.
-- Source/primary-class ownership is not a reliable priority: an old
-- cross-post can precede a new assignment created directly in the class.
-- The re-numbering is atomic and never changes gradebook_no or submissions.

update public.assignment_classes
set class_assignment_no = null
where class_assignment_no is not null;

with candidates as (
  select ac.class_id, ac.assignment_id, a.gradebook_no, a.week_no,
         a.audience_type, ac.created_at as linked_at,
         row_number() over (
           partition by ac.class_id, a.gradebook_no
           order by a.week_no, ac.created_at, a.id
         ) as number_rank
  from public.assignment_classes ac
  join public.assignments a on a.id = ac.assignment_id
),
preserved as (
  select class_id, assignment_id, gradebook_no as new_number
  from candidates
  where audience_type is distinct from 'targeted'
    and gradebook_no > 0 and number_rank = 1
),
extras as (
  select c.class_id, c.assignment_id,
         row_number() over (
           partition by c.class_id
           order by c.week_no, c.linked_at, c.assignment_id
         ) as extra_rank
  from candidates c
  left join preserved p
    on p.class_id = c.class_id and p.assignment_id = c.assignment_id
  where c.audience_type is distinct from 'targeted'
    and p.assignment_id is null
),
max_preserved as (
  select class_id, max(new_number) as max_number
  from preserved group by class_id
),
resolved as (
  select class_id, assignment_id, new_number from preserved
  union all
  select e.class_id, e.assignment_id,
         (coalesce(m.max_number, 0) + e.extra_rank)::integer
  from extras e
  left join max_preserved m on m.class_id = e.class_id
)
update public.assignment_classes ac
set class_assignment_no = r.new_number
from resolved r
where ac.class_id = r.class_id and ac.assignment_id = r.assignment_id;
