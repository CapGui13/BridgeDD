const test=require("node:test"),assert=require("node:assert/strict");
const B=require("./ffb_board.js");
test("Duplicate board dealer and vulnerability cycle",()=>{
 assert.deepEqual(B.forBoard(1),{number:1,dealer:"north",vulnerability:"none"});
 assert.deepEqual(B.forBoard(6),{number:6,dealer:"east",vulnerability:"ew"});
 assert.deepEqual(B.forBoard(16),{number:16,dealer:"west",vulnerability:"ew"});
 assert.deepEqual(B.forBoard(17),{number:17,dealer:"north",vulnerability:"none"});
 assert.deepEqual(B.forBoard(32),{number:32,dealer:"west",vulnerability:"ew"});
 assert.equal(B.labelDealer("west"),"Ouest");
 assert.equal(B.labelVulnerability("ns"),"Nord – Sud");
});
test("Missing or invalid board numbers never invent dealer/vulnerability",()=>{
 for(const x of [0,-1,100,"","abc","1.7",NaN,null])
  assert.equal(B.forBoard(x),null,String(x));
 assert.equal(B.labelDealer(""),"Non renseigné");
});
test("Crop board number in FFB upper left, not suit rows",()=>{
 const rect=B.cropBoardNumber({width:1536,height:2048},[
  {seat:"north",x:569,y:240,w:401,h:165},
  {seat:"west",x:80,y:750,w:430,h:160}
 ]);
 assert.ok(rect, "should locate board tile");
 assert.ok(rect.x>=100&&rect.x<150);
 assert.ok(rect.y>=290&&rect.y<315);
 assert.ok(rect.w>95&&rect.w<130);
 assert.equal(B.cropBoardNumber({width:1200,height:1600},[
  {seat:"north",x:400,y:-100,w:300,h:130,inferred:true}]),null);
});
