/* Tiny Classroom list thumbnails: R2 objects, not base64 stored in Supabase.
 * The old data-URL column is read-only for backward compatibility. */
const SOURCE_LIMIT = 5 * 1024 * 1024;
const TARGET_BYTES = 12 * 1024;
const LIMIT_BYTES = 24 * 1024;
const DEFAULT = './assets/copeak-default-thumbnail.svg';
const $ = id => document.getElementById(id);
const signedCache = new Map();
let pending = Promise.resolve();
let changed;
let original = null;
let originalKey = null;
let previewBlobUrl = null;
let revision = 0;

export function thumbnailUrl(raw) {
  return typeof raw === 'string' && raw.length <= 65000 &&
    /^data:image\/(?:webp|jpeg);base64,[a-z0-9+/=]+$/i.test(raw)
      ? raw : DEFAULT;
}

function setStatus(message, kind = 'neutral') {
  const node = $('assignmentThumbnailStatus');
  if (node) { node.textContent = message; node.dataset.kind = kind; }
}

function clearBlobPreview() {
  if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
  previewBlobUrl = null;
}

function show(src, filename, registered = false) {
  const img = $('assignmentThumbnailPreview');
  if (img) {
    img.onerror = () => { img.onerror = null; img.src = DEFAULT; };
    img.src = src || DEFAULT;
  }
  const label = $('assignmentThumbnailFileName');
  if (label) label.textContent = filename ||
    (registered ? '登録済みサムネイル（Cloudflare R2）' : '画像未登録（Copeak標準画像を表示）');
  const remove = $('assignmentThumbnailRemove');
  if (remove) remove.disabled = !registered;
}

function encodeWebP(canvas, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
}

async function optimize(file) {
  if (!file || !/^image\/(?:png|jpeg|webp)$/i.test(file.type)) {
    throw new Error('PNG / JPEG / WebP画像を選択してください');
  }
  if (file.size > SOURCE_LIMIT) throw new Error('元画像は5MB以下を選択してください');
  const src = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight ||
        img.naturalWidth > 16000 || img.naturalHeight > 16000) {
      throw new Error('画像のサイズを確認してください');
    }
    const canvas = document.createElement('canvas');
    let smallest = null;
    for (const width of [240, 200, 176, 160, 128]) {
      canvas.width = width;
      canvas.height = Math.round(width * 9 / 16);
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('画像を圧縮できませんでした');
      // Center crop: the listing always displays a 16:9 cover.
      const cropW = Math.min(img.naturalWidth, img.naturalHeight * 16 / 9);
      const cropH = cropW * 9 / 16;
      ctx.drawImage(img, (img.naturalWidth - cropW) / 2,
        (img.naturalHeight - cropH) / 2, cropW, cropH,
        0, 0, canvas.width, canvas.height);
      for (const quality of [0.62, 0.49, 0.37, 0.27]) {
        const blob = await encodeWebP(canvas, quality);
        if (!blob || blob.type !== 'image/webp') {
          throw new Error('この端末ではWebP圧縮に対応していません');
        }
        if (!smallest || blob.size < smallest.size) smallest = blob;
        if (blob.size <= TARGET_BYTES) {
          return new File([blob], 'thumbnail.webp', { type: 'image/webp' });
        }
      }
    }
    if (smallest && smallest.size <= LIMIT_BYTES) {
      return new File([smallest], 'thumbnail.webp', { type: 'image/webp' });
    }
    throw new Error('24KB以下に圧縮できませんでした。別の画像をお試しください');
  } finally {
    URL.revokeObjectURL(src);
  }
}

// A single authorized signing request fetches up to 40 direct-to-R2 image URLs.
export async function loadThumbnailUrls(assignments, sb) {
  const eligible = (assignments || []).filter(a => a?.id && a.thumbnail_object_key);
  const urls = {};
  const now = Date.now();
  const needed = [];
  for (const a of eligible) {
    const cached = signedCache.get(a.id);
    if (cached?.key === a.thumbnail_object_key && cached.expires > now) {
      urls[a.id] = cached.url;
    } else if (!needed.some(x => x.id === a.id)) needed.push(a);
  }
  if (!needed.length) return urls;
  const { data, error } = await sb.auth.getSession();
  if (error || !data?.session?.access_token) return urls;
  for (let offset = 0; offset < needed.length; offset += 40) {
    const chunk = needed.slice(offset, offset + 40);
    const response = await fetch('/api/r2-thumbnail-urls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Supabase-Access-Token': data.session.access_token
      },
      body: JSON.stringify({ assignmentIds: chunk.map(a => a.id) })
    });
    if (!response.ok) throw new Error('サムネイルの表示URLを取得できませんでした');
    const payload = await response.json();
    for (const a of chunk) {
      const url = payload.urls?.[a.id];
      if (typeof url !== 'string' || !url.startsWith('https://')) continue;
      signedCache.set(a.id, { key: a.thumbnail_object_key, url, expires: Date.now() + 7 * 60 * 1000 });
      urls[a.id] = url;
    }
  }
  return urls;
}

