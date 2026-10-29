const test=require("node:test"),assert=require("node:assert/strict"),p=require("./ffb_parse.js");
test("Example FFB : 52 distinct cards",()=>{
 const hands={
 north:{S:"ARD762",H:"84",D:"R86",C:"62"},
 west:{S:"V",H:"R652",D:"D9754",C:"DV3"},
 east:{S:"1083",H:"V107",D:"AV102",C:"R107"},
 south:{S:"954",H:"AD93",D:"3",C:"A9854"}
 };
 const v=p.validate(hands);
 assert.equal(v.complete,true,JSON.stringify(v));
 assert.deepEqual(v.counts,{north:13,east:13,south:13,west:13});
 assert.equal(v.missing.length,0);
});
test("OCR French 10 and 0 without 1 are handled",()=>{
 assert.equal(p.normalize("A V 10",true).value,"AJT");
 assert.equal(p.normalize("A V 0",true).value,"AJT");
 assert.equal(p.normalize("R D V 9").value,"KQJ9");
});
test("Duplicate/missing caught even if the total is 52",()=>{
 const hands={
 north:{S:"ARD762",H:"84",D:"R86",C:"62"},
 west:{S:"V",H:"R652",D:"D9754",C:"DV3"},
 east:{S:"1083",H:"V107",D:"AV103",C:"R107"},
 south:{S:"954",H:"AD93",D:"3",C:"A9854"}
 };
 const v=p.validate(hands);assert.equal(v.complete,false);
 assert.ok(v.duplicates.includes("D3 (east/south)"));
 assert.ok(v.missing.includes("D2"));
});
test("Green FFB blocks assign seats by position",()=>{
 const w=150,h=270,data=new Uint8ClampedArray(w*h*4);
 function rect(x,y,width,height){for(let py=y;py<y+height;py++)for(let px=x;px<x+width;px++){
 const i=(py*w+px)*4;data[i]=0;data[i+1]=145;data[i+2]=64;data[i+3]=255;
 }}
 rect(44,13,60,18);rect(6,94,60,18);rect(84,94,60,18);rect(44,174,60,18);
 rect(3,3,27,32); // dealer compass must not be interpreted as a hand
 const got=p.detectGreenHeaders({width:w,height:h,data});
 assert.deepEqual(got.map(x=>x.seat),["north","west","east","south"]);
});

test("FFB pink/red screenshot layout is recognized (dealer tile excluded)",()=>{
 const w=750,h=1334,data=new Uint8ClampedArray(w*h*4);
 function rect(x,y,width,height,r,g,b){
  for(let py=y;py<y+height;py++)for(let px=x;px<x+width;px++){
   const i=(py*w+px)*4;data[i]=r;data[i+1]=g;data[i+2]=b;data[i+3]=255;
  }
 }
 rect(223,52,304,101,255,229,225);
 rect(32,381,304,101,255,229,225);
 rect(414,381,304,101,255,229,225);
 rect(223,710,304,101,255,229,225);
 rect(32,52,144,144,255,229,225);
 const seats=p.detectFFBHeaders({width:w,height:h,data});
 assert.deepEqual(seats.map(x=>x.seat),["north","west","east","south"]);
 assert.deepEqual(seats.map(x=>[x.x,x.y,x.w,x.h]),[
  [223,52,304,101],[32,381,304,101],[414,381,304,101],[223,710,304,101]
 ]);
});
test("New FFB red screenshot example has 52 unique cards",()=>{
 const hands={
  north:{S:"V1084",H:"94",D:"ADV8",C:"V52"},
  west:{S:"AR732",H:"RD5",D:"7532",C:"9"},
  east:{S:"965",H:"1072",D:"R4",C:"D10764"},
  south:{S:"D",H:"AV863",D:"1096",C:"AR83"}
 };
 const v=p.validate(hands);
 assert.equal(v.complete,true,JSON.stringify(v));
 assert.deepEqual(v.counts,{north:13,east:13,south:13,west:13});
});

