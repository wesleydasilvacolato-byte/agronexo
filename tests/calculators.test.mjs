import test from "node:test";
import assert from "node:assert/strict";
import {CALCS,GROUPS,runCalc} from "../src/calculators.js";
const defaults=calc=>Object.fromEntries(calc.fields.map(f=>[f.key,f.value]));
test("catálogo apresenta 49 ferramentas numeradas e 11 grupos",()=>{
 assert.equal(CALCS.length,49);
 assert.equal(GROUPS.length,11);
 assert.deepEqual(CALCS.map(x=>x.id),Array.from({length:49},(_,i)=>i+1));
 assert.equal(new Set(CALCS.map(x=>x.title)).size,49);
 for(const calc of CALCS)assert.ok(GROUPS.includes(calc.group),calc.title);
});
test("49 cálculos funcionam com os valores de exemplo",()=>{
 for(const calc of CALCS){
  const result=runCalc(calc,defaults(calc));
  assert.equal(result.error,undefined,calc.id+" "+result.error);
  assert.ok(Number.isFinite(result.value),calc.title);
  assert.ok(result.value>=0,calc.title);
  assert.equal(result.unit,calc.unit);
 }
});
test("campos vazios, letras e números negativos são rejeitados",()=>{
 for(const calc of CALCS){
  const first=calc.fields[0].key;
  for(const value of ["","abc",-1,null]){
   const result=runCalc(calc,{...defaults(calc),[first]:value});
   assert.ok(result.error,calc.id+" deveria rejeitar "+value);
  }
 }
});
test("percentuais fisicamente impossíveis são rejeitados",()=>{
 for(const calc of CALCS){
  for(const field of calc.fields){
   if(field.unit!=="%"||field.key==="prnt")continue;
   const result=runCalc(calc,{...defaults(calc),[field.key]:105});
   assert.ok(result.error,calc.id+" aceitou "+field.key+"=105%");
  }
 }
});
test("casos físicos conhecidos das ferramentas principais",()=>{
 const cases=[
  [3,{plantas:50,linha:10,espaco:0.5},100000],
  [39,{taxa:100,vel:12,esp:0.5},1],
  [40,{vazao:1,vel:12,esp:0.5},100],
  [44,{largura:10,vel:6,efic:80},4.8],
  [46,{area:48,cap:4.8},10],
  [48,{et0:5,kc:1.2},6]
 ];
 for(const [id,values,expected] of cases){
  const c=CALCS[id-1],r=runCalc(c,values);
  assert.ok(Math.abs(r.value-expected)<1e-7,"Ferramenta "+id+": "+JSON.stringify(r));
 }
});
test("resultados não calculáveis produzem mensagem de erro",()=>{
 const t=CALCS[2];assert.ok(runCalc(t,{plantas:30,linha:0,espaco:0.5}).error);
 const d=CALCS[29];assert.ok(runCalc(d,{nut:50,teor:0,efic:100}).error);
 const f=CALCS[3];assert.ok(runCalc(f,{falhas:90,duplas:20,total:100}).error);
});
