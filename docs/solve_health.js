/* Surveillance du solveur DDS : erreurs explicites + relance sûre.
   Le moteur natif rend ses erreurs dans #result, masqué dans Bridge DD. */
(function(root){
"use strict";
function classifyNativeStatus(text){
 const s=String(text||"").trim();
 if(!s||/^(Computing|Calcul|Solved in|Résolu en)\b/i.test(s))return null;
 if(/\b(error|failed|failure|exception|unavailable|could not|cannot|undefined|not supported|invalid|erreur|impossible|échec|needs HTTP|SharedArrayBuffer)\b/i.test(s))
  return s.slice(0,210);
 return null;
}
function stateKey(state){
 if(!state||!state.history)return "";
 return [state.declarer,state.denomination,state.targetTricks,
  ...state.history.map(p=>p.seat+":"+p.key)].join("|");
}
function waiting(state,complete){
 return !!state&&!complete&&(!state.pendingDiffs||
  !Object.keys(state.pendingDiffs).length);
}
function init(){
 const alert=document.getElementById("bridge-solve-alert"),
   msg=document.getElementById("bridge-solve-message"),
   retry=document.getElementById("bridge-solve-retry"),
   output=document.getElementById("result");
 if(!alert||!msg||!retry||!output)return;
 let current="",since=0,forcedError="",lastNative="";
 function show(error){
  alert.hidden=!error;
  if(error)msg.textContent=error;
 }
 function refresh(){
  const state=root.playState;
  if(document.body.dataset.bridgeStage!=="play"||!state){
   current="";since=0;forcedError="";lastNative="";show("");return;
  }
  const done=typeof root.isPlayHistoryComplete==="function"
   &&root.isPlayHistoryComplete(state);
  if(!waiting(state,done)){
   forcedError="";lastNative="";show("");return;
  }
  const key=stateKey(state);
  if(key!==current){current=key;since=Date.now();forcedError="";lastNative="";}
  if(!since)since=Date.now();
  const native=classifyNativeStatus(output.textContent);
  const problem=forcedError||(native&&native===lastNative?native:null);
  if(problem)show("Calcul DDS impossible : "+problem);
  else if(Date.now()-since>25000)
   show("Le calcul DDS prend trop de temps ou s'est interrompu. Vérifie ta connexion puis réessaie.");
  else show("");
 }
 const observer=new MutationObserver(()=>{
  lastNative=classifyNativeStatus(output.textContent)||"";
  refresh();
 });
 observer.observe(output,{subtree:true,childList:true,characterData:true});
 const render=root.renderPlayUi;
 if(typeof render==="function")
  root.renderPlayUi=function(...args){const v=render(...args);refresh();return v;};
 retry.addEventListener("click",()=>{
  since=Date.now();forcedError="";lastNative="";show("");
  if(typeof root.scheduleDealSolve!=="function"){
   show("Le moteur DDS n'est pas disponible. Recharge l'application.");return;
  }
  try{Promise.resolve(root.scheduleDealSolve()).catch(e=>{
   forcedError=String(e?.message||e||"Erreur inconnue");refresh();
  });}catch(e){forcedError=String(e?.message||e);refresh();}
 });
 setInterval(refresh,1250);
 refresh();
}
root.BridgeSolveHealth={classifyNativeStatus,stateKey,waiting};
if(typeof module==="object"&&module.exports)module.exports=root.BridgeSolveHealth;
if(typeof document!=="undefined"){
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
 else init();
}
})(typeof globalThis!=="undefined"?globalThis:this);
