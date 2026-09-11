export async function editorStore<T>(key: string, value?: T): Promise<T | undefined> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('orihani-marketing-editor', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('drafts');
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  });
  try { return await new Promise((resolve, reject) => {
    const tx = db.transaction('drafts', value === undefined ? 'readonly' : 'readwrite');
    const s = tx.objectStore('drafts'); const r = value === undefined ? s.get(key) : s.put(value, key);
    tx.oncomplete = () => resolve(value === undefined ? r.result : value);
    tx.onerror = tx.onabort = () => reject(tx.error || Error('브라우저 저장 공간을 확인해주세요.'));
  }); } finally { db.close(); }
}

// Coalesce pending changes to the same draft while a large video is being saved.
// Keep separate drafts queued so switching episodes cannot discard another edit.
export function draftWriter<T>(persist:(value:T)=>Promise<void>) {
  const pending=new Map<string,T>();let running:Promise<void>|undefined;
  const flush=():Promise<void>=>{
    if(running)return running;
    running=(async()=>{while(pending.size){const [id,value]=pending.entries().next().value!;pending.delete(id);await persist(value);}})().finally(()=>{running=undefined;});
    return running;
  };
  return {write:(id:string,value:T)=>{pending.set(id,value);return flush();},flush};
}
