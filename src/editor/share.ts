export async function shareFile(file:File) {
  if(navigator.canShare?.({files:[file]})) {
    try{await navigator.share({files:[file],title:file.name});return;}catch(e){if((e as Error).name==='AbortError')return;}
  }
  const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
export function imageFile(data:string,name:string):File {
  const match=data.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  if(!match)throw Error('사진을 다시 불러와주세요.');
  const bytes=Uint8Array.from(atob(match[2]),s=>s.charCodeAt(0));
  return new File([bytes],name+'.'+({ 'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[match[1]]),{type:match[1]});
}
