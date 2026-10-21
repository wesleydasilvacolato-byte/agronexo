/**
 * Instalação contextual PWA. O aplicativo web não baixa APK/IPA:
 * usa prompt de instalação oficial quando o navegador o fornece
 * ou explica a criação do atalho em modo standalone.
 */
export function detectInstallPlatform({agent="",ipadDesktop=false,standalone=false}={}){
 if(standalone)return "installed";
 if(/iPhone|iPad|iPod/i.test(agent)||ipadDesktop)return "ios";
 if(/Android/i.test(agent))return "android";
 if(/Windows|Macintosh|Linux|CrOS/i.test(agent))return "desktop";
 return "other";
}
export function createAppInstaller({win=window,doc=document,nav=navigator}={}){
 let deferred=null,shown=null;
 const installed=()=>Boolean(win.matchMedia?.("(display-mode: standalone)")?.matches||nav.standalone===true);
 const platform=()=>detectInstallPlatform({agent:nav.userAgent||"",
  ipadDesktop:nav.platform==="MacIntel"&&nav.maxTouchPoints>1,standalone:installed()});
 const instructions=which=>{
  if(which==="ios")return "No Safari: toque em Compartilhar (quadrado com seta para cima), escolha Adicionar à Tela de Início e confirme Adicionar. O ícone oficial aparecerá na tela inicial.";
  if(which==="android")return "No Chrome: toque no menu ⋮ e selecione Instalar aplicativo ou Adicionar à tela inicial. Confirme para abrir o AGRONEXO como aplicativo.";
  if(which==="desktop")return "No Chrome ou Edge: clique no ícone Instalar da barra de endereços ou abra o menu ⋮ e escolha Instalar AGRONEXO. Em outros navegadores, crie um atalho para o site.";
  return "Abra o AGRONEXO no Safari, Chrome ou Edge e procure a opção Instalar aplicativo ou Adicionar à Tela de Início no menu do navegador.";
 };
 function close(){
  shown?.remove();shown=null;
 }
 function open(){
  if(shown)return;
  const kind=platform();
  const canPrompt=Boolean(deferred);
  const panel=doc.createElement("div");
  panel.className="ax-install-overlay";
  panel.innerHTML='<section class="ax-install-sheet" role="dialog" aria-modal="true" aria-labelledby="ax-install-title">'+
   '<button class="ax-install-close" type="button" aria-label="Fechar" data-install-close>×</button>'+
   '<img class="ax-install-logo" src="/icons/icon-192.png" alt="Ícone oficial AGRONEXO" width="74" height="74">'+
   '<p class="ax-install-eyebrow">AGRONEXO · APLICATIVO</p>'+
   '<h2 id="ax-install-title">'+(kind==="installed"?"Aplicativo já instalado":"Leve o AGRONEXO com você")+'</h2>'+
   '<p class="ax-install-copy">'+(kind==="installed"?"Você já está usando o AGRONEXO no formato de aplicativo.": "Instale na tela inicial para abrir em janela própria, com o logotipo da marca e acesso às ferramentas disponíveis offline.")+'</p>'+
   '<div class="ax-install-how">'+(kind==="installed"?"Acesse normalmente pelo ícone na tela inicial.":instructions(kind))+'</div>'+
   (canPrompt&&!installed()?'<button type="button" class="ax-install-cta" data-install-confirm>Instalar aplicativo agora</button>':'')+
   '<button type="button" class="ax-install-later" data-install-close>'+(kind==="installed"?"Fechar":"Entendi")+'</button>'+
   '</section>';
  panel.addEventListener("click",e=>{
   if(e.target===panel||e.target.closest?.("[data-install-close]"))close();
   if(e.target.closest?.("[data-install-confirm]")){
    const prompt=deferred;deferred=null;close();
    if(prompt)prompt.prompt().then?.(()=>{}); // Some browsers return void.
   }
  });
  doc.body.append(panel);
  shown=panel;
  panel.querySelector(".ax-install-close")?.focus();
 }
 win.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferred=e});
 win.addEventListener("appinstalled",()=>{deferred=null;close()});
 return {open,close,platform,installed};
}
