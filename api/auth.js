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
 if(!["login","pin","logout","accept-invite","activate-admin"].includes(action))return res.status(400).json({error:"Ação inválida."});
 if(action==="logout"){clear(res);return res.status(200).json({ok:true})}
 if(!configured())return res.status(503).json({error:"A autenticação depende da configuração segura do banco Supabase."});
 if(action==="activate-admin"){
  if(!await rateGuard(req,res,{namespace:"admin-offline-activation",limit:5,windowSec:900}))return;
  const token=String(req.body.token||"").trim().toLowerCase();
  const password=String(req.body.password||"");
  if(!/^[0-9a-f]{64}$/.test(token)||password.length<12||password.length>128){
   return res.status(400).json({error:"Informe o código de ativação de 64 caracteres e uma senha nova de 12 a 128 caracteres."});
  }
  try{
   const {admin,anon}=clients();
   const email=String(process.env.ADMIN_EMAIL||"wesleydasilvacolato@gmail.com").toLowerCase();
   const result=await admin.from("agronexo_profiles").select("id,email,role,active,invitation_accepted_at,security_version").eq("email",email).maybeSingle();
   const profile=result.data;
   if(result.error||!profile||profile.role!=="admin"||!profile.active||profile.invitation_accepted_at){
    return res.status(403).json({error:"A ativação não está disponível para esta conta."});
   }
   const info=await admin.auth.admin.getUserById(profile.id);
   if(info.error||info.data?.user?.email?.toLowerCase()!==email)return res.status(403).json({error:"Conta administrativa inconsistente."});
   const claimed=await admin.rpc("agronexo_claim_admin_setup",{p_user_id:profile.id,p_token:token});
   if(claimed.error||claimed.data!==true)return res.status(401).json({error:"Código inválido, expirado ou já utilizado. Gere um novo código no Supabase."});
   const changed=await admin.auth.admin.updateUserById(profile.id,{password,email_confirm:true});
   if(changed.error)return res.status(503).json({error:"O código foi consumido, mas não foi possível definir a senha. Gere outro código no Supabase."});
   const updated=await admin.from("agronexo_profiles").update({
    invitation_accepted_at:new Date().toISOString(),security_version:profile.security_version+1
   }).eq("id",profile.id).is("invitation_accepted_at",null);
   if(updated.error)return res.status(503).json({error:"Senha criada, mas não foi possível concluir a ativação. Entre em contato com o suporte."});
   const auth=await anon.auth.signInWithPassword({email,password});
   if(auth.error||!auth.data?.session)return res.status(200).json({ok:true,needLogin:true});
   loginCookie(res,auth.data.session,{...profile,security_version:profile.security_version+1});
   return res.status(200).json({ok:true,locked:true,pinSet:false});
  }catch(e){return fail(res,e)}
 }
 if(action==="accept-invite"){
  if(!await rateGuard(req,res,{namespace:"admin-invite-accept",limit:5,windowSec:900}))return;
  const accessToken=String(req.body.accessToken||""),password=String(req.body.password||"");
  if(accessToken.length<100||accessToken.length>6000||password.length<12||password.length>128)return res.status(400).json({error:"Convite inválido ou senha muito curta. Use pelo menos 12 caracteres."});
  try{
   const {admin,anon}=clients();
   const checked=await anon.auth.getUser(accessToken);
   if(checked.error||!checked.data.user)return res.status(401).json({error:"O convite expirou ou não é válido. Solicite outro convite."});
   const user=checked.data.user;
   const email=String(user.email||"").toLowerCase();
   const {data:p,error}=await admin.from("agronexo_profiles").select("*").eq("id",user.id).maybeSingle();
   if(error||!p||!p.active||p.role!=="admin"||email!=="wesleydasilvacolato@gmail.com"||p.email!==email||p.invitation_accepted_at)return res.status(403).json({error:"Esse convite não pode criar ou alterar esta conta."});
   const saved=await admin.auth.admin.updateUserById(user.id,{password,email_confirm:true});
   if(saved.error)return res.status(503).json({error:"Não foi possível definir a senha. Tente novamente."});
   const marked=await admin.from("agronexo_profiles").update({invitation_accepted_at:new Date().toISOString(),security_version:p.security_version+1}).eq("id",user.id);
   if(marked.error)return res.status(503).json({error:"A senha foi atualizada, mas não foi possível concluir a ativação. Contate o administrador."});
   const login=await anon.auth.signInWithPassword({email,password});
   if(login.error||!login.data.session)return res.status(200).json({ok:true,needLogin:true});
   loginCookie(res,login.data.session,{...p,security_version:p.security_version+1});
   return res.status(200).json({ok:true,locked:true,pinSet:false});
  }catch(e){return fail(res,e)}
 }
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
