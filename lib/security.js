/**
 * Segurança de chamadas do AGRONEXO.
 * Origem + Content-Type + tamanho do corpo + limitação distribuída opcional.
 * A restrição de origem NÃO é autenticação: em produção pública, é necessário
 * vincular identidade e cota individual, com Supabase ou serviço equivalente.
 */
const memory=new Map();
const maxMemory=3500;
function deny(res,status,message,extra={}){
 res.setHeader("Cache-Control","no-store");
 return res.status(status).json({error:message,...extra});
}
export function securePost(req,res,maxBytes=3_900_000){
 if(req.method!=="POST"){res.setHeader("Allow","POST");deny(res,405,"Método não permitido.");return false}
 const type=String(req.headers?.["content-type"]||"").toLowerCase();
 if(!type.startsWith("application/json")){deny(res,415,"Envie os dados em JSON.");return false}
 const n=Number(req.headers?.["content-length"]||"0");
 if(!Number.isFinite(n)||n<0||n>maxBytes){deny(res,413,"A requisição é muito grande. Envie um arquivo menor.");return false}
 const origin=String(req.headers?.origin||"");
 const site=String(req.headers?.["sec-fetch-site"]||"");
 if(site==="cross-site"){deny(res,403,"Requisição de outro site bloqueada.");return false}
 if(origin){
  try{
   const u=new URL(origin);
   const host=String(req.headers?.host||"").toLowerCase().split(":")[0];
   if(u.protocol!=="https:"&&host!=="localhost"&&host!=="127.0.0.1"){deny(res,403,"Origem não segura.");return false}
   if(u.hostname.toLowerCase()!==host){deny(res,403,"Origem não autorizada.");return false}
  }catch{deny(res,403,"Origem inválida.");return false}
 }
 if(req.body===null||Array.isArray(req.body)||typeof req.body!=="object"){deny(res,400,"Corpo JSON inválido.");return false}
 return true;
}
const safeIp=req=>String(req.headers?.["x-vercel-forwarded-for"]||req.headers?.["x-forwarded-for"]||req.socket?.remoteAddress||"anon").split(",")[0].trim().slice(0,80);
export async function rateGuard(req,res,{namespace="global",limit=6,windowSec=60}={}){
 const now=Date.now(),ip=safeIp(req);
 const shared=process.env.UPSTASH_REDIS_REST_URL&&process.env.UPSTASH_REDIS_REST_TOKEN;
 if(shared){
  const key="agronexo:ratelimit:"+namespace+":"+ip;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),3000);
  try{
   const url=process.env.UPSTASH_REDIS_REST_URL.replace(/\/$/,"")+"/pipeline";
   const reply=await fetch(url,{method:"POST",
    headers:{Authorization:"Bearer "+process.env.UPSTASH_REDIS_REST_TOKEN,"Content-Type":"application/json"},
    body:JSON.stringify([["INCR",key],["EXPIRE",key,windowSec,"NX"]]),signal:controller.signal});
   if(!reply.ok)throw Error("Redis indisponível");
   const values=await reply.json();
   if(!Array.isArray(values)||!Number.isFinite(Number(values[0]?.result)))throw Error("Rate limit inválido");
   if(Number(values[0].result)>limit){
    res.setHeader("Retry-After",String(windowSec));
    deny(res,429,"Limite temporário de uso. Aguarde antes de enviar uma nova solicitação.");
    return false;
   }
   return true;
  }catch(e){
   // Configuração anunciada como distribuída deve falhar fechada.
   deny(res,503,"Controle de acesso temporariamente indisponível. Tente novamente em instantes.");
   return false;
  }finally{clearTimeout(timer)}
 }
 // Fallback para a fase beta; não garante cota distribuída.
 if(memory.size>maxMemory){for(const [k,v] of memory)if(v.until<now)memory.delete(k);if(memory.size>maxMemory)memory.clear()}
 const k=namespace+":"+ip;let v=memory.get(k);
 if(!v||v.until<now){v={count:0,until:now+windowSec*1000};memory.set(k,v)}
 if(++v.count>limit){res.setHeader("Retry-After",String(Math.ceil((v.until-now)/1000)));deny(res,429,"Limite de solicitações. Aguarde alguns instantes.");return false}
 return true;
}
export function cleanGet(req,res){
 if(req.method!=="GET"){res.setHeader("Allow","GET");deny(res,405,"Método não permitido.");return false}
 return true;
}
