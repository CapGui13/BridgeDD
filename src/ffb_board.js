/* Standard duplicate-bridge board metadata. A board number is recognized
   separately from cards: never infer it from an OCR card distribution. */
(function(root){"use strict";
const dealers=["north","east","south","west"];
const vuls=["none","ns","ew","all","ns","ew","all","none",
 "ew","all","none","ns","all","none","ns","ew"];
const seats={north:"Nord",east:"Est",south:"Sud",west:"Ouest"};
const vulLabels={none:"Personne",ns:"Nord – Sud",ew:"Est – Ouest",all:"Tous"};
function forBoard(value){
 const n=Number(value);
 if(!Number.isInteger(n)||n<1||n>99)return null;
 return {number:n,dealer:dealers[(n-1)%4],vulnerability:vuls[(n-1)%16]};
}
function labelDealer(value){return seats[value]||"Non renseigné";}
function labelVulnerability(value){return vulLabels[value]||"Non renseignée";}
function cropBoardNumber(image,headers){
 const w=image?.width|0,h=image?.height|0;
 const north=headers?.find(x=>x.seat==="north");
 if(!north||north.inferred||w<250||h<300||north.h<25)return null;
 // Number appears inside the FFB dealer/board compass, to the
 // left of the North banner. Exclude red O/D, N and S labels.
 const x=Math.round(w*.079),right=Math.round(w*.155);
 const y=Math.max(0,Math.round(north.y+north.h*.36));
 const bottom=Math.min(h,Math.round(north.y+north.h*.91));
 if(right-x<18||bottom-y<18)return null;
 return {x,y,w:right-x,h:bottom-y};
}
const api={forBoard,labelDealer,labelVulnerability,cropBoardNumber};
root.BridgeFFBBoard=api;
if(typeof module==="object"&&module.exports)module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
