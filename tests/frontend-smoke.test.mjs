import test from "node:test";
import assert from "node:assert/strict";

test("interface inicializa e navega por oito módulos sem travar",async()=>{
 const nodes=new Map();
 const events=new Map();
 const element=(name)=>{
  if(!nodes.has(name))nodes.set(name,{innerHTML:"",textContent:"",value:"",style:{},classList:{toggle(){},contains(){return false}},insertAdjacentHTML(){},focus(){},setSelectionRange(){},scrollHeight:0,scrollTop:0});
  return nodes.get(name);
 };
 globalThis.document={
  querySelector:element,
  documentElement:{style:{setProperty(){}}},
  createElement:()=>({remove(){},click(){},style:{}}),
  head:{append(){}},body:{append(){}},
  addEventListener:(name,fn)=>events.set(name,fn)
 };
 globalThis.window={innerHeight:800,visualViewport:{height:800,addEventListener(){}},addEventListener(){},scrollTo(){}};
 globalThis.localStorage={getItem:()=>null,setItem(){}};
 await import("../src/app.js?smoke="+Date.now());
 assert.match(element("#content").innerHTML,/Conhecimento que/);
 const navs=["calc","bulario","chat","projects","quotes","notes","settings","dashboard"];
 for(const name of navs){
  await events.get("click")({target:{
   classList:{contains:()=>false},
   closest:()=>({dataset:{nav:name}})
  }});
  assert.ok(element("#content").innerHTML.length>200,name+" não renderizou");
 }
 await events.get("click")({target:{classList:{contains:()=>false},closest:()=>({dataset:{nav:"calc"}})}});
 assert.match(element("#content").innerHTML,/49 ferramentas/);
 await events.get("click")({target:{classList:{contains:()=>false},closest:()=>({dataset:{calc:"1"}})}});
 assert.match(element("#content").innerHTML,/RESULTADO CALCULADO/);
 assert.match(element("#content").innerHTML,/calc-error/);
});


import {readFileSync} from "node:fs";
import {securePost} from "../lib/security.js";
test("mobile-first: menu inferior, safe-area e navegação adaptada",()=>{
 const js=readFileSync(new URL("../src/app.js",import.meta.url),"utf8");
 const css=readFileSync(new URL("../style.css",import.meta.url),"utf8");
 assert.match(js,/class="bottom-nav"/);
 assert.match(js,/data-action="close-menu"/);
 assert.match(css,/safe-area-inset-bottom/);
 assert.match(css,/keyboard-open/);
 assert.match(css,/min-height:44px/);
});
test("API rejeita origem estranha e requisição excessiva",()=>{
 const r={code:200,setHeader(){return this},status(n){this.code=n;return this},json(){return this}};
 const req={method:"POST",headers:{"content-type":"application/json",host:"agronexo-colato1.vercel.app",origin:"https://outro-site.example"},body:{}};
 assert.equal(securePost(req,r),false);assert.equal(r.code,403);
 const big={...req,headers:{...req.headers,origin:"https://agronexo-colato1.vercel.app","content-length":"9000000"}};
 assert.equal(securePost(big,r),false);assert.equal(r.code,413);
});
