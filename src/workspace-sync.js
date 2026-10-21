/**
 * Sync de registros por conta. Mantém cópia local e fila de operações durável.
 * Importação inicial nunca sobrescreve dados existentes no servidor.
 * Operações posteriores propagam criações, mudanças e exclusões (tombstones).
 */
export const COLLECTIONS=Object.freeze(["projects","quotes","notes","chats"]);
export const tracked=state=>{
 const result={};
 for(const collection of COLLECTIONS){
  const rows=Array.isArray(state?.[collection])?state[collection]:[];
  result[collection]=new Map(rows.filter(x=>x&&typeof x==="object"&&x.id!=null)
    .map(x=>[String(x.id),JSON.stringify(x)]));
 }
 return result;
};
export const diffRecords=(oldState,newState)=>{
 const before=tracked(oldState),after=tracked(newState),ops=[];
 for(const collection of COLLECTIONS){
  for(const [id,payload] of after[collection]){
   if(before[collection].get(id)!==payload)ops.push({collection,id,payload:JSON.parse(payload),deleted:false});
  }
  for(const id of before[collection].keys()){
   if(!after[collection].has(id))ops.push({collection,id,deleted:true});
  }
 }
 return ops;
};
export const mergeRemote=(current,serverRecords,pending=[])=>{
 const data={...current},queue=new Map(pending.map(x=>[x.collection+"\x1f"+x.id,x]));
 for(const name of COLLECTIONS)data[name]=[];
 for(const row of serverRecords){
  if(!COLLECTIONS.includes(row.collection))continue;
  const id=String(row.item_id||"");
  if(!id||row.deleted_at)continue;
  if(!row.payload||typeof row.payload!=="object"||Array.isArray(row.payload))continue;
  if(String(row.payload.id)!==id)continue;
  data[row.collection].push(row.payload);
 }
 for(const op of queue.values()){
  if(!COLLECTIONS.includes(op.collection))continue;
  const dest=data[op.collection],idx=dest.findIndex(x=>String(x.id)===op.id);
  if(op.deleted){if(idx>=0)dest.splice(idx,1)}
  else if(op.payload){if(idx>=0)dest[idx]=op.payload;else dest.unshift(op.payload)}
 }
 for(const name of COLLECTIONS)data[name].sort((a,b)=>Date.parse(b.time||0)-Date.parse(a.time||0));
 if(!data.chats.some(x=>x.id===current.selectedChat))data.selectedChat=null;
 return data;
};
export function createWorkspaceSync({userId,storage,read,apply,status,fetcher=fetch,canSync=()=>true}){
 const prefix="agronexo-cloud-v1:"+userId;
 const doneKey=prefix+":migrated",queueKey=prefix+":queue";
 let baseline=structuredClone(read()),running=null,timer=null;
 let pending=[];
 try{const v=JSON.parse(storage.getItem(queueKey)||"[]");if(Array.isArray(v))pending=v.filter(x=>x&&COLLECTIONS.includes(x.collection)&&typeof x.id==="string"&&typeof x.deleted==="boolean")}catch{}
 const saveQueue=()=>storage.setItem(queueKey,JSON.stringify(pending));
 const publish=m=>{if(status)status(m,pending.length)};
 async function request(method,body){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
  try{
   const response=await fetcher("/api/workspace",{
    method,credentials:"same-origin",cache:"no-store",signal:controller.signal,
    ...(method==="POST"?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(data.error||"Servidor indisponível");
   return data;
  }finally{clearTimeout(timeout)}
 }
 async function sendBatches(mode,operations){
  for(let i=0;i<operations.length;i+=4){
   await request("POST",{mode,operations:operations.slice(i,i+4)});
  }
 }
 async function initialImport(){
  if(storage.getItem(doneKey)==="1")return;
  const data=read(),ops=[];
  for(const name of COLLECTIONS)for(const row of data[name]||[]){
   if(row?.id!=null)ops.push({collection:name,id:String(row.id),payload:row,deleted:false});
  }
  // Dados antigos podem já existir na nuvem (primeiro acesso em outro dispositivo).
  await sendBatches("import",ops);
  storage.setItem(doneKey,"1");
 }
 async function flush(){
  for(let rounds=0;pending.length&&rounds<100;rounds++){
   const batch=pending.slice(0,4),snap=batch.map(op=>JSON.stringify(op));
   await request("POST",{mode:"write",operations:batch});
   const keys=new Set(batch.map(op=>op.collection+"\x1f"+op.id));
   // Não descartar uma versão alterada enquanto a requisição estava em trânsito.
   pending=pending.filter(op=>{
    const key=op.collection+"\x1f"+op.id,at=batch.findIndex(x=>x.collection+"\x1f"+x.id===key);
    return !keys.has(key)||JSON.stringify(op)!==snap[at];
   });
   saveQueue();
  }
 }
 async function pull(){
  const response=await request("GET");
  if(!canSync())throw Error("Aguarde a conclusão da conversa antes de atualizar.");
  const remote=mergeRemote(read(),response.records||[],pending);
  apply(remote);
  baseline=structuredClone(read());
 }
 const syncNow=()=>{
  if(running)return running;
  if(!canSync())return Promise.resolve(false);
  running=(async()=>{
   publish("syncing");
   try{
    await initialImport();
    await flush();
    await pull();
    if(pending.length)await flush();
    publish("synced");
    return true;
   }catch(e){publish("offline");return false}
   finally{running=null}
  })();
  return running;
 };
 const save=()=>{
  const current=read();
  const changes=diffRecords(baseline,current);
  baseline=structuredClone(current);
  if(!changes.length)return;
  for(const change of changes){
   pending=pending.filter(x=>x.collection!==change.collection||x.id!==change.id);
   pending.push(change);
  }
  try{saveQueue()}catch{publish("quota");return}
  publish("pending");
  clearTimeout(timer);
  timer=setTimeout(()=>syncNow(),1000);
 };
 const start=()=>{
  window.addEventListener("online",syncNow);
  window.addEventListener("focus",syncNow);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)syncNow()});
  const interval=setInterval(()=>{if(!document.hidden)syncNow()},45000);
  interval?.unref?.();
 };
 return {save,start,syncNow,pendingCount:()=>pending.length,refresh:syncNow};
}
