import {clients,configured,identify,loginCookie,unlockCookie,isUnlocked,clear,hashPin,matchPin,fail} from "../lib/auth.js";
import {securePost,rateGuard} from "../lib/security.js";
export default async function handler(req,res){
 res.setHeader("Cache-Control","no-store");
 if(req.method==="GET"){
  if(!configured())return res.status(503).json({configured:false,error:"Banco e autenticação ainda não conectados."});
  const c=await identify(req,res,{requireUnlock:false});if(!c)return;
  const {p,admin}=c,locked=!isUnlocked(req,p);
  if(!locked){const last=Date.parse(p.last_seen_at||0);if(Date.now()-last>60000)await admin.from("agronexo_profiles").update({last_seen_at:new Date().toISOString()}).eq("id",p.id)}
  return res.status(200).json({loggedIn:true,locked,pinSet:Boolean(p.pin_hash),user:{id:p.id,name:p.display_name,email:p.email,role:p.role}});
 }
 if(!securePost(req,res,16000))return;
 const action=String(req.body?.action||"");
 if(!["login","pin","logout"].includes(action))return res.status(400).json({error:"Ação inválida."});
 if(action==="logout"){clear(res);return res.status(200).json({ok:true})}
 if(!configured())return res.status(503).json({error:"A autenticação depende da configuração segura do banco Supabase."});
 if(action==="login"){
  if(!await rateGuard(req,res,{namespace:"password-login",limit:8,windowSec:900}))return;
  const email=String(req.body.email||"").trim().toLowerCase(),password=String(req.body.password||"");
  if(email.length>254||!/^\S+@\S+\.\S+$/.test(email)||password.length>200)return res.status(400).json({error:"Credenciais inválidas."});
  try{
   const {admin,anon}=clients();
   const auth=await anon.auth.signInWithPassword({email,password});
   if(auth.error||!auth.data.session)return res.status(401).json({error:"E-mail ou senha incorretos."});
   const {data:p,error}=await admin.from("agronexo_profiles").select("*").eq("id",auth.data.user.id).maybeSingle();
   if(error||!p?.active)return res.status(403).json({error:"Este acesso não está autorizado ou está desativado."});
   loginCookie(res,auth.data.session,p);
   return res.status(200).json({ok:true,locked:true,pinSet:Boolean(p.pin_hash)});
  }catch(e){return fail(res,e)}
 }
 if(!await rateGuard(req,res,{namespace:"pin",limit:10,windowSec:900}))return;
 const c=await identify(req,res,{requireUnlock:false});if(!c)return;
 const {p,admin,t}=c,pin=String(req.body.pin||"");
 if(!/^\d{4}$/.test(pin))return res.status(400).json({error:"O PIN deve conter exatamente quatro números."});
 if(req.body.mode==="set"){
  if(p.pin_hash&&t.fresh<Date.now())return res.status(403).json({error:"Faça login novamente com sua senha para redefinir o PIN."});
  if(/^(0000|1111|1234|4321|1212|2222|3333|4444|5555|6666|7777|8888|9999)$/.test(pin))return res.status(400).json({error:"Escolha um PIN menos previsível."});
  const value=hashPin(pin);
  const {error}=await admin.from("agronexo_profiles").update({pin_hash:value,pin_attempts:0,pin_blocked_until:null}).eq("id",p.id);
  if(error)return res.status(503).json({error:"Não foi possível salvar o PIN."});
  unlockCookie(res,p);return res.status(200).json({ok:true});
 }
 if(!p.pin_hash)return res.status(400).json({error:"Defina seu PIN após fazer login.",code:"PIN_SETUP_REQUIRED"});
 const until=Date.parse(p.pin_blocked_until||0);
 if(until>Date.now())return res.status(429).json({error:"PIN bloqueado temporariamente. Tente novamente mais tarde.",retryAfter:Math.ceil((until-Date.now())/1000)});
 if(!matchPin(pin,p.pin_hash)){
  const failed=await admin.rpc("agronexo_record_pin_failure",{p_user:p.id});
  if(failed.error)return res.status(503).json({error:"Não foi possível verificar o PIN. Tente novamente."});
  const blocked=failed.data&&Date.parse(failed.data)>Date.now();
  return res.status(blocked?429:401).json({error:blocked?"Muitas tentativas incorretas. PIN bloqueado por 15 minutos.":"PIN incorreto."});
 }
 await admin.from("agronexo_profiles").update({pin_attempts:0,pin_blocked_until:null,last_seen_at:new Date().toISOString()}).eq("id",p.id);
 unlockCookie(res,p);return res.status(200).json({ok:true});
}
