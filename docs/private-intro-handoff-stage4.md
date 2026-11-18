# Personalized Copeak: private introduction handoff (Stage 4)

## What changed
The Copeak Classroom student page no longer includes individually generated `lessonText` in the `eng` URL parameter. It passes only launch metadata (assignment ID, student ID, launch nonce, origin, practice mode) through the navigation URL. The student's full English paragraph is sent only after the Copeak tab sends a verified **ready** message using `window.postMessage` with an exact `targetOrigin`.

The Copeak receiver checks `event.source === window.opener`, exact approved Classroom origin, assignment ID, student ID, UUID nonce, payload type and maximum text length. It imports the text as an ordinary **standard** Copeak lesson, preserving Read/Paced/Vanish/Shadow. Only after importing into Copeak's existing lesson store does it acknowledge success back to Classroom.

The existing Text / Dialogue lesson URL pathway is untouched.

## Files
- Classroom: `js/personal-intro-handoff.mjs` and `js/student.js`.
- Copeak: `private-intro-receiver.js`, `app-bundle.js`, `index.html`.
- Tests: `tests/personal-intro-handoff.test.mjs`, `tests/personal-intro-privacy.test.mjs` (Classroom), `tests/private-intro-receiver.test.cjs` (Copeak).

## Release dependencies and safe order
**Do not deploy this feature yet.** It requires changes to two repositories plus the previously staged Supabase migration.

When a separate release is approved:
1. Validate both repositories with local automated tests and manual browsers (Safari/iPad/Chrome/Edge).
2. Deploy the Copeak **receiver first**, because it understands the new message handshake and is backward-compatible with old assignments.
3. Review/apply the Self-Introduction database migration in an isolated test project, then verify teacher/create and student drafts with two different student identities.
4. After successful staging checks and explicit permission, apply the reviewed production DB migration.
5. Deploy the Classroom **sender last** so students never see a new handoff URL that the production Copeak receiver does not understand.
6. Verify Direct Sync score submissions, private assignment targeting, editing after due date, fast and slow connections, popup blocking, and shared-device privacy.

## Privacy limitations
- Personal English text is **not** present in the navigated GET URL; this avoids the earlier direct URL disclosure risk.
- The URL still contains the existing Classroom `classroom_student` identifier (a UUID), classroom assignment ID and a temporary handshake nonce needed for Direct Sync. Do not call the URL entirely free of student-related metadata.
- The personal text is still stored locally by Copeak in its **IndexedDB lesson library** to support re-opening and reading practice. Shared devices must not be treated as private merely because URL text was removed. Data-retention/cleanup and separation across student accounts need a distinct review before general release.
- Private Copeak lessons are explicitly marked, and the existing Quick Share / Classic Share / multiplayer export pathways are blocked for them. The legacy Google Form result payload sends a generic private-text label instead of the student's English text.
- Personal text is sanitized in both the Classroom generator and Copeak receiver to avoid HTML tag injection into the legacy reading view.
- Student drafts remain in Supabase and protected by assignment-aware RLS once the staged migration is approved and installed.
- Avoid providing sensitive information, exact home addresses, or legal full names in student-entered fields.

## Verification performed
- Confirmed manually with direct in-memory exchange between the exact sender and receiver JavaScript: ready -> payload -> import -> ack, correct text, no leaked plaintext in URL and no leftover message listeners.
- Checked syntax of edited `app-bundle.js`, receiver and Classroom `student.js` with JS parser.
- Added sender/receiver automated tests, but the GitHub CI pipeline has **not run** for this development-only branch.
- No Vercel deployment, main-branch merge or production Supabase mutation is authorized by this work.
