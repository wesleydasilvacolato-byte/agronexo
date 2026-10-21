import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {readFileSync} from "node:fs";
import {authorizeOffline,offlineInfo,unlockOffline,revokeOffline,offlineGrantDurationMs} from "../src/offline-access.js";
const memory=()=>{
 const m=new Map();
 return {getItem:key=>m.get(key)||null,setItem:(key,v)=>m.set(key,String(v)),removeItem:key=>m.delete(key)};
};
const user={id:"80583d4b-4959-40c8-8bea-b381c78542bc",name:"Agro Teste",email:"teste@example.com",role:"admin"};
const now=Date.parse("2026-10-21T12:00:00Z");
test("PIN nao fica armazenado e o acesso permite abrir apenas os proprios registros",async()=>{
 const storage=memory();
 const data=await authorizeOffline({storage,cryptoApi:webcrypto,pin:"7392",user,now});
 assert.equal(data.expiresAt,now+offlineGrantDurationMs);
 const grant=storage.getItem("agronexo-offline-grant-v1");
 assert.ok(!grant.includes('"7392"'));
 assert.ok(!grant.includes("role"));
 assert.equal(offlineInfo(storage,now+1000).id,user.id);
 const unlocked=await unlockOffline({storage,cryptoApi:webcrypto,pin:"7392",now:now+2000});
 assert.equal(unlocked.id,user.id);
 assert.equal(unlocked.role,"user");
});
test("PIN errado nao concede acesso, bloqueia apos cinco tentativas",async()=>{
 const storage=memory();await authorizeOffline({storage,cryptoApi:webcrypto,pin:"8472",user,now});
 for(let i=0;i<4;i++)await assert.rejects(unlockOffline({storage,cryptoApi:webcrypto,pin:"0000",now:now+i}),/incorreto/);
 await assert.rejects(unlockOffline({storage,cryptoApi:webcrypto,pin:"0000",now:now+4}),/15 minutos/);
 await assert.rejects(unlockOffline({storage,cryptoApi:webcrypto,pin:"8472",now:now+100}),/bloqueado/);
 assert.equal((await unlockOffline({storage,cryptoApi:webcrypto,pin:"8472",now:now+16*60000})).id,user.id);
});
test("autorizacao de sete dias expira e logout retira acesso offline",async()=>{
 const storage=memory();await authorizeOffline({storage,cryptoApi:webcrypto,pin:"7539",user,now});
 assert.equal(offlineInfo(storage,now+offlineGrantDurationMs+1),null);
 await assert.rejects(unlockOffline({storage,cryptoApi:webcrypto,pin:"7539",now:now+offlineGrantDurationMs+1}),/Sem autorização/);
 revokeOffline(storage);
 assert.equal(offlineInfo(storage,now+1000),null);
});
test("service worker faz fallback offline apenas para HTML publico e arquivos estaticos",()=>{
 const sw=readFileSync(new URL("../sw.js",import.meta.url),"utf8");
 const boot=readFileSync(new URL("../src/boot.js",import.meta.url),"utf8");
 const app=readFileSync(new URL("../src/app.js",import.meta.url),"utf8");
 const build=readFileSync(new URL("../scripts/build-agrofit.mjs",import.meta.url),"utf8");
 assert.match(sw,/cache\.match\(fallback\)/);
 assert.match(sw,/ignoreSearch:true/);
 assert.match(sw,/pathname\.startsWith\("\/api\/"/);
 assert.match(sw,/"\/src\/offline-access\.js"/);
 assert.match(boot,/unlockOffline\(/);
 assert.match(boot,/authorizeOffline\(/);
 assert.match(boot,/AGRONEXO_RECONNECT/);
 assert.match(app,/!window\.AGRONEXO_OFFLINE/);
 assert.match(app,/enable-offline/);
 assert.match(build,/"src\/offline-access\.js"/);
});
