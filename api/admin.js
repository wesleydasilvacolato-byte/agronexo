import {identify,audit,fail} from "../lib/auth.js";
import {securePost,rateGuard} from "../lib/security.js";
const goodEmail=e=>/^\S+@\S+\.\S+$/.test(e)&&e.length<=254;
const masked=p=>({id:p.id,name:p.display_name,email:p.email,role:p.role,active:p.active,lastSeen:p.last_seen_at,createdAt:p.created_at,pinSet:Boolean(p.pin_hash)});
export default async function handler(req,res){
 res.setHeader("Cache-Control","no-store");
 if(req.method!=="GET"&&!securePost(req,res,32000))return;
 const c=await identify(req,res,{adminOnly:true});if(!c)return;
 if(!await rateGuard(req,res,{namespace:"admin",limit:50,windowSec:60}))return;
 const {p:actor,admin}=c;
 try{
  if(req.method==="GET"){
   const {data:users,error}=await admin.from("agronexo_profiles").select("id,email,display_name,role,active,last_seen_at,created_at,pin_hash").order("created_at",{ascending:false}).limit(5000);
   if(error)throw error;
   const {data:auditLog,error:auditErr}=await admin.from("agronexo_admin_audit").select("id,actor_id,target_id,action,details,created_at").order("created_at",{ascending:false}).limit(25);
   if(auditErr)throw auditErr;
   const current=Date.now()-15*60000;
   return res.status(200).json({users:users.map(masked),audit:auditLog,summary:{
    total:users.length,enabled:users.filter(u=>u.active).length,
    blocked:users.filter(u=>!u.active).length,
    online:users.filter(u=>u.active&&Date.parse(u.last_seen_at||0)>=current).length,
    admins:users.filter(u=>u.role==="admin").length},
    onlineDefinition:"Acessaram a plataforma nos últimos 15 minutos",
    truncated:users.length===5000
   });
  }
  if(req.method!=="POST")return res.status(405).json({error:"Método não permitido."});
  const action=String(req.body?.action||"");
  if(action==="create"){
   const email=String(req.body.email||"").trim().toLowerCase(),name=String(req.body.name||"").trim(),password=String(req.body.password||"");
   if(!goodEmail(email)||name.length<2||name.length>90||password.length<12||password.length>128)return res.status(400).json({error:"Informe nome, e-mail válido e senha temporária com pelo menos 12 caracteres."});
   const existing=await admin.from("agronexo_profiles").select("id").eq("email",email).maybeSingle();
   if(existing.data)return res.status(409).json({error:"Já existe uma conta com esse e-mail."});
   const created=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:name}});
   if(created.error||!created.data.user)return res.status(400).json({error:"Não foi possível criar a conta. Confira e-mail e configuração do Supabase."});
   const user=created.data.user;
   const saved=await admin.from("agronexo_profiles").insert({id:user.id,email,display_name:name,role:"user",active:true});
   if(saved.error){await admin.auth.admin.deleteUser(user.id);throw saved.error}
   await audit(admin,actor.id,"user.created",user.id,{email,name});
   return res.status(201).json({ok:true,id:user.id});
  }
  if(action==="toggle"){
   const id=String(req.body.id||""),active=req.body.active;
   if(!/^[a-f0-9-]{36}$/i.test(id)||typeof active!=="boolean")return res.status(400).json({error:"Dados inválidos."});
   if(id===actor.id)return res.status(403).json({error:"Não é permitido alterar a própria conta administrativa."});
   const {data:u,error}=await admin.from("agronexo_profiles").select("id,role,security_version,email").eq("id",id).maybeSingle();
   if(error||!u)return res.status(404).json({error:"Usuário não encontrado."});
   if(u.role==="admin")return res.status(403).json({error:"Contas administrativas não podem ser modificadas por este painel."});
   const updated=await admin.from("agronexo_profiles").update({active,security_version:u.security_version+1}).eq("id",id);
   if(updated.error)throw updated.error;
   await audit(admin,actor.id,active?"user.reenabled":"user.suspended",id,{email:u.email});
   return res.status(200).json({ok:true});
  }
  if(action==="reset-password"){
   const id=String(req.body.id||""),password=String(req.body.password||"");
   if(!/^[a-f0-9-]{36}$/i.test(id)||password.length<12||password.length>128)return res.status(400).json({error:"Escolha uma senha temporária com pelo menos 12 caracteres."});
   if(id===actor.id)return res.status(403).json({error:"Para alterar a própria senha administrativa, use o fluxo seguro de recuperação do provedor."});
   const {data:u}=await admin.from("agronexo_profiles").select("id,role,email,security_version").eq("id",id).maybeSingle();
   if(!u)return res.status(404).json({error:"Usuário não encontrado."});
   if(u.role==="admin")return res.status(403).json({error:"Redefinição de outra conta administrativa não permitida."});
   const updated=await admin.auth.admin.updateUserById(id,{password});
   if(updated.error)throw updated.error;
   const result=await admin.from("agronexo_profiles").update({security_version:u.security_version+1,pin_hash:null,pin_attempts:0,pin_blocked_until:null}).eq("id",id);
   if(result.error)throw result.error;
   await audit(admin,actor.id,"user.password_reset",id,{email:u.email,pinReset:true});
   return res.status(200).json({ok:true});
  }
  if(action==="reset-pin"){
   const id=String(req.body.id||"");
   if(!/^[a-f0-9-]{36}$/i.test(id)||id===actor.id)return res.status(400).json({error:"Usuário inválido."});
   const {data:u}=await admin.from("agronexo_profiles").select("id,role,email,security_version").eq("id",id).maybeSingle();
   if(!u||u.role!=="user")return res.status(403).json({error:"Ação não permitida."});
   const result=await admin.from("agronexo_profiles").update({pin_hash:null,pin_attempts:0,pin_blocked_until:null,security_version:u.security_version+1}).eq("id",id);
   if(result.error)throw result.error;
   await audit(admin,actor.id,"user.pin_reset",id,{email:u.email});
   return res.status(200).json({ok:true});
  }
  return res.status(400).json({error:"Ação administrativa desconhecida."});
 }catch(e){return fail(res,e)}
}
