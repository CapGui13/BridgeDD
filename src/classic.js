/* Diagramme mobile traditionnel — les boutons de jeu DDS sont conservés. */
(function(){
"use strict";
const seats=["north","west","east","south"];
const suits=["spades","hearts","diamonds","clubs"];
let scheduled=false;
function compass(){
 const center=document.querySelector(".grid-filler-center");
 if(!center||center.querySelector(".bridge-compass"))return;
 const node=document.createElement("div");
 node.className="bridge-compass";
 node.setAttribute("role","img");
 node.setAttribute("aria-label","Nord Ouest Est Sud");
 for(const [place,letter] of [["north","N"],["west","O"],["east","E"],["south","S"]]){
   const span=document.createElement("span");
   span.className=place;span.textContent=letter;span.setAttribute("aria-hidden","true");
   node.appendChild(span);
 }
 center.insertBefore(node,center.firstChild);
}
function fit(){
 const grid=document.querySelector(".grid-container");
 if(!grid)return;
 if(!window.matchMedia("(max-width:650px)").matches){
   grid.style.removeProperty("--bridge-vertical-hand-width");
   return;
 }
 // Mettre un repère de largeur identique à N/S (basé sur le PLUS LONG rang
 // de cartes effectivement dessiné et non pas un conteneur de 80 %).
 const holdersBySeat=Object.fromEntries(seats.map(seat=>[
   seat,suits.map(suit=>document.getElementById(seat+"_"+suit+"_cards")).filter(Boolean)
 ]));
 const font=(seat,size)=>holdersBySeat[seat].forEach(el=>
   el.style.setProperty("--bridge-pip-font",size+"px"));
 const actualRowWidth=holder=>{
   const row=holder.closest(".hand-suit");
   if(!row)return 0;
   const glyph=row.querySelector("spade-suit,heart-suit,diamond-suit,club-suit");
   const cards=Array.from(holder.querySelectorAll(".hand-card"));
   const gap=3;
   return Math.ceil((glyph?.getBoundingClientRect().width||18)+gap+
     cards.reduce((sum,card)=>sum+card.getBoundingClientRect().width,0)+
     gap*Math.max(0,cards.length-1)+2);
 };
 // Une même taille de caractères pour Nord et Sud, y compris si l'une des
 // mains contient une couleur très longue. L'axe des symboles reste commun.
 let verticalSize=18;
 const maxVerticalWidth=Math.max(90,grid.clientWidth-16);
 grid.style.removeProperty("--bridge-vertical-hand-width");
 font("north",verticalSize);
 font("south",verticalSize);
 const longest=()=>Math.max(0,...["north","south"].flatMap(seat=>
   holdersBySeat[seat].map(actualRowWidth)));
 while(verticalSize>9&&longest()>maxVerticalWidth){
   verticalSize-=.5;
   font("north",verticalSize);
   font("south",verticalSize);
 }
 const width=Math.min(maxVerticalWidth,longest());
 if(width>0)grid.style.setProperty("--bridge-vertical-hand-width",width+"px");
 for(const seat of ["west","east"]){
   const holders=holdersBySeat[seat];
   let size=18;
   font(seat,size);
   const fits=()=>holders.every(el=>el.scrollWidth<=el.clientWidth+1);
   while(size>9&&!fits()){
     size-=.5;
     font(seat,size);
   }
 }
}
function schedule(){
 if(scheduled)return;
 scheduled=true;
 requestAnimationFrame(()=>{scheduled=false;fit()});
}
function init(){
 compass();
 const grid=document.querySelector(".grid-outer");
 if(grid)new MutationObserver(schedule).observe(grid,{childList:true,subtree:true});
 window.addEventListener("resize",schedule);
 window.addEventListener("orientationchange",schedule);
 if(document.fonts?.ready)document.fonts.ready.then(schedule);
 schedule();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
else init();
})();
