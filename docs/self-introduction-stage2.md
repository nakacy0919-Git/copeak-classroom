# Personalized Copeak — Stage 2 integration review

## What is implemented
- Teacher: a new Self-Introduction lesson type with Beginner / Intermediate / Advanced, compact tabs, field selection, 36 expression patterns (12 fields × 3), sample text, classroom/practice-mode/media controls inherited from Reading Assignment.
- Teacher: `lesson_template` versioned JSONB assignment field; saving, editing and duplicate/cross-post preserve the template. Teacher's browser-local "下書きを保存" remains distinct from assignment Publish.
- Student: personal input sheet, minimal question fields, optional expression selection if teacher enabled it, completion validation, text preview and launch into existing Copeak modes.
- Persistence: per-user/per-assignment `student_intro_drafts` record, debounced auto-upsert plus manual Save, and same-tab session backup of *unsynced* changes only.
- Re-editing: separate "自己紹介を編集" action is visible even after practice deadline. Attempting new reading after deadline remains blocked.
- iPad popups: `about:blank` window is opened synchronously on the user's Start click, then reused after awaiting draft save.
- Correct media: the fixed teacher audio file and sample Japanese translation are not passed to dynamic student passages, avoiding mismatched guidance.

## Database change REQUIRED before browser rollout
Review and apply migration `supabase/migrations/20261118211500_self_introduction_drafts.sql` in the appropriate environment *only after explicit authorization*.
The current live database's `assignments_lesson_type_valid` CHECK allows only `text` / `dialogue`. The staged migration adds `self_intro`, adds `lesson_template jsonb` to `assignments`, and creates `student_intro_drafts` with ownership-checked RLS.

Do **not** deploy the front end while the database is missing this migration; Self-Introduction cannot be saved or loaded correctly without it.
Existing Text / Dialogue assignments must remain unchanged.

## Security and privacy
- Drafts are scoped by `student_id = auth.uid()` and a published/authorized assignment; `anon` has no table grants.
- Teachers do not receive a direct SELECT policy for student answers.
- The form supports a nickname; avoid soliciting full names, addresses or sensitive data. The English text is currently sent to Copeak via the existing `eng` URL query parameter, which can appear in browser history. A follow-up privacy hardening step should move personalized text to a short-lived server-side handoff instead of query parameters.
- Session storage backup is temporary and erased after successful server save; multi-device persistence uses Supabase.
- Edits after assignment deletion or unpublishing are unavailable because the student no longer has assignment access.

## Verification status
- Static JavaScript parsing, student-specific generation, field validation and expression-choice behavior were checked.
- Tests are committed under `tests/self-introduction-builder.test.cjs` and `tests/self-introduction-student.test.cjs`, included in the `npm test` script.
- NOT yet verified: RLS allow/deny execution against migrated DB, live browser UI (PC, iPad, Safari), actual Copeak voice and Direct Sync result save, accessibility, cross-posted student data, offline/reconnect/parallel-tab conflicts.
- CI should be run and inspected after a review PR; no PR or deployment was created by this work.

## Rollout checklist
1. Review schema migration and RLS; apply to an isolated test project.
2. Verify assignment create/edit/duplicate/publish and existing Text/Dialogue on the test project.
3. Verify two student identities cannot read or change one another's drafts.
4. Verify cross-posted class access, grade/nickname inputs, autosave and resume on another device.
5. Verify browser popup handling and per-student Accuracy/WPM submission behavior.
6. Obtain approval separately before applying migration or deploying to production.

## Deployment lock
The existing `vercel.json` contains `"git": {"deploymentEnabled": false}`. Do not change this or trigger a preview/production deployment automatically. All work here stays on `feature/self-introduction-student-stage2-20261118`.
