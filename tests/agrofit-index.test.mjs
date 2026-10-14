import test from "node:test";
import assert from "node:assert/strict";
import {getManifest,search} from "../api/bulario.js";
test("índice oficial disponível, com timestamp, conteúdo e validação glifosato",()=>{
 const m=getManifest();
 assert.ok(m,"Índice AGROFIT ainda não compilado");
 assert.ok(m.uniqueProducts>=100);
 assert.equal(m.verifiedGlifosato,true);
 assert.ok(m.shards>0);
 assert.ok(!Number.isNaN(Date.parse(m.builtAt)));
});
test("busca glifosato diretamente no índice (sem contornar API protegida)",()=>{
 const r=search("glifosato");
 assert.ok(r.total>0,"índice não encontrou glifosato");
 assert.ok(r.results.some(x=>x.ativo.toLowerCase().includes("glifosato")));
 assert.ok(r.results.length<=70);
 for(const x of r.results)assert.equal(typeof x.registro,"string");
});
test("nome inexistente não inventa registros",()=>{
 const r=search("zzzxkq-naoexiste-99999");
 assert.equal(r.total,0);
 assert.deepEqual(r.results,[]);
});
test("consultas comuns retornam objeto com resultados limitados",()=>{
 for(const term of ["atrazina","2,4-D"]){
  const r=search(term);
  assert.ok(Number.isInteger(r.total));
  assert.ok(Array.isArray(r.results)&&r.results.length<=70);
 }
});
