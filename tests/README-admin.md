# Admin inspection checks

Development-only dependencies: `npm install --no-save @electric-sql/pglite playwright`.

```
node --test tests/admin-observability.test.mjs tests/classroom-diagnostics.test.mjs
npx playwright install chromium --only-shell
node tests/admin-ui.test.mjs
```

`ADMIN_TEST_BROWSER` can point to a compatible installed Chromium executable.

The database tests use an isolated PGlite fixture and never modify production data.
The browser tests mock the Supabase client and cover 1280×720 and 390×844, navigation,
pagination, previews, escaping, and page overflow. Production authorization is also
checked independently through the server RPC.

## Behavior

- Admin-only server RPC with explicit membership check; existing table RLS is unchanged.
- Assignment recipients deduplicate across linked classes; current targets and historical
  submissions are distinguished. Latest raw scores are displayed separately from pass
  evaluation (rounded best metrics, overridden by the teacher's manual metrics).
- Diagnostic reports are authenticated client reports, not authoritative server incident
  logs. Only fixed event/reason codes are accepted; no free text, credentials, audio,
  lesson URLs or raw exception messages are stored.
- Classroom queues at most 20 diagnostic reports, expires them after 7 days, and retries
  on startup, online, page restoration, or another failure. It only sends the signed-in
  account's reports. The server deduplicates for a minute and caps 100 reports/user/day.
- The admin list shows reports received in the last 30 days. Older rows for a reporting
  account are removed on that account's next report (no continuous polling or cron).
- Copeak's standalone pending results and Edge Function errors are not collected by
  this Classroom-only change. They must not be inferred from missing submissions.

## Deployment

Apply the additive `admin_observability` migration with the Supabase migration tool.
Do not use `supabase db push`: this project's local and remote migration timestamps differ.
Deploy the frontend after the migration. Old frontends remain compatible with this schema.
No Copeak speech, scoring, or Direct Sync transport files are modified.
