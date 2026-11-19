// Cover thumbnails are independent of assignment support images and R2 files.
// They are tiny, non-expiring data URLs stored in the assignment's own RLS row.
const THUMB_RE=/^data:image\/(?:webp|jpeg);base64,[A-Za-z0-9+/=]+$/;
const MAX_DATA_LENGTH=89000;
const MAX_INPUT_BYTES=12*1024*1024;
export function safeThumbnailUrl(value){
  return typeof value==='string'&&value.length<=MAX_DATA_LENGTH&&THUMB_RE.test(value)?value:null;
}
export function validateThumbnailFile(file){
  if(!file)return;
  const allowed=/\.(png|jpe?g|webp)$/i.test(file.name||'') &&
    (!file.type||/^image\/(?:png|jpeg|webp)$/.test(file.type));
  if(!allowed)throw Error('PNG / JPEG / WebP画像を選択してください');
  if(file.size>MAX_INPUT_BYTES)throw Error('元画像は12 MB以下にしてください');
}
export function compressThumbnail(file){
  validateThumbnailFile(file);
  if(!file)return Promise.resolve(null);
  return new Promise((resolve,reject)=>{
    const blobUrl=URL.createObjectURL(file),image=new Image();
    image.onerror=()=>{URL.revokeObjectURL(blobUrl);reject(Error('画像を読み取れませんでした'))};
    image.onload=()=>{
      URL.revokeObjectURL(blobUrl);
      const canvas=document.createElement('canvas');
      const ctx=canvas.getContext('2d',{alpha:false});
      if(!ctx){reject(Error('画像の圧縮に失敗しました'));return}
      try{
        for(const [w,h,q] of [[320,180,.75],[280,158,.65],[240,135,.57],[200,113,.50]]){
          canvas.width=w;canvas.height=h;ctx.fillStyle='#063768';ctx.fillRect(0,0,w,h);
          ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
          const scale=Math.max(w/image.naturalWidth,h/image.naturalHeight);
          const iw=image.naturalWidth*scale,ih=image.naturalHeight*scale;
          ctx.drawImage(image,(w-iw)/2,(h-ih)/2,iw,ih);
          let data=canvas.toDataURL('image/webp',q);
          if(!/^data:image\/webp;base64,/.test(data))data=canvas.toDataURL('image/jpeg',q);
          if(safeThumbnailUrl(data)){resolve(data);return}
        }
        reject(Error('サムネイルを90KB以下に圧縮できませんでした'));
      }catch(e){reject(e)}
    };
    image.src=blobUrl;
  });
}
