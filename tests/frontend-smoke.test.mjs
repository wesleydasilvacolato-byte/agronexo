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
