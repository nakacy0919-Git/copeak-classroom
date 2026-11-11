# Copeak Classroom — teacher registration notification

A new pending teacher signup triggers a database webhook. The recipient is taken from currently approved members of `public.platform_admins`, joined to `auth.users.email` at signup time; no email address is hardcoded.

- Source database: Copeak Classroom Supabase project `sxcbudhcxiblpdzpgfep`.
- Sender: dedicated `copeak-teacher-signup-notify` function in the existing shared mail-enabled Supabase project `ayrflycncfbvizlfchce`, reusing `RESEND_API_KEY` and `GCC_MAIL_FROM`.
- Secrets are never exposed to the browser or committed to GitHub.
- Source project's Vault secret `copeak_teacher_notify_token` is the private 64-character webhook token. Sender compares its SHA-256 hash; rotate both together.
- Admin review URL: `https://cc.pic-speak-story.com/admin.html` (existing admin authentication and review RPC required).
- Only new `teacher_details` inserts trigger notifications; previous teacher accounts are not backfilled.

When redeploying or changing environments, create the Vault secret and rotate the worker hash before enabling the trigger. Test the mail provider with a `provider_test` event sent to the fixed Resend synthetic test sink.


## Teacher approval confirmation to teachers (2026-11-11)

When an existing platform admin invokes `public.admin_set_teacher_status` and the teacher state **transitions** into `approved`, the Copeak database posts a signed `teacher_approved` event to the same sender.

- Recipient: the approved teacher's current `auth.users.email`, never a hardcoded address.
- Subject: `【Copeak Classroom】先生アカウントの登録が完了しました`.
- Message includes the login URL `https://cc.pic-speak-story.com/` and the administrator-provided LINE support link `https://line.me/ti/p/KXn-mCnjFa`.
- No email is sent on unrelated status updates or repeat approval of an already-approved account.
- A generated approval marker provides an idempotency key if the mail sender retries an HTTP request.
- Mail errors are nonblocking: approval remains successful even if the provider is temporarily unavailable.
- To test without contacting a real teacher, send `teacher_approval_test` with an admin recipient list and the private bearer token. The test email is clearly marked as synthetic.
