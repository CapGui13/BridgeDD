/* Import photo FFB de Bridge DD.
   Reconnaissance Tesseract WASM locale, toujours avec validation humaine. */
(function(){
"use strict";
const P=window.BridgeFFB;
if(!P)return;
const symbols={S:"♠",H:"♥",D:"♦",C:"♣"};
const seatNames={north:"Nord",east:"Est",south:"Sud",west:"Ouest"};
const seatOrder=["north","west","east","south"];
const suitOrder=["S","H","D","C"];
let hands=P.empty(), busy=false, imageUrl=null;
let reviewSnapshot=null,lastInferred=null,recognitionGeneration=0;
let orderWarnings=[];
const $=id=>document.getElementById(id);
function setStatus(message){$("ffb-status").textContent=message;}
function setBusy(value){
 busy=value;
 // Ne pas bloquer le sélecteur de fichiers pendant une OCR longue.
 $("ffb-file").disabled=false;
 $("ffb-camera-file").disabled=false;
 $("ffb-select").disabled=false;
 $("ffb-camera").disabled=false;
 $("ffb-apply").disabled=value||!P.validate(hands).complete;
 $("ffb-choose-another").disabled=false;
 $("ffb-close").disabled=false;
}
function cancelRecognition(){
 // Toute opération asynchrone précédente devient immédiatement caduque.
 recognitionGeneration++;
 setBusy(false);
}
function closeDialog(){
 cancelRecognition();
 $("ffb-dialog").hidden=true;
 $("ffb-file").value="";
 $("ffb-camera-file").value="";
 if(reviewSnapshot){
  hands=reviewSnapshot;
  reviewSnapshot=null;
  repaintForm();
 }
 // Conserver l'aperçu tant que l'on peut vérifier la donne importée.
}
function chooseAnotherPhoto(){
 cancelRecognition();
 $("ffb-file").value="";
 setStatus("Choisis une autre photo dans ta photothèque.");
 // iOS exige un clic direct depuis le geste de l'utilisateur.
 $("ffb-file").click();
}
function ensureCurrent(generation){
 if(generation!==recognitionGeneration)throw new Error("Reconnaissance annulée.");
}
function showDialog(){
 $("ffb-dialog").hidden=false;
 $("ffb-close").focus();
}
function readLiveDeal(){
 const source=typeof window.collectHands==="function"?window.collectHands():null;
 if(!source)return null;
 const built=P.empty();
 const code={spades:"S",hearts:"H",diamonds:"D",clubs:"C"};
 for(const seat of P.seats)for(const card of source[seat]||[]){
  const suit=code[card.suit],pip=card.pip;
  if(!suit||!P.ranks.includes(pip))return null;
  built[seat][suit]+=pip;
 }
 return P.validate(built).complete?built:null;
}
function openReview(){
 if(busy)return false;
 const current=readLiveDeal();
 if(current)hands=current;
 if(!P.validate(hands).complete)return false;
 reviewSnapshot=JSON.parse(JSON.stringify(hands));
 repaintForm();
 setStatus("Vérifie les cartes reconnues. Tu peux corriger une couleur, puis charger la donne.");
 showDialog();
 return true;
}
function repaintForm(){
 const area=$("ffb-hands");
 area.replaceChildren();
 for(const seat of seatOrder){
  const box=document.createElement("fieldset");
  box.className="ffb-seat";
  const legend=document.createElement("legend");
  legend.textContent=seatNames[seat];box.append(legend);
  for(const suit of suitOrder){
   const label=document.createElement("label");
   label.className="ffb-suit-row";
   const glyph=document.createElement("span");
   glyph.className="ffb-glyph "+(suit==="D"||suit==="H"?"red":"");
   glyph.textContent=symbols[suit];
   const input=document.createElement("input");
   input.type="text";input.autocapitalize="characters";
   input.spellcheck=false;input.autocomplete="off";
   input.inputMode="text";input.dataset.seat=seat;input.dataset.suit=suit;
   input.value=P.toFrench(P.orderInfo(hands[seat][suit]).sorted).replace(/ /g,"");
   input.setAttribute("aria-label",seatNames[seat]+" "+symbols[suit]);
   input.addEventListener("input",()=>{
    hands[seat][suit]=P.normalize(input.value).value;
    orderWarnings=orderWarnings.filter(w=>w.seat!==seat||w.suit!==suit);
    updateValidation();
   });
   input.addEventListener("blur",()=>{
    const info=P.orderInfo(input.value);
    if(info.valid){
     hands[seat][suit]=info.sorted;
     input.value=P.toFrench(info.sorted).replace(/ /g,"");
    }
    updateValidation();
   });
   label.append(glyph,input);box.append(label);
  }
  area.append(box);
 }
 updateValidation();
}
function updateValidation(){
 const v=P.validate(hands);
 const results=$("ffb-validation");
 const missing=$("ffb-missing");
 const seats=seatOrder.map(seat=>seatNames[seat]+" "+v.counts[seat]+"/13").join(" · ");
 const warnings=orderWarnings.filter(w=>w?.seat&&w?.suit);
 let issues="";
 if(v.duplicates.length)issues+=" Doublons : "+v.duplicates.map(x=>cardFr(x.slice(0,2))).join(", ")+".";
 if(v.unknown.length)issues+=" Caractères inconnus à corriger.";
 if(v.missing.length)issues+=" Manquantes : "+v.missing.length+".";
 if(warnings.length)
  issues+=" Ordre impossible lu par l'OCR : "+
   warnings.map(x=>seatNames[x.seat]+" "+symbols[x.suit]).join(", ")+
   ". Cartes triées : vérifie leur identité sur la photo.";
 results.textContent=(v.complete
  ?(warnings.length?"⚠ 52 cartes distinctes, mais OCR à vérifier. ":"✓ Donne valide : 52 cartes distinctes. ")
  :"À corriger : ")+seats+"."+issues;
 results.className=v.complete&&!warnings.length?"ffb-validation good":"ffb-validation warn";
 const groups=suitOrder.map(suit=>{
  const pips=v.missing.filter(card=>card[0]===suit)
   .map(card=>P.toFrench(card[1]).trim());
  return pips.length?symbols[suit]+" "+pips.join(" · "):null;
 }).filter(Boolean);
 missing.hidden=!groups.length;
 missing.textContent=groups.length
   ?"Cartes manquantes selon la reconnaissance : "+groups.join("   |   ")
   :"";
 $("ffb-apply").disabled=busy||!v.complete;
 const incomplete=Object.keys(v.counts).filter(seat=>v.counts[seat]===12);
 const canFix=v.total===51&&v.missing.length===1&&
  !v.duplicates.length&&!v.unknown.length&&incomplete.length===1&&
  Object.values(v.counts).every(n=>n===12||n===13);
 const hint=$("ffb-complete");
 hint.hidden=!canFix;
 if(canFix){
  const seat=incomplete[0],card=v.missing[0];
  hint.textContent="Proposer "+cardFr(card)+" à "+seatNames[seat];
  hint.onclick=()=>{
   const target=hands[seat][card[0]];
   if(!target.includes(card[1]))hands[seat][card[0]]=target+card[1];
   repaintForm();
   setStatus("Carte complétée d'après les 51 autres. Vérifie le diagramme.");
  };
 }
}
function cardFr(card){
 const names={K:"R",Q:"D",J:"V",T:"10"};
 return (names[card?.[1]]||card?.[1]||"?")+(symbols[card?.[0]]||"");
}
async function loadImage(file) {
 return new Promise((resolve,reject)=>{
  const img=new Image(),url=URL.createObjectURL(file);
  img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};
  img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Impossible de lire cette image."));};
  img.src=url;
 });
}
function baseCanvas(image){
 // Ne jamais dégrader une photo de moniteur 1536 px à 1000 px :
 // cela efface des jambages et les deux chiffres de « 10 ».
 const maxWidth=1600,maxHeight=2400;
 const ratio=Math.min(1,maxWidth/image.naturalWidth,maxHeight/image.naturalHeight);
 const canvas=document.createElement("canvas");
 canvas.width=Math.round(image.naturalWidth*ratio);
 canvas.height=Math.round(image.naturalHeight*ratio);
 const ctx=canvas.getContext("2d",{willReadFrequently:true});
 if(!ctx)throw new Error("Canvas indisponible sur cet appareil.");
 ctx.fillStyle="white";ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.drawImage(image,0,0,canvas.width,canvas.height);
 return canvas;
}
/* Détecter les rangs visibles à l'intérieur d'une bande photo, sans utiliser
   les nombres de cartes attendus ou un jeu particulier. */
function trimPhotoInk(canvas){
 const context=canvas.getContext("2d",{willReadFrequently:true});
 const {width:w,height:h}=canvas;
 if(w<6||h<8)return canvas;
 const rgba=context.getImageData(0,0,w,h).data;
 const binary=new Uint8Array(w*h),visited=new Uint8Array(w*h);
 const queue=new Int32Array(w*h),components=[];
 for(let i=0,j=0;i<binary.length;i++,j+=4)
  binary[i]=rgba[j]<110?1:0;
 // Conserver les véritables caractères (connexes, d'une hauteur et
 // d'une surface réalistes). Les points de moiré de 1-3 pixels doivent
 // être ignorés, surtout très loin à droite des cartes.
 const minHeight=Math.max(8,Math.floor(h*.15));
 const minArea=Math.max(13,Math.floor(h*.22));
 for(let start=0;start<binary.length;start++){
  if(!binary[start]||visited[start])continue;
  visited[start]=1;
  let n=1,head=0,left=w,top=h,right=-1,bottom=-1;
  queue[0]=start;
  while(head<n){
   const i=queue[head++],y=Math.floor(i/w),x=i%w;
   if(x<left)left=x;if(x>right)right=x;
   if(y<top)top=y;if(y>bottom)bottom=y;
   if(x>0){const j=i-1;if(binary[j]&&!visited[j]){visited[j]=1;queue[n++]=j;}}
   if(x<w-1){const j=i+1;if(binary[j]&&!visited[j]){visited[j]=1;queue[n++]=j;}}
   if(y>0){const j=i-w;if(binary[j]&&!visited[j]){visited[j]=1;queue[n++]=j;}}
   if(y<h-1){const j=i+w;if(binary[j]&&!visited[j]){visited[j]=1;queue[n++]=j;}}
  }
  const cw=right-left+1,ch=bottom-top+1;
  if(n>=minArea&&cw>=2&&ch>=minHeight)
   components.push({left,right,top,bottom,area:n,width:cw,height:ch});
 }
 if(!components.length)return canvas;
 components.sort((a,b)=>a.left-b.left);
 // Un bout de symbole de couleur recadré au bord gauche n'est pas un rang.
 if(components.length>1&&components[0].left<=3&&
    components[0].width<15&&
    components[1].left-components[0].right>=8)
  components.shift();
 const x0=Math.max(0,Math.min(...components.map(c=>c.left))-5);
 const x1=Math.min(w,Math.max(...components.map(c=>c.right))+8);
 const y0=Math.max(0,Math.min(...components.map(c=>c.top))-5);
 const y1=Math.min(h,Math.max(...components.map(c=>c.bottom))+7);
 if(x1-x0<5||y1-y0<8)return canvas;
 const output=document.createElement("canvas");
 output.width=x1-x0;output.height=y1-y0;
 output.getContext("2d").drawImage(canvas,x0,y0,output.width,output.height,
  0,0,output.width,output.height);
 return output;
}
function shiftCrop(rect,offset,imageWidth){
 const x=Math.max(0,Math.min(imageWidth-5,rect.x+offset));
 const right=Math.min(imageWidth,rect.x+rect.w);
 return {x,y:rect.y,w:Math.max(5,right-x),h:rect.h};
}
// Preserve gray levels when Tesseract's own thresholding can recover strokes
// lost by the hard black/white filter, especially leading honors on photos.
function cropPhotoGrayscale(image,rect,trim=false){
 const raw=document.createElement("canvas");
 raw.width=Math.max(1,Math.round(rect.w));
 raw.height=Math.max(1,Math.round(rect.h));
 const ctx=raw.getContext("2d",{willReadFrequently:true});
 ctx.fillStyle="white";
 ctx.fillRect(0,0,raw.width,raw.height);
 ctx.drawImage(image,rect.x,rect.y,rect.w,rect.h,0,0,raw.width,raw.height);
 restoreBlueBadgeDigit(raw);
 const pix=ctx.getImageData(0,0,raw.width,raw.height);
 for(let j=0;j<pix.data.length;j+=4){
  const v=Math.round(.299*pix.data[j]+.587*pix.data[j+1]+.114*pix.data[j+2]);
  // Keep antialiased strokes and mid-gray details for adaptive Otsu.
  const adjusted=Math.max(0,Math.min(255,Math.round((v-100)*1.55+100)));
  pix.data[j]=pix.data[j+1]=pix.data[j+2]=adjusted;
 }
 ctx.putImageData(pix,0,0);
 // Add a trimmed gray candidate without removing the legacy candidate.
 const textRegion=trim?trimPhotoInk(raw):raw;
 const out=document.createElement("canvas"),pad=25;
 out.width=textRegion.width*4+2*pad;
 out.height=textRegion.height*4+2*pad;
 const dest=out.getContext("2d");
 dest.fillStyle="#fff";dest.fillRect(0,0,out.width,out.height);
 dest.imageSmoothingEnabled=true;
 dest.imageSmoothingQuality="high";
 dest.drawImage(textRegion,pad,pad,textRegion.width*4,textRegion.height*4);
 return out;
}
/* Photographic rank-only reading, with no suit symbols or LCD moire. */
function cropPhotoRankInk(image,rect){
 if(rect.w<=0||rect.h<=0||!window.BridgePhotoRank)return null;
 const raw=document.createElement("canvas");
 raw.width=Math.max(1,Math.round(rect.w));
 raw.height=Math.max(1,Math.round(rect.h));
 const ctx=raw.getContext("2d",{willReadFrequently:true});
 ctx.fillStyle="#fff";ctx.fillRect(0,0,raw.width,raw.height);
 ctx.drawImage(image,rect.x,rect.y,rect.w,rect.h,0,0,raw.width,raw.height);
 const prepared=window.BridgePhotoRank.isolate(
  ctx.getImageData(0,0,raw.width,raw.height));
 if(!prepared.boxes.length)return null;
 const mask=prepared.mask,w=prepared.width,h=prepared.height;
 const makeCanvas=box=>{
  const left=Math.max(0,box.x-5),top=Math.max(0,box.y-5);
  const right=Math.min(w,box.x+box.w+6),bottom=Math.min(h,box.y+box.h+6);
  const width=right-left,height=bottom-top;
  const tiny=document.createElement("canvas");
  tiny.width=width;tiny.height=height;
  const dest=tiny.getContext("2d");
  const out=dest.createImageData(width,height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const dark=mask[(y+top)*w+x+left],j=(y*width+x)*4;
   out.data[j]=out.data[j+1]=out.data[j+2]=dark?0:255;
   out.data[j+3]=255;
  }
  dest.putImageData(out,0,0);
  const zoom=document.createElement("canvas"),pad=16;
  zoom.width=width*4+pad*2;zoom.height=height*4+pad*2;
  const z=zoom.getContext("2d");
  z.fillStyle="#fff";z.fillRect(0,0,zoom.width,zoom.height);
  z.imageSmoothingEnabled=false;
  z.drawImage(tiny,pad,pad,width*4,height*4);
  return zoom;
 };
 const boxes=prepared.boxes;
 const left=Math.min(...boxes.map(c=>c.x)),top=Math.min(...boxes.map(c=>c.y));
 const right=Math.max(...boxes.map(c=>c.x+c.w));
 const bottom=Math.max(...boxes.map(c=>c.y+c.h));
 return {canvas:makeCanvas({x:left,y:top,w:right-left,h:bottom-top}),
  parts:boxes.map(makeCanvas)};
}

function cropCanvas(image,rect,photo=false,alternate=false) {
 if(!rect.w||!rect.h)throw new Error("Cadrage des cartes invalide.");
 // Pour une photo d'écran, binariser AVANT d'agrandir les pixels :
 // cela supprime le moiré sans grossir les artefacts RGB de l'écran.
 const scale=photo?1:3,canvas=document.createElement("canvas");
 canvas.width=Math.max(1,Math.round(rect.w*scale));
 canvas.height=Math.max(1,Math.round(rect.h*scale));
 const ctx=canvas.getContext("2d",{willReadFrequently:true});
 ctx.fillStyle="white";ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
 ctx.drawImage(image,rect.x,rect.y,rect.w,rect.h,0,0,canvas.width,canvas.height);
 restoreBlueBadgeDigit(canvas);
 if(!photo)return canvas;
 const pix=ctx.getImageData(0,0,canvas.width,canvas.height);
 const width=canvas.width,height=canvas.height,n=width*height;
 const gray=new Uint8Array(n),smooth=new Uint8Array(n);
 // Le capteur photographie les sous-pixels R/V/B du moniteur : un filtre
 // médian 3x3 avant binarisation supprime le moiré local sans effacer les
 // contours des chiffres, contrairement à un simple flou.
 for(let i=0;i<n;i++){
  const j=i*4;
  gray[i]=Math.round(.299*pix.data[j]+.587*pix.data[j+1]+.114*pix.data[j+2]);
 }
 smooth.set(gray);
 const neighbors=new Uint8Array(9);
 for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
  let k=0;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)
   neighbors[k++]=gray[(y+dy)*width+x+dx];
  neighbors.sort();
  smooth[y*width+x]=neighbors[4];
 }
 const hist=new Int32Array(256);
 for(const value of smooth)hist[value]++;
 let sum=0,seen=0,weighted=0,max=-1,threshold=128,median=128;
 for(let i=0;i<256;i++)sum+=i*hist[i];
 for(let i=0;i<256;i++){
  seen+=hist[i];weighted+=i*hist[i];
  if(seen>=n/2&&median===128)median=i;
  const remaining=n-seen;
  if(!seen||!remaining)continue;
  const separation=Math.pow(sum/n-weighted/seen,2)*seen*n/remaining;
  if(separation>max){max=separation;threshold=i;}
 }
 // Sans plafond, la zone bas-droite d'une photo peut avoir un seuil Otsu
 // de 200+ et devenir un rectangle noir qui empêche toute reconnaissance.
 // Conserver DEUX traitements réels en parallèle au lieu de remplacer
 // l'ancien seuil par le nouveau. La V34 a dégradé plusieurs donneurs :
 // un seul seuil ne convient pas à tous les caractères photographiés.
 const baseline=Math.min(threshold,Math.max(70,Math.min(135,median-25)));
 threshold=(alternate===true||alternate==="boosted")
  ?Math.max(122,Math.min(136,baseline+20))
  :alternate==="low" ?Math.max(65,baseline-9) :baseline;
 for(let i=0;i<n;i++){
  const v=smooth[i]<=threshold?0:255,j=i*4;
  pix.data[j]=pix.data[j+1]=pix.data[j+2]=v;
  pix.data[j+3]=255;
 }
 ctx.putImageData(pix,0,0);
 // En photographiant un écran, la largeur des cartes est souvent
 // inférieure à la moitié de la zone de lecture. Des centaines de pixels
 // blancs détournent le segmentateur de Tesseract sur Safari : réduire la
 // zone au vrai groupe de glyphes, tout en conservant une marge blanche.
 const trimmed=trimPhotoInk(canvas);
 const pad=14;
 const zoom=document.createElement("canvas");
 zoom.width=trimmed.width*3+pad*2;
 zoom.height=trimmed.height*3+pad*2;
 const zoomCtx=zoom.getContext("2d",{willReadFrequently:true});
 zoomCtx.fillStyle="white";
 zoomCtx.fillRect(0,0,zoom.width,zoom.height);
 zoomCtx.imageSmoothingEnabled=false;
 zoomCtx.drawImage(trimmed,pad,pad,trimmed.width*3,trimmed.height*3);
 return zoom;
}
/* FFB overlays the card just played with a blue disk and white rank.
   Transform only that disk into white paper with a black digit before OCR.
   This is local pixel processing; it doesn't infer or invent a card. */