export async function hydrateThumbnailCards(assignments, sb, root) {
  const items = (assignments || []).filter(a => a.thumbnail_object_key);
  if (!items.length || !root) return;
  try {
    const urls = await loadThumbnailUrls(items, sb);
    for (const img of root.querySelectorAll('img[data-assignment-thumb-id]')) {
      const id = img.dataset.assignmentThumbId;
      const match = items.find(a => a.id === id);
      if (!match || !urls[id]) continue;
      // Ensure the existing card still describes the same object after async work.
      if (img.dataset.thumbKey !== match.thumbnail_object_key) continue;
      img.onerror = () => { img.onerror = null; img.src = thumbnailUrl(match.thumbnail_data_url); };
      img.src = urls[id];
    }
  } catch (error) {
    console.warn('[Classroom thumbnails] R2 URL lookup failed', error);
  }
}

export function initializeThumbnailEditor() {
  const input = $('assignmentThumbnailInput');
  if (!input || input.dataset.initialized) return;
  input.dataset.initialized = '1';
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    const currentRevision = ++revision;
    const previous = changed;
    setStatus('小さなWebP画像に圧縮しています…');
    pending = optimize(file).then(optimized => {
      if (currentRevision !== revision) return;
      clearBlobPreview();
      changed = optimized;
      previewBlobUrl = URL.createObjectURL(optimized);
      show(previewBlobUrl, file.name + ' · ' + (optimized.size / 1024).toFixed(1) + 'KB', true);
      setStatus('圧縮完了。教材を保存するとCloudflare R2へ登録されます。', 'success');
    }).catch(error => {
      if (currentRevision !== revision) return;
      input.value = '';
      changed = previous;
      if (previous instanceof File && previewBlobUrl) {
        show(previewBlobUrl, previous.name, true);
      } else if (previous === null) {
        show(DEFAULT, '', false);
      } else {
        show(thumbnailUrl(original), '', Boolean(originalKey || thumbnailUrl(original) !== DEFAULT));
      }
      setStatus(error.message || '画像の圧縮に失敗しました', 'error');
      throw error;
    });
    pending.catch(() => {});
  });
  document.querySelector('.assignment-thumbnail-upload-btn')?.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      input.click();
    }
  });
  $('assignmentThumbnailRemove')?.addEventListener('click', () => {
    ++revision;
    pending = Promise.resolve();
    changed = null;
    clearBlobPreview();
    input.value = '';
    show(DEFAULT, '', false);
    setStatus('画像の削除は教材の保存時に確定します。');
  });
  show(DEFAULT);
}

export function restoreThumbnailEditor(assignment, sb) {
  const currentRevision = ++revision;
  clearBlobPreview();
  pending = Promise.resolve();
  changed = undefined;
  original = assignment?.thumbnail_data_url || null;
  originalKey = assignment?.thumbnail_object_key || null;
  const input = $('assignmentThumbnailInput');
  if (input) input.value = '';
  const registered = Boolean(originalKey || thumbnailUrl(original) !== DEFAULT);
  show(thumbnailUrl(original), '', registered);
  setStatus(registered ? '登録済みサムネイルを表示しています。' : '未登録の場合はCopeak標準画像を表示します。',
    registered ? 'success' : 'neutral');
  if (assignment?.id && originalKey && sb) {
    void loadThumbnailUrls([assignment], sb).then(urls => {
      if (currentRevision !== revision || changed !== undefined) return;
      if (urls[assignment.id]) show(urls[assignment.id], '', true);
    }).catch(() => { if (currentRevision === revision) setStatus('登録画像の取得に失敗しました', 'error'); });
  }
}

export async function assignmentThumbnailForSave() {
  await pending;
  return changed; // undefined = keep, null = delete, File = R2 upload
}

export async function uploadThumbnailToR2(file, sb) {
  if (!(file instanceof File) || file.type !== 'image/webp' ||
      file.size <= 0 || file.size > LIMIT_BYTES) {
    throw new Error('サムネイルは24KB以内のWebPで保存してください');
  }
  const { data, error } = await sb.auth.getSession();
  if (error || !data?.session?.access_token) throw new Error('先生として再ログインしてください');
  const signedResponse = await fetch('/api/r2-upload-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Supabase-Access-Token': data.session.access_token
    },
    body: JSON.stringify({
      mediaKind: 'thumbnail',
      fileName: 'thumbnail.webp',
      contentType: file.type,
      fileSize: file.size
    })
  });
  const signed = await signedResponse.json().catch(() => ({}));
  if (!signedResponse.ok || signed.mediaKind !== 'thumbnail' || !signed.uploadUrl ||
      typeof signed.objectKey !== 'string' ||
      !/^classroom-thumbnails\/[0-9a-f-]{36}\/[0-9]+-[0-9a-f-]{36}\.webp$/i.test(signed.objectKey)) {
    throw new Error(signed.error || 'R2アップロードの準備に失敗しました');
  }
  const upload = await fetch(signed.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/webp' },
    body: file
  });
  if (!upload.ok) throw new Error('R2への保存に失敗しました (' + upload.status + ')');
  return { objectKey: signed.objectKey, size: file.size };
}
