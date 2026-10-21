import {CALCS,GROUPS,runCalc} from "./calculators.js";
import {ASSETS} from "./brand-assets.js";
import {createWorkspaceSync} from "./workspace-sync.js";
import {revokeOffline} from "./offline-access.js";
import {sortedChats,renameChat,pinChat,removeChat,previewChat,restoredChatScroll} from "./chat-management.js";
import {renderAssistant} from "./chat-format.js";
const $=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const num=v=>Number(v).toLocaleString("pt-BR",{maximumFractionDigits:3});
const date=v=>new Date(v).toLocaleDateString("pt-BR");
const uid=()=>globalThis.crypto?.randomUUID?.()||String(Date.now()+Math.random());
const key="agronexo-v2:"+String(window.AGRONEXO_USER?.id||"isolated");
if(window.AGRONEXO_ADMIN&&!localStorage.getItem(key)&&localStorage.getItem("agronexo-v1")){
  // Migração restrita ao administrador da instalação anterior.
  localStorage.setItem(key,localStorage.getItem("agronexo-v1"));
  localStorage.removeItem("agronexo-v1");
}
const defaultState={projects:[],quotes:[],notes:[],calcHistory:[],chats:[],selectedChat:null};
function normalizeState(raw){
 const src=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw:{};
 const arr=k=>Array.isArray(src[k])?src[k].filter(x=>x&&typeof x==="object"&&!Array.isArray(x)):[];
 const chats=arr("chats").filter(c=>c.id!=null&&Array.isArray(c.messages)).map(c=>({
  ...c,title:String(c.title||"Nova conversa").slice(0,80),
  messages:c.messages.filter(m=>m&&["user","assistant"].includes(m.role)&&typeof m.content==="string")
    .map(m=>({...m,content:m.content.slice(0,30000)}))
 }));
 const current=chats.some(c=>c.id===src.selectedChat)?src.selectedChat:null;
 return {
  projects:arr("projects"),quotes:arr("quotes"),notes:arr("notes"),
  calcHistory:arr("calcHistory").slice(0,150),chats,
  selectedChat:current
 };
}
function load(){try{return normalizeState(JSON.parse(localStorage.getItem(key)||"{}"))}catch{return normalizeState(defaultState)}}
let state=load(),workspaceSync=null,cloudState=window.AGRONEXO_OFFLINE?"offline":"syncing",pendingSync=0;
const persistLocal=()=>{localStorage.setItem(key,JSON.stringify(state))};
const save=()=>{try{persistLocal();workspaceSync?.save()}catch{toast("Armazenamento do navegador cheio. Exporte seus dados nas configurações.")}};
const syncLabels={syncing:"Sincronizando",synced:"Salvo na nuvem",offline:"Offline · dados locais",pending:"Alterações pendentes",quota:"Memória local cheia"};
function syncDisplay(){
 const message=(window.AGRONEXO_OFFLINE?"Modo offline · dados no aparelho":(syncLabels[cloudState]||"Aguardando"))+(pendingSync?" ("+pendingSync+")":"");
 for(const el of (document.querySelectorAll?.("[data-cloud-status]")||[]))el.textContent=message;
}
const app=$("#app");
function updateVisualHeight(){
 const h=window.visualViewport?.height||window.innerHeight;
 if(Number.isFinite(h)&&h>200)document.documentElement.style.setProperty("--ag-vh",h+"px");
 // Oculta a navegação inferior somente enquanto o teclado ocupa a viewport.
 const screen=window.innerHeight||h;
 const active=document.activeElement;
 const textFocused=!!active&&(/^(TEXTAREA|SELECT)$/.test(active.tagName)||active.tagName==="INPUT"&&!["checkbox","radio","file","button"].includes(active.type));
 document.body?.classList?.toggle("keyboard-open",screen-h>150||(textFocused&&window.innerWidth<=850));
}
updateVisualHeight();
window.visualViewport?.addEventListener("resize",updateVisualHeight);
window.addEventListener("resize",updateVisualHeight);
const iconLink=document.createElement("link");iconLink.rel="icon";iconLink.type="image/webp";iconLink.href=ASSETS.icon;document.head.append(iconLink);
let page="dashboard",filter="",group="Todas",selectedCalc=1,calcValues={},searchTimer=null,bulState={results:[],total:0,query:"",loading:false,source:"",error:"",backend:""},pendingFiles=[],recording=null,dialog=null,chatBusy=false,chatMenuId=null,chatSearch="",chatHistoryOpen=false;
const navigation=[["dashboard","⌂","Visão geral"],["calc","▦","Calculadoras"],["bulario","▤","Bulário AGROFIT"],["chat","◈","Sebastião IA"],["projects","◫","Projetos e áreas"],["quotes","≋","Cotações"],["notes","✎","Caderno de campo"],["settings","⚙","Configurações"]];
function toast(t){$(".toast")?.remove();const e=document.createElement("div");e.className="toast";e.textContent=t;document.body.append(e);setTimeout(()=>e.remove(),4300)}
function pageTitle(){return navigation.find(x=>x[0]===page)?.[2]||"AGRONEXO"}
function shell(){document.body?.classList?.remove("drawer-open");app.innerHTML='<div class="shell"><aside class="sidebar" id="side"><div class="brand"><img src="'+ASSETS.logo+'" alt="Agronexo — logotipo oficial" class="brand-logo"><button class="drawer-close" data-action="close-menu" aria-label="Fechar menu">×</button></div><nav class="nav"><p class="nav-caption">Workspace</p>'+navigation.map(([id,ico,label])=>'<button class="'+(id===page?"active":"")+'" data-nav="'+id+'"><span class="nav-icon">'+ico+'</span>'+label+'</button>').join("")+'</nav><div class="side-bottom"><div class="side-seb-head"><img class="side-seb-avatar" src="'+ASSETS.sebAvatar+'" alt="Sebastião, assistente da Agronexo"><b>Converse com o Sebastião</b></div><p>Conhecimento do campo. Proximidade em cada conversa.</p><button data-nav="chat">Abrir conversa →</button></div><p class="side-note">AGRONEXO · Campo. Conexão. Conhecimento.</p></aside><button class="drawer-shade" data-action="close-menu" aria-label="Fechar menu lateral"></button><main class="main"><header class="topbar"><div class="top-left"><button class="mobile-menu" data-action="menu">☰</button><div><p class="crumb">Plataforma / Área de trabalho</p><h2>'+esc(pageTitle())+'</h2></div></div><div class="top-right">'+(window.AGRONEXO_ADMIN?'<button class="btn btn-light admin-open-btn" data-action="admin-panel">Administração</button>':"")+'<button type="button" class="btn btn-light ag-install-shortcut" data-action="install-app" aria-label="Instalar AGRONEXO como aplicativo">Instalar app</button><span class="signal"><i class="dot"></i> <span data-cloud-status>Sincronizando</span></span><img class="top-brand-icon" src="'+ASSETS.icon+'" alt="Ícone Agronexo"></div></header><section class="content '+(page==="chat"?"chat-content":"")+'" id="content"></section><nav class="bottom-nav" aria-label="Navegação principal">'+[["dashboard","⌂","Início"],["calc","▦","Cálculos"],["bulario","▤","Bulário"],["chat","◈","Sebastião"]].map(([id,ico,name])=>'<button type="button" class="'+(page===id?"active":"")+'" data-nav="'+id+'" aria-label="'+name+'"'+(page===id?' aria-current="page"':"")+'><span class="bottom-icon">'+ico+'</span><span>'+name+'</span></button>').join("")+'<button type="button" data-action="menu" aria-label="Abrir todos os módulos"><span class="bottom-icon">☰</span><span>Mais</span></button></nav></main></div>';renderContent();syncDisplay();}
function navigate(p){if(!navigation.some(x=>x[0]===p))return;document.body?.classList?.remove("drawer-open");clearTimeout(searchTimer);if(bularioController)bularioController.abort();page=p;filter="";group="Todas";window.scrollTo(0,0);shell()}
function head(kicker,title,subtitle,action=""){return '<div class="pagehead"><div><div class="eyebrow">'+kicker+'</div><h1>'+title+'</h1><p class="muted">'+subtitle+'</p></div>'+action+'</div>'}
function empty(icon,title,desc){return '<div class="empty"><div style="font-size:28px">'+icon+'</div><h3>'+title+'</h3><p>'+desc+'</p></div>'}
function renderContent(){const root=$("#content");if(!root)return;({dashboard,calc:calculators,bulario:bulario,chat:chat,projects:projects,quotes:quotes,notes:notes,settings:settings}[page]||dashboard)(root)}
function dashboard(root){const history=state.calcHistory.slice(0,4);root.innerHTML='<div class="hero"><div style="position:relative;z-index:2"><div class="eyebrow">BEM-VINDO À PLATAFORMA</div><h1>Conhecimento que<br><em>conecta o campo.</em></h1><p>Campo. Conexão. Conhecimento. Ferramentas agronômicas, consulta de defensivos e o Sebastião para ajudar no dia a dia — tudo em um só lugar.</p><button class="btn btn-accent" data-nav="calc" style="margin-top:22px">Explorar ferramentas →</button></div><div class="hero-visual"><img src="'+ASSETS.sebFull+'" alt="Sebastião, mascote oficial Agronexo, com chapéu, uniforme de campo e tablet"></div></div><div class="stats">'+[["49","Calculadoras disponíveis","11 áreas de conhecimento"],[state.projects.length,"Áreas cadastradas","Gestão de propriedades"],[state.quotes.length,"Cotações registradas","Comparativos locais"],[state.calcHistory.length,"Cálculos realizados","Histórico no dispositivo"]].map(a=>'<div class="card stat"><p class="stat-label">'+a[1]+'</p><p class="stat-number">'+a[0]+'</p><p class="stat-bottom">'+a[2]+'</p></div>').join("")+'</div><div class="twocol"><div class="card section-card"><div style="display:flex;justify-content:space-between;align-items:center"><h3 class="section-title">Acesso rápido</h3><span class="pill">Ferramentas</span></div><div class="quickgrid">'+[["calc","▦","49 calculadoras"],["bulario","▤","Consultar defensivos"],["chat","◈","Perguntar ao Sebastião"],["projects","◫","Minhas áreas"]].map(a=>'<button class="quick" data-nav="'+a[0]+'"><span class="icon-wrap">'+a[1]+'</span><strong>'+a[2]+' →</strong></button>').join("")+'</div></div><div class="card section-card"><h3 class="section-title">Atividade recente</h3>'+(history.length?history.map(h=>'<div class="activity"><span class="mini-symbol">∑</span><div><div class="activity-title">'+esc(h.name)+'</div><p>'+esc(h.result)+' '+esc(h.unit)+'</p></div><span class="activity-time">'+date(h.time)+'</span></div>').join(""):empty("◷","Tudo começa aqui","Os cálculos realizados aparecerão neste espaço."))+'</div></div><div class="footer-note">Plataforma de apoio à decisão · resultados exigem validação agronômica</div>'}
function calculators(root){if(selectedCalc==="open")return calcDetail(root);const list=CALCS.filter(c=>(group==="Todas"||c.group===group)&&(c.title+" "+c.group).toLowerCase().includes(filter.toLowerCase()));root.innerHTML=head("FERRAMENTAS DE PRECISÃO","Calculadoras agronômicas","49 ferramentas organizadas por etapa da produção, com fórmulas transparentes.",'<span class="pill">'+list.length+' ferramentas</span>')+'<div class="toolbar"><div class="search"><span>⌕</span><input id="calc-search" placeholder="Buscar ferramenta ou assunto..." value="'+esc(filter)+'"></div><button class="btn btn-ghost" data-action="calc-history">Histórico</button></div><div class="chiprow">'+["Todas",...GROUPS].map(g=>'<button class="chip '+(group===g?"active":"")+'" data-group="'+esc(g)+'">'+esc(g)+'</button>').join("")+'</div><div class="catalog">'+list.map(c=>'<button class="tool-card" data-calc="'+c.id+'"><span class="tool-no">'+String(c.id).padStart(2,"0")+'</span><b>'+esc(c.title)+'</b><small>'+esc(c.group)+' →</small></button>').join("")+'</div>'+(list.length?"":empty("⌕","Nenhuma ferramenta","Tente outro termo de busca."))}
function calcDetail(root){const c=CALCS.find(x=>x.id===Number(selectedCalc));if(!c)return;const v={};c.fields.forEach(f=>{v[f.key]=calcValues[f.key]??f.value});const result=runCalc(c,v);root.innerHTML=head(c.group,'0'+c.id+' · '+esc(c.title),"Ferramenta "+c.id+" de 49 · Preencha os campos para calcular.",'<button class="btn btn-ghost" data-action="back-calcs">← Todas as calculadoras</button>')+'<div class="calc-layout"><div class="card calc-form"><h3 class="section-title">Dados para o cálculo</h3><div class="fieldgrid">'+c.fields.map(f=>'<div class="field"><label for="f-'+f.key+'">'+esc(f.label)+'</label><div class="field-inner"><input id="f-'+f.key+'" type="number" step="any" min="'+f.min+'" '+(f.max==null?"":'max="'+f.max+'"')+' data-calc-field="'+f.key+'" value="'+esc(v[f.key])+'"><span>'+esc(f.unit)+'</span></div></div>').join("")+'</div><div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:24px"><button class="btn" data-action="calc-save">Salvar resultado</button><button class="btn btn-light" data-action="calc-reset">Restaurar exemplo</button></div><div class="notice warning">Os valores preenchidos são exemplos. Ajuste todos os parâmetros com dados reais. O AGRONEXO não prescreve insumos ou defensivos.</div></div><div><div class="result-card"><p class="eyebrow">RESULTADO CALCULADO</p><div class="result-value" id="calc-number">'+(result.error?"—":num(result.value))+'</div><div class="result-unit">'+esc(c.unit)+'</div><p class="calc-error" id="calc-error" role="status" aria-live="polite">'+(result.error?esc(result.error):"")+'</p><p class="result-formula"><b>Metodologia:</b> '+esc(c.formula)+'</p></div><div class="notice">'+esc(c.note)+'</div></div></div>'}
function updateCalc(){
 const c=CALCS.find(x=>x.id===Number(selectedCalc));if(!c)return;
 const v={};c.fields.forEach(f=>v[f.key]=calcValues[f.key]??f.value);
 const r=runCalc(c,v),result=$("#calc-number"),error=$("#calc-error");
 if(result)result.textContent=r.error?"—":num(r.value);
 if(error)error.textContent=r.error||"";
}
function calcHistoryModal(){dialog={type:"history"};openDialog('<h2>Histórico de cálculos</h2>'+(state.calcHistory.length?'<div style="max-height:360px;overflow:auto">'+state.calcHistory.map(h=>'<div class="activity"><span class="mini-symbol">∑</span><div><div class="activity-title">'+esc(h.name)+'</div><p>'+esc(h.result)+' '+esc(h.unit)+'</p></div><span class="activity-time">'+date(h.time)+'</span></div>').join("")+'</div>':empty("◷","Sem registros","Salve um cálculo para vê-lo aqui."))+'<div class="modal-actions"><button class="btn btn-light" data-action="close-modal">Fechar</button></div>')}
const AGROFIT_SOURCE="https://dados.agricultura.gov.br/dataset/sistema-de-agrotoxicos-fitossanitarios-agrofit";
const AGROFIT_CONSULTA="https://agrofit.agricultura.gov.br/agrofit_cons/principal_agrofit_cons";
function officialButton(text= "Abrir consulta oficial AGROFIT ↗"){
 return '<a class="btn btn-ghost" href="'+AGROFIT_CONSULTA+'" target="_blank" rel="noopener noreferrer">'+text+'</a>';
}
function bulario(root){
 root.innerHTML=head("BASE REGULATÓRIA","Bulário AGROFIT","Pesquise ingredientes ativos, marcas comerciais e números de registro no catálogo público do MAPA.",'<span class="pill">Dados oficiais</span>')+
 '<div class="notice" style="margin-bottom:15px">O AGRONEXO pesquisa o cadastro público de produtos formulados. Os PDFs de bula só são apresentados diretamente quando houver um endereço identificável na fonte oficial. Para consultar a bula vigente, confira o produto na <a href="'+AGROFIT_CONSULTA+'" target="_blank" rel="noopener noreferrer">Consulta Aberta do AGROFIT ↗</a>. Não aplique produtos com base apenas neste resumo.</div>'+
 '<div class="card bulario-panel"><div class="toolbar"><div class="search bulario-search"><span>⌕</span><input id="bulario-search" type="search" autocomplete="off" aria-label="Buscar produto ou ingrediente ativo" placeholder="Ex.: glifosato, 2,4-D, produto ou registro" value="'+esc(bulState.query)+'"></div><button class="btn" data-action="bulario-reload">Pesquisar</button></div><div class="bulario-examples"><span>Experimente:</span><button class="chip" data-bulario-example="glifosato">Glifosato</button><button class="chip" data-bulario-example="2,4-D">2,4-D</button><button class="chip" data-bulario-example="atrazina">Atrazina</button></div><div id="bulario-results" role="status" aria-live="polite"></div></div>';
 updateBulContent()
}
function updateBulContent(){
 const el=$("#bulario-results");if(!el)return;
 if(bulState.loading){el.innerHTML=empty("◷","Consultando o MAPA","A primeira busca pode demorar enquanto a base oficial é consultada.")+
   '<p class="muted" style="text-align:center;margin:0 0 16px">Se o servidor público não responder, o sistema mostrará como continuar na consulta oficial.</p>';return}
 if(bulState.error){
  el.innerHTML='<div class="notice warning"><b>Consulta indisponível</b><p style="margin:9px 0">'+esc(bulState.error)+'</p><p>A pesquisa não retornou registros verificáveis. Isso não indica ausência de registro do ingrediente ativo.</p><div class="bul-actions" style="margin-top:13px">'+officialButton()+'<button class="btn btn-light" data-action="bulario-reload">Tentar novamente</button></div></div>';return
 }
 if(!bulState.query||bulState.query.length<2){
  el.innerHTML=empty("⌕","Consulte um produto ou ativo","Digite ao menos dois caracteres para encontrar registros do AGROFIT.")+
   '<div class="bul-actions" style="justify-content:center;margin:6px 0 15px">'+officialButton()+'</div>';return
 }
 if(!bulState.results.length){
  el.innerHTML=empty("⌕","Nenhum resultado confirmado","Não foram encontrados registros correspondentes nesta consulta. Experimente o nome comercial ou verifique no AGROFIT.")+
  '<div class="bul-actions" style="justify-content:center;margin-bottom:18px">'+officialButton()+'</div>';return
 }
 const visible=bulState.results.length;
 el.innerHTML='<div class="bul-results-head"><div><strong>'+num(bulState.total)+' resultado(s)</strong><p class="muted">'+visible+' registro(s) exibido(s) · Fonte: MAPA/AGROFIT'+(bulState.backend==="csv-stream"?" (CSV)":"")+'</p></div>'+officialButton("Consultar bulas no MAPA ↗")+'</div>'+
 '<div class="bul-result-grid">'+bulState.results.map((p,i)=>{
  const badges='<span class="tag">'+esc(p.classe||"Produto formulado")+'</span>';
  return '<article class="bul-product card"><div class="bul-product-head">'+badges+(p.registro?'<span class="muted">Registro '+esc(p.registro)+'</span>':"")+'</div><h3>'+esc(p.nome||"Produto cadastrado")+'</h3><p class="bul-active"><b>Ingrediente ativo:</b> '+esc(p.ativo||"Consulte cadastro oficial")+'</p><div class="bul-actions"><button class="btn btn-light" data-bulario-detail="'+i+'">Informações e bula →</button></div></article>'
 }).join("")+'</div>'+
 '<p class="source" style="margin-top:16px">Fonte: Ministério da Agricultura e Pecuária. Dados abertos AGROFIT (CC BY). Consulte sempre o registro e a bula vigente antes de qualquer uso.</p>';
}
let bularioController=null;
async function fetchBulario(){
 const q=($("#bulario-search")?.value??bulState.query??"").trim();
 bulState.query=q;
 if(q.length<2){bulState.results=[];bulState.total=0;bulState.error="";bulState.loading=false;updateBulContent();return}
 if(bularioController)bularioController.abort();
 const controller=new AbortController();bularioController=controller;
 bulState.loading=true;bulState.error="";updateBulContent();
 const timer=setTimeout(()=>controller.abort(),52000);
 try{
  const response=await fetch("/api/bulario?q="+encodeURIComponent(q),{signal:controller.signal,cache:"no-store"});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||"A pesquisa não pôde ser concluída.");
  if(bulState.query!==q)return;
  bulState.results=Array.isArray(data.results)?data.results:[];
  bulState.total=Number(data.total)||0;
  bulState.backend=data.backend||"oficial";
  bulState.error="";
 }catch(e){
  if(controller.signal.aborted&&bularioController!==controller)return;
  if(bulState.query!==q)return;
  bulState.error=e.name==="AbortError"?"A consulta demorou mais do que o esperado. Tente novamente ou use o portal do MAPA.":e.message;
  bulState.results=[];bulState.total=0;
 }finally{
  clearTimeout(timer);
  if(bularioController===controller){
   bularioController=null;bulState.loading=false;updateBulContent();
  }
 }
}
function bularioDetails(i){
 const p=bulState.results[Number(i)];if(!p)return;
 const row=(label,value)=>value?'<div class="bul-detail-row"><b>'+label+'</b><span>'+esc(value)+'</span></div>':"";
 const url=typeof p.bulaUrl==="string"&&/^https:\/\/[a-z0-9.-]+\.gov\.br\//i.test(p.bulaUrl)?p.bulaUrl:null;
 openDialog('<div class="bul-detail"><span class="pill">MAPA · Produto formulado</span><h2 style="margin-top:12px">'+esc(p.nome||"Registro AGROFIT")+'</h2>'+
 row("Registro",p.registro)+row("Ingrediente ativo / concentração",p.ativo)+row("Classe",p.classe)+row("Titular do registro",p.titular)+
 row("Classificação toxicológica",p.toxico)+row("Classificação ambiental",p.ambiental)+
 '<div class="notice warning"><b>Bula e rótulo:</b> o catálogo CSV não assegura um PDF por produto. Para verificar instruções de uso, culturas autorizadas, dose, carência e restrições, consulte a bula vigente no AGROFIT. Não use estimativas não verificadas.</div>'+
 '<div class="bul-actions">'+(url?'<a class="btn" target="_blank" rel="noopener noreferrer" href="'+esc(url)+'">Abrir PDF da bula ↗</a>':'')+
 officialButton("Consultar bula no AGROFIT ↗")+
 '<button class="btn btn-light" data-bula-lookup="'+i+'">Procurar ficha na Embrapa</button>'+
 '<button class="btn btn-light" data-action="close-modal">Fechar</button></div>'+
 '<p class="muted" id="bula-lookup-status" aria-live="polite" style="margin-top:12px"></p></div>');
}
async function checkBulaEmbrapa(i){
 const p=bulState.results[Number(i)];if(!p||!p.nome)return;
 const target=$("#bula-lookup-status");
 if(target)target.textContent="Verificando a página pública da Embrapa...";
 try{
  const response=await fetch("/api/bula?nome="+encodeURIComponent(p.nome),{cache:"no-store"});
  const data=await response.json();
  const found=Boolean(data.encontrado)&&/^https:\/\/www\.atermaisdigital\.cnptia\.embrapa\.br\/web\/controle-de-pragas\/w\/[a-z0-9-]+$/i.test(data.url||"");
  if(!target)return;
  if(found){
   target.innerHTML='<a class="btn btn-light" href="'+esc(data.url)+'" target="_blank" rel="noopener noreferrer">Abrir ficha na Embrapa ↗</a><p style="margin-top:8px">'+
      (data.documentosPossiveis?"Há indicação de documento de bula nesta página. Confira a versão e data antes de usar.":"Confira se há documentos de bula disponíveis na ficha oficial.")+'</p>';
  }else target.textContent=data.nota||"Não foi encontrada uma ficha confirmada. Use a consulta AGROFIT/MAPA.";
 }catch(e){if(target)target.textContent="A consulta à Embrapa está indisponível neste momento. Use o AGROFIT/MAPA."}
}

