# Copeak Classroom — teacher registration notification

A new pending teacher signup triggers a database webhook. The recipient is taken from currently approved members of `public.platform_admins`, joined to `auth.users.email` at signup time; no email address is hardcoded.

- Source database: Copeak Classroom Supabase project `sxcbudhcxiblpdzpgfep`.
- Sender: dedicated `copeak-teacher-signup-notify` function in the existing shared mail-enabled Supabase project `ayrflycncfbvizlfchce`, reusing `RESEND_API_KEY` and `GCC_MAIL_FROM`.
- Secrets are never exposed to the browser or committed to GitHub.
- Source project's Vault secret `copeak_teacher_notify_token` is the private 64-character webhook token. Sender compares its SHA-256 hash; rotate both together.
- Admin review URL: `https://cc.pic-speak-story.com/admin.html` (existing admin authentication and review RPC required).
- Only new `teacher_details` inserts trigger notifications; previous teacher accounts are not backfilled.

When redeploying or changing environments, create the Vault secret and rotate the worker hash before enabling the trigger. Test the mail provider with a `provider_test` event sent to the fixed Resend synthetic test sink.
