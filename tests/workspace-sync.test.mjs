import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {diffRecords,mergeRemote,createWorkspaceSync} from "../src/workspace-sync.js";
const base=()=>({projects:[],quotes:[],notes:[],chats:[],calcHistory:[],selectedChat:null});
const item=(id,extras={})=>({id,time:"2026-10-21T00:00:00.000Z",...extras});
const storage=()=>{
 const m=new Map();
 return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};
};
function fakeCloud(){
 const rows=new Map(),history=[];
 const fetcher=async(url,opts)=>{
  assert.equal(url,"/api/workspace");
  if(opts.method==="GET")return {ok:true,json:async()=>({records:[...rows.values()].map(x=>structuredClone(x))})};
  const body=JSON.parse(opts.body);
  assert.ok(body.operations.length<=4);
  for(const op of body.operations){
   const key=op.collection+":"+op.id;
   if(body.mode==="import"&&rows.has(key))continue;
   rows.set(key,{collection:op.collection,item_id:op.id,payload:op.deleted?{}:op.payload,deleted_at:op.deleted?"2026-10-21T00:00:00Z":null,updated_at:"2026-10-21T00:00:00Z"});
   history.push({mode:body.mode,op:structuredClone(op)});
  }
  return {ok:true,json:async()=>({ok:true})};
 };
 return {rows,history,fetcher};
}
function device(cloud,initial=base(),ownStorage=storage()){
 let current=structuredClone(initial);
 const callbacks={
  userId:"test-user",storage:ownStorage,read:()=>current,
  apply:remote=>{current=structuredClone(remote)},status:()=>{},
  fetcher:cloud.fetcher
 };
 const sync=createWorkspaceSync(callbacks);
 return {sync,storage:ownStorage,read:()=>current,
  mutate:fn=>{fn(current);sync.save()}};
}
test("operações detectam inclusões, edições e exclusões por coleção",()=>{
 const initial=base(),next=base();
 initial.projects.push(item("p1",{name:"Antiga"}));
 next.projects.push(item("p1",{name:"Nova"}));
 next.notes.push(item("n1",{title:"Nota"}));
 const ops=diffRecords(initial,next);
 assert.equal(ops.length,2);
 assert.equal(ops.find(x=>x.id==="p1").payload.name,"Nova");
 assert.equal(ops.find(x=>x.id==="n1").collection,"notes");
 assert.deepEqual(diffRecords(next,base()).map(x=>x.deleted),[true,true]);
});
test("primeiro dispositivo importa dados antigos sem perder histórico de cálculos",async()=>{
 const cloud=fakeCloud(),initial=base();
 initial.projects.push(item("prop",{name:"Fazenda inicial"}));
 initial.quotes.push(item("cot",{item:"Adubo",price:129}));
 initial.notes.push(item("nota",{title:"Visita"}));
 initial.chats.push(item("chat",{title:"Sebastião",messages:[{role:"user",content:"Olá"}]}));
 initial.calcHistory.push(item("calculo",{value:90}));
 const a=device(cloud,initial);
 assert.equal(await a.sync.syncNow(),true);
 assert.equal(cloud.rows.size,4);
 assert.deepEqual(a.read().calcHistory,initial.calcHistory);
 assert.equal(a.storage.getItem("agronexo-cloud-v1:test-user:migrated"),"1");
});
test("segundo dispositivo recebe dados novos e exclusões sem ressuscitar itens",async()=>{
 const cloud=fakeCloud(),one=base();
 one.projects.push(item("p1",{name:"Talhão 1"}));
 const a=device(cloud,one),b=device(cloud);
 assert.equal(await a.sync.syncNow(),true);
 assert.equal(await b.sync.syncNow(),true);
 assert.equal(b.read().projects[0].name,"Talhão 1");
 b.mutate(s=>s.notes.push(item("n2",{title:"Colheita"})));
 assert.equal(await b.sync.syncNow(),true);
 assert.equal(await a.sync.syncNow(),true);
 assert.equal(a.read().notes[0].title,"Colheita");
 a.mutate(s=>{s.projects=[]});
 assert.equal(await a.sync.syncNow(),true);
 assert.equal(await b.sync.syncNow(),true);
 assert.equal(b.read().projects.length,0);
 const old=device(cloud,one);
 assert.equal(await old.sync.syncNow(),true);
 assert.equal(old.read().projects.length,0);
});
test("importação inicial não sobrescreve documento já sincronizado",async()=>{
 const cloud=fakeCloud(),initial=base();initial.notes.push(item("n1",{title:"Atualizada na nuvem"}));
 const a=device(cloud,initial);await a.sync.syncNow();
 const stale=base();stale.notes.push(item("n1",{title:"Versão antiga"}));
 const b=device(cloud,stale);await b.sync.syncNow();
 assert.equal(b.read().notes[0].title,"Atualizada na nuvem");
});
test("edição offline mantém a fila e sincroniza após reiniciar no mesmo navegador",async()=>{
 const cloud=fakeCloud(),browserStorage=storage(),a=device(cloud,base(),browserStorage);
 await a.sync.syncNow();
 a.mutate(s=>s.quotes.push(item("q1",{supplier:"Fornecedor"})));
 const offline={fetcher:async()=>{throw Error("Sem rede")},storage:browserStorage};
 let current=structuredClone(a.read());
 const crash=createWorkspaceSync({userId:"test-user",storage:offline.storage,read:()=>current,apply:s=>{current=s},fetcher:offline.fetcher});
 assert.equal(await crash.syncNow(),false);
 assert.ok(JSON.parse(browserStorage.getItem("agronexo-cloud-v1:test-user:queue")).length===1);
 const recovery=device(cloud,current,browserStorage);
 assert.equal(await recovery.sync.syncNow(),true);
 assert.equal(cloud.rows.get("quotes:q1").payload.supplier,"Fornecedor");
 assert.equal(JSON.parse(browserStorage.getItem("agronexo-cloud-v1:test-user:queue")).length,0);
});
test("backend exige identificação da conta no servidor e valida os quatro módulos",()=>{
 const api=readFileSync(new URL("../api/workspace.js",import.meta.url),"utf8");
 const sql=readFileSync(new URL("../sql/003_workspace_sync.sql",import.meta.url),"utf8");
 assert.match(api,/identify\(req,res\)/);
 assert.match(api,/user_id:p\.id/);
 assert.match(api,/ignoreDuplicates:mode==="import"/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/auth\.uid\(\)/);
 assert.match(sql,/references auth\.users\(id\) on delete cascade/);
});