test("Mixed header colors and scrolled north still assign four seats",()=>{
 const w=750,h=1334,data=new Uint8ClampedArray(w*h*4);
 function fill(x,y,width,height,r,g,b){
  for(let py=y;py<y+height;py++)for(let px=x;px<x+width;px++){
   const i=(py*w+px)*4;data[i]=r;data[i+1]=g;data[i+2]=b;data[i+3]=255;
  }
 }
 fill(32,274,304,101,0,145,64);fill(414,274,304,101,255,229,225);
 fill(223,603,304,101,255,229,225);
 const found=p.detectFFBHeaders({width:w,height:h,data});
 assert.deepEqual(found.map(x=>x.seat),["north","west","east","south"]);
 assert.equal(found[0].y,-55);
 assert.equal(found[3].y,603);
});
test("Eight supplied FFB deals are valid with 52 distinct cards",()=>{
 const packs=[
 [["ARD762","84","R86","62"],["V","R652","D9754","DV3"],["1083","V107","AV102","R107"],["954","AD93","3","A9854"]],
 [["AR1095","1096","AD2","74"],["V8642","7","1085","A862"],["3","ARDV42","RV6","DV10"],["D7","853","9743","R953"]],
 [["106","A86","R95","R9543"],["D72","1074","A874","D87"],["93","RDV953","6","AV62"],["ARV854","2","DV1032","10"]],
 [["V1084","94","ADV8","V52"],["AR732","RD5","7532","9"],["965","1072","R4","D10764"],["D","AV863","1096","AR83"]],
 [["R973","D","R1093","V983"],["54","AV86","872","A1064"],["AD","R10752","V","RD752"],["V10862","943","AD654",""]],
 [["V10986","2","1098","AD107"],["R7","AR8743","AD5","R5"],["A42","V96","V64","9843"],["D53","D105","R732","V62"]],
 [["D7543","8","AR32","DV7"],["V10982","AV5","976","54"],["","R76432","DV105","A63"],["AR6","D109","84","R10982"]],
 [["873","R","A765","105432"],["V942","AV42","R1043","7"],["AD65","D97","DV82","86"],["R10","108653","9","ARDV9"]]
 ];
 const seats=["north","west","east","south"],suits=["S","H","D","C"];
 for(const [i,pack] of packs.entries()){
  const hands=p.empty();
  pack.forEach((holding,j)=>holding.forEach((cards,k)=>hands[seats[j]][suits[k]]=cards));
  const verdict=p.validate(hands);
  assert.equal(verdict.complete,true,"Donne "+(i+1)+": "+JSON.stringify(verdict));
 }
});

