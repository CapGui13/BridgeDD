/* V23 : sélecteur tactile des cartes sans altérer les coups DDS.
   Un tap sur la couleur ou sur une petite carte ouvre des boutons lisibles. */
(function(root){
"use strict";
const names={north:"Nord",south:"Sud",east:"Est",west:"Ouest"};
const suits={spades:"♠",hearts:"♥",diamonds:"♦",clubs:"♣"};
const hon={A:"A",K:"R",Q:"D",J:"V",T:"10"};
function init(){
 const grid=document.querySelector(".grid-outer");
 if(!grid)return;
 const pop=document.createElement("section");
 pop.id="bridge-card-picker";
 pop.hidden=true;
 pop.setAttribute("aria-label","Choisir la carte à jouer");
 pop.innerHTML='<div class="bridge-card-backdrop"></div>'+
 '<div class="bridge-card-sheet" role="dialog" aria-modal="true" aria-labelledby="bridge-card-heading">'+
 '<div class="bridge-card-heading"><strong id="bridge-card-heading">Choisir une carte</strong>'+
 '<button type="button" id="bridge-card-close" aria-label="Fermer">✕</button></div>'+
 '<div id="bridge-card-options" class="bridge-card-options"></div>'+
 '<p class="bridge-card-help">Vert : optimal · Noir : autre carte jouable</p></div>';
 document.body.append(pop);
 const options=pop.querySelector("#bridge-card-options");
 const heading=pop.querySelector("#bridge-card-heading");
 let originalFocus=null,bypass=false;
 function close(){
  if(pop.hidden)return;
  pop.hidden=true;
  document.body.classList.remove("bridge-card-picking");
  if(originalFocus?.isConnected&&typeof originalFocus.focus==="function")
   originalFocus.focus({preventScroll:true});
  originalFocus=null;
 }
 function show(holder){
  if(!holder||!root.isPlayMode?.())return false;
  const [seat,suit]=holder.id.split("_");
  if(!names[seat]||!suits[suit])return false;
  const cards=[...holder.querySelectorAll(".hand-card.hand-card-playable:not([disabled])")];
  if(!cards.length)return false;
  originalFocus=document.activeElement;
  heading.textContent=names[seat]+" — "+suits[suit];
  options.replaceChildren();
  for(const source of cards){
   const key=source.dataset.card;
   if(!key)continue;
   const target=document.createElement("button");
   target.type="button";target.className="bridge-card-choice";target.dataset.card=key;
   if(source.classList.contains("bridge-optimal"))target.classList.add("bridge-card-best");
   if(source.classList.contains("bridge-nonoptimal"))target.classList.add("bridge-card-other");
   target.textContent=hon[key[1]]||key[1];
   target.setAttribute("aria-label",names[seat]+", "+(hon[key[1]]||key[1])+
     suits[suit]+(source.classList.contains("bridge-optimal")?", jeu optimal":""));
   target.addEventListener("click",()=>{
    const fresh=holder.querySelector('.hand-card[data-card="'+key+'"].hand-card-playable:not([disabled])');
    close();
    if(!fresh)return;
    bypass=true;
    try{fresh.click();}finally{bypass=false;}
   });
   options.append(target);
  }
  if(!options.childElementCount)return false;
  pop.hidden=false;
  document.body.classList.add("bridge-card-picking");
  options.querySelector("button")?.focus({preventScroll:true});
  return true;
 }
 // Capture avant le clic natif : une petite cible n'est jamais jouée
 // accidentellement si le sélecteur tactile doit apparaître.
 grid.addEventListener("click",event=>{
  if(bypass||!root.isPlayMode?.()||document.body.dataset.bridgeStage!=="play"||
     !root.matchMedia("(max-width:650px)").matches)return;
  const button=event.target.closest?.(".hand-card");
  if(button){
   if(!button.classList.contains("hand-card-playable")||button.disabled)return;
   if(button.getBoundingClientRect().width>=32)return; // cible déjà confortable
   const holder=button.closest(".hand-holding");
   if(holder&&show(holder)){
    event.preventDefault();event.stopImmediatePropagation();
   }
   return;
  }
  const row=event.target.closest?.(".hand-suit");
  if(row&&show(row.querySelector(".hand-holding"))){
   event.preventDefault();event.stopImmediatePropagation();
  }
 },true);
 pop.querySelector("#bridge-card-close").addEventListener("click",close);
 pop.querySelector(".bridge-card-backdrop").addEventListener("click",close);
 document.addEventListener("keydown",e=>{
  if(!pop.hidden&&e.key==="Escape"){e.preventDefault();close();}
 });
 const observer=new MutationObserver(()=>{
  if(!pop.hidden)close(); // ne pas laisser des choix obsolètes après un coup/undo
 });
 observer.observe(grid,{childList:true,subtree:true});
 for(const id of ["bridge-newphoto","bridge-change-contract","coach-undo"])
  document.getElementById(id)?.addEventListener("click",close);
 root.BridgeCardPicker={open:show,close};
}
if(typeof document!=="undefined"){
 if(document.readyState==="loading")
  document.addEventListener("DOMContentLoaded",init,{once:true});
 else init();
}
})(typeof globalThis!=="undefined"?globalThis:this);