function projects(root){root.innerHTML=head("GESTÃO DE ÁREAS","Projetos e propriedades","Cadastre propriedades e talhões para manter sua operação organizada.",'<button class="btn" data-action="project-new">+ Nova área</button>')+(state.projects.length?'<div class="cards-two">'+state.projects.map(p=>'<div class="card info-card"><span class="pill">Área cadastrada</span><h3 style="margin-top:14px">'+esc(p.name)+'</h3><p>'+esc(p.crop||"Cultura não informada")+' · '+num(p.hectares)+' ha</p><p>'+esc(p.city||"Localização não informada")+'</p><div style="margin-top:18px"><button class="btn btn-light" data-remove="projects" data-id="'+p.id+'">Excluir</button></div></div>').join("")+'</div>':empty("◫","Sua primeira propriedade","Comece cadastrando uma área para acompanhar informações da sua operação."))}
function quotes(root){root.innerHTML=head("GESTÃO DE PREÇOS","Cotações agrícolas","Registre e compare preços de insumos ou commodities, com data e fornecedor.",'<button class="btn" data-action="quote-new">+ Nova cotação</button>')+'<div class="card table-wrap">'+(state.quotes.length?'<table class="data-table"><thead><tr><th>Item</th><th>Fornecedor</th><th>Preço</th><th>Unidade</th><th>Data</th><th></th></tr></thead><tbody>'+state.quotes.map(q=>'<tr><td><strong>'+esc(q.item)+'</strong></td><td>'+esc(q.supplier)+'</td><td>'+money(q.price)+'</td><td>'+esc(q.unit)+'</td><td>'+date(q.time)+'</td><td><button class="btn btn-light" data-remove="quotes" data-id="'+q.id+'">Excluir</button></td></tr>').join("")+'</tbody></table>':empty("≋","Sem cotações","Registre valores para comparar preços e acompanhar negociações."))+'</div>'}
function notes(root){root.innerHTML=head("ROTINA DO CAMPO","Caderno de campo","Guarde ocorrências, observações, amostragens e atividades.",'<button class="btn" data-action="note-new">+ Nova anotação</button>')+(state.notes.length?'<div class="cards-two">'+state.notes.map(n=>'<div class="card info-card"><span class="pill">'+date(n.time)+'</span><h3 style="margin-top:15px">'+esc(n.title)+'</h3><p style="white-space:pre-wrap">'+esc(n.body)+'</p><div style="margin-top:15px"><button class="btn btn-light" data-remove="notes" data-id="'+n.id+'">Excluir</button></div></div>').join("")+'</div>':empty("✎","Seu caderno está vazio","Registre informações das visitas técnicas e acompanhe atividades."))}
function settings(root){root.innerHTML=head("PREFERÊNCIAS","Configurações e dados","Transparência, fontes, armazenamento e integrações.")+'<div class="cards-two"><div class="card info-card"><h3>Dados e sincronização</h3><p>Projetos, cotações, caderno de campo e conversas do Sebastião são vinculados à sua conta no Supabase. Uma cópia local protege alterações feitas sem internet, que serão enviadas quando a conexão retornar. Histórico das calculadoras permanece apenas neste dispositivo. O modo offline exige uma autorização com PIN neste aparelho, válida por 7 dias. O navegador precisa ter carregado o aplicativo online ao menos uma vez.</p><p><strong data-cloud-status>Sincronizando</strong></p><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:19px"><button class="btn" data-action="sync-now">Sincronizar agora</button><button class="btn btn-light" data-action="enable-offline">Habilitar acesso offline</button><button class="btn btn-light" data-action="reconnect">Reconectar conta</button><button class="btn btn-ghost" data-action="relogin">Entrar novamente para sincronizar</button><button class="btn btn-light" data-action="export">Exportar backup JSON</button><button class="btn btn-light" data-action="import">Importar backup</button><button class="btn btn-light" data-action="clear-local" style="color:#a12c2c">Limpar cópia local</button><button class="btn btn-ghost" data-action="logout">Sair da conta</button><button class="btn btn-light" data-action="install-app">Instalar aplicativo</button></div></div><div class="card info-card"><h3>Assistente Sebastião</h3><p>O Sebastião usa a API Gemini do Google pelo servidor; a chave nunca fica no navegador. Configure GEMINI_API_KEY na Vercel para ativar texto, imagem, áudio e vídeo.</p><p>Vídeos pequenos (até 2,2 MB) podem ser enviados com áudio; vídeos maiores são analisados por três quadros, sem áudio. As conversas em texto são sincronizadas entre dispositivos da mesma conta. Anexos multimídia são processados e não ficam armazenados na nuvem.</p><button class="btn btn-ghost" data-nav="chat" style="margin-top:16px">Abrir assistente →</button></div><div class="card info-card"><h3>Fontes científicas e regulatórias</h3><p>Bulário: arquivos CSV públicos AGROFIT/MAPA, publicados sob CC BY. A plataforma não copia integralmente conteúdos editoriais da Embrapa e não possui acesso privilegiado à API protegida.</p><a class="btn btn-light" href="'+AGROFIT_SOURCE+'" target="_blank" rel="noopener" style="margin-top:14px">Ver base oficial ↗</a></div><div class="card info-card"><h3>Uso técnico responsável</h3><p>Os 49 módulos apresentam estimativas matemáticas. Alguns métodos dependem de coeficientes e tabelas regionais. A decisão de aplicar fertilizantes, corretivos e defensivos deve considerar recomendações oficiais e profissional habilitado.</p><p>AGRONEXO · Protótipo funcional em evolução.</p></div></div><input hidden type="file" accept="application/json" id="import-file">'}
function activeChat(){let c=state.chats.find(x=>x.id===state.selectedChat);if(!c){c={id:uid(),title:"Nova conversa",time:new Date().toISOString(),messages:[]};state.chats.unshift(c);state.selectedChat=c.id;save()}return c}
function chatListMarkup(){
 const all=sortedChats(state.chats),found=all.filter(c=>String(c.title||"").toLocaleLowerCase("pt-BR").includes(chatSearch.toLocaleLowerCase("pt-BR")));
 if(!found.length)return '<p class="chat-no-results">'+(chatSearch?"Nenhuma conversa encontrada.":"Suas conversas aparecerão aqui.")+'</p>';
 return found.map(t=>{
  const id=esc(String(t.id)),current=t.id===state.selectedChat,pin=Boolean(t.pinned);
  return '<div class="chat-conversation'+(current?" active":"")+'">'+
   '<button type="button" class="chat-select" data-chat="'+id+'" aria-current="'+(current?"true":"false")+'" title="'+esc(t.title)+'">'+
    (pin?'<span class="chat-pin-symbol" aria-label="Fixada">◆</span>':'<span class="chat-dot" aria-hidden="true">◈</span>')+
    '<span class="chat-select-text"><strong>'+esc(t.title||"Nova conversa")+'</strong><small>'+esc(previewChat(t))+'</small></span></button>'+
   '<button type="button" class="chat-more" data-chat-menu="'+id+'" aria-label="Opções de '+esc(t.title||"conversa")+'" aria-expanded="'+(chatMenuId===t.id)+'">⋯</button>'+
   (chatMenuId===t.id?'<div class="chat-context" role="group" aria-label="Opções da conversa">'+
    '<button type="button" data-chat-command="rename" data-chat-id="'+id+'">✎ Renomear</button>'+
    '<button type="button" data-chat-command="pin" data-chat-id="'+id+'">'+(pin?"◇ Desafixar":"◆ Fixar no topo")+'</button>'+
    '<button type="button" class="danger" data-chat-command="delete" data-chat-id="'+id+'">Excluir conversa</button>'+
   '</div>':"")+
  '</div>';
 }).join("");
}
function refreshChatList(){
 const list=$("#chat-list");if(list)list.innerHTML=chatListMarkup();
}
function chat(root,{previousScroll=null}={}){
 const c=activeChat(),pinnedCount=state.chats.filter(c=>c.pinned).length;
 const messages=c.messages.length?c.messages.map((m,i)=>{
  const ai=m.role!=="user",time=new Date(m.time||Date.now()).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
  return '<article class="bubble '+(ai?"assistant":"user")+'" aria-label="'+(ai?"Resposta do Sebastião":"Sua mensagem")+'">'+
   (ai?'<div class="chat-message-label">SEBASTIÃO</div><div class="chat-rich">'+renderAssistant(m.content)+'</div>':'<div class="chat-user-text">'+esc(m.content)+'</div>')+
   '<div class="chat-message-foot"><small>'+time+'</small>'+(ai?'<button type="button" data-chat-copy="'+i+'" title="Copiar resposta" aria-label="Copiar resposta">Copiar</button>':"")+'</div></article>';
 }).join(""):'<div class="chat-welcome"><img class="seb-avatar" src="'+ASSETS.sebAvatar+'" alt="Sebastião, assistente do AGRONEXO"><h2>O que vamos resolver no campo hoje?</h2><p>Sou Sebastião, seu parceiro na agronomia. Tire dúvidas, interprete informações e organize o trabalho rural.</p><div class="suggestions">'+["Como interpretar uma análise de solo?","Calcule a população de plantas por hectare","Qual a diferença entre pH e CTC?"].map(t=>'<button type="button" data-prompt="'+esc(t)+'">'+esc(t)+'</button>').join("")+'</div></div>';
 root.innerHTML='<div class="card chat-frame'+(chatHistoryOpen?" show-history":"")+'">'+
 '<button class="chat-history-shade" type="button" data-action="chat-close-history" aria-label="Fechar histórico"></button>'+
 '<aside class="chat-rail" id="chat-rail" aria-label="Histórico de conversas">'+
 '<div class="chat-rail-top"><div><strong>Conversas</strong><small>'+state.chats.length+' no histórico'+(pinnedCount?' · '+pinnedCount+' fixada(s)':'')+'</small></div><button type="button" data-action="chat-close-history" class="chat-rail-close" aria-label="Fechar histórico">×</button></div>'+
 '<button class="btn chat-new" type="button" data-action="new-chat">＋ Nova conversa</button>'+
 '<label class="chat-search-label" for="chat-search">Buscar conversa<input id="chat-search" type="search" placeholder="Buscar no histórico" value="'+esc(chatSearch)+'" autocomplete="off"></label>'+
 '<div id="chat-list" class="chat-list" aria-label="Lista de conversas">'+chatListMarkup()+'</div>'+
 '<p class="chat-rail-foot">Histórico sincronizado na sua conta.</p></aside>'+
 '<section class="chat-main" aria-label="Conversa com Sebastião">'+
 '<header class="chat-head"><img class="seb-avatar" src="'+ASSETS.sebAvatar+'" alt="Sebastião">'+
 '<div class="chat-ident"><b>Sebastião <span class="chat-ai-tag">IA AGRONÔMICA</span></b><p>'+esc(c.title||"Nova conversa")+'</p></div>'+
 '<button type="button" class="btn btn-light chat-history-toggle" data-action="chat-history" aria-label="Abrir histórico"><span class="chat-menu-icon" aria-hidden="true">☰</span><span class="chat-history-label">Conversas</span></button>'+
 '<button type="button" class="chat-header-new" data-action="new-chat" aria-label="Nova conversa" title="Nova conversa">＋</button></header>'+
 '<div class="messages" id="messages" role="log" aria-label="Mensagens" aria-live="polite">'+messages+'</div>'+
 '<div class="composer"><div id="attachment-info" class="attachment-info" aria-live="polite"></div>'+
 '<div class="composer-input"><button type="button" class="round" data-action="attach" title="Enviar foto, áudio ou vídeo" aria-label="Anexar arquivo">＋</button>'+
 '<button type="button" class="round" data-action="mic" title="Gravar áudio" aria-label="Gravar áudio">◉</button>'+
 '<textarea id="chat-text" placeholder="Pergunte ao Sebastião..." rows="1" aria-label="Mensagem ao Sebastião"></textarea>'+
 '<button type="button" class="round send" data-action="send-chat" title="Enviar mensagem" aria-label="Enviar mensagem">↑</button></div>'+
 '<div class="chat-disclaimer">Respostas geradas por IA podem conter erros. Confira bulas, fontes oficiais e orientações técnicas.</div>'+
 '<input id="chat-file" type="file" accept="image/*,video/*,audio/*" hidden multiple></div></section></div>';
 setTimeout(()=>{const pane=$("#messages");if(pane)pane.scrollTop=previousScroll?
  restoredChatScroll(previousScroll.top,previousScroll.height,previousScroll.viewport,pane.scrollHeight,pane.clientHeight):pane.scrollHeight},0);
}

