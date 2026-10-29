/* Read a bridge contract and declarer printed between FFB's West/East hands.
   Parses OCR conservatively: the score and "+N" overtricks must never be
   mistaken for a level, suit or declarer. */
(function(root){"use strict";
const suitNames={SA:"N",NT:"N",SANSATOUT:"N",SANSATOUTS:"N",
 "♠":"S","♤":"S",PIQUE:"S",PIQUES:"S",P:"S",
 "♥":"H","♡":"H",COEUR:"H",COEURS:"H",
 "♦":"D","♢":"D",CARREAU:"D",CARREAUX:"D",
 "♣":"C","♧":"C",TREFLE:"C",TREFLES:"C",T:"C"};
const directions={NORD:"north",NORTH:"north",N:"north",
 OUEST:"west",WEST:"west",O:"west",W:"west",
 EST:"east",EAST:"east",E:"east",SUD:"south",SOUTH:"south",S:"south"};
function clean(value){
 return String(value??"").normalize("NFKD")
  .replace(/[\u0300-\u036f]/g,"").replace(/Œ/g,"OE").replace(/œ/g,"oe")
  .toUpperCase().replace(/[\u00a0\u2007]/g," ")
  .replace(/[‐‑–—−]/g,"-");
}
function parseContract(raw){
 // Require the denomination next to the 1..7 trick level. In particular
 // reject "2+3", "93,13 %" and random two-digit board numbers.
 const text=clean(raw).replace(/S\s*\.\s*A\.?/g,"SA");
 const pattern=/(^|[^A-Z0-9])([1-7])\s*(SANS[\s-]*ATOUTS?|SA|NT|PIQUES?|COEURS?|CARREAUX?|TREFLES?|[♠♤♥♡♦♢♣♧PT])(?=$|[^A-Z])/g;
 const matches=[];
 let match;
 while((match=pattern.exec(text))){
  const token=match[3].replace(/[\s-]/g,"");
  const strain=suitNames[token];
  if(strain)matches.push({level:Number(match[2]),strain});
 }
 if(matches.length!==1)return null;
 return matches[0];
}
// Gray "par Ouest" often reads as "por Ouest", "par Oust" or
// "porOuest" when photographed on an LCD. Match an unambiguous
// direction after a plausible preposition, not arbitrary OCR words.
function editDistanceAtMostOne(a,b){
 if(Math.abs(a.length-b.length)>1)return false;
 if(a===b)return true;
 let i=0,j=0,errors=0;
 while(i<a.length&&j<b.length){
  if(a[i]===b[j]){i++;j++;continue;}
  if(++errors>1)return false;
  if(a.length>=b.length)i++;
  if(b.length>=a.length)j++;
 }
 return errors+Math.max(a.length-i,b.length-j)<=1;
}
function parseDeclarer(raw){
 const text=clean(raw).replace(/0/g,"O").replace(/5/g,"S")
  .replace(/1/g,"I").replace(/[^A-Z\s]/g," ")
  .replace(/\s+/g," ").trim();
 if(!text)return null;
 const names=["NORD","OUEST","EST","SUD","NORTH","WEST","EAST","SOUTH"];
 const exact=directions[text];
 if(exact)return exact;
 // The result might be surrounded by OCR speckles (bars, punctuation,
 // etc.), but require an unambiguous 'par / por / per / pr' prefix.
 // Reject crops with multiple words/directions: these can contain
 // part of another label (or a player name) and must not be guessed.
 const stripped=text.replace(/^(?:[IL] )+/,"").replace(/(?: [IL])+$/,"");
 const match=stripped.match(/^P(?:AR|OR|ER|R)\s*([A-Z]{3,7})$/);
 if(!match)return null;
 // Exact recognized direction always wins. EST and WEST are only
 // one edit apart, so fuzzy matching alone would make "Est" ambiguous.
 if(directions[match[1]])return directions[match[1]];
 const candidates=names.filter(name=>editDistanceAtMostOne(match[1],name));
 const resolved=new Set(candidates.map(name=>directions[name]));
 return resolved.size===1?[...resolved][0]:null;
}

/* V48: Tesseract's English model often reads the FFB spade glyph as
   '@' on a photographed LCD: '1♠ X -1' -> '1@ X-1'.
   Accept that alias ONLY if the photographed glyph's actual silhouette
   has the pointed, outward-growing crown and a narrow bottom stem.
   The shape is checked from the crop itself; never reinterpret a plain
   number, score, or an unverified '@' as a suit. */
function looksLikeSpade(canvas){
 if(!canvas?.getContext)return false;
 const w=canvas.width|0,h=canvas.height|0;
 if(w<70||h<35||w*h>1250000)return false;
 let source;
 try{source=canvas.getContext("2d",{willReadFrequently:true})
  .getImageData(0,0,w,h).data;}catch(_){return false;}
 const mask=new Uint8Array(w*h),queue=new Int32Array(w*h);
 for(let i=0;i<w*h;i++){
  const j=i*4;
  const gray=.299*source[j]+.587*source[j+1]+.114*source[j+2];
  if(gray<105)mask[i]=1;
 }
 const pieces=[];
 for(let start=0;start<mask.length;start++){
  if(!mask[start])continue;
  let head=0,tail=1,minX=w,minY=h,maxX=-1,maxY=-1;
  queue[0]=start;mask[start]=0;
  while(head<tail){
   const i=queue[head++],y=Math.floor(i/w),x=i-y*w;
   if(x<minX)minX=x;if(x>maxX)maxX=x;
   if(y<minY)minY=y;if(y>maxY)maxY=y;
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    if(!dx&&!dy)continue;
    const yy=y+dy,xx=x+dx;
    if(xx>=0&&xx<w&&yy>=0&&yy<h){
     const k=yy*w+xx;
     if(mask[k]){mask[k]=0;queue[tail++]=k;}
    }
   }
  }
  const pw=maxX-minX+1,ph=maxY-minY+1;
  if(tail>=35&&ph>=Math.max(12,h*.19)&&pw>=5)
   pieces.push({x:minX,y:minY,w:pw,h:ph,area:tail});
 }
 pieces.sort((a,b)=>a.x-b.x);
 // Only inspect the symbol immediately following a single level digit.
 if(pieces.length<2)return false;
 const digit=pieces[0],icon=pieces[1];
 if(icon.x-digit.x-digit.w>digit.h*.60||
    icon.w<icon.h*.62||icon.w>icon.h*1.4||
    icon.h/digit.h<.53||icon.h/digit.h>1.8)return false;
 const widths=new Uint16Array(icon.h);
 const startX=Math.max(0,icon.x),endX=Math.min(w,icon.x+icon.w);
 for(let y=0;y<icon.h;y++){
  const yy=icon.y+y;
  for(let x=startX;x<endX;x++){
   const j=(yy*w+x)*4;
   if(.299*source[j]+.587*source[j+1]+.114*source[j+2]<105)widths[y]++;
  }
 }
 const avg=(lo,hi)=>{
  const begin=Math.floor(icon.h*lo),end=Math.max(begin+1,Math.floor(icon.h*hi));
  let n=0;for(let i=begin;i<Math.min(icon.h,end);i++)n+=widths[i];
  return n/(Math.min(icon.h,end)-begin);
 };
 const top=avg(0,.12),middle=avg(.41,.63),stem=avg(.83,.96);
 // FFB monitor captures have a large, narrow-stem spade, whereas
 // Chromium's fallback Unicode font renders a shorter, broad-stem spade.
 // Check both explicitly; neither resembles the mid-height diamond or
 // the rounded three-lobed club. A stray '@' is never enough on its own.
 const heightRatio=icon.h/digit.h,stemRatio=stem/middle;
 const photoSpade=heightRatio>=.95&&stemRatio>.15&&stemRatio<.59;
 const compactSpade=heightRatio>=.53&&heightRatio<.90&&
  stemRatio>.72&&stemRatio<1.20;
 if(middle<icon.w*.54||top>=middle*.30||
    (!photoSpade&&!compactSpade))return false;
 let downward=0;
 for(let y=2;y<Math.floor(icon.h*.50);y++){
  if(widths[y+1]<widths[y]-Math.max(2,icon.w*.03))downward++;
 }
 return downward<=Math.max(2,Math.ceil(icon.h*.06));
}

/* Independent fallback when English Tesseract loses an FFB ♠ glyph.
   Only run after a conservative visual spade confirmation, then isolate
   the adjacent single level digit. The caller performs OCR on that digit
   alone; no level is inferred from a score or "X -1". */
function isolateSpadeLevel(canvas){
 if(!looksLikeSpade(canvas))return null;
 const w=canvas.width|0,h=canvas.height|0;
 const context=canvas.getContext("2d",{willReadFrequently:true});
 const rgba=context.getImageData(0,0,w,h).data;
 const mask=new Uint8Array(w*h),queue=new Int32Array(w*h);
 for(let i=0;i<mask.length;i++){
  const j=i*4;
  mask[i]=(.299*rgba[j]+.587*rgba[j+1]+.114*rgba[j+2])<105?1:0;
 }
 const pieces=[];
 for(let start=0;start<mask.length;start++){
  if(!mask[start])continue;
  let head=0,tail=1,x0=w,y0=h,x1=-1,y1=-1;
  queue[0]=start;mask[start]=0;
  while(head<tail){
   const i=queue[head++],y=Math.floor(i/w),x=i-y*w;
   if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    if(!dx&&!dy)continue;
    const xx=x+dx,yy=y+dy;
    if(xx<0||xx>=w||yy<0||yy>=h)continue;
    const k=yy*w+xx;
    if(mask[k]){mask[k]=0;queue[tail++]=k;}
   }
  }
  const bw=x1-x0+1,bh=y1-y0+1;
  if(tail>=35&&bh>=Math.max(12,h*.19)&&bw>=5)
   pieces.push({x:x0,y:y0,w:bw,h:bh});
 }
 pieces.sort((a,b)=>a.x-b.x);
 if(pieces.length<2)return null;
 const digit=pieces[0],suit=pieces[1];
 // Same linked components already validated by looksLikeSpade. Keep
 // only the leftmost glyph, not the X or the negative trick count.
 if(digit.x>=suit.x||digit.w>digit.h*1.1)return null;
 const pad=Math.max(12,Math.round(digit.h*.45));
 const side=Math.max(digit.w,digit.h)+pad*2;
 const out=document.createElement("canvas");
 out.width=side;out.height=side;
 const ctx=out.getContext("2d");
 ctx.fillStyle="white";ctx.fillRect(0,0,side,side);
 ctx.drawImage(canvas,digit.x,digit.y,digit.w,digit.h,
  Math.round((side-digit.w)/2),Math.round((side-digit.h)/2),
  digit.w,digit.h);
 return out;
}

