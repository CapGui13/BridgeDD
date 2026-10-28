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
