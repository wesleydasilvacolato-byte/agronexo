import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {seal,unseal,hashPin,matchPin} from "../lib/auth.js";
if(!process.env.AUTH_SESSION_SECRET)process.env.AUTH_SESSION_SECRET=Buffer.alloc(32,7).toString("base64");
const root=file=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
test("sessão e desbloqueio usam envelope criptografado autenticado",()=>{
 const original={userId:"u-test",v:3,expiresAt:Date.now()+360000};
 const encrypted=seal(original);
 assert.ok(!encrypted.includes("u-test"));
 assert.deepEqual(unseal(encrypted),original);
 const tampered=encrypted.slice(0,-3)+"abc";
 assert.equal(unseal(tampered),null);
});
test("PIN utiliza hash com salt, sem persistir 4 dígitos em texto aberto",()=>{
 const a=hashPin("7392"),b=hashPin("7392");
 assert.notEqual(a,b);
 assert.equal(matchPin("7392",a),true);
 assert.equal(matchPin("1739",a),false);
 assert.equal(matchPin("73929",a),false);
 assert.throws(()=>hashPin("abcd"));
});
test("sem cadastro público: landing chama boot protegido e painel requer admin",()=>{
 const index=root("index.html"),boot=root("src/boot.js"),admin=root("api/admin.js"),sql=root("sql/001_auth_admin.sql");
 assert.match(index,/src\/boot\.js/);
 assert.doesNotMatch(index,/src\/app\.js/);
 assert.match(boot,/\/api\/auth/);
 assert.match(admin,/adminOnly:true/);
 assert.match(sql,/row level security/i);
 assert.match(sql,/pin_blocked_until/);
});
test("PWA instala somente arquivos públicos no cache",()=>{
 const manifest=JSON.parse(root("manifest.webmanifest"));
 const sw=root("sw.js"),build=root("scripts/build-agrofit.mjs");
 assert.equal(manifest.display,"standalone");
 assert.ok(manifest.icons.some(x=>x.sizes==="192x192"));
 assert.ok(manifest.icons.some(x=>x.sizes==="512x512"));
 assert.match(sw,/pathname\.startsWith\("\/api\/"\)/);
 assert.match(build,/admin\.html/);
 assert.match(build,/icons/);
});
