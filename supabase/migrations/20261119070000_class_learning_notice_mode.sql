-- Copeak Classroom: teacher-selectable student learning guidance.
-- Existing class RLS already limits UPDATE to teacher_id = auth.uid()
-- and SELECT to the owner teacher and members of the class.
alter table public.classes
  add column if not exists learning_notice_mode text not null default 'standard';

alter table public.classes
  drop constraint if exists classes_learning_notice_mode_valid;
alter table public.classes
  add constraint classes_learning_notice_mode_valid
  check (learning_notice_mode in ('strict', 'standard', 'gentle'));

comment on column public.classes.learning_notice_mode is
  'Teacher-selected display sensitivity for the student learning status, default standard. Changes advisory wording only.';