test("Complete 4th hand by elimination when three other hands contain 13 distinct cards",()=>{
 const original={
  north:{S:"ARD762",H:"84",D:"R86",C:"62"},
  west:{S:"V",H:"R652",D:"D9754",C:"DV3"},
  east:{S:"1083",H:"V107",D:"AV102",C:"R107"},
  south:{S:"954",H:"",D:"",C:""}
 };
 const before=JSON.stringify(original);
 const result=p.completeFourthHand(original);
 assert.equal(result.completed,true);
 assert.equal(result.seat,"south");
 assert.equal(result.added.length,10);
 assert.equal(result.hands.south.H,"AQ93");
 assert.equal(result.hands.south.D,"3");
 assert.equal(result.hands.south.C,"A9854");
 assert.ok(p.validate(result.hands).complete);
 assert.equal(JSON.stringify(original),before,"Input hands must not be modified");
});
test("Auto inference can complete a fully unread fourth hand",()=>{
 const original={
  north:{S:"ARD762",H:"84",D:"R86",C:"62"},
  west:{S:"V",H:"R652",D:"D9754",C:"DV3"},
  east:{S:"1083",H:"V107",D:"AV102",C:"R107"},
  south:{S:"",H:"",D:"",C:""}
 };
 const result=p.completeFourthHand(original);
 assert.equal(result.completed,true);
 assert.equal(result.added.length,13);
 assert.deepEqual(result.hands.south,{S:"954",H:"AQ93",D:"3",C:"A9854"});
});
test("Two incomplete hands are ambiguous and must keep OCR review",()=>{
 const original={
  north:{S:"ARD762",H:"84",D:"R86",C:"62"},
  west:{S:"V",H:"R652",D:"D9754",C:"DV3"},
  east:{S:"1083",H:"V107",D:"AV102",C:"R10"},
  south:{S:"954",H:"AD93",D:"3",C:"A985"}
 };
 const result=p.completeFourthHand(original);
 assert.equal(result.completed,false);
 assert.equal(result.hands,original);
 const v=p.validate(original);
 assert.ok(v.missing.includes("C7"));
 assert.ok(v.missing.includes("C4"));
});
test("Duplicates block automatic reconstruction despite three 13-card hands",()=>{
 const original={
  north:{S:"ARD762",H:"84",D:"R86",C:"62"},
  west:{S:"V",H:"R652",D:"D9754",C:"DV3"},
  east:{S:"1083",H:"V107",D:"AV102",C:"R107"},
  south:{S:"A",H:"",D:"",C:""}
 };
 const r=p.completeFourthHand(original);
 assert.equal(r.completed,false);
 assert.ok(p.validate(original).duplicates.length>0);
});
test("Invalid or extra ranks prevent completing a fourth hand",()=>{
 const original={
  north:{S:"ARD762",H:"84",D:"R86",C:"62"},
  west:{S:"V",H:"R652",D:"D9754",C:"DV3"},
  east:{S:"1083",H:"V107",D:"AV102",C:"R107"},
  south:{S:"954X",H:"",D:"",C:""}
 };
 assert.equal(p.completeFourthHand(original).completed,false);
});

test("OCR readings with identical cards in different order are equivalent",()=>{
 const hands={
  north:{S:"ARD762",H:"84",D:"R86",C:"62"},
  west:{S:"V",H:"R652",D:"D9754",C:"DV3"},
  east:{S:"1083",H:"V107",D:"AV102",C:"R107"},
  south:{S:"954",H:"AD93",D:"3",C:"A9854"}
 };
 const other=JSON.parse(JSON.stringify(hands));
 other.north.S="267DRA";
 assert.equal(p.sameDistribution(hands,other),true);
 other.north.S="267DRA8";
 assert.equal(p.sameDistribution(hands,other),false);
});
test("OCR inference works for any seat and 1..13 missing ranks",()=>{
 const full={
  north:{S:"ARD762",H:"84",D:"R86",C:"62"},
  west:{S:"V",H:"R652",D:"D9754",C:"DV3"},
  east:{S:"1083",H:"V107",D:"AV102",C:"R107"},
  south:{S:"954",H:"AD93",D:"3",C:"A9854"}
 };
 const cardsBySeat={};
 for(const seat of p.seats){
  cardsBySeat[seat]=p.suits.flatMap(suit=>[...p.normalize(full[seat][suit]).value]
   .map(rank=>({suit,rank})));
 }
 for(const seat of p.seats)for(let missing=1;missing<=13;missing++){
  const copy=JSON.parse(JSON.stringify(full));
  const all=cardsBySeat[seat];
  for(const {suit,rank} of all.slice(0,missing)){
   copy[seat][suit]=[...p.normalize(copy[seat][suit]).value]
    .filter(x=>x!==rank).join("");
  }
  const restored=p.completeFourthHand(copy);
  assert.equal(restored.completed,true,seat+" "+missing);
  assert.equal(restored.added.length,missing);
  assert.equal(p.validate(restored.hands).complete,true);
  assert.equal(p.sameDistribution(restored.hands,full),true);
 }
});

