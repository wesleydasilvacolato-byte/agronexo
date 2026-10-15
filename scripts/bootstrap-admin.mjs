import {createClient} from "@supabase/supabase-js";
/** Bootstrap administrativo, acionado somente sob ADMIN_BOOTSTRAP_ONCE. */
const url=process.env.SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_KEY;
const email="wesleydasilvacolato@gmail.com";
const wrongEmail="wesledasilvacolato@gmail.com";
const redirect=process.env.ADMIN_INVITE_REDIRECT;
if(!url||!key||!redirect||!/^https:\/\//.test(redirect)){
 throw Error("Convite bloqueado: credenciais ou ADMIN_INVITE_REDIRECT ausentes.");
}
const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const listed=await admin.auth.admin.listUsers({page:1,perPage:1000});
if(listed.error)throw listed.error;
const users=listed.data.users;
let expected=users.find(u=>u.email?.toLowerCase()===email);
const previous=users.find(u=>u.email?.toLowerCase()===wrongEmail);
if(expected){
 const prof=await admin.from("agronexo_profiles").select("role,active").eq("id",expected.id).maybeSingle();
 if(prof.error||prof.data?.role!=="admin"||!prof.data.active)throw Error("E-mail correto já registrado sem perfil administrativo válido; revisão manual necessária.");
 console.log("[admin] Cadastro correto confirmado no Auth e no perfil.");
}else{
 if(previous){
  const p=await admin.from("agronexo_profiles").select("role,active,invitation_accepted_at").eq("id",previous.id).maybeSingle();
  if(p.error||p.data?.role!=="admin"||!p.data.active||p.data.invitation_accepted_at||previous.email_confirmed_at||previous.last_sign_in_at){
   throw Error("Cadastro com e-mail antigo está em uso ou alterado: correção automática proibida.");
  }
 }
 const invited=await admin.auth.admin.inviteUserByEmail(email,{redirectTo:redirect,data:{full_name:"Administrador AGRONEXO"}});
 if(invited.error||!invited.data.user)throw Error("Convite para o e-mail correto falhou: "+(invited.error?.message||"sem confirmação"));
 expected=invited.data.user;
 const saved=await admin.from("agronexo_profiles").insert({
  id:expected.id,email,display_name:"Administrador AGRONEXO",role:"admin",active:true
 });
 if(saved.error){await admin.auth.admin.deleteUser(expected.id);throw Error("Convite emitido mas perfil não foi salvo: "+saved.error.message)}
 console.log("[admin] Convite solicitado e perfil administrativo criado no e-mail correto.");
}
if(previous&&previous.id!==expected.id){
 const p=await admin.from("agronexo_profiles").select("role,invitation_accepted_at").eq("id",previous.id).maybeSingle();
 if(!p.error&&p.data?.role==="admin"&&!p.data.invitation_accepted_at&&!previous.email_confirmed_at&&!previous.last_sign_in_at){
  const removed=await admin.auth.admin.deleteUser(previous.id);
  if(removed.error)throw Error("Conta correta criada, mas remoção do convite antigo falhou: "+removed.error.message);
  console.log("[admin] Convite para o endereço errado revogado.");
 }
}
