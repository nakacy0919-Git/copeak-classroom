-- READ-ONLY PRODUCTION PREFLIGHT. No INSERT, UPDATE, DDL or migrations.
-- Execute against the CURRENT production Copeak Classroom project before applying migration.
with gates as (
  select
    to_regclass('public.assignments') is not null as assignments_table_exists,
    to_regclass('public.profiles') is not null as profiles_table_exists,
    to_regclass('public.class_members') is not null as membership_table_exists,
    to_regclass('public.assignment_classes') is not null as cross_post_table_exists,
    to_regclass('public.student_intro_drafts') is null as new_drafts_table_not_yet_installed,
    not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'assignments'
        and column_name = 'lesson_template'
    ) as new_template_column_not_yet_installed,
    exists (
      select 1 from pg_constraint c
      where c.conrelid = 'public.assignments'::regclass
        and c.conname = 'assignments_lesson_type_valid'
        and pg_get_constraintdef(c.oid) like '%text%'
        and pg_get_constraintdef(c.oid) like '%dialogue%'
        and pg_get_constraintdef(c.oid) not like '%self_intro%'
    ) as existing_text_dialogue_constraint_matches,
    exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'assignments'
        and cmd = 'SELECT' and policyname = 'assignment participant read'
        and qual like '%is_student_member_of_assignment_class%'
        and qual like '%is_published%'
    ) as assignment_audience_rls_present,
    has_table_privilege('authenticated', 'public.assignments', 'SELECT') as student_assignments_select_grant,
    has_table_privilege('authenticated', 'public.profiles', 'SELECT') as student_profiles_select_grant,
    has_schema_privilege('authenticated', 'public', 'USAGE') as authenticated_public_schema_usage,
    (select relrowsecurity from pg_class where oid = 'public.assignments'::regclass) as assignments_rls_enabled,
    (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass) as profiles_rls_enabled
)
select *,
  (
    assignments_table_exists
    and profiles_table_exists
    and membership_table_exists
    and cross_post_table_exists
    and new_drafts_table_not_yet_installed
    and new_template_column_not_yet_installed
    and existing_text_dialogue_constraint_matches
    and assignment_audience_rls_present
    and student_assignments_select_grant
    and student_profiles_select_grant
    and authenticated_public_schema_usage
    and assignments_rls_enabled
    and profiles_rls_enabled
  ) as ready_for_reviewed_schema_migration
from gates;
