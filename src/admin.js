import {ASSETS} from "./brand-assets.js";
const root=document.querySelector("#app");
let store={users:[],summary:{},audit:[]},tab="users",search="";
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const when=d=>d?new Date(d).toLocaleString("pt-BR"):"Nunca";
const recently=d=>d&&Date.now()-Date.parse(d)<15*60000;
async function api(action,payload={}){
 const isRead=!action;
 const r=await fetch("/api/admin",{method:isRead?"GET":"POST",credentials:"same-origin",
  headers:isRead?{}:{"Content-Type":"application/json"},
  body:isRead?undefined:JSON.stringify({action,...payload}),cache:"no-store"});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(data.error||"Falha na comunicação.");
 return data;
}
function toast(message,negative=false){
 const item=document.createElement("div");item.className="admin-toast"+(negative?" error":"");
 item.textContent=message;document.body.append(item);setTimeout(()=>item.remove(),4200);
}
async function refresh(){
 try{store=await api();render()}catch(e){
  if(/login|PIN|autorizado|Sessão|Conta/i.test(e.message)){location.replace("/");return}
  toast(e.message,true)
 }
}
function summary(){
 const s=store.summary;
 return [['users','Usuários cadastrados',s.total||0],['user-check','Contas habilitadas',s.enabled||0],
 ['activity','Ativos (15 min)',s.online||0],['user-x','Desativadas',s.blocked||0]];
}
function tag(u){return !u.active?'<span class="admin-status disabled">Desativado</span>':recently(u.lastSeen)?'<span class="admin-status online">Ativo agora</span>':'<span class="admin-status">Habilitado</span>'}
function userCard(u){
 const mine=u.id===window.AGRONEXO_USER?.id;
 return '<article class="admin-user"><div class="admin-user-head"><div class="admin-initial">'+esc(u.name?.slice(0,1).toUpperCase()||"U")+'</div><div class="admin-user-detail"><h3>'+esc(u.name)+'</h3><p>'+esc(u.email)+'</p></div>'+tag(u)+'</div>'+
 '<div class="admin-user-meta"><span>'+(u.role==="admin"?"Administrador":"Usuário")+'</span><span>Último acesso: '+when(u.lastSeen)+'</span><span>PIN: '+(u.pinSet?"Configurado":"Pendente")+'</span></div>'+
 (mine||u.role==="admin"?'': '<div class="admin-actions">'+
 '<button data-admin-action="toggle" data-id="'+u.id+'" data-active="'+(!u.active)+'">'+(u.active?"Desativar conta":"Reativar conta")+'</button>'+
 '<button data-admin-action="reset-password" data-id="'+u.id+'">Alterar senha</button>'+
 '<button data-admin-action="reset-pin" data-id="'+u.id+'">Redefinir PIN</button></div>')+'</article>'
}
function render(){
 const user=window.AGRONEXO_USER||{};
 root.innerHTML='<div class="admin-shell"><header class="admin-header"><div class="admin-brand"><img src="'+ASSETS.icon+'" alt="Agronexo"><div><strong>AGRONEXO</strong><small>Painel Administrativo</small></div></div><div class="admin-head-actions"><span>'+esc(user.name||"Administrador")+'</span><button data-admin-action="workspace">Plataforma</button><button data-admin-action="logout">Sair</button></div></header>'+
 '<main class="admin-body"><div class="admin-intro"><div><span class="admin-label">CONTROLE E SEGURANÇA</span><h1>Administração</h1><p>Gerencie acessos, acompanhe a atividade e proteja a plataforma.</p></div><button class="admin-primary" data-admin-action="new">+ Novo usuário</button></div>'+
 '<div class="admin-metrics">'+summary().map(([ico,label,value])=>'<div class="admin-metric"><span>'+label+'</span><strong>'+Number(value).toLocaleString("pt-BR")+'</strong></div>').join("")+'</div>'+
 '<nav class="admin-tabs" aria-label="Seções administrativas">'+[["users","Usuários"],["audit","Histórico de ações"],["system","Plataforma"]].map(([id,name])=>'<button class="'+(tab===id?"selected":"")+'" data-admin-tab="'+id+'">'+name+'</button>').join("")+'</nav>'+
 '<section id="admin-panel">'+(tab==="users"?usersTab():tab==="audit"?auditTab():systemTab())+'</section>'+
 '</main><footer class="admin-footer">AGRONEXO · Administração protegida · Ativos significa acesso nos últimos 15 minutos</footer></div>';
}
function usersTab(){
 const filtered=store.users.filter(u=>[u.name,u.email].some(x=>String(x||"").toLowerCase().includes(search.toLowerCase())));
 return '<div class="admin-section-heading"><h2>Controle de usuários</h2><p>Somente administradores criam novos acessos. Nenhum usuário pode se cadastrar sozinho.</p></div>'+
 '<label class="admin-search">Pesquisar <input id="admin-search" type="search" placeholder="Nome ou e-mail..." value="'+esc(search)+'"></label>'+
 '<div id="admin-user-list" class="admin-user-list">'+(filtered.length?filtered.map(userCard).join(""):'<p>Nenhum usuário encontrado.</p>')+'</div>';
}
function auditTab(){
 return '<div class="admin-section-heading"><h2>Histórico de ações</h2><p>Registros administrativos recentes, sem senhas ou PINs.</p></div>'+
 '<div class="admin-audit">'+(store.audit.length?store.audit.map(a=>'<div class="admin-audit-row"><div><strong>'+esc(a.action)+'</strong><p>'+esc(a.details?.email||a.target_id||"Plataforma")+'</p></div><time>'+when(a.created_at)+'</time></div>').join(""):'<p>Não há alterações registradas.</p>')+'</div>';
}
function systemTab(){
 return '<div class="admin-section-heading"><h2>Estado da plataforma</h2><p>Preferências operacionais e indicadores de disponibilidade.</p></div>'+
 '<div class="admin-system"><div><h3>Contas fechadas</h3><p>Somente a administração cria usuários. Credenciais são verificadas pelo Supabase Auth; sessões são protegidas por cookies HttpOnly.</p></div>'+
 '<div><h3>PIN de 4 números</h3><p>Vinculado à sessão autenticada; cinco tentativas incorretas bloqueiam o PIN por quinze minutos.</p></div>'+
 '<div><h3>Contagem de ativos</h3><p>Aproximação com base no último acesso autenticado em até 15 minutos, não um rastreamento de presença em tempo real.</p></div>'+
 '<div><h3>Instalação como aplicativo</h3><p>No Android ou tablet, acesse o AGRONEXO pelo Chrome e use Instalar aplicativo. No iOS, use Compartilhar → Adicionar à Tela de Início.</p></div>'+
 '<div><h3>Dados e backups</h3><p>O painel administra as contas. Conversas e dados operacionais ainda ficam no navegador de cada usuário até a implantação do banco de documentos.</p></div></div>';
}
function modal(title,html){
 const div=document.createElement("div");div.className="admin-backdrop";div.innerHTML='<section class="admin-dialog" role="dialog" aria-modal="true"><div class="admin-dialog-title"><h2>'+title+'</h2><button data-admin-action="close">✕</button></div>'+html+'</section>';
 document.body.append(div);
}
function newUser(){
 modal("Novo usuário",'<p class="admin-help">Crie uma conta e entregue as credenciais por um canal privado. A senha será usada no primeiro acesso.</p>'+
 '<form id="new-user-form" class="admin-form"><label>Nome completo<input name="name" required minlength="2" maxlength="90" autocomplete="off"></label>'+
 '<label>E-mail<input name="email" type="email" required autocomplete="off"></label>'+
 '<label>Senha temporária (12+ caracteres)<input name="password" type="password" required minlength="12" autocomplete="new-password"></label>'+
 '<div class="admin-dialog-actions"><button type="button" data-admin-action="close">Cancelar</button><button class="admin-primary" type="submit">Criar acesso</button></div></form>');
}
function resetPassword(id){
 modal("Alterar senha",'<p class="admin-help">Uma nova senha revogará as sessões antigas e exigirá que o usuário crie um novo PIN.</p>'+
 '<form id="reset-password-form" data-id="'+id+'" class="admin-form"><label>Nova senha temporária<input type="password" name="password" required minlength="12" autocomplete="new-password"></label>'+
 '<div class="admin-dialog-actions"><button type="button" data-admin-action="close">Cancelar</button><button class="admin-primary" type="submit">Confirmar redefinição</button></div></form>');
}
document.addEventListener("click",async e=>{
 if(e.target.classList.contains("admin-backdrop")){e.target.remove();return}
 const tabButton=e.target.closest("[data-admin-tab]");
 if(tabButton){tab=tabButton.dataset.adminTab;render();return}
 const btn=e.target.closest("[data-admin-action]");if(!btn)return;
 const action=btn.dataset.adminAction;
 if(action==="close"){document.querySelector(".admin-backdrop")?.remove();return}
 if(action==="new"){newUser();return}
 if(action==="workspace"){location.href="/?modo=plataforma";return}
 if(action==="logout"){await fetch("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"logout"})});location.replace("/");return}
 if(action==="reset-password"){resetPassword(btn.dataset.id);return}
 const user=store.users.find(u=>u.id===btn.dataset.id);if(!user)return;
 if(action==="toggle"){
  if(!confirm((user.active?"Desativar":"Reativar")+" a conta "+user.email+"?"))return;
  try{await api("toggle",{id:user.id,active:!user.active});toast("Conta atualizada.");await refresh()}catch(e){toast(e.message,true)}
 }
 if(action==="reset-pin"){
  if(!confirm("Revogar o PIN de "+user.email+"? Será necessário entrar novamente com a senha e definir outro PIN."))return;
  try{await api("reset-pin",{id:user.id});toast("PIN revogado.");await refresh()}catch(e){toast(e.message,true)}
 }
});
document.addEventListener("input",e=>{
 if(e.target.id==="admin-search"){search=e.target.value;const box=document.querySelector("#admin-user-list");if(box)box.innerHTML=store.users.filter(u=>[u.name,u.email].some(x=>String(x||"").toLowerCase().includes(search.toLowerCase()))).map(userCard).join("")||"<p>Nenhum usuário encontrado.</p>"}
});
document.addEventListener("submit",async e=>{
 if(!["new-user-form","reset-password-form"].includes(e.target?.id))return;
 e.preventDefault();
 const form=e.target,button=form.querySelector("button[type=submit]");button.disabled=true;
 const fields=Object.fromEntries(new FormData(form));
 try{
  if(form.id==="new-user-form")await api("create",fields);
  else await api("reset-password",{id:form.dataset.id,password:fields.password});
  form.reset();document.querySelector(".admin-backdrop")?.remove();
  toast("Operação concluída. Compartilhe a senha temporária em canal privado.");
  await refresh();
 }catch(err){toast(err.message,true)}finally{if(button.isConnected)button.disabled=false}
});
await refresh();
