import {rateGuard} from "../lib/security.js";
/**
 * Busca complementar em páginas públicas da Embrapa (ATER+ Digital).
 * Validação estrita do nome e do domínio para NÃO inventar URLs de bula.
 * Sem indexação/cópia de PDFs nem chamadas a APIs privadas.
 */
const HOST="www.atermaisdigital.cnptia.embrapa.br";
const PATH="/web/controle-de-pragas/w/";
const cache=new Map();
const normalize=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
function slugify(s){return normalize(s).replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,90)}
function matchProduct(html,name){
 const title=(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||"").replace(/<[^>]+>/g," ").trim();
 const canonicalName=normalize(name).replace(/[^a-z0-9]+/g," ").trim();
 const pageName=normalize(title).replace(/[^a-z0-9]+/g," ").trim();
 // Não inferir correspondência de nomes apenas por uma palavra genérica.
 return canonicalName.length>=5&&(pageName===canonicalName||pageName.startsWith(canonicalName+" "));
}
export default async function handler(req,res){
 if(req.method!=="GET")return res.status(405).json({error:"Método não permitido."});
 if(!await rateGuard(req,res,{namespace:"embrapa-bula",limit:20,windowSec:60}))return;
 const raw=String(req.query?.nome||"").trim().slice(0,100),slug=slugify(raw);
 const base="https://"+HOST+PATH;
 res.setHeader("Cache-Control","public, s-maxage=3600");
 if(slug.length<5)return res.status(400).json({error:"Informe uma marca comercial com pelo menos cinco caracteres."});
 if(cache.has(slug)&&Date.now()-cache.get(slug).time<6*3600*1000)return res.status(200).json(cache.get(slug).data);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
 try{
  const response=await fetch(base+slug,{signal:controller.signal,headers:{"Accept":"text/html","User-Agent":"Agronexo/1.2 (Consulta pública de páginas ATER+ Digital)"}});
  if(!response.ok)throw Error("A Embrapa não disponibilizou esta página.");
  const final=new URL(response.url||base+slug);
  if(final.hostname!==HOST||!final.pathname.startsWith(PATH))throw Error("Redirecionamento não autorizado.");
  if(Number(response.headers.get("content-length")||0)>3e6)throw Error("Página muito grande.");
  const html=await response.text();if(html.length>3e6)throw Error("Página muito grande.");
  if(!matchProduct(html,raw))throw Error("Não foi possível confirmar a ficha deste produto.");
  const type=(html.match(/Tipo do Documento[\s\S]{0,550}?Bula/i)||/Bula Agrofit/i.test(html));
  const data={encontrado:true,nome:raw,documentosPossiveis:Boolean(type),
    url:final.href,nota:"Página pública da Embrapa identificada. Confira a versão e data da bula diretamente na página."};
  if(cache.size>100)cache.clear();cache.set(slug,{time:Date.now(),data});
  return res.status(200).json(data);
 }catch(e){
  return res.status(200).json({encontrado:false,nome:raw,
    nota:"Não foi possível confirmar uma ficha da Embrapa para esse produto. Consulte o AGROFIT/MAPA."});
 }finally{clearTimeout(timer)}
}