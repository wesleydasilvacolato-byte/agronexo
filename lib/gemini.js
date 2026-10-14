// Gateway comum ao Gemini: a chave só é lida no servidor.
// Documentação: https://ai.google.dev/gemini-api/docs/generate-content
const API="https://generativelanguage.googleapis.com/v1beta/models/";
// Novos projetos não têm necessariamente acesso à família 2.5.
export const MODEL=process.env.GEMINI_MODEL||"gemini-3.5-flash-lite";
const FALLBACKS=["gemini-3.5-flash-lite","gemini-3.1-flash-lite"];
let lastWorkingModel=null;
export const hasKey=()=>Boolean(process.env.GEMINI_API_KEY?.trim());
const requests=new Map();
export function limit(req,res,maximum=8,windowMs=60000){
 const id=String(req.headers?.["x-forwarded-for"]||req.socket?.remoteAddress||"anon").split(",")[0].trim().slice(0,90);
 const key=id+":"+maximum;
 const now=Date.now();
 if(requests.size>3000){for(const [k,v] of requests){if(v.reset<now)requests.delete(k)}}
 let v=requests.get(key);
 if(!v||v.reset<now){v={count:0,reset:now+windowMs};requests.set(key,v)}
 if(++v.count>maximum){
  res.setHeader("Retry-After",String(Math.ceil((v.reset-now)/1000)));
  res.status(429).json({error:"Muitas mensagens em pouco tempo. Aguarde alguns instantes e tente novamente."});
  return false;
 }
 return true;
}
export function decodeDataUrl(src,allowed,maxBytes){
 const raw=String(src||"");
 const match=/^data:([a-z0-9.+/-]+)(?:;[^,]*)?;base64,([a-z0-9+/=]+)$/i.exec(raw);
 if(!match||!allowed.test(match[1]))throw Object.assign(new Error("Mídia inválida ou formato não aceito."),{httpStatus:400});
 const mime=match[1].toLowerCase(),data=match[2];
 if(Math.ceil(data.length*3/4)>maxBytes)throw Object.assign(new Error("Arquivo excede o limite permitido."),{httpStatus:413});
 return {inlineData:{mimeType:mime,data}};
}
export function geminiError(code,payload){
 if(code===429)return "Limite gratuito do Gemini atingido. Tente novamente mais tarde ou confira sua cota no Google AI Studio.";
 if(code===401||code===403)return "Chave Gemini inválida ou sem acesso. Confira GEMINI_API_KEY e as permissões do projeto no Google AI Studio.";
 if(code===404)return "Modelo Gemini não disponível para esta chave. Confira GEMINI_MODEL e a disponibilidade regional.";
 if(code===400)return "A API Gemini recusou o formato dos dados enviados. Revise a mídia e tente novamente.";
 if(code>=500)return "Serviço Gemini temporariamente indisponível. Tente novamente.";
 return "Não foi possível consultar o Gemini (código "+code+").";
}
export async function generate(contents,{systemInstruction="",maxOutputTokens=1200,temperature=0.3,timeout=40000}={}){
 if(!hasKey())throw Object.assign(new Error("Configure GEMINI_API_KEY no AGRONEXO na Vercel."),{httpStatus:503});
 // Testa somente modelos oficialmente oferecidos com modalidade gratuita.
 // Em caso de 404 (modelo não acessível), tenta um outro Flash-Lite; não
 // contorna limites 429, políticas de acesso 403 ou outras rejeições.
 const queue=[lastWorkingModel,MODEL,...FALLBACKS].filter((m,i,a)=>m&&a.indexOf(m)===i);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
 try{
  const request={contents,generationConfig:{temperature,maxOutputTokens}};
  if(systemInstruction)request.systemInstruction={parts:[{text:systemInstruction}]};
  for(const model of queue){
   if(!/^[a-zA-Z0-9._-]{3,90}$/.test(model))continue;
   const response=await fetch(API+encodeURIComponent(model)+":generateContent",{
    method:"POST",headers:{"x-goog-api-key":process.env.GEMINI_API_KEY,"Content-Type":"application/json"},
    body:JSON.stringify(request),signal:controller.signal
   });
   const body=await response.json().catch(()=>({}));
   if(response.status===404){
    if(lastWorkingModel===model)lastWorkingModel=null;
    continue;
   }
   if(!response.ok)throw Object.assign(new Error(geminiError(response.status,body)),{httpStatus:response.status===429?429:response.status===401||response.status===403?503:502});
   const reply=body.candidates?.[0]?.content?.parts?.filter(p=>typeof p.text==="string").map(p=>p.text).join("\n").trim();
   if(!reply){
    const reason=body.candidates?.[0]?.finishReason||body.promptFeedback?.blockReason||"";
    throw Object.assign(new Error(reason==="SAFETY"||reason==="PROHIBITED_CONTENT"?"O modelo não conseguiu responder a este conteúdo. Reformule sua pergunta.":"O Gemini não retornou uma resposta textual. Tente novamente."),{httpStatus:422});
   }
   lastWorkingModel=model;
   return {reply,model,usage:body.usageMetadata?{inputTokens:body.usageMetadata.promptTokenCount||0,outputTokens:body.usageMetadata.candidatesTokenCount||0}:undefined};
  }
  throw Object.assign(new Error("Os modelos Gemini disponíveis na modalidade gratuita não aceitaram esta chave (404). Confira os modelos liberados para seu projeto no Google AI Studio."),{httpStatus:503});
 }catch(e){
  if(e.name==="AbortError")throw Object.assign(new Error("O Gemini demorou demais para responder. Envie uma mensagem menor ou tente novamente."),{httpStatus:504});
  throw e;
 }finally{clearTimeout(timer)}
}
export function handleError(e,res){
 res.setHeader("Cache-Control","no-store");
 return res.status(e.httpStatus||502).json({error:e.httpStatus?e.message:"Falha na comunicação com o Gemini. Tente novamente."});
}