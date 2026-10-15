import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolveEntry} from "../src/routing.js";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("administradores devem iniciar no painel administrativo",()=>{
 assert.deepEqual(resolveEntry({pathname:"/",role:"admin"}),{page:null,redirect:"/admin.html"});
 assert.deepEqual(resolveEntry({pathname:"/index.html",role:"admin"}),{page:null,redirect:"/admin.html"});
 assert.deepEqual(resolveEntry({pathname:"/admin.html",role:"admin"}),{page:"admin",redirect:null});
});
test("usuários comuns não devem abrir a interface administrativa",()=>{
 assert.deepEqual(resolveEntry({pathname:"/",role:"user"}),{page:"app",redirect:null});
 assert.deepEqual(resolveEntry({pathname:"/admin.html",role:"user"}),{page:null,redirect:"/"});
});
test("administrador pode entrar no modo operacional sem loop de redirecionamento",()=>{
 assert.deepEqual(resolveEntry({pathname:"/",role:"admin",mode:"plataforma"}),{page:"app",redirect:null});
 const admin=read("src/admin.js");
 assert.match(admin,/modo=plataforma/);
 assert.match(admin,/Painel Administrativo/);
 assert.match(admin,/\/api\/admin/);
});
test("entrada administrativa mantém layout próprio e controle de acesso servidor",()=>{
 const html=read("admin.html"),boot=read("src/boot.js"),api=read("api/admin.js");
 assert.match(html,/<title>Administra[cç][aã]o \| AGRONEXO<\/title>/);
 assert.match(html,/auth\.css/);
 assert.match(boot,/resolveEntry/);
 assert.match(boot,/\.\/admin\.js/);
 assert.match(api,/adminOnly:true/);
 assert.match(api,/requireUnlock|identify\(req,res/);
});
test("build inclui roteamento e service worker evita JavaScript obsoleto",()=>{
 const script=read("scripts/build-agrofit.mjs"),sw=read("sw.js");
 assert.match(script,/"src\/routing\.js"/);
 assert.match(sw,/"\/src\/routing\.js"/);
 assert.match(sw,/fetch\(request,\{cache:"no-store"\}\)/);
});
