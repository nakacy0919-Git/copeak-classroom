'use strict';

const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { mayDownloadAssignmentMedia } = require('./assignment-media-access');

const MAX_BATCH = 40;
const SIGNED_SECONDS = 10 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_KEY = /^classroom-thumbnails\/[0-9a-f-]{36}\/[0-9]+-[0-9a-f-]{36}\.webp$/i;

function send(res, status, body) { return res.status(status).json(body); }
function bearer(req) {
  const token = req.headers?.['x-supabase-access-token'] || '';
  if (token) return String(token).trim();
  const header = req.headers?.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

async function getRows(path, token) {
  const response = await fetch(process.env.SUPABASE_URL + path, {
    headers: {
      apikey: process.env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: 'Bearer ' + token
    }
  });
  if (!response.ok) return null;
  const rows = await response.json();
  return Array.isArray(rows) ? rows : null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Method not allowed' });
  }
  let body = req.body || {};
  try {
    if (typeof body === 'string') body = JSON.parse(body);
    const ids = body.assignmentIds;
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > MAX_BATCH ||
        ids.some(id => typeof id !== 'string' || !UUID.test(id)) ||
        new Set(ids).size !== ids.length) {
      return send(res, 400, { error: 'Provide 1–40 unique assignment UUIDs' });
    }
    const token = bearer(req);
    if (!token) return send(res, 401, { error: 'Authentication required' });

    const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, R2_ENDPOINT, R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env;
    if (![SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, R2_ENDPOINT, R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME].every(Boolean)) {
      throw new Error('Missing R2 or Supabase server configuration');
    }

    const userResponse = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + token }
    });
    if (!userResponse.ok) return send(res, 401, { error: 'Invalid session' });
    const user = await userResponse.json();
    if (!UUID.test(user?.id || '')) return send(res, 401, { error: 'Invalid user' });

    const profiles = await getRows('/rest/v1/profiles?id=eq.' + user.id +
      '&select=role,teacher_status', token);
    if (profiles?.[0]?.role !== 'teacher' || profiles[0].teacher_status !== 'approved') {
      return send(res, 403, { error: 'Approved teacher account required' });
    }

    // All queries carry the teacher's JWT. Supabase RLS remains authoritative.
    const ownedClasses = await getRows('/rest/v1/classes?teacher_id=eq.' +
      user.id + '&select=id', token);
    if (!ownedClasses) return send(res, 403, { error: 'Class access failed' });
    const classIds = new Set(ownedClasses.map(row => row.id));

    const assignments = await getRows('/rest/v1/assignments?id=in.(' +
      ids.join(',') + ')&select=id,class_id,thumbnail_object_key', token);
    if (!assignments) return send(res, 403, { error: 'Assignment lookup failed' });

    const otherIds = assignments
      .filter(a => !classIds.has(a.class_id)).map(a => a.id);
    const sharedClasses = new Map();
    if (otherIds.length) {
      const rows = await getRows('/rest/v1/assignment_classes?assignment_id=in.(' +
        otherIds.join(',') + ')&select=assignment_id,class_id', token);
      if (!rows) return send(res, 403, { error: 'Cross-post access failed' });
      for (const row of rows) {
        if (!sharedClasses.has(row.assignment_id)) sharedClasses.set(row.assignment_id, []);
        sharedClasses.get(row.assignment_id).push(row.class_id);
      }
    }

    const s3 = new S3Client({
      region: 'auto', endpoint: R2_ENDPOINT,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY }
    });
    const urls = {};
    for (const assignment of assignments) {
      const key = assignment.thumbnail_object_key;
      if (!SAFE_KEY.test(key || '') ||
          !mayDownloadAssignmentMedia(assignment, classIds,
            sharedClasses.get(assignment.id) || [])) continue;
      urls[assignment.id] = await getSignedUrl(s3,
        new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }),
        { expiresIn: SIGNED_SECONDS });
    }
    return send(res, 200, { urls, expiresIn: SIGNED_SECONDS });
  } catch (error) {
    console.error('[R2 thumbnail URLs]', error);
    return send(res, 500, { error: 'Thumbnail URLs unavailable' });
  }
};
