# Copeak Classroom Stage 5 — shared-device logout

**Status:** Development only; no production Supabase changes, no Vercel deployments.

- Student-specific Self-Introduction input uses `student_intro_drafts` in Supabase as designed in Stages 2-3 (migration still unapplied in production).
- Unsynced form answers are temporarily backed up in `sessionStorage` per authenticated student + assignment.
- On explicit student logout, `CopeakSelfIntroStudent.clearTemporaryDrafts()` closes the active input sheet, removes pending retry handlers, and clears all `copeak:selfintro:unsynced:v1:*` keys from this tab's temporary store.
- Previously saved answers remain in Supabase and remain editable by the authenticated student on their next sign-in.
- When a student is not signed out but another user inherits the same browser session, application-level browser storage is **not** a secure account boundary. School shared devices should use different browser profiles or clear site data between users.

## Testing / release gates

Run `node --test tests/self-introduction-student.test.cjs tests/self-introduction-builder.test.cjs tests/personal-intro-handoff.test.mjs tests/personal-intro-privacy.test.mjs` on this branch. Test server saves, RLS and two-student account isolation on a disposable database; validate Safari/iPad and Chrome with test data. Do not send real students' names or private descriptions until approved.

Copeak's matching Stage 5 branch: `feature/private-intro-memory-only-stage5-20261119`. Its memory-only lesson approach must be deployed **before** Classroom sender changes are exposed to students (and only with explicit permission).

**Deployment restriction:** do not merge to main, do not deploy Vercel, and do not modify production Supabase without a separate request.
