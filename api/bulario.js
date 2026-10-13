// Proxy oficial de dados abertos AGROFIT/MAPA, sem credenciais.
// https://dados.agricultura.gov.br/dataset/sistema-de-agrotoxicos-fitossanitarios-agrofit
const CSV="https://dados.agricultura.gov.br/dataset/6c913699-e82e-4da3-a0a1-fb6c431e367f/resource/d30b30d7-e256-484e-9ab8-cd40974e1238/download/agrofitprodutosformulados.csv";
let cache=null, loaded=0, inFlight=null;
function parseCSV(src){
  const first=src.indexOf("\n");
  const header=src.slice(0,first).replace(/^\uFEFF/,"");
  const sep=(header.match(/;/g)||[]).length>(header.match(/,/g)||[]).length?";":",";
  const rows=[];let row=[],cell="",quote=false;
  for(let i=0;i<src.length;i++){
    const ch=src[i];
    if(ch==='"'){if(quote&&src[i+1]==='"'){cell+='"';i++}else quote=!quote}
    else if(ch===sep&&!quote){row.push(cell);cell=""}
    else if((ch==="\n"||ch==="\r")&&!quote){if(ch==="\r"&&src[i+1]==="\n")i++;row.push(cell);cell="";if(row.some(v=>v.trim()))rows.push(row);row=[]}
    else cell+=ch;
  }
  if(cell||row.length){row.push(cell);rows.push(row)}
  return rows;
}
const norm=v=>String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
function findValue(record,headers,candidates){
  for(const re of candidates){const i=headers.findIndex(h=>re.test(h));if(i>=0&&record[i])return String(record[i]).trim().slice(0,260)}
  return "";
}
async function load(){
  if(cache&&Date.now()-loaded<6*3600*1000)return cache;
  if(inFlight)return inFlight;
  inFlight=(async()=>{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),18000);
    let response;try{response=await fetch(CSV,{headers:{"User-Agent":"AGRONEXO/1.0 (+https://dados.agricultura.gov.br)","Accept":"text/csv,*/*"},signal:controller.signal,cache:"no-store"})}finally{clearTimeout(timeout)}
    if(!response.ok)throw Error("Fonte oficial respondeu "+response.status);
    const size=Number(response.headers.get("content-length")||0);if(size>35e6)throw Error("Arquivo do portal excede 35 MB.");
    const raw=await response.text();if(raw.length>35e6)throw Error("O arquivo da fonte é grande demais.");
    const lines=parseCSV(raw);
    if(lines.length<2)throw Error("CSV oficial sem registros.");
    const headers=lines[0].map(norm);
    const results=lines.slice(1).filter(x=>x.some(Boolean)).map(row=>{
      const nome=findValue(row,headers,[/nome.*comercial/,/nome.*produto/,/produto.*formulado/,/^produto$/,/^marca$/])||row[0]||"";
      return {nome,registro:findValue(row,headers,[/numero.*registro/,/n.*registro/,/registro/]),ativo:findValue(row,headers,[/ingrediente.*ativo/,/principio.*ativo/,/composicao/,/substancia/]),classe:findValue(row,headers,[/classe.*agronomica/,/classe/,/tipo.*produto/,/finalidade/]),search:row.map(norm).join(" ")};
    });
    cache=results;loaded=Date.now();return results;
  })();
  try{return await inFlight}finally{inFlight=null}
}
export default async function handler(req,res){
  if(req.method!=="GET")return res.status(405).json({error:"Método não permitido."});
  const q=String(req.query?.q||"").trim().slice(0,100);
  if(q.length<2)return res.status(400).json({error:"Informe pelo menos dois caracteres."});
  try{const rows=await load();const words=norm(q).split(/\s+/).filter(Boolean);const matches=rows.filter(row=>words.every(w=>row.search.includes(w)));
    res.setHeader("Cache-Control","s-maxage=1800, stale-while-revalidate=3600");
    return res.status(200).json({total:matches.length,results:matches.slice(0,80).map(({search,...r})=>r),source:"MAPA/AGROFIT",license:"CC BY",url:CSV});
  }catch(error){return res.status(502).json({error:"Consulta indisponível no portal do MAPA. "+String(error.message).slice(0,140)})}
}