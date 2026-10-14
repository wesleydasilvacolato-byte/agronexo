import {hasKey,generate,decodeDataUrl,handleError} from "../lib/gemini.js";
import {securePost,rateGuard} from "../lib/security.js";
import {identify} from "../lib/auth.js";
export default async function handler(req,res){
 const auth=await identify(req,res);if(!auth)return;
 res.setHeader("Cache-Control","no-store");
 if(!securePost(req,res,3_600_000))return;
 if(!hasKey())return res.status(503).json({error:"Configure GEMINI_API_KEY na Vercel para ativar transcrição de áudio."});
 if(!await rateGuard(req,res,{namespace:"transcribe",limit:4,windowSec:60}))return;
 try{
  const media=decodeDataUrl(req.body?.data,/^audio\/(webm|mpeg|mp3|mp4|ogg|wav|x-wav|m4a|aac|flac|opus|aiff)$/i,2500000);
  const result=await generate([{role:"user",parts:[
   {text:"Transcreva em português do Brasil o áudio a seguir, fielmente, preservando termos agronômicos, números e unidades. Devolva SOMENTE a transcrição, sem comentários. Caso não contenha fala inteligível, escreva [áudio sem fala inteligível]."},
   media
  ]}],{maxOutputTokens:1200,temperature:0,timeout:45000});
  return res.status(200).json({text:result.reply,model:result.model});
 }catch(error){return handleError(error,res)}
}