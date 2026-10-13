export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({error:"Método não permitido."});
 if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:"Transcrição indisponível. Configure OPENAI_API_KEY na Vercel."});
 try{
 const data=String(req.body?.data||"");
 if(!/^data:audio\/(webm|mpeg|mp3|mp4|ogg|wav|x-wav|m4a|aac)(?:;[^,]*)?;base64,[a-z0-9+/=]+$/i.test(data))return res.status(400).json({error:"Arquivo de áudio não compatível."});
 const raw=Buffer.from(data.split(",")[1],"base64");
 if(raw.length>12*1024*1024)return res.status(413).json({error:"Áudio excede 12 MB."});
 const mime=data.substring(5,data.indexOf(";")),ext=mime.split("/")[1]==="mpeg"?"mp3":mime.split("/")[1];
 const form=new FormData();form.append("model","gpt-4o-mini-transcribe");form.append("file",new Blob([raw],{type:mime}),"audio."+ext);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
 let response;try{response=await fetch("https://api.openai.com/v1/audio/transcriptions",{method:"POST",headers:{"Authorization":"Bearer "+process.env.OPENAI_API_KEY},body:form,signal:controller.signal})}finally{clearTimeout(timer)}
 const json=await response.json().catch(()=>({}));
 if(!response.ok)return res.status(502).json({error:"Transcrição recusada ("+response.status+"). Confira arquivo e créditos da API."});
 return res.status(200).json({text:String(json.text||"").slice(0,15000)});
 }catch(e){return res.status(502).json({error:"Falha ao transcrever o áudio."})}
}