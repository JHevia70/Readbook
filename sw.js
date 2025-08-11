const CACHE = 'readbook-v1.2';
const ASSETS = [
  './','index.html','app.css','app.js','manifest.webmanifest',
  'favicon.ico','favicon-32.png','icon-192.png','icon-512.png','screenshot.png'
];
self.addEventListener('install', e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))); });
self.addEventListener('activate', e=>{ e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))); });
self.addEventListener('fetch', e=>{
  const url=new URL(e.request.url);
  if(e.request.mode==='navigate'){
    e.respondWith(fetch(e.request).then(res=>{ const copy=res.clone(); caches.open(CACHE).then(c=>c.put('index.html',copy)); return res; }).catch(()=>caches.match('index.html')));
    return;
  }
  if(ASSETS.some(a=>url.pathname.endsWith(a.replace('./','/')))){
    e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(res=>{ const copy=res.clone(); caches.open(CACHE).then(c=>c.put(e.request,copy)); return res; })));
  }
});