function restoreBlueBadgeDigit(canvas){
 const ctx=canvas.getContext("2d",{willReadFrequently:true});
 const image=ctx.getImageData(0,0,canvas.width,canvas.height);
 const {data,width:w,height:h}=image;
 let x0=w,y0=h,x1=-1,y1=-1,count=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4,r=data[i],g=data[i+1],b=data[i+2];
  if(b>140&&b>r*1.7&&b>g*1.17&&g<180){
   if(x<x0)x0=x;if(x>x1)x1=x;
   if(y<y0)y0=y;if(y>y1)y1=y;count++;
  }
 }
 const bw=x1-x0+1,bh=y1-y0+1;
 if(count<90||bw<h*.3||bh<h*.3||bw>h*1.55||bh>h*1.55||Math.abs(bw-bh)>h*.2)return;
 const cx=(x0+x1)/2,cy=(y0+y1)/2,radius=Math.max(bw,bh)/2;
 for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
  const i=(y*w+x)*4,r=data[i],g=data[i+1],b=data[i+2];
  const inside=Math.hypot(x-cx,y-cy)<radius*.72;
  const isLetter=inside && r>205 && g>205 && b>205;
  data[i]=data[i+1]=data[i+2]=isLetter?0:255;
  data[i+3]=255;
 }
 ctx.putImageData(image,0,0);
}
function addScript(){
 if(window.Tesseract)return Promise.resolve();
 return new Promise((resolve,reject)=>{
  const script=document.createElement("script");
  script.src=new URL("ocr/tesseract.min.js",document.baseURI).href;
  script.onload=resolve;script.onerror=()=>reject(new Error("Chargement du moteur OCR impossible."));
  document.head.appendChild(script);
 });
}
function workerPath(part){
 return new URL("ocr/"+part,document.baseURI).href.replace(/\/$/,"");
}
async function readFFB(source,headers,generation){
 ensureCurrent(generation);
 // Priorité au lecteur de glyphes FFB : plus rapide et testé sur les
 // 8 captures reçues. On garde l'OCR généraliste comme repli.
 let specialized=null;
 try{
  specialized=window.BridgeFFBFast?.recognize(source,headers,P)||null;
 }catch(err){
  specialized=null;
 }
 const specializedCheck=specialized?P.validate(specialized.hands):null;
 const isPhoto=!!headers.some(h=>h.photo);
 const inferredFast=specialized?.readCount===16
  ?P.completeFourthHand(specialized.hands):null;
 if(!isPhoto&&specialized&&specialized.uncertain<=3&&
    (specializedCheck?.complete||inferredFast?.completed)){
  setStatus(inferredFast?.completed
   ?"Main reconstituée par élimination."
   :"52 cartes reconnues.");
  return {hands:specialized.hands,requiresReview:false,reason:""};
 }
 setStatus("Deuxième lecture des cartes pour vérifier les cas difficiles…");
 try { await addScript();ensureCurrent(generation); }
 catch(err){
  ensureCurrent(generation);
  if(specialized?.readCount===16){
   setStatus("Lecture partielle : vérifie et complète les cartes.");
   return {hands:specialized.hands,requiresReview:true,reason:
    "Photo d'écran ou lecture incertaine : vérifie la donne avant de poursuivre."};
  }
  throw err;
 }
 if(!window.Tesseract)throw new Error("Moteur de reconnaissance non disponible.");
 let worker=null;
 const newHands=P.empty(),candidateRows=[];
 try {
  ensureCurrent(generation);
  worker=await window.Tesseract.createWorker("eng",1,{
   workerPath:workerPath("worker.min.js"),
   corePath:workerPath("core"),
   langPath:workerPath("lang"),
   workerBlobURL:false,
   logger:msg=>{
    if(generation!==recognitionGeneration)return;
    if(msg.status==="loading language traineddata"){
      setStatus("Chargement du dictionnaire de reconnaissance…");
    }
   }
  });
  ensureCurrent(generation);
  await worker.setParameters({
   tessedit_char_whitelist:"ARDVJQKT0123456789",
   tessedit_pageseg_mode:"7",
   preserve_interword_spaces:"1"
  });
  let done=0;
  for(const header of headers){
   for(let row=0;row<4;row++){
    ensureCurrent(generation);
    done++;
    setStatus("Lecture des cartes… "+done+"/16");
    const rect=P.cropForRow(header,row,source.width,source.height);
    const cropped=cropCanvas(source,rect,isPhoto);
    const result=await worker.recognize(cropped);
    ensureCurrent(generation);
    const parsed=P.normalize(result.data.text,true);
    // Ne pas inventer une valeur : la vérification finale est obligatoire.
    newHands[header.seat][suitOrder[row]]=parsed.value;
    candidateRows.push({seat:header.seat,suit:suitOrder[row],
      header,row,options:[{value:parsed.value,confidence:Number(result.data?.confidence)||0}]});
   }
  }
  if(isPhoto){
   // Preserve the legacy Tesseract output and add a rank-only reading for
   // every photo row, including apparently complete yet incorrectly read rows.
   const glyphRows=new Map();
   await worker.setParameters({tessedit_pageseg_mode:"8"});
   for(const entry of candidateRows){
    ensureCurrent(generation);
    const rect=P.cropForRowRetry(entry.header,entry.row,
     source.width,source.height,0);
    const isolated=cropPhotoRankInk(source,rect);
    if(!isolated)continue;
    glyphRows.set(entry,isolated);
    const answer=await worker.recognize(isolated.canvas);
    ensureCurrent(generation);
    const normalized=P.normalize(answer.data?.text,true);
    if(!normalized.invalid&&normalized.value.length<=13&&
       new Set(normalized.value).size===normalized.value.length&&
       !entry.options.some(opt=>opt.value===normalized.value))
     entry.options.push({value:normalized.value,
      confidence:Number(answer.data?.confidence)||0});
   }
   await worker.setParameters({tessedit_pageseg_mode:"7"});
   const first=P.validate(newHands);
   const inferred=P.completeFourthHand(newHands);
   if((!first.complete&&!inferred.completed)||
      candidateRows.some(r=>r.options.length>1||
       P.orderInfo(r.options[0].value).outOfOrder)){
    // Une seconde passe ciblée est moins lente qu'une relecture de 16 lignes.
    // Inclure aussi les couleurs avec doublons, pas seulement les mains <13.
    const suspect=new Set();
    const invertedSuits=new Set(candidateRows.filter(r=>
     P.orderInfo(r.options[0].value).outOfOrder).map(r=>r.suit));
    for(const r of candidateRows){
     const confidence=r.options[0].confidence;
     // Tesseract PSM 7 omet souvent des mots très courts sur écran
     // (ex. « AD », « 75 », « R9 »). Les relire même si la confiance
     // du premier passage semble excellente.
     if(first.counts[r.seat]!==13||confidence<75||
        r.options[0].value.length<=3)
      suspect.add(r.seat+":"+r.suit);
    }
    const suitsWithDuplicates=new Set([
     ...first.duplicates.map(v=>v[0]),...invertedSuits
    ]);
    let doneRetry=0;
    const needsAll=first.total<43;
    // Mode « mot unique » au lieu de « ligne » : il peut récupérer les
    // valeurs isolées ignorées sur les photographies de moniteur.
    await worker.setParameters({tessedit_pageseg_mode:"8"});
    ensureCurrent(generation);
    for(const entry of candidateRows){
     if(!needsAll&&!suspect.has(entry.seat+":"+entry.suit)&&
        !suitsWithDuplicates.has(entry.suit))continue;
     ensureCurrent(generation);
     doneRetry++;
     setStatus("Relecture des caractères incertains… "+doneRetry);
     const rect=P.cropForRow(entry.header,entry.row,source.width,source.height);
     // La première lecture conserve le seuil ancien; cette seconde lecture
     // utilise le seuil renforcé de V34 et est évaluée comme alternative.
     const cropped=cropCanvas(source,rect,true,"boosted");
     const alternative=await worker.recognize(cropped);
     ensureCurrent(generation);
     const parsed=P.normalize(alternative.data.text,true);
     if(parsed.value!==entry.options[0].value)
      entry.options.push({value:parsed.value,
       confidence:Number(alternative.data?.confidence)||0});
    }
    await worker.setParameters({tessedit_pageseg_mode:"7"});
    ensureCurrent(generation);
    let reconciled=window.BridgeOCRReconcile?.choose(candidateRows,P);
    let verdict=reconciled?.validation||P.validate(newHands);
    if((!verdict.complete&&!reconciled?.inferred)||reconciled?.orderWarnings?.length){
     // Dernière lecture des lignes présentant réellement des anomalies.
     // Certaines lettres au début de la ligne sont coupées dans le
     // cadrage de base ; d'autres caractères sont répétés par l'OCR.
     const problemSeats=new Set(P.seats.filter(seat=>verdict.counts[seat]!==13));
     const problemSuits=new Set([
      ...verdict.duplicates.map(d=>d[0]),
      ...(reconciled?.orderWarnings||[]).map(x=>x.suit)
     ]);
     const badRows=candidateRows.filter(entry=>
      problemSeats.has(entry.seat)||
      problemSuits.has(entry.suit)||
      entry.options.every(opt=>{
       const v=P.normalize(opt.value).value;
       return new Set(v).size!==v.length;
      }));
     const variations=[
      {shift:-.075,psm:"7"}, // récupérer les premières cartes tronquées
      {shift:.05,psm:"7"},   // retirer les artefacts de symbole de couleur
      {shift:-.03,psm:"8"}   // relire le groupe comme un mot unique
     ];
     let recalc=0;
     let currentPsm="7";
     for(const entry of badRows){
      const rect=P.cropForRow(entry.header,entry.row,source.width,source.height);
      for(const v of variations){
       ensureCurrent(generation);
       setStatus("Vérification approfondie des cartes… "+(++recalc)+"/"+
        (badRows.length*variations.length));
       if(currentPsm!==v.psm){
        await worker.setParameters({tessedit_pageseg_mode:v.psm});
        currentPsm=v.psm;
       }
       const shifted=shiftCrop(rect,Math.round(entry.header.w*v.shift),source.width);
       const crop=cropCanvas(source,shifted,true,false);
       const answer=await worker.recognize(crop);
       ensureCurrent(generation);
       const normalized=P.normalize(answer.data.text,true);
       if(!normalized.invalid&&normalized.value.length<=13&&
          new Set(normalized.value).size===normalized.value.length&&
          !entry.options.some(opt=>opt.value===normalized.value))
        entry.options.push({value:normalized.value,
         confidence:Number(answer.data?.confidence)||0});
      }
     }
     if(currentPsm!=="7")await worker.setParameters({tessedit_pageseg_mode:"7"});
     ensureCurrent(generation);
     reconciled=window.BridgeOCRReconcile?.choose(candidateRows,P)||reconciled;
     // V36: photo perspective can vertically clip whole card lines.
     // Keep prior OCR candidates, read only missing-suit rows and require review.
     if(reconciled&&((!reconciled.validation.complete&&!reconciled.inferred)||reconciled.orderWarnings?.length)){
      const remaining=new Set(P.seats.filter(seat=>
       reconciled.validation.counts[seat]!==13));
      const missingSuits=new Set(reconciled.validation.missing.map(card=>card[0]));
      const doubtful=new Set([
       ...(reconciled.orderWarnings||[]).map(x=>x.suit),
       ...reconciled.validation.duplicates.map(card=>card[0])
      ]);
      const finalRows=candidateRows.filter(r=>
       (remaining.has(r.seat)&&missingSuits.has(r.suit))||
       doubtful.has(r.suit)).sort((a,b)=>
        a.options[0].value.length-b.options[0].value.length);
      const retries=[
       {direction:0,mode:"gray",psm:"7"},
       {direction:-1,mode:"low",psm:"8"},
       {direction:1,mode:"gray",psm:"13"}
      ];
      let currentPsm="7",i=0;
      for(const entry of finalRows)for(const retry of retries){
       ensureCurrent(generation);
       setStatus("Récupération des lignes incomplètes… "+(++i)+"/"+
        (finalRows.length*retries.length));
       if(currentPsm!==retry.psm){
        await worker.setParameters({tessedit_pageseg_mode:retry.psm});
        currentPsm=retry.psm;
       }
       const rect=P.cropForRowRetry(entry.header,entry.row,
        source.width,source.height,retry.direction);
       if(rect.h<=0||rect.w<=0)continue;
       const photo=retry.mode==="gray"
        ?cropPhotoGrayscale(source,rect,true)
        :cropCanvas(source,rect,true,"low");
       const answer=await worker.recognize(photo);
       ensureCurrent(generation);
       const normalized=P.normalize(answer.data?.text,true);
       if(!normalized.invalid&&normalized.value.length<=13&&
          new Set(normalized.value).size===normalized.value.length&&
          !entry.options.some(opt=>opt.value===normalized.value))
        entry.options.push({value:normalized.value,
         confidence:Number(answer.data?.confidence)||0});
      }
      if(currentPsm!=="7")await worker.setParameters({tessedit_pageseg_mode:"7"});
      ensureCurrent(generation);
      reconciled=window.BridgeOCRReconcile?.choose(candidateRows,P)||reconciled;
     }
     // A photograph may turn 9 into D (Queen). If its extra character
     // causes conflicts with another seat, read each rank individually.
     const rankProblemSuits=new Set([
      ...(reconciled?.validation?.missing||[]).map(x=>x[0]),
      ...(reconciled?.validation?.duplicates||[]).map(x=>x[0]),
      ...(reconciled?.orderWarnings||[]).map(x=>x.suit)
     ]);
     const divergent=candidateRows.filter(entry=>
      rankProblemSuits.has(entry.suit)&&
      new Set(entry.options.map(opt=>opt.value)).size>1&&
      glyphRows.get(entry)?.parts.length>0&&
      glyphRows.get(entry).parts.length<=9);
     if(divergent.length){
      await worker.setParameters({tessedit_pageseg_mode:"8"});
      for(const entry of divergent){
       ensureCurrent(generation);
       const parts=glyphRows.get(entry).parts;
       let word="",confidence=0,valid=true;
       for(const canvas of parts){
        const answer=await worker.recognize(canvas);
        ensureCurrent(generation);
        const raw=String(answer.data?.text||"").trim().replace(/\s+/g,"");
        if(!/^[ARDVJQKT0-9]$/.test(raw)){valid=false;break;}
        word+=raw;confidence+=Number(answer.data?.confidence)||0;
       }
       if(!valid)continue;
       const parsed=P.normalize(word,true);
       if(!parsed.invalid&&parsed.value.length<=13&&
          new Set(parsed.value).size===parsed.value.length&&
          !entry.options.some(opt=>opt.value===parsed.value))
        entry.options.push({value:parsed.value,
         confidence:confidence/parts.length});
      }
      await worker.setParameters({tessedit_pageseg_mode:"7"});
      ensureCurrent(generation);
      reconciled=window.BridgeOCRReconcile?.choose(candidateRows,P)||reconciled;
     }
    }
    if(reconciled?.hands){
     for(const seat of P.seats)for(const suit of P.suits)
      newHands[seat][suit]=reconciled.hands[seat][suit];
     orderWarnings=reconciled.orderWarnings||[];
    }
   }
  }
 } catch(err){
  ensureCurrent(generation);
  if(specialized?.readCount===16){
   setStatus("Reconnaissance partielle : corrige les cartes non reconnues.");
   return {hands:specialized.hands,requiresReview:true,reason:
    "La vérification OCR a échoué : confirme la donne avant de poursuivre."};
  }
  throw err;
 } finally {if(worker)await worker.terminate();}
 const generic=P.validate(newHands);
 if(!specialized)return {hands:newHands,requiresReview:isPhoto,reason:
  isPhoto?"Photo d'écran : vérifie les cartes reconnues avant de poursuivre.":""};
 const fast= specializedCheck;
 // Ne pas préférer une seconde lecture qui perd des cartes ou introduit
 // des doublons. Toutes les erreurs restent vérifiables dans le formulaire.
 const score=(v,candidate)=>{
  const inferred=P.completeFourthHand(candidate);
  return (v.complete?200:0)+(inferred.completed?160:0)+v.total-
   6*v.duplicates.length-3*v.unknown.length-
   Math.max(0,v.missing.length-2);
 };
 // Sur photo d'écran, les gabarits de capture nette peuvent confondre
 // certains glyphes du moniteur. Privilégier l'OCR contrasté ; le lecteur
 // rapide ne sert que de dernier recours s'il n'a presque rien trouvé.
 const useFast=isPhoto
  ?generic.total<12&&fast.total>generic.total+12
  :score(fast,specialized.hands)>score(generic,newHands);
 const chosen=P.orderedHands(useFast?specialized.hands:newHands);
 if(useFast)orderWarnings=P.seats.flatMap(seat=>P.suits.flatMap(suit=>
  P.orderInfo(specialized.hands[seat][suit]).outOfOrder?[{seat,suit}]:[]));
 const fastValid=fast.complete||inferredFast?.completed;
 const genericValid=generic.complete||P.completeFourthHand(newHands).completed;
 const disagree=fastValid&&genericValid&&
  !P.sameDistribution(specialized.hands,newHands);
 const requiresReview=isPhoto||!!disagree||(useFast&&specialized.uncertain>3);
 return {hands:chosen,requiresReview,reason:disagree
  ?"Les deux lectures OCR diffèrent : vérifie les cartes avant de poursuivre."
  :(requiresReview
    ?(isPhoto?"Photo d'écran : vérifie les cartes et corrige les caractères incertains."
      :"Reconnaissance incertaine : vérifie les cartes avant de poursuivre.")
    :"")};
}
async function handleFile(file) {
 if(!file)return;
 // Si une image est sélectionnée pendant une autre lecture, seule
 // la sélection la plus récente pourra modifier la donne.
 const generation=++recognitionGeneration;
 hands=P.empty();
 lastInferred=null;
 reviewSnapshot=null;
 orderWarnings=[];
 if(imageUrl){URL.revokeObjectURL(imageUrl);imageUrl=null;}
 $("ffb-image-details").hidden=true;
 $("ffb-preview-image").removeAttribute("src");
 let importAutomatically=false;
 setBusy(true);showDialog();
 repaintForm();
 setStatus("Analyse du screenshot FFB…");
 try {
  if(!file.type.startsWith("image/"))throw new Error("Choisis une image depuis Photos.");
  const image=await loadImage(file);
  ensureCurrent(generation);
  const canvas=baseCanvas(image),ctx=canvas.getContext("2d",{willReadFrequently:true});
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
  const headers=P.detectFFBHeaders(pixels);
  if(headers.length!==4){
   throw new Error("Les quatre bandeaux de joueurs FFB (verts ou roses) n'ont pas été trouvés. Essaie une capture complète de la donne, comme ton exemple.");
  }
  if(imageUrl)URL.revokeObjectURL(imageUrl);
  imageUrl=URL.createObjectURL(file);
  $("ffb-preview-image").src=imageUrl;
  $("ffb-image-details").hidden=false;
  const reading=await readFFB(canvas,headers,generation);
  ensureCurrent(generation);
  hands=P.orderedHands(reading.hands);
  const inferred=P.completeFourthHand(hands);
  if(inferred.completed){
   hands=inferred.hands;
   lastInferred={seat:inferred.seat,count:inferred.added.length};
   setStatus(inferred.added.length+" carte(s) déduite(s) automatiquement pour "+seatNames[inferred.seat]+".");
  }
  repaintForm();
  // Une donne strictement complète (13 par main, 52 cartes différentes,
  // sans caractère inconnu) se charge sans confirmation supplémentaire.
  // Dans tous les autres cas, conserver l'écran de correction.
  importAutomatically=P.validate(hands).complete&&!reading.requiresReview;
  if(reading.requiresReview){
   setStatus(reading.reason||"Vérifie les cartes avant de charger la donne.");
  }else if(!importAutomatically){
   setStatus("Reconnaissance partielle : corrige les cartes avant de charger la donne.");
  }
 }catch(err){
  if(generation===recognitionGeneration)
   setStatus("Reconnaissance impossible : "+(err?.message||"erreur inconnue")+
    ". Appuie sur « Choisir une autre photo » pour revenir à ta photothèque.");
 }finally{
  if(generation===recognitionGeneration){
   setBusy(false);updateValidation();
  }
 }
 if(generation!==recognitionGeneration)return;
 if(importAutomatically){
  try{
   applyDeal();
  }catch(err){
   showDialog();
   setStatus("Chargement impossible : "+(err?.message||"erreur inconnue")+". La donne reste disponible pour vérification.");
  }
 }
}
function applyDeal(){
 const v=P.validate(hands);
 if(!v.complete||busy)return;
 if(typeof window.fillFormWithTestData!=="function"){
  setStatus("Le moteur de jeu n'est pas encore prêt.");return;
 }
 const canonical=P.orderedHands(hands);
 const deal=["north","east","south","west"].map(seat=>
  suitOrder.map(suit=>P.normalize(canonical[seat][suit]).value).join("."));
 window.fillFormWithTestData(deal);
 reviewSnapshot=null; // Vérification confirmée : conserver les corrections.
 closeDialog();
 window.dispatchEvent(new CustomEvent("bridge:deal-imported",{
  detail:{source:"ffb",inferred:lastInferred}
 }));
 $("ffb-file").value="";
 $("ffb-camera-file").value="";
 const state=$("coach-verdict");
 if(state){state.className="coach-verdict good";state.textContent="Donne FFB importée : 52 cartes validées. Choisis un contrat puis joue !";}
 document.querySelector(".grid-outer")?.scrollIntoView({block:"nearest",behavior:"smooth"});
}
function init(){
 // Separate native pickers: iPhone camera (rear-facing when available)
 // versus system photo chooser. Both feed the unchanged V37 OCR pipeline.
 const galleryInput=document.createElement("input");
 galleryInput.type="file";galleryInput.accept="image/*";
 galleryInput.id="ffb-file";galleryInput.hidden=true;
 const cameraInput=document.createElement("input");
 cameraInput.type="file";cameraInput.accept="image/*";
 cameraInput.capture="environment";
 cameraInput.id="ffb-camera-file";cameraInput.hidden=true;
 const actions=document.createElement("div");
 actions.id="ffb-import-actions";
 actions.setAttribute("role","group");
 actions.setAttribute("aria-label","Importer une donne FFB");
 const cameraButton=document.createElement("button");
 cameraButton.type="button";cameraButton.id="ffb-camera";
 cameraButton.textContent="📷 Prendre une photo";
 cameraButton.title="Prendre une photo avec l'appareil photo";
 cameraButton.onclick=()=>{cameraInput.value="";cameraInput.click();};
 const galleryButton=document.createElement("button");
 galleryButton.type="button";galleryButton.id="ffb-select";
 galleryButton.textContent="🖼️ Photothèque";
 galleryButton.title="Choisir une photo existante";
 galleryButton.onclick=()=>{galleryInput.value="";galleryInput.click();};
 actions.append(cameraButton,galleryButton,galleryInput,cameraInput);
 const after=$("sample-deals");
 if(after)after.after(actions);else document.body.append(actions);
 const modal=document.createElement("section");
 modal.id="ffb-dialog";modal.hidden=true;
 modal.innerHTML=`<div class="ffb-scrim"></div>
 <div class="ffb-sheet" role="dialog" aria-modal="true" aria-labelledby="ffb-title">
  <div class="ffb-head"><strong id="ffb-title">Importer une capture FFB</strong>
   <button type="button" id="ffb-choose-another">← Choisir une autre photo</button>
   <button type="button" id="ffb-close">Annuler</button></div>
  <p id="ffb-status" role="status">Sélectionne une capture d'écran FFB.</p>
  <details id="ffb-image-details" hidden><summary>Voir la capture</summary>
   <img alt="Capture d'écran sélectionnée" id="ffb-preview-image"></details>
  <div id="ffb-hands" class="ffb-hands"></div>
  <p id="ffb-validation" class="ffb-validation"></p>
  <p id="ffb-missing" class="ffb-missing" hidden></p>
  <div class="ffb-buttons">
    <button type="button" id="ffb-complete" hidden></button>
    <button type="button" id="ffb-apply" disabled>Charger la donne</button>
  </div>
  <p class="ffb-privacy">Reconnaissance sur l'iPhone : aucune image envoyée à un serveur. Vérifie toujours les 52 cartes.</p>
 </div>`;
 document.body.appendChild(modal);
 $("ffb-close").addEventListener("click",closeDialog);
 $("ffb-choose-another").addEventListener("click",chooseAnotherPhoto);
 galleryInput.addEventListener("change",()=>handleFile(galleryInput.files?.[0]));
 cameraInput.addEventListener("change",()=>handleFile(cameraInput.files?.[0]));
 $("ffb-apply").addEventListener("click",applyDeal);
 repaintForm();
}
window.BridgeFFBImport={openReview,trimPhotoInk,shiftCrop,cropCanvas};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
else init();
})();
