# Personalized Copeak — Stage 3 hardening

## What was changed
- Student practice now requires non-empty, valid and chronologically ordered release and deadline timestamps.
- Personal introductions use a server-assigned `updated_at` timestamp. Saves compare the last read version before updating; older tabs are blocked from silently overwriting a newer draft.
- If another tab/device saved a different draft, students keep their entered text and see two explicit choices: **load latest saved text** or **overwrite with current text** (each with confirmation).
- Unsynced data is backed up in sessionStorage, scoped by student ID and assignment ID, and restored without depending on browser/device clock accuracy.
- If a draft cannot be loaded because the device is offline, students may continue typing into a local-only draft. A reading launch is blocked until connectivity and remote save are restored.
- The editor is no longer discarded when a second open is attempted. It also listens for network restoration and retries unsynced changes.
- Beginner / Intermediate / Advanced now recommend genuinely different Expression Bank phrasing while teachers retain customized choices.
- An isolated PostgreSQL fixture and RLS assertions were added to the existing pull-request test workflow. The fixture must run only against a throwaway CI database.

## Verification performed
- Static parsing and in-memory tests for the expression generator, three levels, required fields, invalid dates, optimistic updates, and stale saves passed.
- Confirmed on the GitHub development branch: Vercel Git deployment remains disabled.
- Confirmed in the live Supabase project using read-only SQL: the new student draft table and template column are **not** installed.

## Still blocking a real classroom rollout
1. Review and apply `supabase/migrations/20261118211500_self_introduction_drafts.sql` in an explicitly authorized **test** Supabase project, not production.
2. Execute the PostgreSQL RLS test workflow, then test teacher assignment create/edit/duplicate and student save/restore/submit in a browser.
3. Verify Safari/iPad popups, simultaneous tabs, slow network, cross-posted assignments and deadline-edits with multiple test student accounts.
4. IMPORTANT PRIVACY: Copeak currently receives `eng` through a URL query parameter. The Copeak app clears the query after import, but the initial request can still expose personal text to browser/network logs. A coordinated secure text handoff change in the separate `nakacy0919-Git/copeak` repository is required before collecting real student data.
5. Do not merge to `main`, apply database migrations or deploy before these checks pass.

## Release guardrails
- No changes to the existing Text or Dialogue generation paths.
- No production Supabase DDL or data modifications.
- No Vercel deployment or Git deployment setting changes.
- Development branch: `feature/self-introduction-hardening-stage3-20261118`.
