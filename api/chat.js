const SYSTEM=[
"Você é Sebastião, assistente de IA da plataforma AGRONEXO, para educação e organização de trabalho agronômico no Brasil.",
"Responda em português do Brasil, com tom profissional, simples, claro e gentil. Apresente cálculos com premissas e unidades.",
"Não invente dados de registros de agrotóxicos, indicações de bula, prazos de carência, dosagens, formulações, misturas, aprovação de cultura, receitas agronômicas nem tratamentos.",
"Quando perguntarem sobre defensivos, oriente consulta à base AGROFIT/MAPA, rótulo e bula atuais, registro estadual quando aplicável e responsável técnico habilitado.",
"Interprete imagens com ressalvas. Se for diagnóstico fitossanitário, ofereça hipóteses, diga o que observar e busque confirmação em laboratório ou profissional. Não afirme certeza por foto.",
"Vídeos enviados ao sistema são analisados como poucos quadros estáticos, sem áudio do vídeo; indique essa limitação quando relevante.",
"Não afirme ter navegado na internet, consultado banco oficial ou executado cálculos não apresentados, a menos que seja verdade.",
"Evite prescrever práticas perigosas; recomende EPI e normas de segurança quando pertinente.",
"É um assistente de IA e pode falhar; mantenha respostas práticas e sem excesso de texto."
].join("\n");
export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({error:"Método não permitido."});
 const apiKey=process.env.OPENAI_API_KEY;
 if(!apiKey)return res.status(503).json({error:"Sebastião ainda não está ativado. Configure OPENAI_API_KEY nas variáveis de ambiente do projeto na Vercel."});
 try{
  const {messages=[],images=[]}=req.body||{};
  if(!Array.isArray(messages)||messages.length===0||messages.length>30||!Array.isArray(images)||images.length>5)return res.status(400).json({error:"Mensagem ou anexos inválidos."});
  const cleaned=messages.slice(-16).map(m=>({role:m.role==="assistant"?"assistant":"user",content:String(m.content||"").slice(0,12000)}));
  const total=cleaned.reduce((n,m)=>n+m.content.length,0);
  if(total>35000)return res.status(413).json({error:"Histórico muito extenso. Inicie uma nova conversa."});
  const content=[{type:"input_text",text:cleaned.pop().content||"Analise os anexos enviados."}];
  for(const im of images){
   const data=String(im.data||"");
   if(!/^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(data)||data.length>2500000)return res.status(400).json({error:"Imagem inválida ou muito grande."});
   content.push({type:"input_image",image_url:data,detail:"auto"});
  }
  const input=[...cleaned.map(m=>({role:m.role,content:m.content})),{role:"user",content}];
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
  let response;try{response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-4.1-mini",instructions:SYSTEM,input,max_output_tokens:1500,store:false}),signal:controller.signal})}finally{clearTimeout(timer)}
  const json=await response.json().catch(()=>({}));
  if(!response.ok)return res.status(response.status===429?429:502).json({error:response.status===429?"Limite de uso da API atingido.":("OpenAI retornou "+response.status+". Confira credenciais, faturamento e modelo.")});
  const output=json.output_text||json.output?.flatMap(o=>o.content||[]).filter(c=>c.type==="output_text").map(c=>c.text).join("\n")||"";
  return res.status(200).json({reply:output||"Não recebi uma resposta de texto.",model:json.model});
 }catch(e){return res.status(502).json({error:e.name==="AbortError"?"A resposta excedeu o tempo limite.":"Falha na comunicação com o modelo de IA."})}
}