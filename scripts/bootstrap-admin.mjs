import {createClient} from "@supabase/supabase-js";
const url=process.env.SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
const email=(process.env.ADMIN_EMAIL||"wesledasilvacolato@gmail.com").trim().toLowerCase();
const password=process.env.ADMIN_INITIAL_PASSWORD;
if(!url||!key||!password||password.length<12){
 console.error("Defina SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e ADMIN_INITIAL_PASSWORD (mínimo de 12 caracteres).");
 process.exit(1);
}
if(!/^https:\/\//.test(url)){console.error("Supabase deve usar HTTPS.");process.exit(1)}
const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
let id=null;
const listed=await admin.auth.admin.listUsers({page:1,perPage:1000});
if(listed.error)throw listed.error;
const existing=listed.data.users.find(u=>u.email?.toLowerCase()===email);
if(existing)id=existing.id;
else{
 const created=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:"Administrador AGRONEXO"}});
 if(created.error)throw created.error;
 id=created.data.user.id;
}
const saved=await admin.from("agronexo_profiles").upsert({id,email,display_name:"Administrador AGRONEXO",role:"admin",active:true},{onConflict:"id"});
if(saved.error)throw saved.error;
console.log("Conta administrativa preparada para:",email);
console.log("A senha inicial não foi exibida e deve permanecer fora do repositório.");
console.log("Após o primeiro login, defina o PIN de 4 dígitos no dispositivo.");
