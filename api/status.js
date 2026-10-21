export default function handler(req,res){
 res.setHeader("Cache-Control","no-store");
 res.status(200).json({
  app:"AGRONEXO",provider:"gemini",model:process.env.GEMINI_MODEL||"gemini-3.5-flash-lite",
  assistantConfigured:Boolean(process.env.GEMINI_API_KEY?.trim()),
  bularioProvider:"MAPA/AGROFIT (índice compactado no build)",bulaPdf:"Apenas link oficial verificado no registro",audioTranscription:"Gemini multimodal",imageAnalysis:true,
  videoAnalysis:"Vídeo curto ou amostragem de quadros para vídeos grandes",
  chatStorage:"Supabase com cópia local e fila de sincronização offline",
  productionAuthReady:Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_ANON_KEY&&(process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_KEY)&&process.env.AUTH_SESSION_SECRET),sharedRateLimitConfigured:Boolean(process.env.UPSTASH_REDIS_REST_URL&&process.env.UPSTASH_REDIS_REST_TOKEN),
  freeTier:"Cotas e disponibilidade determinadas pelo Google AI Studio",version:"1.7.0-beta",workspaceSync:true,syncedCollections:["projects","quotes","notes","chats"]
 })
}