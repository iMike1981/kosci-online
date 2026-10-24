const CACHE='kosci-shell-v2';
const SHELL=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./icon-maskable-512.png','./apple-touch-icon.png','./flags.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return; // MQTT relay, fonts etc. untouched
  if(req.headers.get('upgrade'))return;
  const isNav=req.mode==='navigate'||url.pathname.endsWith('/')||url.pathname.endsWith('index.html');
  if(isNav||url.searchParams.has('v')){
    e.respondWith(fetch(req,{cache:'no-store'}).then(r=>{if(r.ok&&isNav){const cp=r.clone();caches.open(CACHE).then(c=>c.put('./index.html',cp))}return r}).catch(()=>caches.match('./index.html',{ignoreSearch:true}).then(r=>r||caches.match('./'))));
    return;
  }
  e.respondWith(caches.match(req).then(c=>c||fetch(req).then(r=>{if(r.ok){const cp=r.clone();caches.open(CACHE).then(ca=>ca.put(req,cp))}return r})));
});
