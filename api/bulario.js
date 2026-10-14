/**
 * Consulta pública AGROFIT/MAPA, sem credenciais.
 * Estratégia 1: DataStore CKAN (busca paginada no servidor do MAPA).
 * Estratégia 2: leitura incremental do CSV oficial (sem descarregar arquivo
 * inteiro na memória), em caso de DataStore não habilitado.
 * O CSV público NÃO assegura PDF de bula individual por produto.
 */
const DATASET="https://dados.agricultura.gov.br/dataset/sistema-de-agrotoxicos-fitossanitarios-agrofit";
const PORTAL="https://agrofit.agricultura.gov.br/agrofit_cons/principal_agrofit_cons";
const RESOURCE="d30b30d7-e256-484e-9ab8-cd40974e1238";
const BASE="https://dados.agricultura.gov.br";
const CSV=BASE+"/dataset/6c913699-e82e-4da3-a0a1-fb6c431e367f/resource/"+RESOURCE+"/download/agrofitprodutosformulados.csv";
const CACHE=new Map(),TTL=20*60*1000,MAX=80;
const norm=x=>String(x||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const safeText=x=>String(x??"").trim().slice(0,600);
const pdfLink=x=>{
 try{const u=new URL(String(x||"").trim());return u.protocol==="https:"&&u.hostname.endsWith(".gov.br")&&/\.pdf(?:$|[?#])|\/bula(?:\/|$)/i.test(u.href)?u.href:null}catch{return null}
};
function standardized(row){
 const obj=Array.isArray(row)?Object.fromEntries(row):row;
 const entries=Object.entries(obj).filter(([k])=>k!=="_id");
 const field=(...patterns)=>{
  for(const re of patterns){const hit=entries.find(([k,v])=>re.test(norm(k))&&v!=null&&String(v).trim());if(hit)return safeText(hit[1])}
  return "";
 };
 const registro=field(/^numero.*registro/,/^registro/,/registro/);
 const nome=field(/produto.*formulado.*marca/,/marca.*comercial/,/nome.*comercial/,/nome.*produto/,/produto.*formulado/,/^produto$/);
 const ativo=field(/ingrediente.*ativo/,/principio.*ativo/,/composicao/,/substancia/);
 const classe=field(/^classe$/, /classe.*agronomica/,/classe.*uso/,/classe/);
 const titular=field(/titular.*registro/,/empresa.*registrante/,/fabricante/);
 const toxico=field(/classificacao.*toxicologica/,/classe.*toxicologica/);
 const ambiental=field(/classificacao.*ambiental/,/classe.*ambiental/);
 const rawBula=field(/url.*bula/,/link.*bula/,/^bula/);
 const resultado={nome:nome||"Produto sem nome",registro,ativo,classe,titular,toxico,ambiental,
   bulaUrl:pdfLink(rawBula),consultaUrl:PORTAL};
 return resultado;
}
function success(res,data){res.setHeader("Cache-Control","public, s-maxage=120, stale-while-revalidate=300");return res.status(200).json({...data,fonte:DATASET,consultaOficial:PORTAL,origem:"MAPA/AGROFIT",bula:"PDF somente quando publicado e identificado na fonte oficial."})}
function parseDelimitedRow(fields,headers){
 const row={};for(let i=0;i<headers.length;i++){if(headers[i])row[headers[i]]=fields[i]||""}return row;
}
function searchFields(row,query){
 const words=norm(query).split(/\s+/).filter(Boolean);
 const combined=norm(Object.values(row).filter(x=>typeof x==="string").join(" "));
 return words.every(w=>combined.includes(w));
}
async function datastore(query){
 const u=new URL(BASE+"/api/3/action/datastore_search");
 u.searchParams.set("resource_id",RESOURCE);
 u.searchParams.set("limit",String(MAX));
 u.searchParams.set("q",query);
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),9000);
 try{
  const response=await fetch(u,{signal:controller.signal,headers:{"Accept":"application/json"}});
  if(!response.ok)throw Error("DataStore respondeu "+response.status);
  const j=await response.json();
  if(!j.success||!Array.isArray(j.result?.records))throw Error("Índice DataStore indisponível");
  const records=j.result.records;
  return {results:records.map(standardized),total:j.result.total??records.length,backend:"datastore",consultadoEm:new Date().toISOString()};
 }finally{clearTimeout(timeout)}
}
async function csvStreamSearch(query){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),46000);
 let reader;
 try{
  const response=await fetch(CSV,{signal:controller.signal,headers:{"Accept":"text/csv,*/*","User-Agent":"Agronexo/1.2 (consulta AGROFIT public data)"}});
  if(!response.ok)throw Error("CSV público do MAPA respondeu "+response.status);
  if(!response.body?.getReader)throw Error("O servidor não disponibilizou dados em fluxo.");
  reader=response.body.getReader();
  const decoder=new TextDecoder("utf-8");
  let bytes=0,sep=null,inQuotes=false,cell="",row=[],headers=null,
      collected=[],total=0,firstRow=true;
  const completeRow=()=>{
   const values=[...row,cell];cell="";row=[];
   if(firstRow){
     const head=values.map((v,i)=>(i===0?v.replace(/^\uFEFF/,""):v).trim());
     headers=head;firstRow=false;return;
   }
   if(!values.some(v=>v.trim()))return;
   const record=parseDelimitedRow(values,headers);
   if(searchFields(record,query)){
     total++;
     if(collected.length<MAX)collected.push(standardized(record));
   }
  };
  // Delimitador detectado na primeira linha. Máquina de estados suporta
  // aspas, vírgulas, ponto-e-vírgula e quebras de linha dentro de campos.
  let prevCR=false;
  const accept=s=>{
   for(let i=0;i<s.length;i++){
     let ch=s[i];
     if(prevCR){prevCR=false;if(ch==="\n")continue}
     if(firstRow&&sep===null&&ch==="\n"){
       const top=cell.replace(/^\uFEFF/,"");
       const semi=(top.match(/;/g)||[]).length,comma=(top.match(/,/g)||[]).length;
       sep=semi>=comma?";":",";
       // Reanalisa o cabeçalho com parser normal.
       cell="";row=[];inQuotes=false;acceptHeader(top,sep);
       firstRow=false;continue;
     }
     if(firstRow&&sep===null){cell+=ch;continue}
     if(ch==='"'){
       if(inQuotes&&s[i+1]==='"'){cell+='"';i++}
       else inQuotes=!inQuotes;
     }else if(ch===sep&&!inQuotes){row.push(cell);cell=""}
     else if((ch==="\n"||ch==="\r")&&!inQuotes){completeRow();if(ch==="\r")prevCR=true}
     else cell+=ch;
     if(cell.length>500000)throw Error("Campo CSV excedeu o limite de processamento.");
   }
  };
  const acceptHeader=(line,separator)=>{
   // Cabeçalhos oficiais contêm colunas simples e podem incluir aspas.
   const names=[],parts=line.split(separator);for(let x of parts)names.push(x.replace(/^"|"$/g,"").trim());
   headers=names;
  };
  while(true){
   const {value,done}=await reader.read();
   if(done)break;
   bytes+=value.byteLength;
   if(bytes>175*1024*1024)throw Error("CSV oficial excedeu 175 MB. Consulta direta ao MAPA necessária.");
   accept(decoder.decode(value,{stream:true}));
  }
  accept(decoder.decode());
  if(cell.length||row.length)completeRow();
  if(!headers?.length)throw Error("O CSV oficial não apresentou cabeçalho reconhecível.");
  return {results:collected,total,backend:"csv-stream",consultadoEm:new Date().toISOString()};
 }finally{clearTimeout(timeout);if(reader)try{await reader.cancel()}catch{}}
}
async function queryOfficial(query){
 try{return await datastore(query)}
 catch(datastoreError){
  try{return await csvStreamSearch(query)}
  catch(csvError){
   const problem=csvError?.name==="AbortError"?"Consulta excedeu o tempo disponível.":csvError?.message||"Falha ao ler base pública.";
   const err=new Error(problem);
   err.details="DataStore: "+(datastoreError?.message||"indisponível");
   throw err;
  }
 }
}
export default async function handler(req,res){
 if(req.method!=="GET")return res.status(405).json({error:"Método não permitido."});
 const q=String(req.query?.q||"").trim().slice(0,100);
 if(q.length<2)return res.status(400).json({error:"Informe ao menos 2 caracteres."});
 const key=norm(q),old=CACHE.get(key);
 if(old&&Date.now()-old.time<TTL)return success(res,old.data);
 try{
  const data=await queryOfficial(q);
  if(CACHE.size>80)CACHE.clear();
  CACHE.set(key,{time:Date.now(),data});
  return success(res,data);
 }catch(e){
  // Jamais fabricar resultados; devolva a origem para o usuário continuar
  // consultando a bula pelo portal oficial.
  res.setHeader("Cache-Control","no-store");
  return res.status(503).json({
   error:"A fonte pública do MAPA não respondeu a esta consulta. "+e.message,
   fonte:DATASET,consultaOficial:PORTAL,semResultadosConfirmados:true
  });
 }
}
