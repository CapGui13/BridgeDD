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
 const candidates=names.filter(name=>editDistanceAtMostOne(match[1],name));
 const resolved=new Set(candidates.map(name=>directions[name]));
 return resolved.size===1?[...resolved][0]:null;
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
 // Tighter secondary crop excludes parts of the contract/score above
 // and below the faint declarer line on photographed monitors.
 const declarerTight=rect(1.37,.33);
 if(contract.h<16||declarer.h<16||contract.w<35)return null;
 return {contract,declarer,declarerTight};
}
const api={parseContract,parseDeclarer,locate};
root.BridgeFFBContract=api;
if(typeof module==="object"&&module.exports)module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
