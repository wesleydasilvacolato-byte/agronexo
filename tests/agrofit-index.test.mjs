import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/bulario.js";
const call=async query=>{
 let code=200,value=null;
 const res={setHeader(){return this},status(x){code=x;return this},json(x){value=x;return this}};
 await handler({method:"GET",query},res);
 return {code,value};
};
test("índice oficial foi gerado corretamente",async()=>{
 const {code,value}=await call({status:"1"});
 assert.equal(code,200,JSON.stringify(value));
 assert.equal(value.indexed,true);
 assert.ok(value.uniqueProducts>=100);
 assert.equal(value.verifiedGlifosato,true);
 assert.ok(value.shards>0);
 assert.ok(!Number.isNaN(Date.parse(value.builtAt)));
});
test("API responde pesquisa por ingrediente ativo glifosato",async()=>{
 const r=await call({q:"glifosato"});
 assert.equal(r.code,200,JSON.stringify(r.value));
 assert.ok(r.value.total>0,"índice não encontrou glifosato");
 assert.ok(r.value.results.some(x=>x.ativo.toLowerCase().includes("glifosato")));
 assert.ok(r.value.results.length<=70);
 for(const x of r.value.results){
  assert.equal(typeof x.nome,"string");
  assert.equal(typeof x.registro,"string");
 }
});
test("API responde a registro inexistente sem inventar produtos",async()=>{
 const r=await call({q:"zzzxkq-naoexiste-99999"});
 assert.equal(r.code,200,JSON.stringify(r.value));
 assert.equal(r.value.total,0);
 assert.deepEqual(r.value.results,[]);
});
test("API rejeita busca com menos de 2 caracteres",async()=>{
 const r=await call({q:"g"});assert.equal(r.code,400);
});
