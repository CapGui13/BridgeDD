const test=require("node:test"),assert=require("node:assert/strict");
const P=require("./ffb_parse.js"),R=require("./ocr_reconcile.js");
function candidates(){
 const source={
  north:{S:"Q86",H:"KT6",D:"AQ",C:"JT43"},
  west:{S:"97432",H:"8532",D:"75",C:"75"},
  east:{S:"AJ",H:"AQ7",D:"T984",C:"A862"},
  south:{S:"KT5",H:"J94",D:"KJ632",C:"K9"}
 };
 return P.seats.flatMap(seat=>P.suits.map(suit=>
  ({seat,suit,options:[{value:source[seat][suit],confidence:60}]})));
}
test("Rescue monitor photo OCR using only ranks seen in alternative OCR pass",()=>{
 const rows=candidates();
 const north=rows.find(x=>x.seat==="north"&&x.suit==="C");
 north.options=[{value:"J43",confidence:70},{value:"JT43",confidence:64}];
 const east=rows.find(x=>x.seat==="east"&&x.suit==="D");
 east.options=[{value:"7T984",confidence:70},{value:"T984",confidence:62}];
 const a=R.choose(rows,P);
 assert.ok(a);
 assert.equal(P.validate(a.hands).total,51);
 assert.equal(P.validate(a.hands).duplicates.length,0);
 assert.ok(P.validate(a.hands).missing.includes("CQ"));
 assert.equal(a.inferred,true);
 assert.equal(P.validate(P.completeFourthHand(a.hands).hands).complete,true);
});
test("Conflicting or duplicate OCR does not fabricate a full deck",()=>{
 const rows=candidates();
 const north=rows.find(x=>x.seat==="north"&&x.suit==="C");
 north.options=[{value:"J43",confidence:100}];
 const west=rows.find(x=>x.seat==="west"&&x.suit==="S");
 west.options=[{value:"9743",confidence:90}];
 const result=R.choose(rows,P);
 assert.equal(result.validation.complete,false);
 assert.equal(result.inferred,false);
 assert.ok(result.validation.missing.length>=2);
});

test("V29: short two-card rows need alternate OCR and recover user's missing ranks",()=>{
 const source={
  north:{S:"Q86",H:"KT6",D:"AQ",C:"QJT43"},
  west:{S:"97432",H:"8532",D:"75",C:"75"},
  east:{S:"AJ",H:"AQ7",D:"T984",C:"A862"},
  south:{S:"KT5",H:"J94",D:"KJ632",C:"K9"}
 };
 const missing={
  north:{S:"Q8",H:"KT",D:"AQ",C:"Q"},
  west:{D:"75",C:"75"},
  south:{C:"9"}
 };
 const rows=P.seats.flatMap(seat=>P.suits.map(suit=>{
  const correct=source[seat][suit];
  const absent=missing[seat]?.[suit]||"";
  const raw=[...correct].filter(rank=>!absent.includes(rank)).join("");
  return {seat,suit,options:absent?
   [{value:raw,confidence:85},{value:correct,confidence:68}]:
   [{value:correct,confidence:87}]};
 }));
 const before=P.empty();
 for(const row of rows)before[row.seat][row.suit]=row.options[0].value;
 assert.equal(P.validate(before).missing.length,12);
 const result=R.choose(rows,P);
 assert.ok(result);
 assert.equal(result.validation.complete,true,JSON.stringify(result.validation));
 assert.ok(P.sameDistribution(result.hands,source));
});

