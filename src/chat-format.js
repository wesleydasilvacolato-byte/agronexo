/**
 * Renderer de respostas do Sebastião. Nunca interpreta HTML de origem.
 * Fórmulas offline: LaTeX usual, potências, subscritos, frações, raízes.
 */
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const commands={times:"×",cdot:"·",div:"÷",pm:"±",mp:"∓",leq:"≤",geq:"≥",neq:"≠",approx:"≈",to:"→",rightarrow:"→",infty:"∞",pi:"π",alpha:"α",beta:"β",gamma:"γ",delta:"δ",Delta:"Δ",theta:"θ",mu:"μ",sigma:"σ",Sigma:"Σ",rho:"ρ",omega:"ω",Omega:"Ω",lambda:"λ",varepsilon:"ε",degree:"°","%":"%","quad":" ","qquad":" ",";":" ",",":" ","!":""};
export function mathHtml(source){
 const s=String(source||"").slice(0,6000);let p=0,steps=0;
 function block(){
  if(s[p]!=="{")return atom();
  p++;const body=sequence(true);if(s[p]==="}")p++;return body;
 }
 function atom(){
  if(p>=s.length)return "";
  if(s[p]==="{")return block();
  if(s[p]==="\\"){
   p++;const start=p;
   if(/[A-Za-z]/.test(s[p]||""))while(p<s.length&&/[A-Za-z]/.test(s[p]))p++;
   else p++;
   const name=s.slice(start,p);
   if(["frac","dfrac","tfrac"].includes(name))return '<span class="ax-frac"><span class="ax-frac-n">'+block()+'</span><span class="ax-frac-d">'+block()+'</span></span>';
   if(name==="sqrt")return '<span class="ax-root">√<span class="ax-radicand">'+block()+'</span></span>';
   if(["text","mathrm","mathbf","operatorname","mathit","textbf"].includes(name))return '<span class="ax-math-text">'+block()+'</span>';
   if(["left","right"].includes(name))return atom();
   return esc(commands[name]??"\\"+name);
  }
  return esc(s[p++]);
 }
 function sequence(group=false){
  let out="";
  while(p<s.length&&steps++<12000){
   if(group&&s[p]==="}")break;
   if(s[p]==="^"||s[p]==="_"){
    const tag=s[p++]==="^"?"sup":"sub";
    out+='<'+tag+' class="ax-math-script">'+block()+'</'+tag+'>';continue;
   }
   out+=atom();
  }
  return out;
 }
 return '<span class="ax-math">'+sequence()+'</span>';
}
function plain(s){
 return esc(s).replace(/([\p{L}\p{N})])\^(\{-?[\d.,a-zA-Z+−-]+\}|-?\d+)/gu,(_,base,power)=>base+'<sup>'+power.replace(/^\{|\}$/g,"")+'</sup>');
}
function inline(text){
 const s=String(text||"");let result="",pos=0;
 const token=/\\\(([\s\S]+?)\\\)|(?<!\\)\$([^$\n]{1,500})\$(?!\$)|\x60([^\x60\n]+)\x60|\*\*([^*\n]+)\*\*/g;
 let match;
 while((match=token.exec(s))){
  result+=plain(s.slice(pos,match.index));
  if(match[1]!=null||match[2]!=null)result+=mathHtml(match[1]??match[2]);
  else if(match[3]!=null)result+='<code class="ax-inline-code">'+esc(match[3])+'</code>';
  else result+='<strong>'+plain(match[4])+'</strong>';
  pos=token.lastIndex;
 }
 return result+plain(s.slice(pos));
}
export function renderAssistant(content){
 const lines=String(content??"").slice(0,30000).replace(/\r\n?/g,"\n").split("\n");
 let html="",paragraph=[],list=null,code=[],inCode=false,inMath=false,math=[];
 const flush=()=>{if(paragraph.length){html+='<p>'+paragraph.map(inline).join("<br>")+'</p>';paragraph=[]}};
 const endList=()=>{if(list){html+='</'+list+'>';list=null}};
 for(const line of lines){
  const trimmed=line.trim();
  if(/^\x60{3}/.test(trimmed)){
   flush();endList();
   if(inCode){html+='<pre class="ax-code"><code>'+esc(code.join("\n"))+'</code></pre>';code=[];inCode=false}
   else inCode=true;
   continue;
  }
  if(inCode){code.push(line);continue}
  if(trimmed==="$$"||trimmed==="\\["){flush();endList();inMath=true;math=[];continue}
  if(inMath){
   if(trimmed==="$$"||trimmed==="\\]"){html+='<div class="ax-math-block" role="math">'+mathHtml(math.join(" "))+'</div>';math=[];inMath=false}
   else math.push(line);
   continue;
  }
  const oneMath=trimmed.match(/^\$\$(.+?)\$\$$|^\\\[(.+?)\\\]$/);
  if(oneMath){flush();endList();html+='<div class="ax-math-block" role="math">'+mathHtml(oneMath[1]||oneMath[2])+'</div>';continue}
  if(!trimmed){flush();endList();continue}
  const heading=trimmed.match(/^(#{1,3})\s+(.+)$/);
  if(heading){flush();endList();const h=Math.min(heading[1].length+2,5);html+='<h'+h+'>'+inline(heading[2])+'</h'+h+'>';continue}
  const unordered=trimmed.match(/^[-*•]\s+(.+)$/);
  const ordered=trimmed.match(/^\d+[.)]\s+(.+)$/);
  if(unordered||ordered){
   flush();const next=unordered?"ul":"ol";
   if(list!==next){endList();html+='<'+next+'>';list=next}
   html+='<li>'+inline((unordered||ordered)[1])+'</li>';continue;
  }
  endList();paragraph.push(line);
 }
 if(inCode)html+='<pre class="ax-code"><code>'+esc(code.join("\n"))+'</code></pre>';
 if(inMath)html+='<div class="ax-math-block" role="math">'+mathHtml(math.join(" "))+'</div>';
 flush();endList();return html||'<p></p>';
}
