import test from "node:test";
import assert from "node:assert/strict";
import {securePost,rateGuard} from "../lib/security.js";
const req=(headers={},body={messages:[]})=>({method:"POST",headers:{"content-type":"application/json",host:"agronexo-colato1.vercel.app",origin:"https://agronexo-colato1.vercel.app",...headers},body});
const response=()=>({code:200,body:null,headers:{},setHeader(k,v){this.headers[k]=v;return this},status(n){this.code=n;return this},json(x){this.body=x;return this}});
test("POST JSON legítimo de mesma origem é aceito",()=>{const r=response();assert.equal(securePost(req(),r),true)});
test("bloqueia chamadas cross-site e origens host diferentes",()=>{
 for(const h of [{origin:"https://evil.example"},{origin:"https://agronexo-colato1.vercel.app","sec-fetch-site":"cross-site"}]){
  const r=response();assert.equal(securePost(req(h),r),false);assert.equal(r.code,403);
 }
});
test("bloqueia payload grande, formato inválido e método diferente",()=>{
 const cases=[
  [req({"content-length":"9000000"}),413],
  [req({"content-type":"text/plain"}),415],
  [{...req(),method:"GET"},405],
  [req({},[]),400],
 ];
 for(const [q,status] of cases){const r=response();assert.equal(securePost(q,r),false);assert.equal(r.code,status)}
});
test("limite por IP em beta impede rajadas por minuto",async()=>{
 const q=req({"x-forwarded-for":"192.0.2.47"});const id="test-"+Date.now();
 for(let i=0;i<2;i++){const r=response();assert.equal(await rateGuard(q,r,{namespace:id,limit:2,windowSec:60}),true)}
 const r=response();assert.equal(await rateGuard(q,r,{namespace:id,limit:2,windowSec:60}),false);assert.equal(r.code,429);
});
