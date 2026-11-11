const { timingSafeEqual } = require('node:crypto');

const APPROVAL_URL = 'https://cc.pic-speak-story.com/admin.html?status=pending';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function safeString(value, maxLength = 160) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function isValidWebhookToken(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string' || !expected) return false;
  const given = Buffer.from(provided, 'utf8');
  const wanted = Buffer.from(expected, 'utf8');
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  if (!isValidWebhookToken(req.headers['x-copeak-mail-token'], process.env.COPEAK_MAIL_HOOK_SECRET)) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const teacherId = safeString(body.teacher_id, 40);
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(teacherId)) {
    return res.status(400).json({ ok: false, error: 'invalid_teacher_id' });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  const to = process.env.TEACHER_APPROVAL_EMAIL;
  if (!resendKey || !from || !to) {
    return res.status(503).json({ ok: false, error: 'email_provider_not_configured' });
  }

  const name = safeString(body.display_name) || '氏名未登録';
  const school = safeString(body.school_name) || '学校未登録';
  const prefecture = safeString(body.prefecture, 80) || '未登録';
  const email = safeString(body.email, 254) || '未登録';
  const registeredDate = new Date(body.registered_at);
  const registered = Number.isNaN(registeredDate.getTime())
    ? '未登録'
    : new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(registeredDate) + ' JST';

  const html = `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#172337;max-width:600px;margin:0 auto">
    <h2 style="color:#1c4f78">Copeak Classroom｜先生の新規登録</h2>
    <p>新しい先生のアカウント登録がありました。登録情報を確認して、承認または却下してください。</p>
    <table style="border-collapse:collapse;width:100%">
      <tr><th style="text-align:left;padding:8px;background:#f2f6fa">氏名</th><td style="padding:8px">${escapeHtml(name)}</td></tr>
      <tr><th style="text-align:left;padding:8px;background:#f2f6fa">学校名</th><td style="padding:8px">${escapeHtml(school)}</td></tr>
      <tr><th style="text-align:left;padding:8px;background:#f2f6fa">都道府県</th><td style="padding:8px">${escapeHtml(prefecture)}</td></tr>
      <tr><th style="text-align:left;padding:8px;background:#f2f6fa">メール</th><td style="padding:8px">${escapeHtml(email)}</td></tr>
      <tr><th style="text-align:left;padding:8px;background:#f2f6fa">登録日時</th><td style="padding:8px">${escapeHtml(registered)}</td></tr>
    </table>
    <p style="margin-top:28px"><a href="${APPROVAL_URL}" style="background:#17639a;color:white;padding:12px 20px;border-radius:8px;text-decoration:none">管理者画面で確認する</a></p>
    <p style="font-size:12px;color:#596675">ログイン後、管理者権限で承認できます。このメールのリンクを開くだけでは承認されません。</p>
  </div>`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `copeak-teacher-${teacherId}`
      },
      body: JSON.stringify({
        from, to: [to],
        subject: '【Copeak Classroom】新しい先生の登録申請',
        html,
        text: `Copeak Classroomに新しい先生の登録申請がありました。\n氏名: ${name}\n学校: ${school}\n都道府県: ${prefecture}\nメール: ${email}\n登録日時: ${registered}\n\n管理者画面: ${APPROVAL_URL}\nログイン後に承認してください。`
      }),
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) {
      console.error('[teacher-notification] Provider rejected request:', response.status);
      return res.status(502).json({ ok: false, error: 'email_delivery_failed' });
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[teacher-notification] Request failed:', error?.name || 'unknown');
    return res.status(502).json({ ok: false, error: 'email_delivery_failed' });
  }
};