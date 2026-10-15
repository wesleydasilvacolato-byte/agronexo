/** Seleção de interface com privilégio derivado da sessão validada no servidor. */
export function resolveEntry({pathname="/",role="user",mode=""}={}){
 const atAdmin=pathname==="/admin.html"||pathname==="/admin/";
 if(atAdmin){
  return role==="admin"?{page:"admin",redirect:null}:{page:null,redirect:"/"};
 }
 if(role==="admin"&&mode!=="plataforma"){
  return {page:null,redirect:"/admin.html"};
 }
 return {page:"app",redirect:null};
}
