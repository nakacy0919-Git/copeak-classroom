# Stage 4 — Private Personalized Introduction Handoff

## Linked development branches
- Classroom: `nakacy0919-Git/copeak-classroom` → `feature/private-self-intro-handoff-stage4-20261118`
- Copeak: `nakacy0919-Git/copeak` → `feature/classroom-private-intro-handoff-20261118`

Both repositories must be tested and released together. **Do not deploy either branch by itself.**

## New transport
1. Student fills the teacher-configured introduction; all draft content is saved under the student's authenticated assignment.
2. Classroom opens an empty `about:blank` popup in the original click handler (iPad/Safari safe).
3. Classroom prepares a URL containing assignment/student/nonce metadata but **no personal English text**.
4. Copeak loads, initializes IndexedDB, verifies a trusted Classroom origin, assignment UUID, student UUID and nonce, and posts `copeak-classroom-intro-ready` back to the opener.
5. Classroom checks `event.origin`, `event.source`, assignment and nonce; only then posts `copeak-classroom-intro-payload` with the English text.
6. Copeak imports that text into the existing lesson engine from an **in-memory URLSearchParams object**. It never assigns the passage to the browser URL or history. It sends an acknowledgement after import.
7. Classroom awaits the acknowledgement before dismissing the form. On error it closes the popup and keeps the student's original answers.

The normal Text/Dialogue URL transport and the existing Direct Sync score return path are unchanged.

## Security checks
- Origin allowlist on receiver: `https://cc.pic-speak-story.com`, `https://copeak-classroom.vercel.app`. Changes to deployment domains require an explicit reviewed update.
- Both sides verify the assignment and one-time nonce. Both also validate student ID.
- Text length is bounded to 6,000 characters; invalid or empty payloads are rejected.
- The transport listener accepts only one successful payload, ignores unsolicited messages and expires after 60 seconds.
- Classroom uses `crypto.randomUUID()` (already used by Direct Sync) as the one-time nonce.

## Important remaining privacy limitation
The passage is removed from the URL but **Copeak's existing lesson system persists the imported text in browser IndexedDB**. On a shared school device, the stored lesson may be locally visible to another user. This must be addressed (storage isolation, private-session cleanup and/or safe on-demand reload) and tested **before using real student names or sensitive information**. Recommend nicknames and do not collect exact addresses.

## Test and release prerequisites
- Automated Classroom handshake checks in `tests/personal-intro-handoff.test.mjs`, included in `npm test`.
- Copeak receiver contract checks in `tests/private_intro_handoff.test.mjs` (run `node --test tests/private_intro_handoff.test.mjs`).
- Still needed: actual PC/Safari/iPad handoff, existing Text/Dialogue smoke tests, Direct Sync submission verification, and isolated Supabase RLS tests.
- Schema migration `supabase/migrations/20261118211500_self_introduction_drafts.sql` is **not applied**. Test it on an isolated Supabase project with approval before any production change.
- Both `vercel.json` files retain `git.deploymentEnabled: false`.
- No production deployments, no merge into `main`, no database mutations in this stage.