test("Photographed monitor FFB headers tolerate perspective, dark green and noise",()=>{
 const w=1000,h=1333,data=new Uint8ClampedArray(w*h*4);
 for(let i=0;i<w*h;i++){
  const p=i*4;
  data[p]=190;data[p+1]=190;data[p+2]=188;data[p+3]=255;
 }
 // Width and slight height differences copy the geometry of a phone photo;
 // no player names or personal imagery is stored in the repository.
 const blocks=[
  {x:371,y:123,w:273,h:108},
  {x:69,y:455,w:262,h:101},
  {x:690,y:451,w:268,h:101},
  {x:385,y:759,w:253,h:95}
 ];
 for(const {x,y,w:width,h:height} of blocks){
  for(let cy=y;cy<y+height;cy++)for(let cx=x;cx<x+width;cx++){
   const i=(cy*w+cx)*4,n=(cx*17+cy*29)%11;
   data[i]=17+n;data[i+1]=90+n;data[i+2]=20+n;
   // Simulate pale pixel interference from the monitor.
   if((cx+cy*3)%23===0){data[i]=165;data[i+1]=166;data[i+2]=160;}
  }
 }
 const found=p.detectFFBHeaders({width:w,height:h,data});
 assert.deepEqual(found.map(x=>x.seat),["north","west","east","south"]);
 assert.equal(found.every(x=>x.photo===true),true);
 assert.equal(found[0].inferred,undefined,"Use the actual north banner");
 assert.equal(found[3].inferred,undefined,"Use actual south despite perspective");
 assert.ok(Math.abs(found[3].y-759)<7,JSON.stringify(found[3]));
});

test("User monitor-photo OCR 50/52 is safely restored by known fourth hand",()=>{
 // 16 ranks recovered from original-resolution photo with median-filter OCR.
 // No screenshot or identifying player information is stored in the repo.
 const hands={
  north:{S:"D86",H:"R106",D:"AD",C:"V43"},
  west:{S:"97432",H:"8532",D:"75",C:"75"},
  east:{S:"AV",H:"AD7",D:"10984",C:"A862"},
  south:{S:"R105",H:"V94",D:"RV632",C:"R9"}
 };
 const v=p.validate(hands);
 assert.equal(v.total,50);
 assert.deepEqual(v.counts,{north:11,east:13,south:13,west:13});
 assert.deepEqual(v.missing,["CQ","CT"]);
 const resolved=p.completeFourthHand(hands);
 assert.equal(resolved.completed,true);
 assert.equal(resolved.seat,"north");
 assert.equal(resolved.added.length,2);
 assert.equal(p.validate(resolved.hands).complete,true);
 assert.equal(p.sameDistribution(resolved.hands,{
  north:{S:"D86",H:"R106",D:"AD",C:"DV1043"},
  west:{S:"97432",H:"8532",D:"75",C:"75"},
  east:{S:"AV",H:"AD7",D:"10984",C:"A862"},
  south:{S:"R105",H:"V94",D:"RV632",C:"R9"}
 }),true);
});

test("FFB suit ranks are sorted descending without adding or removing cards",()=>{
 const samples=[
  ["10V","V10"],["943DR","RD943"],["6R10","R106"],
  ["A V 10 9","AV109"],["RD943","RD943"]
 ];
 for(const [read,expected] of samples){
  const info=p.orderInfo(read,true);
  assert.equal(p.toFrench(info.sorted).replaceAll(" ",""),expected,read);
  assert.equal(info.value.length,info.sorted.length);
 }
 const issue=p.orderInfo("10V",true);
 assert.equal(issue.outOfOrder,true);
 assert.equal(p.orderInfo("V10",true).outOfOrder,false);
 const invalid=p.orderInfo("R99",true);
 assert.equal(invalid.valid,false);
 assert.equal(invalid.sorted,"K99","Do not silently fix duplicates");
});
test("Sorting a 52-card deal does not fix rank swaps between seats",()=>{
 const wrong={
  north:{S:"Q86",H:"KT6",D:"AQ",C:"KQ943"},
  west:{S:"97432",H:"8532",D:"75",C:"75"},
  east:{S:"AJ",H:"AQ7",D:"T984",C:"A862"},
  south:{S:"KT5",H:"J94",D:"KJ632",C:"TJ"}
 };
 const sorted=p.orderedHands(wrong);
 assert.equal(sorted.south.C,"JT");
 assert.equal(p.validate(sorted).complete,true);
 assert.equal(p.sameDistribution(sorted,{
  ...wrong,north:{...wrong.north,C:"QJT43"},
  south:{...wrong.south,C:"K9"}
 }),false);
});