test("V31: actual photographed FFB OCR errors can be resolved without inventing cards",()=>{
 const actual={
  north:{S:"Q86",H:"KT6",D:"AQ",C:"QJT43"},
  west:{S:"97432",H:"8532",D:"75",C:"75"},
  east:{S:"AJ",H:"AQ7",D:"T984",C:"A862"},
  south:{S:"KT5",H:"J94",D:"KJ632",C:"K9"}
 };
 const shown={
  north:{S:"6",H:"6",D:"",C:"JT43"},
  west:{S:"97432",H:"8532",D:"73",C:"75"},
  east:{S:"AJ",H:"AQ7",D:"7TT984",C:"A862"},
  south:{S:"KT5",H:"J94",D:"KJ632",C:"K99"}
 };
 const rows=P.seats.flatMap(seat=>P.suits.map(suit=>{
  const bad=shown[seat][suit],good=actual[seat][suit];
  return {seat,suit,options:bad===good?
   [{value:bad,confidence:91}]:
   [{value:bad,confidence:83},{value:good,confidence:67}]};
 }));
 const check=R.choose(rows,P);
 assert.ok(check);
 assert.equal(check.validation.complete,true,JSON.stringify(check.validation));
 assert.equal(P.sameDistribution(check.hands,actual),true);
});
test("V31: a sole OCR guess still cannot synthesize missing cards",()=>{
 const actual={
  north:{S:"6",H:"6",D:"",C:"JT43"},
  west:{S:"97432",H:"8532",D:"73",C:"75"},
  east:{S:"AJ",H:"AQ7",D:"7TT984",C:"A862"},
  south:{S:"KT5",H:"J94",D:"KJ632",C:"K99"}
 };
 const rows=P.seats.flatMap(seat=>P.suits.map(suit=>({
  seat,suit,options:[{value:actual[seat][suit],confidence:99}]
 })));
 const check=R.choose(rows,P);
 assert.ok(check);
 assert.equal(check.validation.complete,false);
 assert.ok(check.validation.missing.length>0);
});

test("A complete but wrongly swapped 52-card deal is rejected in favor of ordered OCR alternatives",()=>{
 const source={
  north:{S:"Q86",H:"KT6",D:"AQ",C:"QJT43"},
  west:{S:"97432",H:"8532",D:"75",C:"75"},
  east:{S:"AJ",H:"AQ7",D:"T984",C:"A862"},
  south:{S:"KT5",H:"J94",D:"KJ632",C:"K9"}
 };
 const rows=P.seats.flatMap(seat=>P.suits.map(suit=>({
  seat,suit,options:[{value:source[seat][suit],confidence:70}]
 })));
 const n=rows.find(x=>x.seat==="north"&&x.suit==="C");
 const s=rows.find(x=>x.seat==="south"&&x.suit==="C");
 n.options=[{value:"KQ943",confidence:95},{value:"QJT43",confidence:68}];
 s.options=[{value:"TJ",confidence:96},{value:"K9",confidence:67}];
 const chosen=R.choose(rows,P);
 assert.ok(chosen.validation.complete);
 assert.equal(P.sameDistribution(chosen.hands,source),true);
 assert.equal(chosen.orderWarnings.length,0);
});
test("An uncorrected OCR inversion is sorted but explicitly flagged for human review",()=>{
 const rows=candidates();
 const t=rows.find(x=>x.seat==="south"&&x.suit==="C");
 t.options=[{value:"9K",confidence:100}];
 const result=R.choose(rows,P);
 assert.equal(result.hands.south.C,"K9");
 assert.ok(result.orderWarnings.some(x=>x.seat==="south"&&x.suit==="C"));
});

test("V37: photographed deal recovers hidden badge, void lookalikes and misplaced queen",()=>{
 const actual={
  north:{S:"6",H:"A864",D:"JT7",C:"AQT72"},
  west:{S:"AK",H:"J72",D:"8542",C:"J643"},
  east:{S:"J87542",H:"Q53",D:"Q",C:"K95"},
  south:{S:"QT93",H:"KT9",D:"AK963",C:"8"}
 };
 const original={
  ...actual,
  west:{...actual.west,H:""},
  east:{...actual.east,D:""},
  south:{...actual.south,D:"AKQ963",C:""}
 };
 const rows=P.seats.flatMap(seat=>P.suits.map(suit=>{
  const before=original[seat][suit],after=actual[seat][suit];
  return {seat,suit,options:before===after?
   [{value:before,confidence:93}]:
   [{value:before,confidence:80},{value:after,confidence:74}]};
 }));
 const before=P.validate(original);
 assert.equal(before.complete,false);
 const chosen=R.choose(rows,P);
 assert.ok(chosen, "Must retain a coherent OCR candidate");
 assert.equal(chosen.validation.complete,true,JSON.stringify(chosen.validation));
 assert.equal(P.sameDistribution(chosen.hands,actual),true);
});
