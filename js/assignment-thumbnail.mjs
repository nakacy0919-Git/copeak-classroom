/* Classroom assignment COVER — independent of the lesson support image. */
let current;
let pending=Promise.resolve();
const DEFAULT="./assets/copeak-default-thumbnail.svg";
const $=id=>document.getElementById(id);
export function thumbnailUrl(raw){
 return typeof raw==="string"&&raw.length<=65000&&/^data:image\/(?:webp|jpeg);base64,[a-z0-9+/=]+$/i.test(raw)?raw:DEFAULT;
}
function show(src){
 const img=$("assignmentThumbnailPreview"),status=$("assignmentThumbnailStatus");
 if(img)img.src=thumbnailUrl(src);
 if(status)status.textContent=src?"✓ サムネイル登録済み":"未登録の場合はCopeakオリジナル画像を表示します";
}
async function optimize(file){
 if(!file||!/^image\/(?:png|jpeg|webp)$/i.test(file.type))throw new Error("PNG / JPEG / WebP画像を選んでください");
 if(file.size>15*1024*1024)throw new Error("15MB以下の画像を指定してください");
 const blob=URL.createObjectURL(file);
 try{
  const img=new Image();img.decoding="async";img.src=blob;await img.decode();
  const factor=Math.min(1,240/img.naturalWidth,135/img.naturalHeight);
  const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.naturalWidth*factor));canvas.height=Math.max(1,Math.round(img.naturalHeight*factor));
  const ctx=canvas.getContext("2d",{alpha:false});if(!ctx)throw new Error("画像の圧縮に失敗しました");
  ctx.fillStyle="#134a84";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
  let out=canvas.toDataURL("image/webp",.58);
  if(!out.startsWith("data:image/webp"))out=canvas.toDataURL("image/jpeg",.58);
  if(out.length>65000)throw new Error("圧縮後の画像が大きすぎます");
  return out;
 }finally{URL.revokeObjectURL(blob)}
}
export function initializeThumbnailEditor(){
 const input=$("assignmentThumbnailInput");if(!input||input.dataset.initialized)return;
 input.dataset.initialized="1";
 input.addEventListener("change",()=>{
  const file=input.files?.[0];if(!file)return;
  const status=$("assignmentThumbnailStatus");if(status)status.textContent="画像を圧縮しています…";
  pending=optimize(file).then(src=>{current=src;show(src)}).catch(e=>{input.value="";if(status)status.textContent=e.message;throw e});
 });
 $("assignmentThumbnailRemove")?.addEventListener("click",()=>{current=null;input.value="";show(null)});
 show(null);
}
export function restoreThumbnailEditor(src){
 current=undefined;
 const input=$("assignmentThumbnailInput");if(input)input.value="";
 pending=Promise.resolve();
 show(src);
}
export async function assignmentThumbnailForSave(){
 await pending;
 return current;
}
