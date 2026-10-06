-- =========================================================
-- Copeak Classroom
-- Harden assignment_classes privileges
-- =========================================================

revoke all privileges
on table public.assignment_classes
from anon, authenticated;

grant select
on table public.assignment_classes
to authenticated;