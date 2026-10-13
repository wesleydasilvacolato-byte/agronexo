import {CALCS,GROUPS,runCalc} from "./calculators.js";
const $=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const num=v=>Number(v).toLocaleString("pt-BR",{maximumFractionDigits:3});
const date=v=>new Date(v).toLocaleDateString("pt-BR");
const uid=()=>globalThis.crypto?.randomUUID?.()||String(Date.now()+Math.random());
const key="agronexo-v1";
const defaultState={projects:[],quotes:[],notes:[],calcHistory:[],chats:[],selectedChat:null};
function load(){try{return {...defaultState,...JSON.parse(localStorage.getItem(key)||"{}")}}catch{return structuredClone(defaultState)}}
let state=load();
const save=()=>{try{localStorage.setItem(key,JSON.stringify(state))}catch{toast("Armazenamento do navegador cheio. Exporte seus dados nas configurações.")}};
const app=$("#app");
let page="dashboard",filter="",group="Todas",selectedCalc=1,calcValues={},searchTimer=null,bulState={results:[],total:0,query:"",loading:false,source:"",error:""},pendingFiles=[],recording=null,dialog=null,chatBusy=false;
const navigation=[["dashboard","⌂","Visão geral"],["calc","▦","Calculadoras"],["bulario","▤","Bulário AGROFIT"],["chat","◈","Sebastião IA"],["projects","◫","Projetos e áreas"],["quotes","≋","Cotações"],["notes","✎","Caderno de campo"],["settings","⚙","Configurações"]];
function toast(t){$(".toast")?.remove();const e=document.createElement("div");e.className="toast";e.textContent=t;document.body.append(e);setTimeout(()=>e.remove(),4300)}
function pageTitle(){return navigation.find(x=>x[0]===page)?.[2]||"AGRONEXO"}
function shell(){app.innerHTML='<div class="shell"><aside class="sidebar" id="side"><div class="brand"><span class="brand-symbol">A</span><div><h2>AGRONEXO</h2><small>AGROINTELIGÊNCIA</small></div></div><nav class="nav"><p class="nav-caption">Workspace</p>'+navigation.map(([id,ico,label])=>'<button class="'+(id===page?"active":"")+'" data-nav="'+id+'"><span class="nav-icon">'+ico+'</span>'+label+'</button>').join("")+'</nav><div class="side-bottom"><b>Conheça o Sebastião</b><p>Seu assistente agronômico com IA, leitura de imagens e transcrição de áudio.</p><button data-nav="chat">Conversar com Sebastião →</button></div><p class="side-note">AGRONEXO · Versão de desenvolvimento</p></aside><main class="main"><header class="topbar"><div class="top-left"><button class="mobile-menu" data-action="menu">☰</button><div><p class="crumb">Plataforma / Área de trabalho</p><h2>'+esc(pageTitle())+'</h2></div></div><div class="top-right"><span class="signal"><i class="dot"></i> Ambiente conectado</span><span class="avatar">AG</span></div></header><section class="content '+(page==="chat"?"chat-content":"")+'" id="content"></section></main></div>';renderContent();}
function navigate(p){if(!navigation.some(x=>x[0]===p))return;page=p;filter="";group="Todas";window.scrollTo(0,0);shell()}
function head(kicker,title,subtitle,action=""){return '<div class="pagehead"><div><div class="eyebrow">'+kicker+'</div><h1>'+title+'</h1><p class="muted">'+subtitle+'</p></div>'+action+'</div>'}
function empty(icon,title,desc){return '<div class="empty"><div style="font-size:28px">'+icon+'</div><h3>'+title+'</h3><p>'+desc+'</p></div>'}
function renderContent(){const root=$("#content");if(!root)return;({dashboard,calc:calculators,bulario:bulario,chat:chat,projects:projects,quotes:quotes,notes:notes,settings:settings}[page]||dashboard)(root)}
function dashboard(root){const history=state.calcHistory.slice(0,4);root.innerHTML='<div class="hero"><div style="position:relative;z-index:2"><div class="eyebrow">BEM-VINDO À PLATAFORMA</div><h1>Inteligência que<br>cultiva resultados.</h1><p>Ferramentas agronômicas, informações de defensivos, gestão das áreas e um assistente inteligente — em um único espaço.</p><button class="btn btn-accent" data-nav="calc" style="margin-top:22px">Explorar ferramentas →</button></div><div class="hero-visual"><div>A</div></div></div><div class="stats">'+[["49","Calculadoras disponíveis","11 áreas de conhecimento"],[state.projects.length,"Áreas cadastradas","Gestão de propriedades"],[state.quotes.length,"Cotações registradas","Comparativos locais"],[state.calcHistory.length,"Cálculos realizados","Histórico no dispositivo"]].map(a=>'<div class="card stat"><p class="stat-label">'+a[1]+'</p><p class="stat-number">'+a[0]+'</p><p class="stat-bottom">'+a[2]+'</p></div>').join("")+'</div><div class="twocol"><div class="card section-card"><div style="display:flex;justify-content:space-between;align-items:center"><h3 class="section-title">Acesso rápido</h3><span class="pill">Ferramentas</span></div><div class="quickgrid">'+[["calc","▦","49 calculadoras"],["bulario","▤","Consultar defensivos"],["chat","◈","Perguntar ao Sebastião"],["projects","◫","Minhas áreas"]].map(a=>'<button class="quick" data-nav="'+a[0]+'"><span class="icon-wrap">'+a[1]+'</span><strong>'+a[2]+' →</strong></button>').join("")+'</div></div><div class="card section-card"><h3 class="section-title">Atividade recente</h3>'+(history.length?history.map(h=>'<div class="activity"><span class="mini-symbol">∑</span><div><div class="activity-title">'+esc(h.name)+'</div><p>'+esc(h.result)+' '+esc(h.unit)+'</p></div><span class="activity-time">'+date(h.time)+'</span></div>').join(""):empty("◷","Tudo começa aqui","Os cálculos realizados aparecerão neste espaço."))+'</div></div><div class="footer-note">Plataforma de apoio à decisão · resultados exigem validação agronômica</div>'}
function calculators(root){if(selectedCalc==="open")return calcDetail(root);const list=CALCS.filter(c=>(group==="Todas"||c.group===group)&&(c.title+" "+c.group).toLowerCase().includes(filter.toLowerCase()));root.innerHTML=head("FERRAMENTAS DE PRECISÃO","Calculadoras agronômicas","49 ferramentas organizadas por etapa da produção, com fórmulas transparentes.",'<span class="pill">'+list.length+' ferramentas</span>')+'<div class="toolbar"><div class="search"><span>⌕</span><input id="calc-search" placeholder="Buscar ferramenta ou assunto..." value="'+esc(filter)+'"></div><button class="btn btn-ghost" data-action="calc-history">Histórico</button></div><div class="chiprow">'+["Todas",...GROUPS].map(g=>'<button class="chip '+(group===g?"active":"")+'" data-group="'+esc(g)+'">'+esc(g)+'</button>').join("")+'</div><div class="catalog">'+list.map(c=>'<button class="tool-card" data-calc="'+c.id+'"><span class="tool-no">'+String(c.id).padStart(2,"0")+'</span><b>'+esc(c.title)+'</b><small>'+esc(c.group)+' →</small></button>').join("")+'</div>'+(list.length?"":empty("⌕","Nenhuma ferramenta","Tente outro termo de busca."))}
function calcDetail(root){const c=CALCS.find(x=>x.id===Number(selectedCalc));if(!c)return;const v={};c.fields.forEach(f=>{v[f.key]=calcValues[f.key]??f.value});const result=runCalc(c,v);root.innerHTML=head(c.group,'0'+c.id+' · '+esc(c.title),"Ferramenta "+c.id+" de 49 · Preencha os campos para calcular.",'<button class="btn btn-ghost" data-action="back-calcs">← Todas as calculadoras</button>')+'<div class="calc-layout"><div class="card calc-form"><h3 class="section-title">Dados para o cálculo</h3><div class="fieldgrid">'+c.fields.map(f=>'<div class="field"><label for="f-'+f.key+'">'+esc(f.label)+'</label><div class="field-inner"><input id="f-'+f.key+'" type="number" step="any" min="'+f.min+'" data-calc-field="'+f.key+'" value="'+esc(v[f.key])+'"><span>'+esc(f.unit)+'</span></div></div>').join("")+'</div><div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:24px"><button class="btn" data-action="calc-save">Salvar resultado</button><button class="btn btn-light" data-action="calc-reset">Restaurar exemplo</button></div><div class="notice warning">Os valores preenchidos são exemplos. Ajuste todos os parâmetros com dados reais. O AGRONEXO não prescreve insumos ou defensivos.</div></div><div><div class="result-card"><p class="eyebrow">RESULTADO CALCULADO</p><div class="result-value" id="calc-number">'+(result.error?"—":num(result.value))+'</div><div class="result-unit">'+esc(c.unit)+'</div><p class="result-formula"><b>Metodologia:</b> '+esc(c.formula)+'</p></div><div class="notice">'+esc(c.note)+'</div></div></div>'}
function updateCalc(){const c=CALCS.find(x=>x.id===Number(selectedCalc));if(!c)return;const v={};c.fields.forEach(f=>{v[f.key]=calcValues[f.key]??f.value});const r=runCalc(c,v);const o=$("#calc-number");if(o)o.textContent=r.error?"—":num(r.value)}
function calcHistoryModal(){dialog={type:"history"};openDialog('<h2>Histórico de cálculos</h2>'+(state.calcHistory.length?'<div style="max-height:360px;overflow:auto">'+state.calcHistory.map(h=>'<div class="activity"><span class="mini-symbol">∑</span><div><div class="activity-title">'+esc(h.name)+'</div><p>'+esc(h.result)+' '+esc(h.unit)+'</p></div><span class="activity-time">'+date(h.time)+'</span></div>').join("")+'</div>':empty("◷","Sem registros","Salve um cálculo para vê-lo aqui."))+'<div class="modal-actions"><button class="btn btn-light" data-action="close-modal">Fechar</button></div>')}
const AGROFIT_SOURCE="https://dados.agricultura.gov.br/dataset/sistema-de-agrotoxicos-fitossanitarios-agrofit";
function bulario(root){root.innerHTML=head("CONSULTA OFICIAL","Bulário agrícola","Pesquisa de produtos registrados na base pública AGROFIT/MAPA — não é reprodução de bulas completas.",'<span class="pill">Fonte oficial · MAPA</span>')+'<div class="notice">Dados de produtos formulados disponibilizados pelo Ministério da Agricultura e Pecuária. Confira sempre a bula e o rótulo vigentes, cultura autorizada, restrições e receituário com um profissional habilitado. <a href="'+AGROFIT_SOURCE+'" target="_blank" rel="noopener">Consultar fonte original ↗</a></div><div class="card" style="padding:20px;margin-top:18px"><div class="toolbar"><div class="search"><span>⌕</span><input id="bulario-search" placeholder="Buscar por produto, ingrediente ativo ou registro..." value="'+esc(bulState.query)+'"></div><button class="btn" data-action="bulario-reload">Pesquisar</button></div><div id="bulario-results"></div></div>';updateBulContent()}
function updateBulContent(){const el=$("#bulario-results");if(!el)return;if(bulState.loading){el.innerHTML=empty("◷","Consultando catálogo","Buscando registros públicos no servidor oficial...");return}if(bulState.error){el.innerHTML='<div class="notice warning">Não foi possível acessar os dados públicos: '+esc(bulState.error)+'. Tente novamente. <a href="'+AGROFIT_SOURCE+'" target="_blank" rel="noopener">Abrir fonte oficial ↗</a></div>';return}if(!bulState.results.length){el.innerHTML=empty("⌕","Busque no catálogo","Digite o nome de um produto ou ingrediente ativo para consultar.");return}el.innerHTML='<p class="muted" style="margin:12px 0 15px">'+num(bulState.total)+' registro(s) encontrado(s); exibindo os primeiros '+bulState.results.length+'.</p><div class="table-wrap"><table class="data-table"><thead><tr><th>Produto</th><th>Registro</th><th>Ingrediente / composição</th><th>Classe / tipo</th><th>Fonte</th></tr></thead><tbody>'+bulState.results.map(p=>'<tr><td><strong>'+esc(p.nome||"Não informado")+'</strong></td><td>'+esc(p.registro||"—")+'</td><td>'+esc(p.ativo||"—")+'</td><td>'+esc(p.classe||"—")+'</td><td><a target="_blank" rel="noopener" href="'+AGROFIT_SOURCE+'">MAPA ↗</a></td></tr>').join("")+'</tbody></table></div><div class="source" style="margin-top:18px">Fonte: dados abertos AGROFIT/MAPA, licença CC BY. Atualização informada pelo portal de dados de origem.</div>'}
async function fetchBulario(){const q=$("#bulario-search")?.value?.trim()??bulState.query;bulState.query=q;if(q.length<2){bulState.results=[];bulState.total=0;updateBulContent();return}bulState.loading=true;updateBulContent();try{const r=await fetch("/api/bulario?q="+encodeURIComponent(q));const j=await r.json();if(!r.ok)throw Error(j.error||"Falha no servidor");if(bulState.query!==q)return;bulState.results=j.results||[];bulState.total=j.total||0;bulState.error=""}catch(e){bulState.error=e.message;bulState.results=[]}finally{bulState.loading=false;updateBulContent()}}
function projects(root){root.innerHTML=head("GESTÃO DE ÁREAS","Projetos e propriedades","Cadastre propriedades e talhões para manter sua operação organizada.",'<button class="btn" data-action="project-new">+ Nova área</button>')+(state.projects.length?'<div class="cards-two">'+state.projects.map(p=>'<div class="card info-card"><span class="pill">Área cadastrada</span><h3 style="margin-top:14px">'+esc(p.name)+'</h3><p>'+esc(p.crop||"Cultura não informada")+' · '+num(p.hectares)+' ha</p><p>'+esc(p.city||"Localização não informada")+'</p><div style="margin-top:18px"><button class="btn btn-light" data-remove="projects" data-id="'+p.id+'">Excluir</button></div></div>').join("")+'</div>':empty("◫","Sua primeira propriedade","Comece cadastrando uma área para acompanhar informações da sua operação."))}
function quotes(root){root.innerHTML=head("GESTÃO DE PREÇOS","Cotações agrícolas","Registre e compare preços de insumos ou commodities, com data e fornecedor.",'<button class="btn" data-action="quote-new">+ Nova cotação</button>')+'<div class="card table-wrap">'+(state.quotes.length?'<table class="data-table"><thead><tr><th>Item</th><th>Fornecedor</th><th>Preço</th><th>Unidade</th><th>Data</th><th></th></tr></thead><tbody>'+state.quotes.map(q=>'<tr><td><strong>'+esc(q.item)+'</strong></td><td>'+esc(q.supplier)+'</td><td>'+money(q.price)+'</td><td>'+esc(q.unit)+'</td><td>'+date(q.time)+'</td><td><button class="btn btn-light" data-remove="quotes" data-id="'+q.id+'">Excluir</button></td></tr>').join("")+'</tbody></table>':empty("≋","Sem cotações","Registre valores para comparar preços e acompanhar negociações."))+'</div>'}
function notes(root){root.innerHTML=head("ROTINA DO CAMPO","Caderno de campo","Guarde ocorrências, observações, amostragens e atividades.",'<button class="btn" data-action="note-new">+ Nova anotação</button>')+(state.notes.length?'<div class="cards-two">'+state.notes.map(n=>'<div class="card info-card"><span class="pill">'+date(n.time)+'</span><h3 style="margin-top:15px">'+esc(n.title)+'</h3><p style="white-space:pre-wrap">'+esc(n.body)+'</p><div style="margin-top:15px"><button class="btn btn-light" data-remove="notes" data-id="'+n.id+'">Excluir</button></div></div>').join("")+'</div>':empty("✎","Seu caderno está vazio","Registre informações das visitas técnicas e acompanhe atividades."))}
function settings(root){root.innerHTML=head("PREFERÊNCIAS","Configurações e dados","Transparência, fontes, armazenamento e integrações.")+'<div class="cards-two"><div class="card info-card"><h3>Armazenamento</h3><p>Suas conversas, cálculos, áreas, cotações e notas são salvos no armazenamento LOCAL deste navegador. Este modo não sincroniza entre dispositivos nem substitui backup seguro.</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:19px"><button class="btn" data-action="export">Exportar dados JSON</button><button class="btn btn-light" data-action="import">Importar backup</button></div></div><div class="card info-card"><h3>Assistente Sebastião</h3><p>O Sebastião usa a API Gemini do Google pelo servidor; a chave nunca fica no navegador. Configure GEMINI_API_KEY na Vercel para ativar texto, imagem, áudio e vídeo.</p><p>Vídeos pequenos (até 2,2 MB) podem ser enviados com áudio; vídeos maiores são analisados por três quadros, sem áudio. O histórico é salvo somente neste dispositivo.</p><button class="btn btn-ghost" data-nav="chat" style="margin-top:16px">Abrir assistente →</button></div><div class="card info-card"><h3>Fontes científicas e regulatórias</h3><p>Bulário: arquivos CSV públicos AGROFIT/MAPA, publicados sob CC BY. A plataforma não copia integralmente conteúdos editoriais da Embrapa e não possui acesso privilegiado à API protegida.</p><a class="btn btn-light" href="'+AGROFIT_SOURCE+'" target="_blank" rel="noopener" style="margin-top:14px">Ver base oficial ↗</a></div><div class="card info-card"><h3>Uso técnico responsável</h3><p>Os 49 módulos apresentam estimativas matemáticas. Alguns métodos dependem de coeficientes e tabelas regionais. A decisão de aplicar fertilizantes, corretivos e defensivos deve considerar recomendações oficiais e profissional habilitado.</p><p>AGRONEXO · Protótipo funcional em evolução.</p></div></div><input hidden type="file" accept="application/json" id="import-file">'}
function activeChat(){let c=state.chats.find(x=>x.id===state.selectedChat);if(!c){c={id:uid(),title:"Nova conversa",time:new Date().toISOString(),messages:[]};state.chats.unshift(c);state.selectedChat=c.id;save()}return c}
function chat(root){const c=activeChat();root.innerHTML='<div class="card chat-frame"><aside class="chat-rail"><button class="btn" data-action="new-chat">+ Nova conversa</button><h3>Conversas</h3><div style="display:flex;flex-direction:column;gap:3px;overflow:auto">'+state.chats.map(t=>'<button class="chat-item '+(t.id===c.id?"active":"")+'" data-chat="'+t.id+'">◈ &nbsp; '+esc(t.title)+'</button>').join("")+'</div><div style="margin-top:auto"><button class="btn btn-ghost" data-action="delete-chat" style="width:100%">Excluir conversa atual</button></div></aside><div class="chat-main"><div class="chat-head"><span class="seb-avatar">S</span><div><b>Sebastião · Gemini | Assistente agronômico</b><p>Consultas em linguagem natural · Dados técnicos requerem conferência</p></div></div><div class="messages" id="messages">'+(c.messages.length?c.messages.map(m=>'<div class="bubble '+(m.role==="user"?"user":"assistant")+'">'+esc(m.content)+'<small>'+new Date(m.time).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})+'</small></div>').join(""):'<div class="chat-welcome"><span class="seb-avatar">S</span><h2>Olá! Eu sou o Sebastião.</h2><p>Sou o assistente do AGRONEXO. Posso ajudar com questões do agro, imagens, áudios, vídeos curtos e leitura de documentos fotografados.</p><div class="suggestions">'+["Como interpretar uma análise de solo?","O que é CTC do solo?","Ajude a planejar uma vistoria de campo"].map(t=>'<button data-prompt="'+esc(t)+'">'+esc(t)+'</button>').join("")+'</div></div>')+'</div><div class="composer"><div id="attachment-info" class="attachment-info"></div><div class="composer-input"><button class="round" data-action="attach" title="Enviar foto, áudio ou vídeo">＋</button><button class="round" data-action="mic" title="Gravar áudio">◉</button><textarea id="chat-text" placeholder="Escreva uma mensagem ao Sebastião..." rows="1"></textarea><button class="round send" data-action="send-chat" title="Enviar">↑</button></div><div class="chat-disclaimer">O Sebastião pode cometer erros. Valide orientações técnicas e siga bulas e prescrições oficiais.</div><input id="chat-file" type="file" accept="image/*,video/*,audio/*" hidden multiple></div></div></div>';setTimeout(()=>{const e=$("#messages");if(e)e.scrollTop=e.scrollHeight},0)}
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
  const el=$("#attachment-info");
  if(el)el.textContent=pendingFiles.length?pendingFiles.map(f=>f.name).join(" · ").slice(0,170):"";
}
async function transcribe(file){const r=await fetch("/api/transcribe",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({data:file.data,name:file.name})});const j=await r.json();if(!r.ok)throw Error(j.error||"Erro ao transcrever");return j.text}
async function sendChat(){
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
  if(conversation.messages.length===1)conversation.title=(content||"Mensagem multimídia").slice(0,50);
  save();
  chat($("#content"));
  const pane=$("#messages");
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
    save();
  }catch(err){
    conversation.messages.push({role:"assistant",content:"Não foi possível processar: "+err.message,time:new Date().toISOString()});
    save();
  }finally{chatBusy=false;chat($("#content"))}
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
  openDialog('<h2>' + cfg.title + '</h2><p class="muted">Esses dados serão salvos neste navegador.</p>' +
    '<form id="crud-form">' + rows +
    '<div class="modal-actions"><button type="button" class="btn btn-light" data-action="close-modal">Cancelar</button>' +
    '<button class="btn" type="submit">Salvar</button></div></form>');
}
function exportData(){const blob=new Blob([JSON.stringify({version:1,exported:new Date().toISOString(),...state},null,2)],{type:"application/json"});const u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download="agronexo-backup-"+new Date().toISOString().slice(0,10)+".json";a.click();URL.revokeObjectURL(u)}
async function importData(file){try{if(file.size>2e6)throw Error("Backup excede 2 MB.");const j=JSON.parse(await file.text());if(!Array.isArray(j.chats)||!Array.isArray(j.calcHistory)||!Array.isArray(j.projects)||!Array.isArray(j.quotes)||!Array.isArray(j.notes))throw Error("Formato de backup inválido.");state={...defaultState,...j};save();shell();toast("Dados importados com sucesso.")}catch(e){toast(e.message)}}
document.addEventListener("click",async e=>{if(e.target.classList.contains("modal-backdrop")){$(".modal-backdrop")?.remove();return}const el=e.target.closest("[data-nav],[data-calc],[data-group],[data-action],[data-chat],[data-prompt],[data-remove]");if(!el)return;if(el.dataset.nav){navigate(el.dataset.nav);return}if(el.dataset.calc){selectedCalc=Number(el.dataset.calc);calcValues={};calcDetail($("#content"));return}if(el.dataset.group){group=el.dataset.group;calculators($("#content"));return}if(el.dataset.chat){state.selectedChat=el.dataset.chat;save();chat($("#content"));return}if(el.dataset.prompt){$("#chat-text").value=el.dataset.prompt;sendChat();return}if(el.dataset.remove){const collection=el.dataset.remove;state[collection]=state[collection].filter(x=>x.id!==el.dataset.id);save();renderContent();toast("Registro excluído.");return}const action=el.dataset.action;if(action==="menu"){$("#side")?.classList.toggle("open")}if(action==="back-calcs"){selectedCalc=1;calculators($("#content"))}if(action==="calc-reset"){calcValues={};calcDetail($("#content"))}if(action==="calc-save"){const c=CALCS.find(x=>x.id===Number(selectedCalc));const v={};c.fields.forEach(f=>v[f.key]=calcValues[f.key]??f.value);const r=runCalc(c,v);if(r.error){toast(r.error);return}state.calcHistory.unshift({id:uid(),calcId:c.id,name:c.title,values:v,result:num(r.value),unit:r.unit,time:new Date().toISOString()});state.calcHistory=state.calcHistory.slice(0,100);save();toast("Cálculo adicionado ao histórico.")}if(action==="calc-history")calcHistoryModal();if(action==="close-modal"){$(".modal-backdrop")?.remove();dialog=null}if(action==="bulario-reload")fetchBulario();if(action==="project-new")formModal("project");if(action==="quote-new")formModal("quote");if(action==="note-new")formModal("note");if(action==="new-chat"){state.selectedChat=null;activeChat();chat($("#content"))}if(action==="delete-chat"){state.chats=state.chats.filter(c=>c.id!==state.selectedChat);state.selectedChat=null;save();chat($("#content"))}if(action==="send-chat")sendChat();if(action==="attach")$("#chat-file")?.click();if(action==="mic")toggleMic();if(action==="export")exportData();if(action==="import")$("#import-file")?.click()});
document.addEventListener("input",e=>{if(e.target.id==="calc-search"){filter=e.target.value;const pos=e.target.selectionStart;calculators($("#content"));const i=$("#calc-search");i?.focus();i?.setSelectionRange(pos,pos)}if(e.target.id==="bulario-search"){bulState.query=e.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(fetchBulario,700)}if(e.target.dataset.calcField){calcValues[e.target.dataset.calcField]=e.target.value;updateCalc()}});
document.addEventListener("keydown",e=>{if(e.target.id==="chat-text"&&e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendChat()}});
document.addEventListener("change",async e=>{if(e.target.id==="chat-file"){await attachments(e.target.files);e.target.value=""}if(e.target.id==="import-file"){if(e.target.files?.[0])await importData(e.target.files[0])}});
document.addEventListener("submit",e=>{if(e.target.id!=="crud-form")return;e.preventDefault();const form=e.target;const val=k=>form.querySelector("#crud-"+k)?.value?.trim()||"";let obj;if(dialog.type==="project"){obj={name:val("name"),hectares:Number(val("hectares")),crop:val("crop"),city:val("city")};state.projects.unshift({...obj,id:uid(),time:new Date().toISOString()})}if(dialog.type==="quote"){obj={item:val("item"),supplier:val("supplier"),price:Number(val("price")),unit:val("unit")};state.quotes.unshift({...obj,id:uid(),time:new Date().toISOString()})}if(dialog.type==="note"){obj={title:val("title"),body:val("body")};state.notes.unshift({...obj,id:uid(),time:new Date().toISOString()})}save();$(".modal-backdrop")?.remove();dialog=null;renderContent();toast("Registro salvo.")});
shell();