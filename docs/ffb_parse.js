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
  // The pink FFB player banners can be photographed as muted salmon/
  // brick colours, far below 245 red because the camera captures an LCD.
  // Preserve the bright screenshot rule and add a hue-relative threshold
  // for monitor photos (a neutral gray background should not qualify).
  const pink=(r>245&&g>198&&g<245&&b>191&&b<243&&r-g>12&&Math.abs(g-b)<16)||
   (r>80&&r-g>12&&r-b>18);
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
   components.push({x:minX,y:minY,w:bw,h:bh,area:tail,colour});
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
 // V42: A photographed screen can wash salmon-pink O/E banners almost
 // completely into the background. The two distinct central green N/S
 // player banners still locate the entire table. Infer the *geometry*
 // of the lateral headers from those green anchors when the usual O/E
 // pair is absent. The cards themselves must still be read by OCR.
 let recoveredFromGreen=false;
 if(!best){
  const centralGreens=components.filter(c=>c.colour===1&&
   c.x+c.w/2>w*.3&&c.x+c.w/2<w*.7&&
   c.w>=w*.17&&c.h>=h*.035);
  let anchors=null,score=-Infinity;
  for(const top of centralGreens)for(const bottom of centralGreens){
   if(bottom.y<=top.y)continue;
   const separation=bottom.y-top.y;
   const size=(top.h+bottom.h)/2;
   if(separation<size*3||separation>size*8.8)continue;
   const cxTop=top.x+top.w/2,cxBottom=bottom.x+bottom.w/2;
   if(Math.abs(cxTop-cxBottom)>Math.max(top.w,bottom.w)*.52)continue;
   if(Math.abs(top.w-bottom.w)>Math.max(top.w,bottom.w)*.36)continue;
   const pairScore=top.area+bottom.area-Math.abs(cxTop-cxBottom)*40;
   if(pairScore>score){anchors=[top,bottom];score=pairScore;}
  }
  if(anchors){
   const [top,bottom]=anchors;
   const centerX=(top.x+top.w/2+bottom.x+bottom.w/2)/2;
   const targetWidth=Math.round((top.w+bottom.w)*.54);
   const targetHeight=Math.round((top.h+bottom.h)*.50);
   const yCenter=(top.y+bottom.y)/2;
   // Positions are expressed relative to actual detected green banners,
   // rather than absolute screen pixels or any known specific deal.
   const wx=Math.max(0,Math.round(centerX-targetWidth*1.7));
   const ex=Math.min(w-targetWidth,
    Math.round(centerX+targetWidth*.65));
   const y=Math.max(0,Math.round(yCenter));
   const candidateWest={x:wx,y,w:targetWidth,h:targetHeight,
    area:0,inferred:true};
   const candidateEast={x:ex,y,w:targetWidth,h:targetHeight,
    area:0,inferred:true};
   if(candidateWest.x+candidateWest.w<w*.50&&
      candidateEast.x>w*.51&&targetHeight>0){
    best=[candidateWest,candidateEast];
    recoveredFromGreen=true;
   }
  }
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
 // Pink photographed banners sometimes include a tinted halo above the
 // actual rectangular header. Their tall colour bounding box otherwise
 // causes each successive card-row crop to drift downward (and miss clubs).
 // When both central banners are visible, use their more reliable height
 // as the row-spacing reference, and align O/E to the lower banner top.
 let correctedWest=west,correctedEast=east;
 if(photo&&north&&south){
  const typical=Math.round((north.h+south.h)/2);
  const tallest=Math.max(west.h,east.h);
  if(typical>0&&tallest>typical*1.13&&
     Math.abs(west.y-east.y)<typical*.28){
   const top=Math.max(west.y,east.y);
   correctedWest={...west,y:top,h:typical};
   correctedEast={...east,y:top,h:typical};
  }
 }
 // On a photographed green banner, the pale icon can split off the
 // leftmost part of the green component. In that case its narrow bbox
 // shifts the rank crop to the right and cuts the first honour.
 // The west/east pair gives the real horizontal center and width.
 const restoreBannerWidth=component=>{
  if(!component||!photo||component.w>=width*.91)return component;
  const center=component.x+component.w/2;
  const expected=xMiddle+width/2;
  if(Math.abs(center-expected)>width*.38)return component;
  const x=Math.max(0,Math.min(w-width,Math.round(expected-width/2)));
  return {...component,x,w:width};
 };
 return [
  {seat:"north",...(restoreBannerWidth(north)||{x:xMiddle,y:yMiddle-offset,w:width,h:height,inferred:true}),photo},
  {seat:"west",...correctedWest,photo,recoveredFromGreen},
  {seat:"east",...correctedEast,photo,recoveredFromGreen},
  {seat:"south",...(restoreBannerWidth(south)||{x:xMiddle,y:yMiddle+offset,w:width,h:height,inferred:true}),photo}
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

/* Photo OCR retry regions compensate a slight vertical camera perspective. */
function cropForRowRetry(header,row,imWidth,imHeight,direction=0){
 const base=cropForRow(header,row,imWidth,imHeight);
 if(base.h<=0||base.w<=0)return {...base,y:Math.max(0,Math.min(imHeight,base.y)),h:0};
 const pad=Math.max(2,Math.round(header.h*.05));
 const shift=Math.round(header.h*.065*Math.max(-1,Math.min(1,direction)));
 const y0=Math.max(0,Math.min(imHeight,base.y-pad+shift));
 const y1=Math.max(y0,Math.min(imHeight,base.y+base.h+pad+shift));
 return {...base,y:y0,h:y1-y0};
}
const api={seats,suits,ranks,normalize,orderInfo,orderedHands,toFrench,empty,validate,completeFourthHand,sameDistribution,detectGreenHeaders,detectFFBHeaders,cropForRow,cropForRowRetry};
root.BridgeFFB=api;
if(typeof module==="object"&&module.exports)module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
