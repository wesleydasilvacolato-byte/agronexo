import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const app=readFileSync(new URL("../src/app.js",import.meta.url),"utf8");
const css=readFileSync(new URL("../style.css",import.meta.url),"utf8");
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
test("navegação principal com cinco botões no celular",()=>{
 assert.match(app,/class="bottom-nav"/);
 for(const route of ["dashboard","calc","bulario","chat"])assert.ok(app.includes('"'+route+'"'),route);
 assert.match(app,/data-action="menu"/);
 assert.match(css,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
});
test("respeita safe-area, teclado virtual e alvos de toque",()=>{
 assert.match(html,/viewport-fit=cover/);
 assert.match(css,/safe-area-inset-bottom/);
 assert.match(css,/keyboard-open/);
 assert.match(css,/min-height:44px/);
 assert.match(css,/overflow-y:auto/);
});
test("interface oferece exclusão local consciente e mensagens de erro dos cálculos",()=>{
 assert.match(app,/data-action="clear-local"/);
 assert.match(app,/id="calc-error"/);
 assert.match(app,/window.confirm/);
});
