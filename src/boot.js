import {ASSETS} from "./brand-assets.js";
const root=document.querySelector("#app");
let state=null,installEvent=null,loading=false;
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
 '<button class="auth-link" type="button" data-auth-action="install">Instalar AGRONEXO no dispositivo</button>');
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
async function enterApp(){
 window.AGRONEXO_ADMIN=state.user.role==="admin";
 window.AGRONEXO_USER=state.user;
 if(location.pathname==="/admin.html"){
  if(!window.AGRONEXO_ADMIN){location.replace("/");return}
  await import("./admin.js");
 }else{
  await import("./app.js");
 }
}
async function boot(){
 root.innerHTML='<div class="loading"><span class="load-orbit"></span><h2>AGRONEXO</h2><p>Verificando acesso...</p></div>';
 try{
  const response=await fetch("/api/auth",{credentials:"same-origin",cache:"no-store"});
  const data=await response.json().catch(()=>({}));
  if(response.status===503&&!data.configured){renderSetup();return}
  if(!response.ok){renderLogin();return}
  state=data;
  if(data.locked){renderPin(!data.pinSet);return}
  await enterApp();
 }catch(e){renderLogin("Não foi possível verificar a conexão. Confira sua internet.")}
}
document.addEventListener("submit",async e=>{
 if(!["login-form","pin-form"].includes(e.target?.id))return;
 e.preventDefault();if(loading)return;loading=true;
 const button=e.target.querySelector("button[type=submit]");
 if(button)button.disabled=true;
 error("");
 try{
  if(e.target.id==="login-form"){
   await call("login",{email:document.querySelector("#login-email").value.trim(),password:document.querySelector("#login-password").value});
  }else{
   const pin=document.querySelector("#login-pin").value;
   if(!/^\d{4}$/.test(pin))throw Error("Informe exatamente quatro números.");
   await call("pin",{mode:root.dataset.pinMode,pin});
  }
  await boot();
 }catch(err){error(err.message)}finally{loading=false;if(button?.isConnected)button.disabled=false}
});
document.addEventListener("click",async e=>{
 const el=e.target.closest("[data-auth-action]");
 if(!el)return;
 if(el.dataset.authAction==="logout"){await call("logout").catch(()=>{});location.replace("/");return}
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
