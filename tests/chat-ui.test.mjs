import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {sortedChats,renameChat,pinChat,removeChat,previewChat} from "../src/chat-management.js";
import {renderAssistant,mathHtml} from "../src/chat-format.js";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const chats=[
 {id:"um",title:"Solo",time:"2026-10-10T00:00:00Z",messages:[{role:"assistant",content:"Análise de solo"}]},
 {id:"dois",title:"Soja",time:"2026-10-20T00:00:00Z",messages:[{role:"assistant",content:"Cultura da soja"}]},
 {id:"tres",title:"Milho",time:"2026-10-15T00:00:00Z",pinned:true,messages:[]}
];
test("fixar e desafixar preserva conteúdo e ordena fixadas no topo",()=>{
 const pinned=pinChat(chats,"um");
 assert.equal(pinned.find(x=>x.id==="um").pinned,true);
 assert.deepEqual(sortedChats(pinned).map(x=>x.id),["tres","um","dois"]);
 assert.deepEqual(sortedChats(pinChat(pinned,"um")).map(x=>x.id),["tres","dois","um"]);
 assert.equal(pinned[0].messages[0].content,"Análise de solo");
 assert.equal(chats[0].pinned,undefined);
});
test("renomear não apaga mensagens, valida vazio e limita comprimento",()=>{
 const result=renameChat(chats,"dois","  Análise   de   soja  ");
 assert.equal(result[1].title,"Análise de soja");
 assert.deepEqual(result[1].messages,chats[1].messages);
 assert.throws(()=>renameChat(chats,"dois"," "),/Digite um nome/);
 assert.equal(renameChat(chats,"dois","A".repeat(120))[1].title.length,80);
});
test("exclusão remove apenas conversa indicada; prévia é resumida",()=>{
 assert.deepEqual(removeChat(chats,"dois").map(c=>c.id),["um","tres"]);
 assert.equal(chats.length,3);
 assert.match(previewChat(chats[0]),/Análise/);
});
test("potências, índices, raiz e fração não exibem comandos de origem",()=>{
 const formula="\\frac{PMS \\times sementes}{1000} + x^{2} + C_{solo} + \\sqrt{a}";
 const out=mathHtml(formula);
 assert.match(out,/class="ax-frac"/);
 assert.match(out,/class="ax-root"/);
 assert.match(out,/<sup class="ax-math-script">2<\/sup>/);
 assert.match(out,/<sub class="ax-math-script">solo<\/sub>/);
 assert.match(out,/×/);
 assert.doesNotMatch(out,/\\frac|\\sqrt/);
});
test("Markdown agronômico formata listas e fórmulas",()=>{
 const sample=[
  "## População de plantas",
  "- **Fórmula:** \\(P = \\frac{10000}{E} \\times N\\)",
  "- Use m^2 e kg/ha.",
  "",
  "$$","x^{3} = \\frac{a}{b}","$$"
 ].join("\n");
 const out=renderAssistant(sample);
 assert.match(out,/<h4>/);
 assert.match(out,/<ul>/);
 assert.match(out,/<strong>Fórmula:<\/strong>/);
 assert.match(out,/class="ax-math-block"/);
 assert.match(out,/<sup>2<\/sup>/);
 assert.match(out,/class="ax-frac"/);
});
test("HTML malicioso é escapado sem executar script",()=>{
 const response=renderAssistant('<img src=x onerror=alert(1)>\n\\(x^{<script>alert(1)</script>}\\)');
 assert.doesNotMatch(response,/<script>|<img/);
 assert.match(response,/&lt;img/);
 assert.match(response,/&lt;script&gt;/);
});
test("UI inclui controles, pesquisa e layout de celular e tablet",()=>{
 const app=read("src/app.js"),css=read("style.css");
 const sw=read("sw.js"),build=read("scripts/build-agrofit.mjs");
 for(const name of ["chat-search","chat-more","chat-rename-form","data-chat-command","chat-history-shade","chat-header-new","chat-message-foot"])
  assert.ok(app.includes(name),"Falta "+name);
 assert.match(app,/renderAssistant\(m\.content\)/);
 assert.match(css,/@media\(max-width:1050px\)/);
 assert.match(css,/@media\(max-width:650px\)/);
 assert.match(css,/env\(safe-area-inset-bottom/);
 assert.match(css,/\.ax-math-block/);
 assert.match(css,/\.chat-frame\.show-history/);
 assert.match(sw,/"\/src\/chat-format.js"/);
 assert.match(build,/"src\/chat-format.js"/);
});