async function readFile(f){const limit=12*1024*1024;if(f.size>limit)throw Error("Arquivo muito grande: máximo de 12 MB.");return await new Promise((resolve,reject)=>{const rd=new FileReader();rd.onload=()=>resolve(String(rd.result));rd.onerror=reject;rd.readAsDataURL(f)})}
async function videoFrames(file){const url=URL.createObjectURL(file);const video=document.createElement("video");video.preload="auto";video.muted=true;video.src=url;await new Promise((resolve,reject)=>{video.onloadedmetadata=resolve;video.onerror=()=>reject(Error("Vídeo inválido."));setTimeout(()=>reject(Error("Não foi possível ler o vídeo.")),10000)});const duration=Math.min(video.duration||1,120),out=[];try{for(const at of [0.15,0.5,0.85]){video.currentTime=Math.min(duration*at,Math.max(0,duration-.08));await new Promise((resolve,reject)=>{video.onseeked=resolve;video.onerror=()=>reject(Error("Falha ao obter quadro."));setTimeout(resolve,2500)});const cv=document.createElement("canvas");cv.width=576;cv.height=Math.round(576*(video.videoHeight||9)/(video.videoWidth||16));cv.getContext("2d").drawImage(video,0,0,cv.width,cv.height);out.push({type:"image",data:cv.toDataURL("image/jpeg",0.68),name:file.name+" (quadro "+Math.round(at*100)+"%)"})}}finally{URL.revokeObjectURL(url);video.remove()}return out}
async function imageData(file){
  if(!file.type.match(/^image\/(png|jpeg|webp)$/i)){throw Error("Use fotos JPG, PNG ou WebP.");}
  const url=URL.createObjectURL(file);
  try{
    const img=document.createElement("img");
    img.src=url;
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error("Não consegui abrir a foto."))});
    const scale=Math.min(1,1280/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement("canvas");
    canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
    canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
    canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
    const data=canvas.toDataURL("image/jpeg",0.7);
    if(data.length>1500000)throw Error("A imagem não pôde ser reduzida. Tente uma foto menor.");
    return data;
  }finally{URL.revokeObjectURL(url)}
}
async function attachments(files){
  pendingFiles=[];
  const selected=Array.from(files||[]).slice(0,4);
  for(const f of selected){
    try{
      if(f.type.startsWith("image/")){
        pendingFiles.push({type:"image",data:await imageData(f),name:f.name});
      }else if(f.type.startsWith("audio/")){
        if(f.size>2400000)throw Error("Áudio muito grande. Envie até aproximadamente 2,4 MB.");
        pendingFiles.push({type:"audio",data:await readFile(f),name:f.name});
      }else if(f.type.startsWith("video/")){
        if(f.size<=2200000&&/^(video\/mp4|video\/webm|video\/quicktime)$/i.test(f.type)){
          pendingFiles.push({type:"video",data:await readFile(f),name:f.name});
        }else{
          pendingFiles.push(...await videoFrames(f));
          toast("Vídeo grande: vou analisar três quadros representativos, sem o áudio.");
        }
      }else toast("Tipo de arquivo não aceito: "+f.name);
    }catch(err){toast(err.message)}
  }
  // A Vercel limita o corpo de cada requisição a ~4,5 MB.
  let inlineChars=0;
  pendingFiles=pendingFiles.filter(f=>{
    if(f.type==="audio")return true; // transcrito em uma chamada separada
    const next=inlineChars+f.data.length;
    if(next>3200000){toast("Mídias demais para uma mensagem. Envie menos arquivos.");return false}
    inlineChars=next;return true
  });
  const el=$("#attachment-info");
  if(el)el.textContent=pendingFiles.length?pendingFiles.map(f=>f.name).join(" · ").slice(0,170):"";
}
async function transcribe(file){const r=await fetch("/api/transcribe",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({data:file.data,name:file.name})});const j=await r.json();if(!r.ok)throw Error(j.error||"Erro ao transcrever");return j.text}
async function sendChat(){
  if(window.AGRONEXO_OFFLINE||navigator.onLine===false){toast("O Sebastião precisa de internet. As conversas anteriores continuam disponíveis.");return}
  if(chatBusy)return;
  const field=$("#chat-text");
  let content=field?.value?.trim()||"";
  if(!content&&!pendingFiles.length)return;
  const conversation=activeChat(),files=pendingFiles.slice();
  pendingFiles=[];
  if(field)field.value="";
  chatBusy=true;
  const audio=files.filter(f=>f.type==="audio");
  const images=files.filter(f=>f.type==="image");
  const videos=files.filter(f=>f.type==="video");
  const visualCount=images.length;
  const display=content+(audio.length?"\n[Áudio enviado]":"")+
    (visualCount?"\n["+visualCount+" foto(s)/quadro(s) enviado(s)]":"")+
    (videos.length?"\n[Vídeo curto enviado]":"");
  const entry={role:"user",content:display,time:new Date().toISOString()};
  conversation.messages.push(entry);
  conversation.updatedAt=new Date().toISOString();
  if(conversation.messages.length===1&&!conversation.customTitle)conversation.title=(content||"Mensagem multimídia").slice(0,50);
  save();
  if(page==="chat"&&state.selectedChat===conversation.id)chat($("#content"));
  const pane=page==="chat"&&state.selectedChat===conversation.id?$("#messages"):null;
  if(pane){pane.insertAdjacentHTML("beforeend",'<div class="bubble assistant" id="thinking">Sebastião está analisando sua mensagem...</div>');pane.scrollTop=pane.scrollHeight}
  try{
    for(const a of audio){
      const transcription=await transcribe(a);
      content+=(content?"\n":"")+"Mensagem em áudio ("+a.name+"): "+transcription;
      entry.content=display+"\n[Transcrição: "+transcription+"]";
      save();
    }
    const history=conversation.messages.slice(-14).map(m=>({role:m.role,content:m.content}));
    history[history.length-1]={role:"user",content:content||"Analise os anexos enviados."};
    const response=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:history,images,videos})});
    let payload;
    try{payload=await response.json()}catch{throw Error("Resposta inesperada do servidor. Confira a publicação da API.")}
    if(!response.ok)throw Error(payload.error||"A consulta não foi concluída.");
    conversation.messages.push({role:"assistant",content:payload.reply||"Sem resposta do modelo.",time:new Date().toISOString()});
    conversation.updatedAt=new Date().toISOString();
    save();
  }catch(err){
    conversation.messages.push({role:"assistant",content:"Não foi possível processar: "+err.message,time:new Date().toISOString()});
    conversation.updatedAt=new Date().toISOString();
    save();
  }finally{chatBusy=false;if(page==="chat"&&state.selectedChat===conversation.id)chat($("#content"));workspaceSync?.syncNow()}
}
async function toggleMic(){if(recording){recording.stop();return}try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});const chunks=[],rec=new MediaRecorder(stream);recording=rec;rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};rec.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());recording=null;await attachments([new File(chunks,"gravacao.webm",{type:rec.mimeType||"audio/webm"})]);toast("Áudio preparado. Toque em enviar.")};rec.start();toast("Gravando... toque no microfone novamente para encerrar.")}catch(e){toast("Não foi possível acessar o microfone: "+e.message)}}
function openDialog(html){document.querySelector(".modal-backdrop")?.remove();const el=document.createElement("div");el.className="modal-backdrop";el.innerHTML='<div class="modal" role="dialog" aria-modal="true">'+html+'</div>';document.body.append(el)}
function formModal(type) {
  dialog = {type};
  const definitions = {
    project: {
      title: "Cadastrar área",
      fields: [
        ["name", "Nome da propriedade ou talhão", "text"],
        ["hectares", "Área em hectares", "number"],
        ["crop", "Cultura", "text"],
        ["city", "Município / UF", "text"]
      ]
    },
    quote: {
      title: "Nova cotação",
      fields: [
        ["item", "Produto ou commodity", "text"],
        ["supplier", "Fornecedor", "text"],
        ["price", "Preço (R$)", "number"],
        ["unit", "Unidade (ex.: saca, kg)", "text"]
      ]
    },
    note: {
      title: "Nova anotação",
      fields: [
        ["title", "Assunto", "text"],
        ["body", "Descrição / observação", "textarea"]
      ]
    }
  };
  const cfg = definitions[type];
  if (!cfg) return;
  const rows = cfg.fields.map(([key, label, inputType]) => {
    const id = "crud-" + key;
    const control = inputType === "textarea"
      ? '<textarea id="' + id + '" required rows="4"></textarea>'
      : '<input id="' + id + '" required type="' + inputType + '"' +
        (inputType === "number" ? ' step="any" min="0"' : "") + '>';
    return '<div class="field"><label for="' + id + '">' + label +
      '</label><div class="field-inner">' + control + '</div></div>';
  }).join("");
  openDialog('<h2>' + cfg.title + '</h2><p class="muted">Esses dados serão salvos na sua conta e poderão ser consultados em outros dispositivos.</p>' +
    '<form id="crud-form">' + rows +
    '<div class="modal-actions"><button type="button" class="btn btn-light" data-action="close-modal">Cancelar</button>' +
    '<button class="btn" type="submit">Salvar</button></div></form>');
}
function exportData(){const blob=new Blob([JSON.stringify({version:1,exported:new Date().toISOString(),...state},null,2)],{type:"application/json"});const u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download="agronexo-backup-"+new Date().toISOString().slice(0,10)+".json";a.click();URL.revokeObjectURL(u)}
async function importData(file){try{if(file.size>8e6)throw Error("Backup excede 8 MB.");const j=JSON.parse(await file.text());if(!Array.isArray(j.chats)||!Array.isArray(j.calcHistory)||!Array.isArray(j.projects)||!Array.isArray(j.quotes)||!Array.isArray(j.notes))throw Error("Formato de backup inválido.");state=normalizeState(j);save();shell();toast("Dados importados com sucesso.")}catch(e){toast(e.message)}}
document.addEventListener("click",async e=>{if(e.target.classList.contains("modal-backdrop")){$(".modal-backdrop")?.remove();return}const el=e.target.closest("[data-nav],[data-calc],[data-group],[data-action],[data-chat],[data-chat-menu],[data-chat-command],[data-chat-copy],[data-prompt],[data-remove],[data-bulario-detail],[data-bulario-example],[data-bula-lookup]");if(!el)return;if(el.dataset.nav){navigate(el.dataset.nav);return}if(el.dataset.calc){selectedCalc=Number(el.dataset.calc);calcValues={};calcDetail($("#content"));return}if(el.dataset.group){group=el.dataset.group;calculators($("#content"));return}if(el.dataset.chatMenu!==undefined){
 chatMenuId=chatMenuId===el.dataset.chatMenu?null:el.dataset.chatMenu;
 refreshChatList();return;
}
if(el.dataset.chatCommand){
 const id=el.dataset.chatId,c=state.chats.find(x=>String(x.id)===id);
 if(!c){chatMenuId=null;refreshChatList();return}
 const action=el.dataset.chatCommand;
 chatMenuId=null;
 if(action==="rename"){
  openDialog('<h2>Renomear conversa</h2><p class="muted">Escolha um nome curto para encontrar esta conversa depois.</p>'+
   '<form id="chat-rename-form" data-chat-id="'+esc(id)+'"><div class="field"><label for="chat-rename-title">Nome da conversa</label><input id="chat-rename-title" name="title" maxlength="80" value="'+esc(c.title||"Nova conversa")+'" required autofocus></div>'+
   '<div class="modal-actions"><button type="button" class="btn btn-light" data-action="close-modal">Cancelar</button><button type="submit" class="btn">Salvar nome</button></div></form>');
  $("#chat-rename-title")?.focus();return;
 }
 if(action==="pin"){state.chats=pinChat(state.chats,id);save();refreshChatList();return}
 if(action==="delete"){
  if(chatBusy&&String(state.selectedChat)===id){toast("Aguarde o Sebastião concluir a resposta antes de excluir esta conversa.");return}
  if(!window.confirm('Excluir a conversa "'+c.title+'" e todas as mensagens? A exclusão será sincronizada.')){refreshChatList();return}
  state.chats=removeChat(state.chats,id);
  if(String(state.selectedChat)===id)state.selectedChat=null;
  save();chatHistoryOpen=false;chat($("#content"));toast("Conversa excluída.");return;
 }
 return;
}
if(el.dataset.chatCopy!==undefined){
 const c=state.chats.find(x=>x.id===state.selectedChat),m=c?.messages?.[Number(el.dataset.chatCopy)];
 if(m?.role==="assistant"){
  try{await navigator.clipboard.writeText(m.content);toast("Resposta copiada.")}catch{toast("Não foi possível copiar. Selecione o texto da resposta.")}
 }
 return;
}
if(el.dataset.chat){state.selectedChat=el.dataset.chat;chatMenuId=null;chatHistoryOpen=false;save();chat($("#content"));return}if(el.dataset.prompt){$("#chat-text").value=el.dataset.prompt;sendChat();return}if(el.dataset.remove){if(!window.confirm("Excluir este registro? Essa ação não pode ser desfeita."))return;const collection=el.dataset.remove;state[collection]=state[collection].filter(x=>x.id!==el.dataset.id);save();renderContent();toast("Registro excluído.");return}const action=el.dataset.action;if(action==="install-app"){window.AGRONEXO_INSTALL?.();return}
 if(action==="enable-offline"){
  if(window.AGRONEXO_OFFLINE||navigator.onLine===false){toast("Para ativar o acesso offline, conecte-se à internet primeiro.");return}
  openDialog('<h2>Habilitar modo offline</h2><p class="muted">Confirme seu PIN de quatro números. Este dispositivo poderá abrir os registros locais sem internet por sete dias. Não use aparelhos públicos ou compartilhados.</p>'+
   '<form id="offline-enroll-form"><div class="field"><label for="offline-enroll-pin">PIN atual</label><input id="offline-enroll-pin" type="password" inputmode="numeric" pattern="[0-9]{4}" minlength="4" maxlength="4" autocomplete="off" required></div>'+
   '<div class="modal-actions"><button type="button" class="btn btn-light" data-action="close-modal">Cancelar</button><button type="submit" class="btn">Habilitar neste dispositivo</button></div></form>');
  return;
 }
 if(action==="relogin"){window.location.href="/?modo=plataforma";return}
 if(action==="reconnect"){
  if(navigator.onLine===false){toast("Ainda sem internet. Seus registros continuam salvos neste dispositivo.");return}
  if(window.AGRONEXO_OFFLINE){
   const ok=await window.AGRONEXO_RECONNECT?.();
   if(!ok){toast("Sua sessão online precisa ser desbloqueada novamente. A cópia local foi preservada.");return}
  }
  const ok=await workspaceSync?.syncNow();
  toast(ok?"Sincronização concluída.":"Falha ao sincronizar. Registros locais preservados.");
  return;
 }
 if(action==="sync-now"){toast("Verificando dados na nuvem...");const ok=await workspaceSync?.syncNow();toast(ok?"Sincronização concluída.":"Sem conexão com a nuvem. Seus dados locais foram preservados.");return}
if(action==="admin-panel"){window.location.href="/admin.html";return}
if(action==="logout"){revokeOffline();await fetch("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"logout"})}).catch(()=>{});window.location.replace("/");return}
if(action==="menu"){const open=$("#side")?.classList.toggle("open");document.body?.classList?.toggle("drawer-open",!!open)}
if(action==="close-menu"){$("#side")?.classList.remove("open");document.body?.classList.remove("drawer-open")}if(action==="back-calcs"){selectedCalc=1;calculators($("#content"))}if(action==="calc-reset"){calcValues={};calcDetail($("#content"))}if(action==="calc-save"){const c=CALCS.find(x=>x.id===Number(selectedCalc));const v={};c.fields.forEach(f=>v[f.key]=calcValues[f.key]??f.value);const r=runCalc(c,v);if(r.error){toast(r.error);return}state.calcHistory.unshift({id:uid(),calcId:c.id,name:c.title,values:v,result:num(r.value),unit:r.unit,time:new Date().toISOString()});state.calcHistory=state.calcHistory.slice(0,100);save();toast("Cálculo adicionado ao histórico.")}if(action==="calc-history")calcHistoryModal();if(action==="close-modal"){$(".modal-backdrop")?.remove();dialog=null}if(action==="bulario-reload")fetchBulario();if(el.dataset.bularioDetail!==undefined)bularioDetails(el.dataset.bularioDetail);if(el.dataset.bulaLookup!==undefined)checkBulaEmbrapa(el.dataset.bulaLookup);if(el.dataset.bularioExample){bulState.query=el.dataset.bularioExample;const inp=$("#bulario-search");if(inp)inp.value=bulState.query;fetchBulario()}if(action==="project-new")formModal("project");if(action==="quote-new")formModal("quote");if(action==="note-new")formModal("note");if(action==="chat-history"){chatHistoryOpen=!chatHistoryOpen;$(".chat-frame")?.classList.toggle("show-history",chatHistoryOpen);return}
 if(action==="chat-close-history"){chatHistoryOpen=false;$(".chat-frame")?.classList.remove("show-history");return}if(action==="new-chat"){if(chatBusy){toast("Aguarde a resposta para abrir outra conversa.");return}state.selectedChat=null;chatMenuId=null;chatHistoryOpen=false;activeChat();chat($("#content"))}if(action==="delete-chat"){if(chatBusy){toast("Aguarde o término da resposta.");return}if(!window.confirm("Excluir esta conversa e todas as mensagens?"))return;state.chats=removeChat(state.chats,state.selectedChat);state.selectedChat=null;save();chat($("#content"))}if(action==="send-chat")sendChat();if(action==="attach")$("#chat-file")?.click();if(action==="mic")toggleMic();if(action==="export")exportData();if(action==="import")$("#import-file")?.click();if(action==="clear-local"){if(workspaceSync?.pendingCount()){toast("Há alterações não sincronizadas. Aguarde a nuvem antes de limpar este dispositivo.");return}if(window.confirm("Limpar apenas a cópia deste navegador? Os registros sincronizados continuarão disponíveis na sua conta. Faça um backup antes.")){localStorage.removeItem(key);state=normalizeState(defaultState);shell();await workspaceSync?.refresh();toast("Cópia local atualizada com os registros da conta.")}}});
document.addEventListener("focusin",e=>{if(window.innerWidth<=850&&(e.target.matches?.("input:not([type=file]),textarea,select")))document.body?.classList?.add("keyboard-open")});
document.addEventListener("focusout",()=>setTimeout(updateVisualHeight,180));
document.addEventListener("input",e=>{
 if(e.target.id==="chat-search"){chatSearch=e.target.value;refreshChatList();return}
 if(e.target.id==="chat-text"){
  const input=e.target;input.style.height="auto";input.style.height=Math.min(input.scrollHeight,132)+"px";return;
 }
 if(e.target.id==="calc-search"){filter=e.target.value;const pos=e.target.selectionStart;calculators($("#content"));const i=$("#calc-search");i?.focus();i?.setSelectionRange(pos,pos)}if(e.target.id==="bulario-search"){bulState.query=e.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(fetchBulario,700)}if(e.target.dataset.calcField){calcValues[e.target.dataset.calcField]=e.target.value;updateCalc()}});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){$("#side")?.classList.remove("open");document.body?.classList.remove("drawer-open");$(".modal-backdrop")?.remove();return}
 if(e.target.id==="chat-text"&&e.key==="Enter"&&!e.shiftKey&&!e.isComposing){e.preventDefault();sendChat()}});
