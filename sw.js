const CACHE='kosci-shell-v58';
const SHELL=['./','./index.html','./manifest.webmanifest','./icon-192.png?v=2','./icon-512.png?v=2','./icon-maskable-512.png?v=2','./apple-touch-icon.png?v=2','./flags.svg','./logo-banner.webp','./logo-banner.jpg','./logo-banner-en.webp','./logo-banner-en.jpg','./av-donutduck77.webp','./av-donutduck77-128.webp','./av-donutduck77.png','./av-cat.webp','./av-cat-128.webp','./av-cat.png','./av-dog.webp','./av-dog-128.webp','./av-dog.png','./av-panda.webp','./av-panda-128.webp','./av-panda.png','./av-ninja.webp','./av-ninja-128.webp','./av-ninja.png','./av-alien.webp','./av-alien-128.webp','./av-alien.png','./av-fairy.webp','./av-fairy-128.webp','./av-fairy.png','./av-flame.webp','./av-flame-128.webp','./av-flame.png','./av-skull.webp','./av-skull-128.webp','./av-skull.png','./av-butterfly.webp','./av-butterfly-128.webp','./av-butterfly.png','./av-angel.webp','./av-angel-128.webp','./av-angel.png','./av-aether.webp','./av-aether-128.webp','./av-aether.png','./av-wizard.webp','./av-wizard-128.webp','./av-wizard.png'];
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
