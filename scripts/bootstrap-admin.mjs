import {createClient} from "@supabase/supabase-js";
/** Executa SOMENTE em build de prévia explicitamente habilitado.
 * Envia convite ao e-mail administrativo, sem criar ou divulgar senhas.
 * Operação idempotente: se a conta estiver cadastrada corretamente, não envia novamente.
 */
const url=process.env.SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_KEY;
const email=(process.env.ADMIN_EMAIL||"wesleydasilvacolato@gmail.com").trim().toLowerCase();
const redirect=process.env.ADMIN_INVITE_REDIRECT;
if(!url||!key||!redirect||!/^https:\/\//.test(redirect)){
 throw Error("Convite bloqueado: configure SUPABASE_URL, chave service role e ADMIN_INVITE_REDIRECT.");
}
const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const listed=await admin.auth.admin.listUsers({page:1,perPage:1000});
if(listed.error)throw listed.error;
const existing=listed.data.users.find(u=>u.email?.toLowerCase()===email);
if(existing){
 const prof=await admin.from("agronexo_profiles").select("role").eq("id",existing.id).maybeSingle();
 if(prof.error||prof.data?.role!=="admin")throw Error("E-mail existente sem perfil administrativo válido; intervenção manual necessária.");
 console.log("[admin-bootstrap] Conta administrativa já existe. Nenhum convite adicional enviado.");
}else{
 const invited=await admin.auth.admin.inviteUserByEmail(email,{redirectTo:redirect,data:{full_name:"Administrador AGRONEXO"}});
 if(invited.error||!invited.data.user)throw Error("Falha ao convidar e-mail administrativo: "+(invited.error?.message||"Sem usuário"));
 const u=invited.data.user;
 const saved=await admin.from("agronexo_profiles").insert({id:u.id,email,display_name:"Administrador AGRONEXO",role:"admin",active:true});
 if(saved.error)throw Error("Convite emitido, mas cadastro do administrador falhou: "+saved.error.message);
 console.log("[admin-bootstrap] Convite administrativo registrado e solicitado por e-mail.");
}
