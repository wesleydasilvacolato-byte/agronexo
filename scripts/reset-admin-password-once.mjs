import {createClient} from "@supabase/supabase-js";
/**
 * Emergency, one-time admin password provisioning.
 * Runs ONLY when ADMIN_PASSWORD_RESET_ONCE=1 in Preview.
 * The secret must be supplied as a protected Vercel environment variable.
 * Never print or commit the temporary password or Supabase service key.
 */
if(process.env.ADMIN_PASSWORD_RESET_ONCE!=="1"){
 console.log("[admin-access] Password provisioning disabled.");
}else{
 const email="wesleydasilvacolato@gmail.com";
 const pass=process.env.ADMIN_TEMP_PASSWORD||"";
 const url=process.env.SUPABASE_URL||"";
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_KEY||"";
 if(!/^https:\/\//.test(url)||!secret||pass.length<18||pass.length>128){
  throw Error("Protected admin provisioning variables are incomplete or invalid.");
 }
 const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const prof=await admin.from("agronexo_profiles")
   .select("id,email,role,active,security_version,invitation_accepted_at,pin_hash")
   .eq("email",email).maybeSingle();
 if(prof.error||!prof.data||prof.data.role!=="admin"||prof.data.active!==true){
  throw Error("Admin profile could not be verified. No password changed.");
 }
 const profile=prof.data;
 const found=await admin.auth.admin.getUserById(profile.id);
 if(found.error||found.data?.user?.email?.toLowerCase()!==email){
  throw Error("Supabase Auth account does not match the admin profile.");
 }
 const user=found.data.user;
 if(!user.user_metadata?.agronexo_temp_password_issued_at){
  const updated=await admin.auth.admin.updateUserById(profile.id,{
   password:pass,email_confirm:true,
   user_metadata:{...user.user_metadata,agronexo_temp_password_issued_at:new Date().toISOString()}
  });
  if(updated.error)throw Error("Supabase rejected password update: "+updated.error.message);
  console.log("[admin-access] One-time temporary password registered in Supabase Auth.");
 }else{
  console.log("[admin-access] Temporary password was already provisioned; will not change it again.");
 }
 if(!profile.invitation_accepted_at||profile.pin_hash){
  const patch=await admin.from("agronexo_profiles").update({
   invitation_accepted_at:profile.invitation_accepted_at||new Date().toISOString(),
   pin_hash:null,pin_attempts:0,pin_blocked_until:null,
   security_version:profile.security_version+1
  }).eq("id",profile.id);
  if(patch.error)throw Error("Profile security version update failed: "+patch.error.message);
 }
 console.log("[admin-access] Admin account activation completed; password never logged.");
}
