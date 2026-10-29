const test=require("node:test"),assert=require("node:assert/strict");
const C=require("./ffb_contract.js");
test("V45: French FFB sans-atout contract and declarer",()=>{
 assert.deepEqual(C.parseContract("2 SA +3"),{level:2,strain:"N"});
 assert.deepEqual(C.parseContract("2SA+3"),{level:2,strain:"N"});
 assert.deepEqual(C.parseContract("6 NT ="),{level:6,strain:"N"});
 assert.equal(C.parseDeclarer("par Ouest"),"west");
 assert.equal(C.parseDeclarer("PAR NORD"),"north");
 assert.equal(C.parseDeclarer("par Est"),"east");
 assert.equal(C.parseDeclarer("par Sud"),"south");
 assert.equal(C.parseDeclarer("por Ouest"),"west");
 assert.equal(C.parseDeclarer("| por Ouest’) |"),"west");
 assert.equal(C.parseDeclarer("porOuest"),"west");
 assert.equal(C.parseDeclarer("par Quest"),"west");
 assert.equal(C.parseDeclarer("par Ouert"),"west");
 assert.equal(C.parseDeclarer("par Oust"),"west");
 assert.equal(C.parseDeclarer("par 0uest"),"west");
 assert.equal(C.parseDeclarer("per Est"),"east");
 assert.equal(C.parseDeclarer("pr Nord"),"north");
});
test("V45: every denomination and contract level; French accents",()=>{
 for(const [value,level,strain] of [
  ["4♠ +1",4,"S"],["3 PIQUES -1",3,"S"],["2P=",2,"S"],
  ["4♥ =",4,"H"],["3 Cœur -2",3,"H"],["5♦",5,"D"],
  ["1 CARREAUX +2",1,"D"],["6♣ =",6,"C"],["7 Trèfles +1",7,"C"],
  ["1 SA",1,"N"],["7 SANS ATOUT",7,"N"]
 ])assert.deepEqual(C.parseContract(value),{level,strain},value);
});
test("V45: do not invent a contract from scores, overtricks, or uncertain OCR",()=>{
 for(const text of ["93,13 %","+3","2 +3","3","4C","10 SA","5 SA 2 SA","4 ♡ +1 3♣"]){
  if(text==="4C")assert.equal(C.parseContract(text),null);
  else assert.equal(C.parseContract(text),null,text);
 }
 for(const text of ["par","par Marie José","93,13 %","par Due","par Ets Ouest","",null]){
  assert.equal(C.parseDeclarer(text),null,String(text));
 }
});
test("V45: OCR crops occupy the centre of a photographed FFB table",()=>{
 const sample=C.locate({width:1536,height:2048},[
  {seat:"north",x:572,y:203,w:426,h:171},
  {seat:"west",x:100,y:717,w:412,h:157},
  {seat:"east",x:1060,y:715,w:405,h:153},
  {seat:"south",x:595,y:1176,w:383,h:146}
 ]);
 assert.ok(sample);
 assert.ok(sample.contract.x>=540&&sample.contract.x<700,JSON.stringify(sample));
 assert.ok(sample.contract.y>=810&&sample.contract.y<845,JSON.stringify(sample));
 assert.ok(sample.declarer.y>sample.contract.y);
 assert.ok(sample.declarerTight.y>sample.declarer.y);
 assert.ok(sample.declarerTight.y+sample.declarerTight.h<
  sample.declarer.y+sample.declarer.h);
 assert.ok(sample.declarer.y+sample.declarer.h<1110);
 assert.equal(C.locate({width:1536,height:2048},[
  {seat:"west",x:100,y:717,w:412,h:157}]),null);
});

test("V48: symbol OCR alias needs visual spade evidence",()=>{
 assert.equal(C.parseContract("1@ X-1"),null);
 assert.equal(C.parseContractVisual("1@ X-1",null),null);
 assert.equal(C.parseContractVisual("1 X-1",null),null);
 assert.equal(C.parseContractVisual("93,13%",null),null);
 assert.deepEqual(C.parseContractVisual("2 SA +3",null),{level:2,strain:"N"});
});
test("V48: tighter crop of central contract avoids empty side margins",()=>{
 const headers=[
  {seat:"west",x:87,y:768,w:389,h:138},
  {seat:"east",x:1007,y:771,w:404,h:136}
 ];
 const crop=C.locate({width:1536,height:2048},headers).contractTight;
 assert.ok(crop.x<683&&crop.x>640,JSON.stringify(crop));
 assert.ok(crop.y>872&&crop.y<899,JSON.stringify(crop));
 assert.ok(crop.w<220&&crop.h<70,JSON.stringify(crop));
});
