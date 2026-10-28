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
const $=id=>document.getElementById(id);
function setStatus(message){$("ffb-status").textContent=message;}
function setBusy(value){
 busy=value;
 // Ne pas bloquer le sélecteur de fichiers pendant une OCR longue.
 $("ffb-file").disabled=false;
 $("ffb-select").disabled=false;
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
   input.value=P.toFrench(hands[seat][suit]).replace(/ /g,"");
   input.setAttribute("aria-label",seatNames[seat]+" "+symbols[suit]);
   input.addEventListener("input",()=>{
    hands[seat][suit]=P.normalize(input.value).value;
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
 let issues="";
 if(v.duplicates.length)issues+=" Doublons : "+v.duplicates.map(x=>cardFr(x.slice(0,2))).join(", ")+".";
 if(v.unknown.length)issues+=" Caractères inconnus à corriger.";
 if(v.missing.length)issues+=" Manquantes : "+v.missing.length+".";
 results.textContent=(v.complete?"✓ Donne valide : 52 cartes distinctes. ":"À corriger : ")+seats+"."+issues;
 results.className=v.complete?"ffb-validation good":"ffb-validation warn";
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
 const maxWidth=1000,ratio=Math.min(1,maxWidth/image.naturalWidth);
 const canvas=document.createElement("canvas");
 canvas.width=Math.round(image.naturalWidth*ratio);
 canvas.height=Math.round(image.naturalHeight*ratio);
 const ctx=canvas.getContext("2d",{willReadFrequently:true});
 if(!ctx)throw new Error("Canvas indisponible sur cet appareil.");
 ctx.fillStyle="white";ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.drawImage(image,0,0,canvas.width,canvas.height);
 return canvas;
}
function cropCanvas(image,rect,photo=false) {
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
 const hist=new Int32Array(256),gray=new Uint8Array(canvas.width*canvas.height);
 for(let i=0;i<gray.length;i++){
  const j=i*4,r=pix.data[j],g=pix.data[j+1],b=pix.data[j+2];
  const value=Math.round(.299*r+.587*g+.114*b);
  hist[value]++;gray[i]=value;
 }
 let sum=0,background=0,weight=0,max=-1,threshold=128;
 for(let i=0;i<256;i++)sum+=i*hist[i];
 for(let i=0;i<256;i++){
  background+=hist[i];
  if(!background)continue;
  weight+=i*hist[i];
  const remaining=gray.length-background;
  if(!remaining)break;
  const separation=Math.pow(sum/gray.length-weight/background,2)*
   background*gray.length/remaining;
  if(separation>max){max=separation;threshold=i;}
 }
 for(let i=0;i<gray.length;i++){
  const v=gray[i]<=threshold?0:255,j=i*4;
  pix.data[j]=pix.data[j+1]=pix.data[j+2]=v;
  pix.data[j+3]=255;
 }
 ctx.putImageData(pix,0,0);
 const zoom=document.createElement("canvas");
 zoom.width=canvas.width*3;zoom.height=canvas.height*3;
 const zoomCtx=zoom.getContext("2d",{willReadFrequently:true});
 zoomCtx.imageSmoothingEnabled=true;
 zoomCtx.drawImage(canvas,0,0,zoom.width,zoom.height);
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
 const newHands=P.empty();
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
 const chosen=useFast?specialized.hands:newHands;
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
  hands=reading.hands;
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
 const deal=["north","east","south","west"].map(seat=>
  suitOrder.map(suit=>P.normalize(hands[seat][suit]).value).join("."));
 window.fillFormWithTestData(deal);
 reviewSnapshot=null; // Vérification confirmée : conserver les corrections.
 closeDialog();
 window.dispatchEvent(new CustomEvent("bridge:deal-imported",{
  detail:{source:"ffb",inferred:lastInferred}
 }));
 $("ffb-file").value="";
 const state=$("coach-verdict");
 if(state){state.className="coach-verdict good";state.textContent="Donne FFB importée : 52 cartes validées. Choisis un contrat puis joue !";}
 document.querySelector(".grid-outer")?.scrollIntoView({block:"nearest",behavior:"smooth"});
}
function init(){
 const input=document.createElement("input");
 input.type="file";input.accept="image/*";input.id="ffb-file";input.hidden=true;
 const button=document.createElement("button");
 button.type="button";button.id="ffb-select";button.textContent="📷 FFB";
 button.title="Importer une capture d'écran FFB";
 button.onclick=()=>{if(!busy){input.value="";input.click();}};
 const after=$("sample-deals");
 if(after)after.after(button,input);else document.body.append(button,input);
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
 input.addEventListener("change",()=>handleFile(input.files?.[0]));
 $("ffb-apply").addEventListener("click",applyDeal);
 repaintForm();
}
window.BridgeFFBImport={openReview};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
else init();
})();