document.addEventListener("change",async e=>{if(e.target.id==="chat-file"){await attachments(e.target.files);e.target.value=""}if(e.target.id==="import-file"){if(e.target.files?.[0])await importData(e.target.files[0])}});
document.addEventListener("submit",async e=>{
 if(e.target.id==="chat-rename-form"){
  e.preventDefault();const id=e.target.dataset.chatId,title=e.target.querySelector("#chat-rename-title")?.value||"";
  try{state.chats=renameChat(state.chats,id,title);save();$(".modal-backdrop")?.remove();chatMenuId=null;chat($("#content"));toast("Conversa renomeada.")}
  catch(err){toast(err.message)}
  return;
 }
 if(e.target.id==="offline-enroll-form"){
  e.preventDefault();
  const pin=e.target.querySelector("#offline-enroll-pin")?.value||"";
  const submit=e.target.querySelector("button[type=submit]");
  if(submit)submit.disabled=true;
  try{
   await window.AGRONEXO_ENROLL_OFFLINE(pin);
   $(".modal-backdrop")?.remove();
   toast("Modo offline habilitado neste dispositivo por 7 dias.");
  }catch(err){toast(err.message||"Não foi possível habilitar o offline.")}
  finally{if(submit?.isConnected)submit.disabled=false}
  return;
 }
 if(e.target.id!=="crud-form")return;e.preventDefault();const form=e.target;const val=k=>form.querySelector("#crud-"+k)?.value?.trim()||"";let obj;if(dialog.type==="project"){obj={name:val("name"),hectares:Number(val("hectares")),crop:val("crop"),city:val("city")};state.projects.unshift({...obj,id:uid(),time:new Date().toISOString()})}if(dialog.type==="quote"){obj={item:val("item"),supplier:val("supplier"),price:Number(val("price")),unit:val("unit")};state.quotes.unshift({...obj,id:uid(),time:new Date().toISOString()})}if(dialog.type==="note"){obj={title:val("title"),body:val("body")};state.notes.unshift({...obj,id:uid(),time:new Date().toISOString()})}save();$(".modal-backdrop")?.remove();dialog=null;renderContent();toast("Registro salvo.")});
