# Self-Introduction — Stage 6 Pre-Release Quality Gate

**Date:** 2026-11-19 (JST)  
**Disposition:** NO GO for public release; development-only review completed with unresolved mandatory integration tests.  
**Repositories:**
- Classroom: `qa/self-introduction-pre-release-stage6-20261119`
- Copeak: `qa/private-intro-pre-release-stage6-20261119`

## Findings addressed in Stage 6

1. **BLOCKER — malformed SQL delimiter.** `supabase/migrations/20261118211500_self_introduction_drafts.sql` contained an invalid single-dollar delimiter for the trigger function. The test fixture `tests/sql/self-introduction-fixture.sql` had the same problem for conditional role creation. Both were repaired to correctly paired PostgreSQL dollar-quoted blocks. Added `tests/self-introduction-migration-qa.test.cjs` to prevent recurrence.
2. **BLOCKER — outdated Copeak regression test.** The old `tests/private_intro_handoff.test.mjs` asserted the obsolete inline receiver. Updated it to exercise the current modular receiver, in-memory handoff and metadata-only storage.
3. **UX — unauthenticated demo could attempt a protected launch.** The student introduction editor now allows demo input/preview while disabling Copeak launch without a valid student account, plus a regression test.
4. **PRIVACY — local custom-lesson editor could rewrite a private lesson shell.** Copeak now refuses that edit path and directs the student back to Classroom; test added.
5. **TEST QUALITY — incorrect RLS occurrence count.** Corrected the migration QA test to count four direct draft-owner checks separately from the profile lookups.

## Checks completed without touching production

| Area | Evidence | Stage 6 status |
| --- | --- | --- |
| JS syntax and module interoperability | Static module parse and in-memory receiver ↔ sender handshake tests | PASS in simulation |
| Student intro generation and grade/field rules | Executed test callbacks from 14 builder tests | PASS in simulation |
| Student draft client save/versions, conflict, logout | Executed test callbacks from student tests | PASS in simulation |
| Private Copeak receiver, origin/nonce/ID validation | Executed receiver test callbacks | PASS in simulation |
| Metadata-only private storage and Direct Sync | Executed storage test callbacks and earlier history write scenario | PASS in simulation |
| SQL migration spelling/quoting, policy shape | Static QA test checks after repairs | PASS (structural only) |
| Legacy Text/Dialogue code paths | Inspected and guarded by static tests | PASS (structural only) |
| Real Node `npm test` / Copeak `node --test` in repository checkout | Repository cannot be cloned in this inspection runtime | NOT RUN |
| Isolated PostgreSQL execution of staged migration + RLS | No disposable running Classroom test database available | NOT RUN |
| Two real student accounts and cross-posting E2E | Requires staging auth / DB / browser | NOT RUN |
| Actual Safari/iPad, Chrome, Edge voice/speech and popup | Requires deployed staging endpoints and physical browser testing | NOT RUN |
| Production data mutations | None | CONFIRMED |
| Vercel deployments from these QA branches | None at time of inspection | CONFIRMED |

**Interpretation:** The passing simulated and structural tests are **not** a substitute for executing the actual GitHub Action, PostgreSQL RLS assertions and browsers. Do not infer classroom production readiness from the simulated check counts.

## Mandatory release blockers

- The live `copeak-classroom` Supabase project still does **not** have `assignments.lesson_template` or `student_intro_drafts`. This is expected because deployment was prohibited; do not apply the pending migration without separate authorization.
- The existing extra `copeak-picspeak-test` Supabase project is inactive and is not a ready, isolated Classroom validation environment.
- There is no confirmed **real** browser run with two authenticated test students, different class audiences, cross-posted assignments, save/re-edit, deadline and Direct Sync submission.
- No GitHub CI run result was available for these review-only QA branches. Confirm the test jobs are green in a genuine runner before release.

## Manual acceptance scenario (must pass with synthetic users)

1. Teacher creates a Self-Introduction assignment (Beginner, then Intermediate and Advanced) and selects fields/expression choices.
2. Student A opens, enters only test data, previews the exact personal passage, saves and edits on a second device. Confirm optimistic-concurrency resolution.
3. Student B on the same device cannot read A's draft and sees a different generated text. Confirm Supabase RLS denies direct cross-user SELECT/INSERT/UPDATE.
4. Student A opens the latest Copeak from Classroom in Safari/iPad and Chrome; confirm no personal text in the navigation URL or persistent Copeak library, while the reading screen displays the full passage.
5. Confirm Read, Paced, Vanish and Shadowing all function and at least one WPM/Accuracy result Direct Syncs back to the correct assignment/student.
6. Log out A; the private Copeak tab closes and unsynced same-tab input disappears. Log in B and repeat.
7. After the deadline, verify no new practice launches but the existing personal introduction can still be edited and saved.
8. Verify unchanged Text and Dialogue creation, class distribution, OCR import, reading and gradebook.
9. Inspect Copeak IndexedDB, Classroom sessionStorage, Direct Sync retry queue and browser history for unexpected personal paragraphs.
10. Have school staff approve retention/privacy guidance for shared devices.

## Release order — do not execute without explicit authorization

1. Review and run real Node/GitHub tests and an isolated PostgreSQL RLS test.
2. Deploy the backward-compatible **Copeak receiver first** to an authorized staging environment; test opening from the Classroom staging origin (must be explicitly allowlisted).
3. Validate the pending Supabase migration in a separate test project, not the live project.
4. Obtain approval for production migration and execute it separately.
5. Deploy the compatible Classroom sender **last** only after staging passes, then verify with test users; coordinate release and rollback.
6. Keep both repositories' `vercel.json` `git.deploymentEnabled=false` until the user explicitly approves any change.

## Privacy caveats

- The individual English passage is not included in the navigation GET URL and is not stored as an English lesson body in Copeak's primary IndexedDB record.
- Score history, assignment/student UUIDs and Direct Sync retry credentials remain device-resident. The device is **not** fully isolated between OS users.
- Browser speech recognition has its own vendor processing model; no fully local/offline privacy claim is made.
- Real student names, addresses, medical or sensitive personal information should not be used for testing.

**Approval:** NOT GRANTED. No production deploy, main merge or production database mutation performed in Stage 6.
