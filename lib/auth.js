import {createClient} from "@supabase/supabase-js";
import {randomBytes,createCipheriv,createDecipheriv,scryptSync,timingSafeEqual,createHmac} from "node:crypto";
const SESSION="__Host-ax_session",UNLOCK="__Host-ax_unlock";
export const configured=()=>["SUPABASE_URL","SUPABASE_ANON_KEY","SUPABASE_SERVICE_ROLE_KEY","AUTH_SESSION_SECRET"].every(k=>Boolean(process.env[k]));
export function clients(){
 if(!configured())throw Object.assign(new Error("Conecte Supabase e configure as credenciais de autenticação na Vercel."),{status:503});
 const options={auth:{persistSession:false,autoRefreshToken:false}};
 return {admin:createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,options),anon:createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,options)};
}
function secret(){const b=Buffer.from(process.env.AUTH_SESSION_SECRET||"","base64");if(b.length!==32)throw Object.assign(new Error("AUTH_SESSION_SECRET inválido."),{status:503});return b}
export function seal(object){const iv=randomBytes(12),c=createCipheriv("aes-256-gcm",secret(),iv),body=Buffer.concat([c.update(JSON.stringify(object),"utf8"),c.final()]);return Buffer.concat([iv,c.getAuthTag(),body]).toString("base64url")}
export function unseal(value){try{const b=Buffer.from(String(value||""),"base64url"),d=createDecipheriv("aes-256-gcm",secret(),b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return JSON.parse(Buffer.concat([d.update(b.subarray(28)),d.final()]).toString())}catch{return null}}
export function cookies(req){const data={};for(const item of String(req.headers?.cookie||"").split(";")){const i=item.indexOf("=");if(i>0)data[item.slice(0,i).trim()]=item.slice(i+1).trim()}return data}
export function cookie(res,name,value,maxAge){const old=res.getHeader?.("Set-Cookie")||[];res.setHeader("Set-Cookie",[...(Array.isArray(old)?old:[old]),name+"="+value+"; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age="+maxAge])}
export function clear(res){cookie(res,SESSION,"",0);cookie(res,UNLOCK,"",0)}
export function loginCookie(res,tokens,p){const t={id:p.id,access:tokens.access_token,refresh:tokens.refresh_token,exp:(tokens.expires_at||0)*1000,v:p.security_version,fresh:Date.now()+600000};cookie(res,SESSION,seal(t),1209600);cookie(res,UNLOCK,"",0);return t}
export function unlockCookie(res,p){cookie(res,UNLOCK,seal({id:p.id,v:p.security_version,exp:Date.now()+8*3600000}),28800)}
export function isUnlocked(req,p){const v=unseal(cookies(req)[UNLOCK]);return v?.id===p.id&&v.v===p.security_version&&v.exp>Date.now()}
export function fail(res,e){const code=e.status||500;return res.status(code).json({error:code>=500&&code!==503?"Operação indisponível.":e.message})}
export async function identify(req,res,{requireUnlock=true,adminOnly=false}={}){
 try{
  res.setHeader("Cache-Control","no-store");
  const {admin,anon}=clients(),t=unseal(cookies(req)[SESSION]);
  if(!t?.id||!t.access)return res.status(401).json({error:"Faça login.",code:"LOGIN_REQUIRED"})&&null;
  if(t.exp<Date.now()+30000){
   const r=await anon.auth.refreshSession({refresh_token:t.refresh});
   if(r.error||!r.data.session){clear(res);res.status(401).json({error:"Sessão expirada.",code:"LOGIN_REQUIRED"});return null}
   t.access=r.data.session.access_token;t.refresh=r.data.session.refresh_token;t.exp=r.data.session.expires_at*1000;cookie(res,SESSION,seal(t),1209600)
  }
  const a=await anon.auth.getUser(t.access);
  if(a.error||a.data.user?.id!==t.id){clear(res);res.status(401).json({error:"Sessão inválida.",code:"LOGIN_REQUIRED"});return null}
  const {data:p,error}=await admin.from("agronexo_profiles").select("*").eq("id",t.id).maybeSingle();
  if(error)throw error;
  if(!p?.active||p.security_version!==t.v){clear(res);res.status(403).json({error:"Conta desativada ou acesso revogado.",code:"ACCOUNT_DISABLED"});return null}
  if(adminOnly&&p.role!=="admin"){res.status(403).json({error:"Acesso exclusivo do administrador."});return null}
  if(requireUnlock&&!isUnlocked(req,p)){res.status(423).json({error:"Desbloqueie com seu PIN.",code:p.pin_hash?"PIN_REQUIRED":"PIN_SETUP_REQUIRED"});return null}
  return {p,t,admin,anon}
 }catch(e){fail(res,e);return null}
}
export function hashPin(pin){
 if(!/^\d{4}$/.test(String(pin)))throw Object.assign(new Error("PIN deve ter 4 dígitos."),{status:400});
 const salt=randomBytes(16),pepper=createHmac("sha256",secret()).update(pin).digest();
 return salt.toString("base64url")+":"+scryptSync(pepper,salt,32).toString("base64url")
}
export function matchPin(pin,hash){
 if(!/^\d{4}$/.test(String(pin))||!hash)return false;
 try{const [s,h]=hash.split(":"),salt=Buffer.from(s,"base64url"),expected=Buffer.from(h,"base64url");
 const pepper=createHmac("sha256",secret()).update(pin).digest(),actual=scryptSync(pepper,salt,32);
 return expected.length===actual.length&&timingSafeEqual(expected,actual)}catch{return false}
}
export async function audit(admin,actor,action,target,details={}){await admin.from("agronexo_admin_audit").insert({actor_id:actor,target_id:target,action,details})}
