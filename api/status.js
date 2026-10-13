export default function handler(req,res){
 res.setHeader("Cache-Control","no-store");
 res.status(200).json({
  app:"AGRONEXO",provider:"gemini",model:process.env.GEMINI_MODEL||"gemini-2.5-flash",
  assistantConfigured:Boolean(process.env.GEMINI_API_KEY?.trim()),
  audioTranscription:"Gemini multimodal",imageAnalysis:true,
  videoAnalysis:"Vídeo curto ou amostragem de quadros para vídeos grandes",
  chatStorage:"localStorage do navegador (sem sincronização)",
  freeTier:"Cotas e disponibilidade determinadas pelo Google AI Studio",version:"1.1.0-beta"
 })
}