/**
 * Generates compact, locally searchable AGROFIT/MAPA index at BUILD time.
 * Does not require a paid/private API key. Never generates fake records.
 * Source: https://dados.agricultura.gov.br/dataset/sistema-de-agrotoxicos-fitossanitarios-agrofit
 */
import {mkdir,writeFile,readdir,rm,copyFile} from "node:fs/promises";
import {readFile} from "node:fs/promises";
import sharp from "sharp";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {gzipSync} from "node:zlib";

const URL_CSV="https://dados.agricultura.gov.br/dataset/6c913699-e82e-4da3-a0a1-fb6c431e367f/resource/d30b30d7-e256-484e-9ab8-cd40974e1238/download/agrofitprodutosformulados.csv";
const output=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../data/agrofit");
const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const compact=v=>norm(v).replace(/[^a-z0-9]/g,"");
const officialPdf=value=>{try{const u=new URL(String(value||"").trim());return u.protocol==="https:"&&(u.hostname==="gov.br"||u.hostname.endsWith(".gov.br"))&&(/\.pdf(?:$|[?#])/i.test(u.href)||/\/bula(?:\/|$)/i.test(u.pathname))?u.href:null}catch{return null}};
function convertRow(row,header){
 const get=(...patterns)=>{for(const p of patterns){const j=header.findIndex(h=>p.test(h));if(j>=0&&row[j]!=null&&String(row[j]).trim())return String(row[j]).trim().slice(0,440)}return ""};
 const nome=get(/nome.*comercial/,/marca.*comercial/,/produto.*formulado.*marca/,/nome.*produto/,/produto.*formulado/,/^produto$/, /nome.*marca/);
 const registro=get(/numero.*registro/,/registro.*mapa/,/^registro$/, /registro/);
 const ativo=get(/ingrediente.*ativo/,/principio.*ativo/,/composicao/,/substancia/);
 if(!nome&&!registro&&!ativo)return null;
 const classe=get(/classe.*agronomica/,/^classe$/, /classe.*uso/,/classe/);
 const titular=get(/titular.*registro/,/empresa.*registrante/,/registrante/,/fabricante/);
 const toxico=get(/classificacao.*toxicologica/,/classe.*toxicologica/);
 const ambiental=get(/classificacao.*ambiental/,/classe.*ambiental/);
 const bula=get(/url.*bula/,/link.*bula/,/^bula/);
 return {nome:nome||"Produto não identificado",registro,ativo,classe,titular,toxico,ambiental,bulaUrl:officialPdf(bula)};
}
function prefixes(record){
 const tokens=new Set();
 for(const v of [record.nome,record.ativo,record.registro]){
  const n=norm(v).replace(/[^a-z0-9]+/g," ").trim();
  for(const t of n.split(/\s+/)){if(t.length>=2)tokens.add(t.slice(0,2))}
  // Handles e.g. 2,4-D -> 24d, while not penalizing normal names.
  for(const part of String(v||"").split(/[;()/|]+/)){
   const merged=compact(part);if(merged.length>=2)tokens.add(merged.slice(0,2));
  }
 }
 return [...tokens].slice(0,22);
}
async function build(){
 const signal=AbortSignal.timeout(8*60*1000);
 const response=await fetch(URL_CSV,{signal,headers:{Accept:"text/csv,*/*","User-Agent":"AGRONEXO/1.3 (indexed public dataset)"}});
 if(!response.ok||!response.body)throw Error("MAPA respondeu HTTP "+response.status+"; não criar índice falso");
 const reader=response.body.getReader();
 const decoder=new TextDecoder("utf-8");
 let fields=[],cell="",quote=false,pendingQuote=false,prevCR=false,headers=null,separator=null,head="",rows=0,bytes=0;
 const unique=new Map();
 const acceptRow=()=>{
  const values=[...fields,cell];fields=[];cell="";
  if(!values.some(x=>x.trim()))return;
  rows++;
  const record=convertRow(values,headers);
  if(!record)return;
  const key=compact(record.nome)+"|"+compact(record.registro)+"|"+compact(record.ativo);
  const previous=unique.get(key);
  if(previous){
   for(const [k,v] of Object.entries(record))if(!previous[k]&&v)previous[k]=v;
  }else unique.set(key,record);
  if(unique.size>350000)throw Error("Limite de segurança: dados oficiais têm mais de 350.000 registros únicos; revisar esquema");
 };
 function accept(str){
  for(let i=0;i<str.length;i++){
   const ch=str[i];
   if(prevCR){prevCR=false;if(ch==="\n")continue}
   if(headers===null){
    if(ch==="\n"||ch==="\r"){
     const headerLine=head.replace(/^\uFEFF/,"");separator=(headerLine.match(/;/g)||[]).length>=(headerLine.match(/,/g)||[]).length?";":",";
     headers=headerLine.split(separator).map(h=>norm(h.replace(/^"|"$/g,"").trim()));
     if(headers.length<2)throw Error("Cabeçalho AGROFIT inválido: "+headerLine.slice(0,200));
     console.log("[agrofit] colunas:",headers.slice(0,22).join(" | "));
     if(ch==="\r")prevCR=true;
     head="";continue;
    }
    head+=ch;if(head.length>10000)throw Error("Cabeçalho AGROFIT excedeu 10 KB");
    continue;
   }
   if(quote){
    if(pendingQuote){
     pendingQuote=false;if(ch==='"'){cell+='"';continue}
     quote=false;
    }else if(ch==='"'){pendingQuote=true;continue}
    else {cell+=ch;continue}
   }
   if(ch==='"')quote=true;
   else if(ch===separator){fields.push(cell);cell=""}
   else if(ch==="\n"||ch==="\r"){acceptRow();if(ch==="\r")prevCR=true}
   else cell+=ch;
   if(cell.length>1000000)throw Error("Campo muito grande: CSV malformado");
  }
 }
 try{
  while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;
   if(bytes>800*1024*1024)throw Error("Arquivo do MAPA excede 800MB");
   accept(decoder.decode(value,{stream:true}));
  }
  accept(decoder.decode());
  if(headers&&(cell.length||fields.length))acceptRow();
 }finally{try{await reader.cancel()}catch{}}
 if(unique.size<50)throw Error("AGROFIT retornou poucos registros: "+unique.size+"; não gerar catálogo incompleto");
 await mkdir(output,{recursive:true});
 const groups=new Map();
 for(const record of unique.values()){
  for(const prefix of prefixes(record)){
   let values=groups.get(prefix);
   if(!values){values=[];groups.set(prefix,values)}
   values.push(record);
  }
 }
 // Verificação real do índice. Jamais aprovar uma compilação com dados
 // aparentemente válidos mas incapazes de localizar o ativo principal.
 const glyph=(groups.get("gl")||[]).some(r=>norm(r.ativo).includes("glifosato"));
 const formatted=[...unique.values()].filter(r=>r.nome!=="Produto não identificado").length;
 if(!glyph)throw Error("Índice sem o ingrediente ativo glifosato: conferir a coluna de ingrediente ativo do CSV oficial.");
 if(formatted<100)throw Error("Poucos nomes comerciais identificados: "+formatted+"; revisar o esquema do CSV.");
 let outputBytes=0;
 const names=new Set();
 for(const [prefix,records] of groups){
  if(!/^[a-z0-9]{2}$/.test(prefix))continue;
  const buffer=gzipSync(Buffer.from(JSON.stringify(records)),{level:8});
  const name=prefix+".json.gz";await writeFile(path.join(output,name),buffer);names.add(name);outputBytes+=buffer.byteLength;
 }
 const manifest={version:1,source:URL_CSV,builtAt:new Date().toISOString(),uniqueProducts:unique.size,rows,downloadBytes:bytes,shards:names.size,indexBytes:outputBytes,verifiedGlifosato:glyph,kind:"MAPA/AGROFIT public products (not individual bulletins)"};
 await writeFile(path.join(output,"manifest.json"),JSON.stringify(manifest));
 for(const name of await readdir(output))if(name.endsWith(".json.gz")&&!names.has(name))await rm(path.join(output,name));
 console.log("[agrofit] index ready",JSON.stringify(manifest));
}
// Vercel "Other" framework uses public/ as the static output after a build.
const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const publicRoot=path.join(projectRoot,"public");
async function prepareStatic(){
 await mkdir(path.join(publicRoot,"src"),{recursive:true});
 for(const [from,to] of [
  ["index.html","index.html"],
  ["admin.html","admin.html"],
  ["style.css","style.css"],
  ["auth.css","auth.css"],
  ["manifest.webmanifest","manifest.webmanifest"],
  ["sw.js","sw.js"],
  ["src/boot.js","src/boot.js"],
  ["src/admin.js","src/admin.js"],
  ["src/app.js","src/app.js"],
  ["src/calculators.js","src/calculators.js"],
  ["src/brand-assets.js","src/brand-assets.js"]
 ])await copyFile(path.join(projectRoot,from),path.join(publicRoot,to));
 const brandCode=await readFile(path.join(projectRoot,"src/brand-assets.js"),"utf8");
 const icon=brandCode.match(/icon:"data:image\\/webp;base64,([^"]+)"/);
 if(!icon)throw Error("Ícone da identidade oficial Agronexo não encontrado.");
 const source=Buffer.from(icon[1],"base64");
 await mkdir(path.join(publicRoot,"icons"),{recursive:true});
 for(const n of [192,512]){
  await sharp(source).resize(n,n,{fit:"contain",background:"#123C2B"}).png().toFile(path.join(publicRoot,"icons","icon-"+n+".png"));
 }
 console.log("[agrofit] interface, autenticação, painel e ícones PWA preparados em public/");
}
await prepareStatic();
try{await build()}catch(err){
 console.error("[agrofit] índice oficial não gerado:",err?.message||err);
 // Não liberar produção com bulário vazio.
 process.exitCode=1;
}
