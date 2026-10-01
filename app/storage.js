/* Local data storage. Legacy data is never deleted by migration. */
window.libraryStorage = (() => {
  const LEGACY = 'little-library-v1', DB = 'little-library-data-v2';
  let db, mode = '', locked = true, busy = false, previous = [];
  const statuses = ['Want to Read', 'Currently Reading', 'Finished'];
  function validate(input) {
    if (!Array.isArray(input)) throw Error('Library must be an array.');
    const ids = new Set();
    return input.map(b => {
      if (!b || typeof b !== 'object' || Array.isArray(b) || typeof b.id !== 'string' || !/^[\w-]{1,128}$/.test(b.id) || ids.has(b.id) || typeof b.title !== 'string' || !b.title.trim()) throw Error('Invalid or duplicate book.');
      ids.add(b.id); const book = {...b};
      for (const key of ['author','note','songTitle','songArtist','songLink','cover','songArt','created']) {
        if (book[key] == null) book[key] = '';
        if (typeof book[key] !== 'string') throw Error('Invalid '+key+'.');
      }
      for (const key of ['cover','songArt']) if (book[key] && !/^data:image\/(?:png|jpeg|jpg|webp|gif|avif|svg\+xml|bmp);base64,/i.test(book[key]) && !/^https?:\/\//i.test(book[key])) throw Error('Invalid image.');
      if (book.songLink && !/^https?:\/\//i.test(book.songLink)) throw Error('Invalid song link.');
      book.status = statuses.includes(book.status) ? book.status : statuses[0];
      book.rating = Number(book.rating || 0);
      if (!Number.isFinite(book.rating) || book.rating < 0 || book.rating > 5 || book.rating*2 % 1) throw Error('Invalid rating.');
      return book;
    });
  }
  function open() {
    return new Promise((resolve,reject) => {
      const r = indexedDB.open(DB,1);
      r.onupgradeneeded = () => {r.result.createObjectStore('books',{keyPath:'id'});r.result.createObjectStore('images');r.result.createObjectStore('meta');};
      r.onsuccess = () => {db=r.result;db.onversionchange=()=>db.close();resolve(db);};
      r.onerror = () => reject(r.error);r.onblocked=()=>reject(Error('Close other library tabs and retry.'));
    });
  }
  function readStore(name) {
    return new Promise((resolve,reject)=>{const tx=db.transaction(name,'readonly'),r=tx.objectStore(name).getAll(),k=tx.objectStore(name).getAllKeys();tx.oncomplete=()=>resolve(new Map(k.result.map((key,i)=>[key,r.result[i]])));tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);});
  }
  function dataURL(blob) {return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(blob);});}
  function imageBlob(value) {const comma=value.indexOf(','),mime=value.slice(5,value.indexOf(';')),bytes=atob(value.slice(comma+1)),a=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)a[i]=bytes.charCodeAt(i);return new Blob([a],{type:mime});}
  async function read() {
    const [records,images,meta] = await Promise.all([readStore('books'),readStore('images'),readStore('meta')]);
    if (!meta.has('order')) {if(records.size || images.size)throw Error('Incomplete library data.');return null;}
    const order=meta.get('order');if(!Array.isArray(order)||order.length!==records.size||new Set(order).size!==order.length)throw Error('Invalid library order.');
    const list=await Promise.all(order.map(async id=>{if(!records.has(id))throw Error('Missing book.');const b={...records.get(id)};for(const key of ['cover','songArt'])if(b[key]?.startsWith('idb:')){const blob=images.get(id+':'+key);if(!(blob instanceof Blob))throw Error('Missing image.');b[key]=await dataURL(blob);}return b;}));
    return validate(list);
  }
  async function write(list, raw, recovery) {
    const old=new Map(previous.map(b=>[b.id,b])),prepared=list.map(b=>{
      const record={...b},assets=[];
      for(const key of ['cover','songArt'])if(b[key].startsWith('data:')){record[key]='idb:'+b.id+':'+key;if(old.get(b.id)?.[key]!==b[key])assets.push([b.id+':'+key,imageBlob(b[key])]);}
      return {record,assets,original:b};
    });
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(['books','images','meta'],'readwrite'),bs=tx.objectStore('books'),im=tx.objectStore('images'),ms=tx.objectStore('meta'),ids=new Set(list.map(b=>b.id));
      if(recovery){ms.put(recovery,'recoverySnapshot-'+Date.now());bs.clear();im.clear();}
      for(const b of previous)if(!ids.has(b.id)){bs.delete(b.id);im.delete(b.id+':cover');im.delete(b.id+':songArt');}
      for(const {record,assets,original} of prepared){if(JSON.stringify(old.get(record.id))!==JSON.stringify(original))bs.put(record);for(const [key,blob]of assets)im.put(blob,key);for(const key of ['cover','songArt'])if(!original[key].startsWith('data:'))im.delete(record.id+':'+key);}
      ms.put(list.map(b=>b.id),'order');ms.put(2,'schema');
      if(raw!=null)ms.put(raw,'legacySnapshot');
      tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('Save aborted.'));tx.onerror=()=>reject(tx.error);
    });
    previous=list;
  }
  async function load() {
    let raw, legacyError;try{raw=localStorage.getItem(LEGACY);}catch(e){legacyError=e;}
    try{await open();mode='indexeddb';}catch(e){mode='localstorage';}
    if(mode==='indexeddb'){
      const existing=await read();if(existing!==null){previous=existing;locked=false;return existing;}
      if(legacyError)throw Error('Previous browser storage is inaccessible. Restore a backup or retry.');
      const legacy=raw==null?[]:validate(JSON.parse(raw));
      await write(legacy,raw);const check=await read();
      if(JSON.stringify(check)!==JSON.stringify(legacy))throw Error('Migration verification failed. Original data remains intact.');
      locked=false;return check;
    }
    if(legacyError)throw Error('Browser storage is unavailable.');
    const legacy=raw==null?[]:validate(JSON.parse(raw));previous=legacy;locked=false;return legacy;
  }
  async function save(input,{restore=false}={}) {
    if(locked&&!restore)throw Error('Library is protected until recovery.');
    if(busy)throw Error('Another save is in progress. Please try again.');
    const list=validate(input);busy=true;
    try{
      if(mode==='indexeddb'){const recovery=locked&&restore?await Promise.all([readStore('books'),readStore('images'),readStore('meta')]):null;await write(list,locked?rawLegacy():undefined,recovery);}
      else if(mode==='localstorage'){
        // A damaged legacy value must survive explicit recovery too.
        if(locked){const raw=localStorage.getItem(LEGACY);if(raw!=null)localStorage.setItem(LEGACY+'-recovery-'+Date.now(),raw);}
        localStorage.setItem(LEGACY,JSON.stringify(list));previous=list;
      }else throw Error('Storage is not ready.');
      locked=false;return list;
    }finally{busy=false;}
  }
  async function recoveryValue(value){if(value instanceof Blob)return {type:'blob',mime:value.type,data:await dataURL(value)};if(value instanceof Map)return {type:'map',entries:await Promise.all([...value].map(async([k,v])=>[k,await recoveryValue(v)]))};if(Array.isArray(value))return Promise.all(value.map(recoveryValue));if(value&&typeof value==='object'){const out={};for(const [k,v]of Object.entries(value))out[k]=await recoveryValue(v);return out;}return value;}
  async function recoveryExport(){const result={format:'my-little-library-recovery',legacy:rawLegacy()};if(db){for(const store of ['books','images','meta']){const entries=await readStore(store);result[store]=await Promise.all([...entries].map(async([key,value])=>[key,await recoveryValue(value)]));}}return result;}
  function rawLegacy(){try{return localStorage.getItem(LEGACY);}catch{return null;}}
  return {load,save,validate,rawLegacy,recoveryExport,get mode(){return mode;},get locked(){return locked;}};
})();
