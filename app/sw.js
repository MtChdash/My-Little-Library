/* Change RELEASE whenever any app shell asset changes. */
const RELEASE='cassette-b-1';
const PREFIX='little-library-shell-'+encodeURIComponent(new URL(self.registration.scope).pathname)+'-';
const CACHE=PREFIX+RELEASE;
const SHELL=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./drag.js','./storage.js','./pwa.js','./connectivity.js','./cassette.js','./fonts/fonts.css',...Array.from({length:8},(_,i)=>'./fonts/font-'+i+'.ttf')];
const URLS=new Set(SHELL.map(path=>new URL(path,self.registration.scope).href));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const names=await caches.keys();await Promise.all(names.filter(name=>name.startsWith(PREFIX)&&name!==CACHE).map(name=>caches.delete(name)));await self.clients.claim();})()));
self.addEventListener('message',event=>{
  if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();
  if(event.data?.type==='OFFLINE_STATUS')event.ports[0]?.postMessage({ready:true,release:RELEASE});
});
async function network(request){const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),4000);try{return await fetch(request,{signal:abort.signal});}finally{clearTimeout(timer);}}
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url),scope=new URL(self.registration.scope);
  if(event.request.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
  const navigation=event.request.mode==='navigate';
  if(!navigation&&!URLS.has(url.href))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    // Serve one complete, installed release; do not mix runtime HTML and JS versions.
    const cached=await cache.match(navigation?new URL('./index.html',scope).href:event.request);
    if(cached)return cached;
    try{const response=await network(event.request);if(response.ok)return response;return navigation?(await cache.match(new URL('./index.html',scope).href)||response):response;}
    catch(e){const fallback=navigation?await cache.match(new URL('./index.html',scope).href):null;return fallback||new Response('Open the library online once to prepare it for offline use.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}
  })());
});
