const CACHE='mis-finanzas-integracion-v14';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon.svg','./integracion/bbva-api.js','./integracion/bbva-movimientos.js'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
 self.skipWaiting();
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));
 self.clients.claim();
});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const url=new URL(req.url);
 // Never intercept, cache or replay any banking or authenticated API traffic.
 if(url.origin!==self.location.origin||url.pathname.startsWith('/bank/')||req.headers.has('Authorization'))return;
 event.respondWith(fetch(req).then(response=>{
  if(response.ok && response.type==='basic'){
   const copy=response.clone();
   event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,copy)));
  }
  return response;
 }).catch(()=>caches.match(req)));
});
