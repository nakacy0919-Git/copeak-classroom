-- =========================================================
-- Copeak Classroom
-- Fix assignment creation RLS after Cross-posting
-- =========================================================

drop policy if exists
  "assignment participant read"
on public.assignments;


create policy "assignment participant read"
on public.assignments
for select
to authenticated
using (

  -- Primary Class teacher.
  --
  -- This direct check is required during INSERT ... RETURNING.
  -- A newly inserted assignment may not yet be visible through
  -- is_teacher_of_assignment() inside the same SQL statement.
  public.is_teacher_of_class(
    class_id
  )

  or

  -- Teachers of secondary Cross-post classes.
  public.is_teacher_of_assignment(
    id
  )

  or

  (
    is_published

    and

    public.is_student_member_of_assignment_class(
      id,
      auth.uid()
    )

    and

    (
      audience_type = 'class'

      or

      exists (
        select 1
        from public.assignment_targets at
        where
          at.assignment_id = assignments.id
          and at.student_id = auth.uid()
      )
    )
  )

);