function parseContractVisual(raw,canvas){
 const recognized=parseContract(raw);
 if(recognized)return recognized;
 const text=clean(raw).replace(/\s+/g," ");
 const explicit=[...text.matchAll(/(?:^|[^A-Z0-9])([1-7])\s*@(?=$|[^A-Z0-9@])/g)];
 // The engine may drop the unrecognized suit entirely, leaving
 // '1 X-1'. Permit this only when the *photo's pixels independently*
 // confirm a spade and the printed counter/result anchors the level.
 const omitted=[...text.matchAll(/(?:^|[^A-Z0-9])([1-7])(?=\s+X\s*[-+]?\s*\d)/g)];
 const levels=[...explicit,...omitted].map(m=>Number(m[1]));
 if(levels.length!==1||!looksLikeSpade(canvas))return null;
 return {level:levels[0],strain:"S"};
}

function locate(image,headers){
 const w=image?.width|0,h=image?.height|0;
 const west=headers?.find(x=>x.seat==="west");
 const east=headers?.find(x=>x.seat==="east");
 if(!west||!east||w<300||h<400)return null;
 const typical=(west.h+east.h)/2;
 if(typical<18||typical>h*.28||
    Math.abs(west.y-east.y)>typical*.7)return null;
 const middle=((west.x+west.w)+east.x)/2;
 const top=(west.y+east.y)/2;
 const rw=Math.max(55,Math.min(w*.31,typical*3.0));
 const x=Math.max(0,Math.round(middle-rw/2));
 const width=Math.min(Math.round(rw),w-x);
 const rect=(mult,range)=>{
  const y=Math.max(0,Math.round(top+typical*mult));
  const height=Math.min(Math.round(typical*range),h-y);
  return {x,y,w:width,h:height};
 };
 // The two text baselines are below the W/E headers; separate them
 // from the lower percentage score. Calibrated on two real monitor photos.
 const contract=rect(.72,.67),declarer=rect(1.28,.43);
 // Narrow crop for difficult symbol contracts (e.g. '1♠ X -1').
 // A huge blank centre makes single-line Tesseract return no text.
 const contractTight={
  x:Math.max(0,Math.round(middle-typical*.55)),
  y:Math.max(0,Math.round(top+typical*.85)),
  w:Math.round(typical*1.3),
  h:Math.round(typical*.45)
 };
 contractTight.w=Math.min(w-contractTight.x,contractTight.w);
 contractTight.h=Math.min(h-contractTight.y,contractTight.h);
 // Tighter secondary crop excludes parts of the contract/score above
 // and below the faint declarer line on photographed monitors.
 const declarerTight=rect(1.37,.33);
 if(contract.h<16||declarer.h<16||contract.w<35)return null;
 return {contract,contractTight,declarer,declarerTight};
}
const api={parseContract,parseContractVisual,looksLikeSpade,isolateSpadeLevel,parseDeclarer,locate};
root.BridgeFFBContract=api;
if(typeof module==="object"&&module.exports)module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
