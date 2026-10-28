/* Bridge DD / FFB screenshot parser, independent of OCR engine and UI.
   Same-origin image processing: no upload or remote recognition. */
(function(root){
"use strict";
const seats=["north","east","south","west"], suits=["S","H","D","C"], ranks="AKQJT98765432";
const french={K:"R",Q:"D",J:"V",T:"10"};
function toFrench(value){return [...String(value)].map(c=>french[c]||c).join(" ");}
function normalize(text,ocr=false){
 let raw=String(text||"").normalize("NFKC").toUpperCase()
  .replace(/[\s.,;:_-]/g,"").replace(/[♠♥♦♣]/g,"")
  .replace(/[O]/g,ocr?"0":"O");
 if(ocr){
  raw=raw.replace(/[I|L]/g,"1").replace(/Z/g,"2").replace(/B/g,"8");
  let fixed="";
  for(let i=0;i<raw.length;i++){
   if(raw[i]==="0" && (i===0||raw[i-1]!=="1"))fixed+="1";
   fixed+=raw[i];
  }
  raw=fixed;
 }
 raw=raw.replace(/10/g,"T").replace(/R/g,"K").replace(/D/g,"Q").replace(/V/g,"J");
 return {value:raw,invalid:raw.replace(/[AKQJT2-9]/g,"")};
}
// Les diagrammes FFB montrent toujours les honneurs puis les petites
// cartes par ordre décroissant. Pour l'OCR, conserver l'information
// « lecture hors ordre » AVANT le tri : elle signale une erreur possible.
function orderInfo(text,ocr=false){
 const parsed=normalize(text,ocr);
 const distinct=new Set(parsed.value).size===parsed.value.length;
 const valid=!parsed.invalid&&distinct;
 const sorted=valid?[...parsed.value].sort(
  (a,b)=>ranks.indexOf(a)-ranks.indexOf(b)).join(""):parsed.value;
 return {value:parsed.value,sorted,valid,
  outOfOrder:valid&&parsed.value!==sorted,
  duplicates:!distinct,invalid:parsed.invalid};
}
function orderedHands(hands){
 const result=empty();
 for(const seat of seats)for(const suit of suits)
  result[seat][suit]=orderInfo(hands?.[seat]?.[suit]||"").sorted;
 return result;
}
function empty(){return Object.fromEntries(seats.map(seat=>[seat,{S:"",H:"",D:"",C:""}]));}
function validate(hands){
 const counts={}, duplicates=[], unknown=[], seen=new Map();
 for(const seat of seats){
  let count=0;
  for(const suit of suits){
   const raw=String(hands?.[seat]?.[suit]||"");
   const parsed=normalize(raw);
   if(parsed.invalid)unknown.push(seat+" "+suit+": "+parsed.invalid);
   for(const pip of parsed.value){
    if(!ranks.includes(pip))continue;
    count++;
    const card=suit+pip;
    if(seen.has(card))duplicates.push(card+" ("+seen.get(card)+"/"+seat+")");
    else seen.set(card,seat);
   }
  }
  counts[seat]=count;
 }
 const missing=[];
 for(const suit of suits)for(const pip of ranks)
  if(!seen.has(suit+pip))missing.push(suit+pip);
 const complete=seats.every(seat=>counts[seat]===13)&&
  duplicates.length===0&&unknown.length===0&&missing.length===0;
 return {complete,counts,duplicates,missing,unknown,total:Object.values(counts).reduce((a,b)=>a+b,0)};
}
/* Complete a partially read hand by elimination only when the other
   three hands have exactly 13 unique, valid cards each. No mutation and
   no assignment when two or more hands have gaps or there are duplicates. */
function completeFourthHand(hands){
 const result=validate(hands);
 const candidates=seats.filter(seat=>result.counts[seat]!==13);
 const fallback={completed:false,hands,seat:null,added:[]};
 if(result.complete||result.duplicates.length||result.unknown.length||
    candidates.length!==1)return fallback;
 const seat=candidates[0];
 if(result.counts[seat]>=13 || result.missing.length!==13-result.counts[seat]||
    !seats.every(s=>s===seat||result.counts[s]===13))return fallback;
 const completed=empty();
 for(const s of seats)for(const suit of suits)
  completed[s][suit]=normalize(hands?.[s]?.[suit]||"").value;
 for(const card of result.missing){
  const suit=card[0],rank=card[1];
  completed[seat][suit]+=rank;
 }
 for(const suit of suits){
  completed[seat][suit]=[...completed[seat][suit]].sort(
   (a,b)=>ranks.indexOf(a)-ranks.indexOf(b)).join("");
 }
 if(!validate(completed).complete)return fallback;
 return {completed:true,hands:completed,seat,added:result.missing.slice()};
}
/* Compare card attribution without treating rank order as a different deal. */
function sameDistribution(left,right){
 for(const seat of seats)for(const suit of suits){
  const sorted=hands=>[...normalize(hands?.[seat]?.[suit]||"").value]
   .sort((a,b)=>ranks.indexOf(a)-ranks.indexOf(b)).join("");
  if(sorted(left)!==sorted(right))return false;
 }
 return true;
}
/* Identify FFB player headers in both colours, including mixed tables.
   North may be scrolled off-screen: the two complete horizontal player
   headers anchor the 329/101 geometry of the FFB deal diagram. */
function detectFFBHeaders(image){
 const {width:w,height:h,data}=image;
 const n=w*h;
 if(!w||!h||!data||data.length<n*4||n>14000000)return [];
 const pixel=new Uint8Array(n),queue=new Int32Array(n);
 for(let i=0,j=0;i<n;i++,j+=4){
  const r=data[j],g=data[j+1],b=data[j+2];
  // Le vert d'un écran photographié est plus sombre (moiré, exposition),
  // contrairement au pixel vert uniforme d'une capture directe.
  const green=g>55&&g>r*1.27&&g>b*1.12&&r<155&&b<175;
  const pink=r>245&&g>198&&g<245&&b>191&&b<243&&r-g>12&&Math.abs(g-b)<16;
  pixel[i]=green?1:(pink?2:0);
 }
 const components=[];
 for(let start=0;start<n;start++){
  const colour=pixel[start];
  if(!colour)continue;
  let head=0,tail=1,minX=w,maxX=-1,minY=h,maxY=-1;
  queue[0]=start;pixel[start]=0;
  while(head<tail){
   const i=queue[head++],y=Math.floor(i/w),x=i-y*w;
   if(x<minX)minX=x;if(x>maxX)maxX=x;
   if(y<minY)minY=y;if(y>maxY)maxY=y;
   const near=[x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<h-1?i+w:-1];
   for(const k of near)if(k>=0&&pixel[k]===colour){
    pixel[k]=0;queue[tail++]=k;
   }
  }
  const bw=maxX-minX+1,bh=maxY-minY+1;
  if(bw>=w*.17&&bh>=Math.max(12,h*.008)&&bw/bh>1.6&&bw/bh<12&&
     tail>=bw*bh*.21)
   components.push({x:minX,y:minY,w:bw,h:bh,area:tail});
 }
 let best=null,bestScore=-Infinity;
 for(const left of components)for(const right of components){
  if(left===right||left.x>=right.x)continue;
  const a=(left.x+left.w/2)/w,b=(right.x+right.w/2)/w;
  if(a>.47||b<.53||b-a<.35)continue;
  if(Math.abs(left.y-right.y)>Math.max(8,Math.min(left.h,right.h)*.19))continue;
  if(Math.abs(left.w-right.w)>Math.max(left.w,right.w)*.22)continue;
  if(Math.abs(left.h-right.h)>Math.max(left.h,right.h)*.25)continue;
  if(Math.min(left.h,right.h)<w*.055)continue;
  const score=left.area+right.area-Math.abs(left.y-right.y)*100;
  if(score>bestScore){best=[left,right];bestScore=score;}
 }
 if(!best)return [];
 const [west,east]=best;
 const width=Math.round((west.w+east.w)/2);
 const height=Math.round((west.h+east.h)/2);
 const yMiddle=Math.round((west.y+east.y)/2);
 const xMiddle=Math.round((west.x+east.x)/2);
 const offset=Math.round(height*(329/101));
 // Sur une photo prise de biais, la projection géométrique de N/S à
 // partir de O/E peut décaler les cartes de plusieurs dizaines de pixels.
 // Chercher les vrais bandeaux N/S avant d'utiliser cette projection.
 const chooseVertical=(targetY)=>{
  const predictedX=xMiddle+width/2;
  const options=components.filter(c=>
   c!==west&&c!==east&&c.x+c.w/2>w*.35&&c.x+c.w/2<w*.65&&
   Math.abs(c.x+c.w/2-predictedX)<width*.55&&
   Math.abs(c.y-targetY)<height*.85&&
   c.w>width*.70&&c.w<width*1.32&&
   c.h>height*.65&&c.h<height*1.42);
  options.sort((a,b)=>
   Math.abs(a.y-targetY)-Math.abs(b.y-targetY)+
   (Math.abs(a.x+a.w/2-predictedX)-
    Math.abs(b.x+b.w/2-predictedX))*.2);
  return options[0]||null;
 };
 const north=chooseVertical(yMiddle-offset);
 const south=chooseVertical(yMiddle+offset);
 // Les photos d'écran sont plus petites dans le champ et peuvent avoir
 // une légère perspective : la seconde lecture OCR demande une vérification.
 const photo=width<w*.34;
 return [
  {seat:"north",...(north||{x:xMiddle,y:yMiddle-offset,w:width,h:height,inferred:true}),photo},
  {seat:"west",...west,photo},
  {seat:"east",...east,photo},
  {seat:"south",...(south||{x:xMiddle,y:yMiddle+offset,w:width,h:height,inferred:true}),photo}
 ];
}
function detectGreenHeaders(image){return detectFFBHeaders(image);}

function cropForRow(header,row,imWidth,imHeight){
 const {x,y,w,h}=header;
 const x0=Math.max(0,Math.round(x+w*.15));
 const x1=Math.min(imWidth,Math.round(x+w*.968));
 const y0=Math.max(0,Math.round(y+h+h*(.13+row*.445)));
 // La hauteur .56 chevauche parfois la couleur suivante sur une photo.
 const y1=Math.min(imHeight,Math.round(y+h+h*((header.photo?.47:.56)+row*.445)));
 return {x:x0,y:y0,w:Math.max(0,x1-x0),h:Math.max(0,y1-y0)};
}
const api={seats,suits,ranks,normalize,orderInfo,orderedHands,toFrench,empty,validate,completeFourthHand,sameDistribution,detectGreenHeaders,detectFFBHeaders,cropForRow};
root.BridgeFFB=api;
if(typeof module==="object"&&module.exports)module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
