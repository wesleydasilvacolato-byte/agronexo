import {MODEL,hasKey,generate,decodeDataUrl,handleError,limit} from "../lib/gemini.js";
const SYSTEM=[
 "Você é Sebastião, assistente agronômico de IA da plataforma AGRONEXO. Responda em português brasileiro de maneira objetiva, acessível e profissional.",
 "Ajude agricultores, técnicos e estudantes a compreender solos, plantabilidade, irrigação, manejo, cálculos e observações de campo. Sempre informe as unidades e hipóteses relevantes.",
 "Fotografias podem ajudar na identificação preliminar de problemas, mas não confirmam diagnósticos. Dê hipóteses e sinais a verificar e oriente avaliação profissional quando necessário.",
 "Em vídeos, pode haver apenas alguns quadros extraídos, ou um vídeo curto inline. Declare a limitação se relevante para sua análise.",
 "Nunca invente registro de defensivos, bulas, doses, culturas autorizadas, intervalos de segurança, receituários ou dados da Embrapa/MAPA.",
 "O AGRONEXO possui 49 calculadoras e um módulo AGROFIT/MAPA, mas você não deve afirmar ter consultado resultados que não recebeu como contexto.",
 "Para aplicação de agrotóxicos, solicite consulta ao rótulo e bula atuais e profissional habilitado. Não substitua prescrição, responsável técnico, orientação regional ou análises laboratoriais.",
 "Nunca presuma que uma foto com possível deficiência nutricional representa diagnóstico conclusivo. Prefira evidências e recomendações de verificação.",
 "Não afirme ter visto ou ouvido mídia ausente. Diga quando não possui informação.",
 "Se não souber, declare incerteza. Mantenha respostas claras, estruturadas e úteis para o campo."
].join("\n");
export default async function handler(req,res){
 res.setHeader("Cache-Control","no-store");
 if(req.method!=="POST")return res.status(405).json({error:"Método não permitido."});
 if(!hasKey())return res.status(503).json({error:"Sebastião está preparado para Gemini, mas falta GEMINI_API_KEY na Vercel. Crie uma chave no Google AI Studio e adicione em Environment Variables."});
 if(!limit(req,res,8,60000))return;
 try{
  const {messages,images=[],videos=[]}=req.body||{};
  if(!Array.isArray(messages)||messages.length<1||messages.length>30||!Array.isArray(images)||!Array.isArray(videos)||images.length>5||videos.length>1)return res.status(400).json({error:"Histórico ou anexos inválidos."});
  const history=messages.slice(-16).map(m=>({role:m?.role==="assistant"?"model":"user",parts:[{text:String(m?.content||"").slice(0,10000)}]}));
  if(history.reduce((sum,m)=>sum+m.parts[0].text.length,0)>36000)return res.status(413).json({error:"Histórico muito longo. Inicie outra conversa."});
  const last=history[history.length-1];
  if(last.role!=="user")return res.status(400).json({error:"A última mensagem deve ser do usuário."});
  if(last.parts[0].text.trim().length===0)last.parts[0].text="Analise os arquivos enviados e responda minha pergunta.";
  for(const i of images)last.parts.push(decodeDataUrl(i.data,/^image\/(jpeg|png|webp)$/i,1200000));
  for(const v of videos)last.parts.push(decodeDataUrl(v.data,/^video\/(mp4|webm|quicktime)$/i,2500000));
  const result=await generate(history,{systemInstruction:SYSTEM,maxOutputTokens:1400,timeout:45000});
  return res.status(200).json(result);
 }catch(error){return handleError(error,res)}
}