test("V36: photographic OCR retry crops expand and shift vertically",()=>{
 const header={x:300,y:100,w:250,h:100,photo:true};
 const base=p.cropForRow(header,1,900,900);
 const center=p.cropForRowRetry(header,1,900,900,0);
 const up=p.cropForRowRetry(header,1,900,900,-1);
 const down=p.cropForRowRetry(header,1,900,900,1);
 assert.ok(center.y<base.y&&center.h>base.h);
 assert.ok(up.y<center.y&&down.y>center.y);
 assert.equal(up.x,base.x);
 assert.equal(down.w,base.w);
 const end=p.cropForRowRetry({...header,y:780},3,900,900,1);
 assert.ok(end.y>=0&&end.y+end.h<=900);
});
test("V36: screenshot eight missing cards require further OCR not guesswork",()=>{
 const hands={
  north:{S:"6",H:"",D:"V107",C:"AD1072"},
  west:{S:"AR",H:"",D:"8542",C:"V643"},
  east:{S:"V87542",H:"D53",D:"",C:"R95"},
  south:{S:"D1093",H:"R109",D:"ARD963",C:""}
 };
 const v=p.validate(hands);
 assert.deepEqual(v.counts,{north:9,east:12,south:13,west:10});
 assert.deepEqual(v.missing,["HA","HJ","H8","H7","H6","H4","H2","C8"]);
 assert.equal(p.completeFourthHand(hands).completed,false);
});


test("V39: faded rose O/E and partially washed-out green N on phone monitor photo",()=>{
 // Reproduces photographed *colours and geometry*, not the user's photo:
 // four anonymous headers; N icon side deliberately fades into gray.
 const w=1000,h=1333,data=new Uint8ClampedArray(w*h*4);
 for(let i=0;i<w*h;i++){const j=i*4;
  data[j]=189;data[j+1]=188;data[j+2]=185;data[j+3]=255;
 }
 function paint(x,y,bw,bh,color){
  for(let py=y;py<y+bh;py++)for(let px=x;px<x+bw;px++){
   const i=(py*w+px)*4,n=((px*17+py*29)%9)-4;
   const [r,g,b]=color;data[i]=r+n;data[i+1]=g+n;data[i+2]=b+n;
   if((px+py*3)%43===0){data[i]=181;data[i+1]=180;data[i+2]=177;}
  }
 }
 paint(371,123,273,108,[21,106,41]);
 paint(371,123,43,108,[187,185,181]); // icon area is overexposed
 paint(69,455,262,101,[167,146,132]); // faded pink on monitor
 paint(690,451,268,101,[181,160,147]);
 paint(385,759,253,95,[28,112,49]);
 const found=p.detectFFBHeaders({width:w,height:h,data});
 assert.deepEqual(found.map(x=>x.seat),["north","west","east","south"]);
 assert.equal(found.length,4);
 assert.equal(found.every(x=>x.photo===true),true);
 assert.ok(Math.abs(found[1].y-455)<7,JSON.stringify(found[1]));
 assert.ok(Math.abs(found[2].y-451)<7,JSON.stringify(found[2]));
 assert.ok(Math.abs(found[0].x-371)<20,
  "North should include faint icon and its first rank: "+JSON.stringify(found[0]));
 assert.equal(found[0].inferred,undefined);
 assert.equal(found[3].inferred,undefined);
});
test("V39: this photographed FFB example forms a full 52-card deal",()=>{
 const hands={
  north:{S:"RV2",H:"1054",D:"82",C:"86543"},
  west:{S:"A1073",H:"A86",D:"V754",C:"R9"},
  east:{S:"D9",H:"RV972",D:"R9",C:"D1072"},
  south:{S:"8654",H:"D3",D:"AD1063",C:"AV"}
 };
 const verdict=p.validate(hands);
 assert.equal(verdict.complete,true,JSON.stringify(verdict));
 assert.deepEqual(verdict.counts,{north:13,east:13,south:13,west:13});
});
