const CACHE="agronexo-static-v2.0-offline";
const ASSETS=["/","/index.html","/admin.html","/style.css","/auth.css","/src/boot.js","/src/offline-access.js","/src/routing.js","/src/workspace-sync.js","/src/app.js","/src/admin.js","/src/calculators.js","/src/brand-assets.js","/icons/icon-192.png","/icons/icon-512.png","/manifest.webmanifest"];
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
  // Apenas o HTML público do aplicativo é guardado (nunca respostas autenticadas).
  // O boot fará a verificação criptográfica do PIN local, sem carregar o painel
  // administrativo nem qualquer dado de API do cache.
  event.respondWith(fetch(request,{cache:"no-store"}).catch(async()=>{
   const cache=await caches.open(CACHE);
   const fallback=url.pathname==="/admin.html"?"/admin.html":"/index.html";
   return (await cache.match(fallback))||new Response(
    '<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:sans-serif;padding:30px;background:#f5f7f0;color:#123c2b"><h1>AGRONEXO</h1><p>Conecte-se uma vez para preparar o aplicativo offline neste aparelho.</p></body></html>',
    {status:503,headers:{"Content-Type":"text/html; charset=utf-8"}});
  }));
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
  }).catch(()=>caches.match(request,{ignoreSearch:true})));
 }
});
