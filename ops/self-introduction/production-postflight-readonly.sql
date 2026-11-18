-- RUN ONLY AFTER APPROVED PRODUCTION MIGRATION. READ-ONLY POSTFLIGHT.
-- Do not interpret a passing structural check as proof of RLS integration behavior.
with checks as (
  select
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'assignments'
        and column_name = 'lesson_template' and data_type = 'jsonb'
    ) as teacher_template_column_ready,
    exists (
      select 1 from pg_constraint c
      where c.conrelid = 'public.assignments'::regclass
        and c.conname = 'assignments_lesson_type_valid'
        and pg_get_constraintdef(c.oid) like '%self_intro%'
        and pg_get_constraintdef(c.oid) like '%text%'
        and pg_get_constraintdef(c.oid) like '%dialogue%'
    ) as all_lesson_types_supported,
    exists (
      select 1 from pg_constraint c
      where c.conrelid = 'public.assignments'::regclass
        and c.conname = 'assignments_published_self_intro_template_valid'
    ) as published_intro_requires_valid_template,
    to_regclass('public.student_intro_drafts') is not null as private_drafts_table_exists,
    (select relrowsecurity from pg_class
      where oid = 'public.student_intro_drafts'::regclass) as private_drafts_rls_enabled,
    (select count(*) from pg_policies
      where schemaname = 'public'
        and tablename = 'student_intro_drafts'
        and cmd in ('SELECT','INSERT','UPDATE')
        and roles = array['authenticated']::name[]) = 3 as all_three_student_owner_policies,
    not has_table_privilege('anon','public.student_intro_drafts','SELECT') as anonymous_drafts_read_denied,
    not has_table_privilege('anon','public.student_intro_drafts','INSERT') as anonymous_drafts_insert_denied,
    not has_table_privilege('authenticated','public.student_intro_drafts','DELETE') as student_drafts_delete_denied,
    has_table_privilege('authenticated','public.student_intro_drafts','SELECT') as student_drafts_read_grant,
    has_table_privilege('authenticated','public.student_intro_drafts','INSERT') as student_drafts_create_grant,
    has_table_privilege('authenticated','public.student_intro_drafts','UPDATE') as student_drafts_update_grant,
    exists (
      select 1 from pg_trigger t
      where t.tgrelid='public.student_intro_drafts'::regclass
        and t.tgname='set_student_intro_draft_updated_at'
        and not t.tgisinternal and t.tgenabled='O'
    ) as server_side_version_trigger_enabled,
    not exists (
      select 1 from public.assignments
      where lesson_type not in ('text','dialogue','self_intro')
    ) as all_existing_lessons_supported
)
select *,
  (
    teacher_template_column_ready and all_lesson_types_supported
    and published_intro_requires_valid_template and private_drafts_table_exists
    and private_drafts_rls_enabled and all_three_student_owner_policies
    and anonymous_drafts_read_denied and anonymous_drafts_insert_denied
    and student_drafts_delete_denied and student_drafts_read_grant
    and student_drafts_create_grant and student_drafts_update_grant
    and server_side_version_trigger_enabled and all_existing_lessons_supported
  ) as schema_and_grants_postflight_pass
from checks;
