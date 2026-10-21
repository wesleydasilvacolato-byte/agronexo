const CACHE="agronexo-static-v1.9-cloud";
const ASSETS=["/","/index.html","/admin.html","/style.css","/auth.css","/src/boot.js","/src/routing.js","/src/workspace-sync.js","/src/app.js","/src/admin.js","/src/calculators.js","/src/brand-assets.js","/icons/icon-192.png","/icons/icon-512.png","/manifest.webmanifest"];
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()).catch(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
 event.waitUntil(caches.keys().then(names=>Promise.all(names.filter(n=>n!==CACHE).map(n=>caches.delete(n)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=="GET"||url.origin!==self.location.origin||url.pathname.startsWith("/api/"))return;
 // Nenhuma API, conversa, token, PIN ou dado de usuário entra no cache.
 if(request.mode==="navigate"){
  event.respondWith(fetch(request,{cache:"no-store"}).catch(()=>new Response(
    '<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:sans-serif;padding:30px;background:#f5f7f0;color:#123c2b"><h1>AGRONEXO</h1><p>Sem conexão com a internet. Reconecte-se para autenticar e continuar.</p></body></html>',
    {status:503,headers:{"Content-Type":"text/html; charset=utf-8"}})));
  return;
 }
 if(ASSETS.includes(url.pathname)){
  // Sempre buscar o bundle atualizado primeiro, evitando reutilizar a navegação
  // administrativa antiga no Chrome/PWA depois de uma publicação.
  event.respondWith(fetch(request,{cache:"no-store"}).then(response=>{
   if(response.ok){
    const copy=response.clone();
    event.waitUntil(caches.open(CACHE).then(c=>c.put(request,copy)));
   }
   return response;
  }).catch(()=>caches.match(request)));
 }
});
