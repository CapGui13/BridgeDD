/* Bridge DD — choix d'une lecture cohérente parmi plusieurs lectures OCR.
   Ne crée aucune carte : ne retient que les caractères effectivement lus. */
(function(root){
"use strict";
function choose(rows,parser){
 if(!Array.isArray(rows)||rows.length!==16||!parser)return null;
 const order={north:0,east:1,south:2,west:3};
 const initial={hands:parser.empty(),counts:[0,0,0,0],seen:new Set(),
  distinct:0,duplicates:0,confidence:0,orderPenalty:0,orderWarnings:[]};
 let beam=[initial];
 const normalized=rows.map(r=>{
  const options=[];
  for(const option of r.options||[]){
   const raw=String(option.value||"");
   const value=parser.orderInfo(raw);
   if(!value.valid||value.value.length>13)continue;
   // Deux lectures ayant les mêmes cartes sont équivalentes. Si l'une
   // était déjà dans l'ordre du diagramme, elle est plus crédible.
   const confidence=Math.min(100,Math.max(0,Number(option.confidence)||0));
   const existing=options.find(v=>v.value===value.sorted);
   if(existing){
    if(existing.outOfOrder&&!value.outOfOrder){
     existing.outOfOrder=false;
     existing.confidence=confidence;
    }else if(existing.outOfOrder===value.outOfOrder)
     existing.confidence=Math.max(existing.confidence,confidence);
   }else options.push({value:value.sorted,outOfOrder:value.outOfOrder,
    confidence});
  }
  if(!options.length)options.push({value:"",confidence:0,outOfOrder:false});
  return {...r,options};
 });
 for(const r of normalized){
  const next=[];
  const idx=order[r.seat];
  if(idx===undefined||!parser.suits.includes(r.suit))return null;
  for(const state of beam)for(const option of r.options){
   const count=state.counts[idx]+option.value.length;
   if(count>13)continue;
   const seen=new Set(state.seen);
   let dup=state.duplicates,distinct=state.distinct;
   for(const rank of option.value){
    const card=r.suit+rank;
    if(seen.has(card))dup++;
    else{seen.add(card);distinct++;}
   }
   const counts=state.counts.slice();counts[idx]=count;
   const hands={...state.hands,
    [r.seat]:{...state.hands[r.seat],[r.suit]:option.value}};
   const confidence=state.confidence+option.confidence;
   const orderPenalty=state.orderPenalty+(option.outOfOrder?1:0);
   const orderWarnings=option.outOfOrder
    ?[...state.orderWarnings,{seat:r.seat,suit:r.suit,value:option.value}]
    :state.orderWarnings;
   const score=distinct*12-dup*90-orderPenalty*70+confidence*.003;
   next.push({hands,counts,seen,duplicates:dup,distinct,confidence,
    orderPenalty,orderWarnings,score});
  }
  next.sort((a,b)=>b.score-a.score);
  beam=next.slice(0,256);
  if(!beam.length)return null;
 }
 beam.sort((a,b)=>{
  const rank=s=>{
   const v=parser.validate(s.hands);
   const inferred=parser.completeFourthHand(s.hands).completed;
   return (v.complete?2000:0)+(inferred?1300:0)+
    s.distinct*12-s.duplicates*90-s.orderPenalty*70+
    s.counts.filter(v=>v===13).length*28+s.confidence*.003;
  };
  return rank(b)-rank(a);
 });
 const best=beam[0];
 return {hands:best.hands,validation:parser.validate(best.hands),
  inferred:parser.completeFourthHand(best.hands).completed,
  orderWarnings:best.orderWarnings};
}
const api={choose};
root.BridgeOCRReconcile=api;
if(typeof module==="object"&&module.exports)module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
