/* Classroom thumbnail for the assignment list, separate from Support Image.
 * Stores a small WebP/JPEG data URL only after explicit assignment save. */
const MAX_ORIGINAL_BYTES = 5 * 1024 * 1024;
const MAX_DATA_LENGTH = 65000;
const DEFAULT = "./assets/copeak-default-thumbnail.svg";
const $ = id => document.getElementById(id);
let pending = Promise.resolve();
let changed = undefined; // undefined means "keep existing", null means "delete".
let original = null;
let revision = 0;

export function thumbnailUrl(raw) {
  return typeof raw === "string" &&
    raw.length <= MAX_DATA_LENGTH &&
    /^data:image\/(?:webp|jpeg);base64,[a-z0-9+/=]+$/i.test(raw)
      ? raw : DEFAULT;
}

function setStatus(text, kind) {
  const node = $("assignmentThumbnailStatus");
  if (node) { node.textContent = text; node.dataset.kind = kind || "neutral"; }
}

function show(src, filename) {
  const img = $("assignmentThumbnailPreview");
  const valid = thumbnailUrl(src);
  if (img) {
    img.onerror = () => {
      img.onerror = null;
      img.src = DEFAULT;
      setStatus("登録画像を読み込めません。もう一度画像を選択してください。", "error");
    };
    img.src = valid;
  }
  const text = $("assignmentThumbnailFileName");
  if (text) text.textContent = filename || (valid !== DEFAULT ? "登録済み画像を表示しています" : "画像未登録（Copeak標準画像を表示）");
  const remove = $("assignmentThumbnailRemove");
  if (remove) remove.disabled = valid === DEFAULT;
}

async function optimize(file) {
  if (!file || !/^image\/(?:png|jpeg|webp)$/i.test(file.type)) {
    throw new Error("PNG / JPEG / WebP画像を選択してください");
  }
  if (file.size > MAX_ORIGINAL_BYTES) {
    throw new Error("画像は5MB以下を選択してください");
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth > 16000 || img.naturalHeight > 16000) {
      throw new Error("画像のサイズを確認してください");
    }
    const factor = Math.min(1, 240 / img.naturalWidth, 135 / img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * factor));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * factor));
    const ctx = canvas.getContext("2d", {alpha:false});
    if (!ctx) throw new Error("画像を圧縮できませんでした");
    ctx.fillStyle = "#134a84";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    let out = "";
    for (const quality of [0.68,0.52,0.38]) {
      out = canvas.toDataURL("image/webp",quality);
      if (!out.startsWith("data:image/webp")) out = canvas.toDataURL("image/jpeg",quality);
      if (out.length <= MAX_DATA_LENGTH) break;
    }
    if (out.length > MAX_DATA_LENGTH) throw new Error("画像を十分に小さくできません。別の画像をお試しください");
    return out;
  } finally { URL.revokeObjectURL(url); }
}

export function initializeThumbnailEditor() {
  const input = $("assignmentThumbnailInput");
  if (!input || input.dataset.initialized) return;
  input.dataset.initialized = "1";
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    const currentRevision = ++revision;
    const previous = changed === undefined ? original : changed;
    const name = $("assignmentThumbnailFileName");
    if (name) name.textContent = file.name;
    setStatus("画像を圧縮しています…");
    pending = optimize(file).then(src => {
      if (currentRevision !== revision) return;
      changed = src;
      show(src,file.name);
      setStatus("画像を準備しました。課題を保存すると登録されます。","success");
    }).catch(error => {
      if (currentRevision !== revision) return;
      input.value = "";
      changed = previous === original ? undefined : previous;
      show(previous);
      setStatus(error.message,"error");
      throw error;
    });
    pending.catch(() => {}); // saveAssignment still awaits the rejection.
  });
  const uploadButton = document.querySelector('label[for="assignmentThumbnailInput"]');
  if (uploadButton) {
    uploadButton.addEventListener("keydown",e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); }
    });
  }
  $("assignmentThumbnailRemove")?.addEventListener("click", () => {
    revision++;
    pending = Promise.resolve();
    changed = null;
    input.value = "";
    show(null);
    setStatus("画像の削除は「Publish Assignment」で保存すると確定します。");
  });
  show(null);
}

export function restoreThumbnailEditor(src) {
  revision++;
  pending = Promise.resolve();
  changed = undefined;
  original = src || null;
  const input = $("assignmentThumbnailInput");
  if (input) input.value = "";
  show(original);
  setStatus(original ? "登録済みの画像を表示しています。" : "未登録の場合はCopeak標準画像を表示します。",
    original ? "success" : "neutral");
}

export async function assignmentThumbnailForSave() {
  await pending;
  return changed; // caller omits this field unless teacher selected/deleted.
}
