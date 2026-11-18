# Personalized Copeak: Self-Introduction Builder

## Purpose
Teachers configure a personalized self-introduction *without* expanding the existing Reading Assignment editor into an excessively long page. Existing class distribution, practice mode, and supplementary media controls are shared with Text and Dialogue.

## Stage 1 (this branch)
- Lesson Type: three horizontally aligned buttons (Text / Dialogue / Self-Introduction).
- Self-Introduction: compact tabs for Basics / Student Input Fields / Expression Bank.
- Beginner / Intermediate / Advanced recommendations, 12 content fields, three natural expressions per field.
- Teacher-only sample text preview and browser-local draft saving per class.
- Reopening the editor restores the teacher's local draft. Student personal information is not collected.
- Publishing the unfinished lesson type is explicitly blocked.
- No database migrations, student flow, or deployments.

## Stage 2: student personalization and safe distribution
1. Add a versioned `lesson_template` JSONB column to assignments in a reviewed Supabase migration. Update all necessary RLS and read paths, then support save/edit, duplicate and cross-post consistently.
2. Show students a short, mobile-first input wizard with only the fields selected by the teacher. Use nicknames and optional age/location fields; never require an exact address.
3. Persist each student's draft by assignment ID and authenticated student ID. **Students must be able to edit their answers at any time**, including after launching Copeak. Use safe autosave and an explicit Save button, restore on reopening, and avoid losing text when switching devices.
4. Build the English text from validated structured fields and a controlled expression bank. Use correct grammatical forms; provide a preview and a Back to Edit action before practice.
5. Pass each student's generated English to the existing Copeak practice launcher, while keeping distribution and practice mode controls unchanged. Never put private profile details into shared or teacher-visible URLs.
6. Enforce students-can-read-only-their-own-drafts database policies. Test cross-posted classes, assignment edits, and accidental double submissions.
7. Verify teacher preview and student input flows on iPad, phone, and PC before requesting any deployment.

## Stage 3 (future, not implemented)
- Story Theater using section-based scenes.
- Recall / Free Retelling and content coverage. These are deliberately out of scope for Stage 1.

## Release safety
The repository root's `vercel.json` contains `"git": { "deploymentEnabled": false }`. Do not change it or deploy/merge without an explicit separate instruction.
