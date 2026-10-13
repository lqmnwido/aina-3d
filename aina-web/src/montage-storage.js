// Store the user's chosen video locally, not an expiring session-only object URL.
async function database(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('aina-montage',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('videos');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
export async function montageFile(file){
  const db=await database();
  try{
    return await new Promise((resolve,reject)=>{
      const transaction=db.transaction('videos',file?'readwrite':'readonly');
      const store=transaction.objectStore('videos');
      const request=file?store.put(file,'selected'):store.get('selected');
      transaction.oncomplete=()=>resolve(file||request.result);
      transaction.onabort=()=>reject(transaction.error||new Error('Video tidak dapat disimpan.'));
      transaction.onerror=()=>reject(transaction.error);
    });
  }finally{db.close();}
}