const userId=String(window.AGRONEXO_USER?.id||"");
workspaceSync=createWorkspaceSync({
 userId,storage:localStorage,read:()=>state,canSync:()=>!chatBusy&&!window.AGRONEXO_OFFLINE,
 apply:remote=>{
  // Preservar rascunho, seleção e rolagem ao receber dados da nuvem.
  const field=page==="chat"?$("#chat-text"):null,draft=field?.value;
  const pane=page==="chat"?$("#messages"):null,oldChatId=state.selectedChat;
  const previousScroll=pane?{top:pane.scrollTop,height:pane.scrollHeight,viewport:pane.clientHeight}:null;
  const wasFocused=!!field&&document.activeElement===field;
  const selection=wasFocused?{start:field.selectionStart,end:field.selectionEnd}:null;
  state=normalizeState(remote);
  try{persistLocal()}catch{}
  if(!chatBusy){
   if(page==="chat")chat($("#content"),{previousScroll:oldChatId===state.selectedChat?previousScroll:null});
   else renderContent();
   const restored=page==="chat"&&draft!=null?$("#chat-text"):null;
   if(restored){
    restored.value=draft;
    restored.style.height="auto";
    restored.style.height=Math.min(restored.scrollHeight,132)+"px";
    if(wasFocused){
     restored.focus({preventScroll:true});
     if(selection&&Number.isInteger(selection.start)&&Number.isInteger(selection.end))
      restored.setSelectionRange(selection.start,selection.end);
    }
   }
  }
 },
 status:(status,pending)=>{cloudState=status;pendingSync=pending;syncDisplay()}
});
// Exibir a cópia local imediatamente. A sincronização da nuvem nunca deve
// bloquear a inicialização, mesmo com internet ruim ou Supabase lento.
shell();
workspaceSync.start();
window.addEventListener("agronexo:authenticated",()=>{cloudState="syncing";syncDisplay();workspaceSync.syncNow()});
workspaceSync.syncNow().catch(()=>{cloudState="offline";syncDisplay()});
