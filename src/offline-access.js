/**
 * Acesso offline autorizado após desbloqueio online com PIN.
 *
 * O PIN NUNCA é persistido: uma chave WebCrypto derivada por PBKDF2
 * autentica e decifra uma autorização local com validade limitada.
 * A proteção local não substitui a autenticação do servidor nem protege
 * contra acesso direto aos arquivos de um aparelho comprometido.
 */
const KEY="agronexo-offline-grant-v1";
const LIMIT_KEY="agronexo-offline-attempts-v1";
const MAX_AGE=7*24*60*60*1000;
const ITERATIONS=260000;
const encoder=new TextEncoder(),decoder=new TextDecoder();
const toB64=bytes=>{
 let v="";for(const b of bytes)v+=String.fromCharCode(b);
 return btoa(v);
};
const fromB64=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
const pinValid=pin=>/^\d{4}$/.test(String(pin));
const object=x=>x&&typeof x==="object"&&!Array.isArray(x);
export function offlineInfo(storage=localStorage,now=Date.now()){
 let grant;
 try{grant=JSON.parse(storage.getItem(KEY)||"null")}catch{return null}
 if(!object(grant)||grant.v!==1||!grant.uid||!grant.salt||!grant.iv||!grant.data||now>Number(grant.exp)||now<Number(grant.issued)-300000)return null;
 return {id:grant.uid,name:String(grant.name||"Usuário"),email:String(grant.email||""),expiresAt:grant.exp};
}
async function cipher(pin,salt,cryptoApi){
 const base=await cryptoApi.subtle.importKey("raw",encoder.encode(pin),"PBKDF2",false,["deriveKey"]);
 return cryptoApi.subtle.deriveKey({name:"PBKDF2",salt,iterations:ITERATIONS,hash:"SHA-256"},base,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
}
export async function authorizeOffline({storage=localStorage,cryptoApi=crypto,pin,user,now=Date.now()}){
 if(!pinValid(pin)||!object(user)||typeof user.id!=="string"||!user.id)throw Error("Não foi possível habilitar este dispositivo.");
 if(!cryptoApi?.subtle||!cryptoApi?.getRandomValues)throw Error("Navegador sem suporte à proteção offline.");
 const salt=cryptoApi.getRandomValues(new Uint8Array(16)),iv=cryptoApi.getRandomValues(new Uint8Array(12));
 const exp=now+MAX_AGE;
 const payload={id:user.id,name:String(user.name||"Usuário"),email:String(user.email||""),issued:now,exp};
 const key=await cipher(pin,salt,cryptoApi);
 const ciphertext=new Uint8Array(await cryptoApi.subtle.encrypt({name:"AES-GCM",iv},key,encoder.encode(JSON.stringify(payload))));
 storage.setItem(KEY,JSON.stringify({v:1,uid:user.id,name:payload.name,email:payload.email,issued:now,exp,
  salt:toB64(salt),iv:toB64(iv),data:toB64(ciphertext)}));
 storage.removeItem(LIMIT_KEY);
 return {expiresAt:exp};
}
export async function unlockOffline({storage=localStorage,cryptoApi=crypto,pin,now=Date.now()}){
 if(!pinValid(pin))throw Error("Digite um PIN de 4 números.");
 const user=offlineInfo(storage,now);
 if(!user)throw Error("Sem autorização offline neste aparelho. Entre com internet primeiro.");
 let tries={count:0,until:0};
 try{tries=JSON.parse(storage.getItem(LIMIT_KEY)||"null")||tries}catch{}
 if(now<Number(tries.until||0))throw Error("Acesso offline temporariamente bloqueado. Aguarde 15 minutos.");
 const raw=JSON.parse(storage.getItem(KEY));
 try{
  const key=await cipher(pin,fromB64(raw.salt),cryptoApi);
  const decrypted=decoder.decode(await cryptoApi.subtle.decrypt({name:"AES-GCM",iv:fromB64(raw.iv)},key,fromB64(raw.data)));
  const payload=JSON.parse(decrypted);
  if(payload.id!==raw.uid||payload.id!==user.id||payload.exp!==raw.exp||payload.issued!==raw.issued||now>payload.exp)throw Error("Grant inválido.");
  storage.removeItem(LIMIT_KEY);
  return {id:payload.id,name:payload.name,email:payload.email,role:"user"};
 }catch{
  const count=(Number(tries.count)||0)+1;
  const until=count>=5?now+15*60*1000:0;
  storage.setItem(LIMIT_KEY,JSON.stringify({count:until?0:count,until}));
  throw Error(until?"Muitas tentativas. Acesso offline bloqueado por 15 minutos.":"PIN offline incorreto.");
 }
}
export function revokeOffline(storage=localStorage){
 storage.removeItem(KEY);
 storage.removeItem(LIMIT_KEY);
}
export const offlineGrantDurationMs=MAX_AGE;
