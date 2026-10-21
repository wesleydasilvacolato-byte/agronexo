import {ASSETS} from "./brand-assets.js";
import {resolveEntry} from "./routing.js";
import {authorizeOffline,unlockOffline,offlineInfo,revokeOffline} from "./offline-access.js";
const root=document.querySelector("#app");
let state=null,installEvent=null,loading=false;
const inviteHash=new URLSearchParams(location.hash.slice(1));
let invite=inviteHash.get("type")==="invite"&&inviteHash.get("access_token")?{accessToken:inviteHash.get("access_token")}:null;
let recovery=inviteHash.get("type")==="recovery"&&inviteHash.get("access_token")?{accessToken:inviteHash.get("access_token")}:null;
if(invite||recovery)history.replaceState(null,"",location.pathname+location.search);
const escape=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function call(action,fields={}){
 const response=await fetch("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({action,...fields})});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Object.assign(new Error(data.error||"Não foi possível concluir."),{code:response.status});
 return data;
}
const header='<img class="auth-logo" src="'+ASSETS.logo+'" alt="AGRONEXO">'+
 '<p class="auth-tag">Campo. Conexão. Conhecimento.</p>';
const body=(contents)=>{root.innerHTML='<main class="auth-page"><section class="auth-card">'+header+contents+
 '<p class="auth-foot">Sua conta é criada exclusivamente pela administração do AGRONEXO.</p></section></main>'};
const error=message=>{const el=document.querySelector("#auth-error");if(el){el.textContent=message;el.hidden=!message}};
function formField(id,type,label,auto,extra=""){
 return '<label class="auth-field" for="'+id+'">'+label+'<input id="'+id+'" type="'+type+'" autocomplete="'+auto+'" required '+extra+'></label>';
}
function renderLogin(msg=""){
 body('<h1>Entre no AGRONEXO</h1><p class="auth-muted">Use o acesso fornecido pelo administrador.</p><form id="login-form" class="auth-form">'+
 formField("login-email","email","E-mail","username","inputmode=email autocapitalize=off")+
 formField("login-password","password","Senha","current-password")+
 '<p id="auth-error" class="auth-error" role="alert" '+(msg?"":"hidden")+'>'+escape(msg)+'</p>'+
 '<button class="auth-primary" type="submit">Entrar na plataforma</button></form>'+
 '<button class="auth-link" type="button" data-auth-action="recovery">Esqueci minha senha</button>'+
 '<button class="auth-link" type="button" data-auth-action="install">Instalar AGRONEXO no dispositivo</button>'+
 (offlineInfo() ? '<button class="auth-link" type="button" data-auth-action="offline">Abrir sem internet</button>':"")');
}
function renderInvitation(){
 body('<h1>Ativar sua conta</h1><p class="auth-muted">Confirme seu convite de administrador e escolha uma senha nova, com pelo menos 12 caracteres.</p>'+
 '<form id="invite-form" class="auth-form">'+
 formField("invite-password","password","Nova senha","new-password",'minlength="12" maxlength="128"')+
 formField("invite-password-confirm","password","Confirmar senha","new-password",'minlength="12" maxlength="128"')+
 '<p id="auth-error" class="auth-error" role="alert" hidden></p>'+
 '<button class="auth-primary" type="submit">Ativar minha conta</button></form>');
}
function renderRecoveryRequest(){
 body('<h1>Recuperar acesso</h1><p class="auth-muted">Informe o e-mail cadastrado. Se houver uma conta autorizada, o Supabase enviará um link para redefinir a senha.</p>'+
 '<form id="recovery-form" class="auth-form">'+
 formField("recovery-email","email","E-mail cadastrado","username",'inputmode="email" autocapitalize="off"')+
 '<p id="auth-error" class="auth-error" role="alert" hidden></p>'+
 '<button class="auth-primary" type="submit">Enviar link de recuperação</button></form>'+
 '<button class="auth-link" type="button" data-auth-action="back-login">Voltar ao login</button>');
}
function renderRecoveryConfirm(){
 body('<h1>Definir nova senha</h1><p class="auth-muted">Crie uma senha nova com pelo menos 12 caracteres.</p>'+
 '<form id="recovery-confirm-form" class="auth-form">'+
 formField("recovery-password","password","Nova senha","new-password",'minlength="12" maxlength="128"')+
 formField("recovery-password-confirm","password","Confirme a nova senha","new-password",'minlength="12" maxlength="128"')+
 '<p id="auth-error" class="auth-error" role="alert" hidden></p>'+
 '<button class="auth-primary" type="submit">Salvar nova senha</button></form>');
}
function renderPin(create=false,msg=""){
 body('<div class="auth-avatar"><img src="'+ASSETS.icon+'" alt=""></div>'+
 '<h1>'+(create?"Proteja seu acesso":"Bem-vindo de volta")+'</h1>'+
 '<p class="auth-muted">'+(create?"Defina um PIN de 4 números para desbloquear este dispositivo. Evite sequências simples.":"Digite seu PIN para continuar.")+'</p>'+
 '<form id="pin-form" class="auth-form"><label class="auth-field" for="login-pin">PIN de 4 números<input id="login-pin" type="password" inputmode="numeric" pattern="[0-9]{4}" minlength="4" maxlength="4" autocomplete="off" required autofocus></label>'+
 '<p id="auth-error" class="auth-error" role="alert" '+(msg?"":"hidden")+'>'+escape(msg)+'</p>'+
 '<button class="auth-primary" type="submit">'+(create?"Salvar meu PIN":"Desbloquear")+'</button></form>'+
 '<button class="auth-link" type="button" data-auth-action="logout">Trocar de conta / entrar com senha</button>');
 root.dataset.pinMode=create?"set":"unlock";
 document.querySelector("#login-pin")?.focus();
}
function renderSetup(){
 body('<h1>Configuração administrativa</h1><p class="auth-muted">O painel está preparado, mas o acesso ainda depende da conexão segura com o Supabase e da inicialização da conta administrativa.</p>'+
 '<p class="auth-note">Para ativar: aplique a migração SQL, configure as quatro variáveis do Supabase na Vercel e inicialize o primeiro administrador. Nenhuma senha administrativa está embutida no código.</p>'+
 '<button class="auth-link" type="button" data-auth-action="install">Instalar aplicativo</button>');
}
function renderOfflineUnlock(msg=""){
 const info=offlineInfo();
 if(!info){renderLogin("Para usar sem internet, desbloqueie sua conta uma vez enquanto estiver conectado.");return}
 if(location.pathname==="/admin.html"){location.replace("/?offline=1");return}
 body('<div class="auth-avatar"><img src="'+ASSETS.icon+'" alt=""></div>'+
 '<h1>Modo offline</h1><p class="auth-muted">Olá, '+escape(info.name)+'. Você pode usar as calculadoras e salvar seus registros neste dispositivo. O acesso offline expira após sete dias da última autorização online.</p>'+
 '<form id="offline-form" class="auth-form">'+
 '<label class="auth-field" for="offline-pin">PIN deste dispositivo<input id="offline-pin" type="password" inputmode="numeric" pattern="[0-9]{4}" minlength="4" maxlength="4" autocomplete="off" required></label>'+
 '<p id="auth-error" class="auth-error" role="alert" '+(msg?"":"hidden")+'>'+escape(msg)+'</p>'+
 '<button class="auth-primary" type="submit">Entrar sem internet</button></form>'+
 '<button class="auth-link" type="button" data-auth-action="back-login">Entrar online quando houver conexão</button>');
 document.querySelector("#offline-pin")?.focus();
}
async function enterOffline(pin){
 const user=await unlockOffline({pin});
 window.AGRONEXO_OFFLINE=true;
 window.AGRONEXO_ADMIN=false;
 window.AGRONEXO_USER=user;
 document.title="AGRONEXO | Modo offline";
 await import("./app.js");
}
async function reconnectOffline(){
 if(!window.AGRONEXO_OFFLINE)return true;
 if(navigator.onLine===false)return false;
 try{
  const response=await fetch("/api/auth",{credentials:"same-origin",cache:"no-store"});
  const data=await response.json();
  if(!response.ok||data.locked||data.user?.id!==window.AGRONEXO_USER?.id)return false;
  state=data;
  window.AGRONEXO_USER=data.user;
  window.AGRONEXO_ADMIN=data.user.role==="admin";
  window.AGRONEXO_OFFLINE=false;
  window.dispatchEvent(new Event("agronexo:authenticated"));
  return true;
 }catch{return false}
}
window.AGRONEXO_RECONNECT=reconnectOffline;
window.AGRONEXO_ENROLL_OFFLINE=async pin=>{
 if(window.AGRONEXO_OFFLINE||!state?.user||state.locked)throw Error("Entre com internet para ativar o acesso offline.");
 if(navigator.onLine===false)throw Error("Ative este aparelho enquanto estiver conectado.");
 if(!/^\d{4}$/.test(pin))throw Error("Informe o PIN de quatro números.");
 await call("pin",{mode:"unlock",pin});
 return authorizeOffline({pin,user:state.user});
};
window.addEventListener("online",()=>{if(window.AGRONEXO_OFFLINE)reconnectOffline()});
// A perda temporária da API pode durar mais que o evento "online".
const reconnectTimer=setInterval(()=>{if(window.AGRONEXO_OFFLINE&&navigator.onLine!==false)reconnectOffline()},45000);
reconnectTimer?.unref?.();
async function enterApp(){
 window.AGRONEXO_OFFLINE=false;
 window.AGRONEXO_ADMIN=state.user.role==="admin";
 window.AGRONEXO_USER=state.user;
 const route=resolveEntry({
  pathname:location.pathname,
  role:state.user.role,
  mode:new URLSearchParams(location.search).get("modo")||""
 });
 if(route.redirect){location.replace(route.redirect);return}
 if(route.page==="admin"){
  document.title="Administração | AGRONEXO";
  await import("./admin.js");
 }else{
  document.title="AGRONEXO | Plataforma Agrícola";
  await import("./app.js");
 }
}
async function boot(){
 if(recovery){renderRecoveryConfirm();return}
 if(invite){renderInvitation();return}
 if(new URLSearchParams(location.search).get("recuperar")==="1"){renderRecoveryRequest();return}
 if(new URLSearchParams(location.search).get("offline")==="1"){renderOfflineUnlock();return}
 if(navigator.onLine===false){renderOfflineUnlock();return}
 root.innerHTML='<div class="loading"><span class="load-orbit"></span><h2>AGRONEXO</h2><p>Verificando acesso...</p></div>';
 try{
  const response=await fetch("/api/auth",{credentials:"same-origin",cache:"no-store"});
  const data=await response.json().catch(()=>({}));
  if(response.status===503&&!data.configured){renderSetup();return}
  if(!response.ok){renderLogin();return}
  state=data;
  if(data.locked){renderPin(!data.pinSet);return}
  await enterApp();
 }catch(e){if(offlineInfo())renderOfflineUnlock();else renderLogin("Sem conexão. Faça seu primeiro login com internet para habilitar o modo offline.")}
}
document.addEventListener("submit",async e=>{
 if(!["login-form","pin-form","invite-form","recovery-form","recovery-confirm-form","offline-form"].includes(e.target?.id))return;
 e.preventDefault();if(loading)return;loading=true;
 const button=e.target.querySelector("button[type=submit]");
 if(button)button.disabled=true;
 error("");
 try{
  if(e.target.id==="offline-form"){
   await enterOffline(document.querySelector("#offline-pin").value);
   return;
  }
  let pinForOffline=null;
  if(e.target.id==="recovery-form"){
   await call("request-recovery",{email:document.querySelector("#recovery-email").value.trim()});
   const note=document.querySelector("#auth-error");
   if(note){note.hidden=false;note.textContent="Se houver uma conta autorizada, um link de recuperação será enviado ao e-mail informado.";}
   return;
  }else if(e.target.id==="recovery-confirm-form"){
   const password=document.querySelector("#recovery-password").value;
   if(password.length<12||password!==document.querySelector("#recovery-password-confirm").value)throw Error("As senhas devem ser iguais e ter pelo menos 12 caracteres.");
   await call("confirm-recovery",{accessToken:recovery.accessToken,password});
   recovery=null;
  }else if(e.target.id==="invite-form"){
   const password=document.querySelector("#invite-password").value;
   if(password.length<12||password!==document.querySelector("#invite-password-confirm").value)throw Error("As senhas precisam ser iguais e ter pelo menos 12 caracteres.");
   await call("accept-invite",{accessToken:invite.accessToken,password});
   invite=null;
  }else if(e.target.id==="login-form"){
   await call("login",{email:document.querySelector("#login-email").value.trim(),password:document.querySelector("#login-password").value});
  }else{
   const pin=document.querySelector("#login-pin").value;
   if(!/^\d{4}$/.test(pin))throw Error("Informe exatamente quatro números.");
   await call("pin",{mode:root.dataset.pinMode,pin});
   pinForOffline=pin;
  }
  await boot();
  // Só registra permissão offline após a autenticação real do PIN no Supabase.
  if(pinForOffline&&state?.user&&!state.locked){
   await authorizeOffline({pin:pinForOffline,user:state.user}).catch(()=>{});
  }
 }catch(err){error(err.message)}finally{loading=false;if(button?.isConnected)button.disabled=false}
});
document.addEventListener("click",async e=>{
 const el=e.target.closest("[data-auth-action]");
 if(!el)return;
 if(el.dataset.authAction==="recovery"){location.href="/?recuperar=1";return}
 if(el.dataset.authAction==="back-login"){location.href="/";return}
 if(el.dataset.authAction==="offline"){location.href="/?offline=1";return}
 if(el.dataset.authAction==="logout"){revokeOffline();await call("logout").catch(()=>{});location.replace("/");return}
 if(el.dataset.authAction==="install"){
  if(installEvent){installEvent.prompt();await installEvent.userChoice;installEvent=null}
  else alert("No Android/Chrome: menu ⋮ → Instalar aplicativo. No iPhone/iPad: Compartilhar → Adicionar à Tela de Início.");
 }
});
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installEvent=e});
window.AGRONEXO_INSTALL=async()=>{
 if(installEvent){installEvent.prompt();await installEvent.userChoice;installEvent=null}
 else alert("Android/Chrome: menu ⋮ → Instalar aplicativo. iPhone/iPad: Compartilhar → Adicionar à Tela de Início.");
};
if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{});
await boot();
