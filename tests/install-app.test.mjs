import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {detectInstallPlatform} from "../src/install-app.js";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("instalador orienta iOS, Android, desktop e reconhece standalone",()=>{
 assert.equal(detectInstallPlatform({agent:"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) AppleWebKit"}),"ios");
 assert.equal(detectInstallPlatform({agent:"Mozilla/5.0 (Linux; Android 16; Pixel) Chrome/140"}),"android");
 assert.equal(detectInstallPlatform({agent:"Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140"}),"desktop");
 assert.equal(detectInstallPlatform({agent:"Mozilla/5.0 (Macintosh) Safari",ipadDesktop:true}),"ios");
 assert.equal(detectInstallPlatform({agent:"Mozilla/5.0 (Android 15)",standalone:true}),"installed");
});
test("regras de instalacao PWA usam recurso oficial e nunca prometem APK/IPA",()=>{
 const code=read("src/install-app.js"),boot=read("src/boot.js");
 assert.match(code,/beforeinstallprompt/);
 assert.match(code,/\.prompt\(\)/);
 assert.match(code,/Adicionar à Tela de Início/);
 assert.match(code,/Instalar aplicativo/);
 assert.match(code,/\/icons\/icon-192\.png/);
 assert.match(boot,/createAppInstaller\(\)/);
 assert.match(boot,/window\.AGRONEXO_INSTALL/);
});
test("o botao Instalar app aparece na plataforma, no painel e no login",()=>{
 const app=read("src/app.js"),admin=read("src/admin.js"),boot=read("src/boot.js");
 assert.match(app,/data-action="install-app"/);
 assert.match(admin,/data-admin-action="install"/);
 assert.match(boot,/data-auth-action="install"/);
});
test("ficheiros da instalacao e logotipo sao fornecidos no build e cache publico",()=>{
 const sw=read("sw.js"),build=read("scripts/build-agrofit.mjs"),index=read("index.html");
 assert.match(sw,/"\/src\/install-app\.js"/);
 assert.match(build,/"src\/install-app\.js"/);
 assert.match(index,/apple-touch-icon/);
 assert.match(index,/icon-192\.png/);
 const manifest=JSON.parse(read("manifest.webmanifest"));
 assert.equal(manifest.display,"standalone");
 assert.ok(manifest.icons.some(x=>x.sizes==="512x512"));
});
test("a interface nao espera a rede para iniciar e o boot nao tem o erro antigo",()=>{
 const app=read("src/app.js"),boot=read("src/boot.js"),pkg=JSON.parse(read("package.json"));
 assert.match(app,/shell\(\);\s*workspaceSync\.start\(\);/);
 assert.doesNotMatch(app,/await workspaceSync\.syncNow\(\)/);
 assert.doesNotMatch(boot,/\:\s*""\)\s*'\)/);
 assert.match(pkg.scripts.build,/test:syntax/);
});
