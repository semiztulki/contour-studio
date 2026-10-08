/* Local, atomic draft storage. No network requests. */
(function(root){
  'use strict';let database;
  function open(){
    if(database)return database;
    database=new Promise((resolve,reject)=>{
      if(!root.indexedDB){reject(Error('Local storage unavailable'));return;}
      const request=root.indexedDB.open('contour-studio-drafts',1);
      request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('drafts'))request.result.createObjectStore('drafts');};
      request.onerror=()=>reject(request.error||Error('Cannot open draft storage'));
      request.onblocked=()=>reject(Error('Draft storage is blocked'));
      request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();database=null;};resolve(db);};
    });
    database.catch(()=>{database=null;});return database;
  }
  async function transaction(mode,operation){
    const db=await open();return new Promise((resolve,reject)=>{
      const tx=db.transaction('drafts',mode),request=operation(tx.objectStore('drafts'));let result;
      request.onsuccess=()=>{result=request.result;};
      tx.oncomplete=()=>resolve(result);
      tx.onabort=tx.onerror=()=>reject(tx.error||request.error||Error('Cannot store draft'));
    });
  }
  root.ContourDraftStore={read:()=>transaction('readonly',store=>store.get('latest')),write:draft=>transaction('readwrite',store=>store.put(draft,'latest'))};
})(typeof globalThis!=='undefined'?globalThis:this);
