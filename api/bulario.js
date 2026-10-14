/**
 * Searches build-time compact AGROFIT/MAPA index. No 175MB downloads per query.
 * Source attribution: https://dados.agricultura.gov.br/dataset/sistema-de-agrotoxicos-fitossanitarios-agrofit
 */
import {readFileSync,existsSync} from "node:fs";
import path from "node:path";
import {gunzipSync} from "node:zlib";
const SOURCE="https://dados.agricultura.gov.br/dataset/sistema-de-agrotoxicos-fitossanitarios-agrofit";
const CONSULTA="https://agrofit.agricultura.gov.br/agrofit_cons/principal_agrofit_cons";
const norm=x=>String(x||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const compact=x=>norm(x).replace(/[^a-z0-9]/g,"");
const candidates=[
 path.resolve(process.cwd(),"data/agrofit"),
 path.resolve(process.cwd(),"../data/agrofit"),
 "/var/task/data/agrofit"
];
let folder=candidates.find(p=>existsSync(path.join(p,"manifest.json")));
let manifest=null,loaded=new Map();
function getManifest(){
 if(!folder)folder=candidates.find(p=>existsSync(path.join(p,"manifest.json")));
 if(!folder)return null;
 if(manifest)return manifest;
 try{
  manifest=JSON.parse(readFileSync(path.join(folder,"manifest.json"),"utf-8"));
  return manifest;
 }catch{return null}
}
function getShard(prefix){
 if(!folder||!/^[a-z0-9]{2}$/.test(prefix))return [];
 const p=path.join(folder,prefix+".json.gz");
 if(!existsSync(p))return [];
 if(loaded.has(prefix))return loaded.get(prefix);
 const records=JSON.parse(gunzipSync(readFileSync(p)).toString("utf-8"));
 if(!Array.isArray(records))throw Error("Partição corrompida");
 if(loaded.size>14)loaded.clear();
 loaded.set(prefix,records);
 return records;
}
function search(q){
 const clean=norm(q).trim();
 const tokens=clean.split(/\s+/).map(x=>x.replace(/[^a-z0-9]/g,"")).filter(Boolean);
 const first=tokens.find(x=>x.length>=2)||compact(q);
 const prefix=first.slice(0,2);
 if(prefix.length!==2)return {total:0,results:[]};
 const records=getShard(prefix);
 const found=records.filter(r=>{
  const visible=norm([r.nome,r.registro,r.ativo].join(" "));
  const flat=compact([r.nome,r.registro,r.ativo].join(" "));
  return (tokens.length&&tokens.every(t=>visible.includes(t)||flat.includes(t)))||flat.includes(compact(q));
 });
 const unique=new Map();for(const p of found)unique.set(compact(p.nome)+"|"+compact(p.registro)+"|"+compact(p.ativo),p);
 const sorted=[...unique.values()].sort((a,b)=>{
  const pa=compact(a.nome).startsWith(compact(q))?0:1;
  const pb=compact(b.nome).startsWith(compact(q))?0:1;
  return pa-pb||String(a.nome).localeCompare(String(b.nome),"pt-BR");
 });
 return {total:sorted.length,results:sorted.slice(0,70)};
}
export default async function handler(req,res){
 res.setHeader("Cache-Control","public, s-maxage=180, stale-while-revalidate=300");
 if(req.method!=="GET")return res.status(405).json({error:"Método não permitido."});
 const q=String(req.query?.q||"").trim().slice(0,120);
 const meta=getManifest();
 if(req.query?.status==="1")return res.status(meta?200:503).json({
   indexed:Boolean(meta),builtAt:meta?.builtAt||null,
   uniqueProducts:meta?.uniqueProducts||0,shards:meta?.shards||0,source:SOURCE,
   error:meta?undefined:"O índice oficial do AGROFIT ainda não foi gerado na compilação da plataforma."
 });
 if(q.length<2)return res.status(400).json({error:"Digite pelo menos dois caracteres."});
 if(!meta)return res.status(503).json({
   error:"O índice AGROFIT ainda não foi gerado. A atualização precisa terminar no servidor para liberar as pesquisas.",
   code:"INDEX_NOT_READY",fonte:SOURCE,consultaOficial:CONSULTA
 });
 try{
  const data=search(q);
  return res.status(200).json({...data,backend:"agrofit-index",fonte:SOURCE,consultaOficial:CONSULTA,
   origem:"MAPA/AGROFIT",builtAt:meta.builtAt,license:"CC BY",bula:"Consulte a bula vigente no AGROFIT/MAPA."});
 }catch(err){
  return res.status(503).json({error:"Não foi possível ler o índice AGROFIT da publicação atual.",
   code:"INDEX_READ_FAILURE",fonte:SOURCE,consultaOficial:CONSULTA});
 }
}
