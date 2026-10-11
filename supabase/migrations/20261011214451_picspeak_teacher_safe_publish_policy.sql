-- Applied to the production Copeak Classroom Supabase. Do not rerun manually.
DROP POLICY "picspeak_teacher_update_draft" ON public.picspeak_assignments;
CREATE POLICY "picspeak_teacher_manage" ON public.picspeak_assignments FOR UPDATE TO authenticated
USING (public.is_teacher_of_class(class_id))
WITH CHECK (public.is_teacher_of_class(class_id) AND (NOT is_published OR due_at>now()));
