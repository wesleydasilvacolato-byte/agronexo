import {identify} from "../lib/auth.js";
import {securePost,rateGuard} from "../lib/security.js";
const collections=new Set(["projects","quotes","notes","chats"]);
const jsonObject=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
function parseOperations(operations){
 if(!Array.isArray(operations)||operations.length===0||operations.length>4)throw Error("Envie de 1 a 4 registros por vez.");
 return operations.map(entry=>{
  if(!jsonObject(entry)||!collections.has(entry.collection))throw Error("Tipo de registro inválido.");
  const id=String(entry.id??"");
  if(id.length<1||id.length>120||/[\u0000-\u001f]/.test(id))throw Error("Identificador inválido.");
  if(typeof entry.deleted!=="boolean")throw Error("Operação inválida.");
  const payload=entry.deleted?{}:entry.payload;
  if(!jsonObject(payload)||(!entry.deleted&&String(payload.id)!==id))throw Error("Registro incompatível com o identificador.");
  if(JSON.stringify(payload).length>450000)throw Error("Um registro excede o limite de sincronização. Exporte um backup antes de reduzir seu tamanho.");
  return {collection:entry.collection,item_id:id,payload,deleted_at:entry.deleted?new Date().toISOString():null,updated_at:new Date().toISOString()};
 });
}
export default async function handler(req,res){
 res.setHeader("Cache-Control","no-store");
 if(!["GET","POST"].includes(req.method))return res.status(405).json({error:"Método não permitido."});
 if(req.method==="POST"&&!securePost(req,res,1950000))return;
 const session=await identify(req,res);if(!session)return;
 if(!await rateGuard(req,res,{namespace:"workspace",limit:240,windowSec:60}))return;
 const {p,admin}=session;
 try{
  if(req.method==="GET"){
   const {data,error}=await admin.from("agronexo_workspace_records")
    .select("collection,item_id,payload,deleted_at,updated_at").eq("user_id",p.id)
    .order("updated_at",{ascending:true}).limit(5001);
   if(error)throw error;
   if(data.length>5000)return res.status(413).json({error:"Sua conta excedeu 5.000 registros. Exporte um backup e contate o suporte."});
   return res.status(200).json({records:data});
  }
  const mode=String(req.body?.mode||"");
  if(!["import","write"].includes(mode))return res.status(400).json({error:"Modo de sincronização inválido."});
  let operations;
  try{operations=parseOperations(req.body.operations)}catch(e){return res.status(400).json({error:e.message})}
  const rows=operations.map(v=>({...v,user_id:p.id}));
  // Importação idempotente: não sobrescrever conteúdo ou exclusão já existentes na nuvem.
  const {error}=await admin.from("agronexo_workspace_records").upsert(rows,{
   onConflict:"user_id,collection,item_id",ignoreDuplicates:mode==="import"
  });
  if(error)throw error;
  return res.status(200).json({ok:true,count:rows.length});
 }catch(e){
  console.error("[workspace] Falha ao sincronizar:",e?.code||e?.name||"error");
  return res.status(503).json({error:"Não foi possível sincronizar. Seus dados locais continuam preservados."});
 }
}
