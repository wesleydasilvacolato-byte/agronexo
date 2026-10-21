/** Operações puras no histórico do Sebastião; objetos permanecem compatíveis com a sync v1.7. */
export function sortedChats(items=[]){
 return [...items].sort((a,b)=>{
  const pinned=Number(Boolean(b.pinned))-Number(Boolean(a.pinned));
  if(pinned)return pinned;
  const t=Date.parse(b.updatedAt||b.time||0)-Date.parse(a.updatedAt||a.time||0);
  return Number.isFinite(t)?t:0;
 });
}
export function renameChat(items,id,title){
 const value=String(title||"").replace(/\s+/g," ").trim().slice(0,80);
 if(!value)throw new Error("Digite um nome para a conversa.");
 return items.map(c=>String(c.id)===String(id)?{...c,title:value,customTitle:true}:c);
}
export function pinChat(items,id){
 return items.map(c=>String(c.id)===String(id)?{...c,pinned:!Boolean(c.pinned)}:c);
}
export function removeChat(items,id){
 return items.filter(c=>String(c.id)!==String(id));
}
export function previewChat(c){
 const last=c.messages?.at(-1)?.content||"";
 return String(last||"Conversa vazia").replace(/\s+/g," ").slice(0,70);
}

/**
 * Mantém a posição de leitura quando a sincronização atualiza o histórico.
 * Se o usuário já estava perto do final, acompanha as novas mensagens.
 */
export function restoredChatScroll(oldTop,oldHeight,oldViewport,newHeight,newViewport){
 const numbers=[oldTop,oldHeight,oldViewport,newHeight,newViewport].map(Number);
 if(numbers.some(x=>!Number.isFinite(x)))return Math.max(0,Number(newHeight)-Number(newViewport)||0);
 const [top,oldFull,oldVisible,newFull,newVisible]=numbers;
 const oldMax=Math.max(0,oldFull-oldVisible),newMax=Math.max(0,newFull-newVisible);
 const distanceFromBottom=Math.max(0,oldMax-Math.max(0,top));
 return distanceFromBottom<=80?newMax:Math.max(0,newMax-distanceFromBottom);
}
