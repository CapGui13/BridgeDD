const test=require("node:test"),assert=require("node:assert/strict");
const P=require("./ffb_parse.js"),S=require("./ffb_suit_locator.js");
const R=require("./ffb_header_refine.js");
test("V47: photo with green side banners and pale N/S aligns void South spade",()=>{
 const w=768,h=1024,data=new Uint8ClampedArray(w*h*4);
 for(let i=0;i<data.length;i+=4){
  data[i]=190;data[i+1]=190;data[i+2]=188;data[i+3]=255;
 }
 function paint(x,y,bw,bh,r,g,b){
  for(let py=y;py<y+bh;py++)for(let px=x;px<x+bw;px++){
   const k=(py*w+px)*4;data[k]=r;data[k+1]=g;data[k+2]=b;
  }
 }
 // Only East and West player banners retain color. North and South
 // pink are washed to gray, forcing their geometries to be inferred.
 paint(41,370,196,75,17,120,53);
 paint(504,372,203,75,18,122,54);
 // Real four pairs of red ♥ and ♦ markers: two center, two lateral.
 // The south heart starts ABOVE the spade crop inferred from side
 // banners, and there are no South spade ranks at all (void).
 for(const [x,y,dy] of [[290,256,35],[69,490,33],
                        [524,493,33],[296,710,30]]){
  paint(x,y,15,15,204,43,39);
  paint(x+1,y+dy,14,15,210,46,42);
 }
 const image={width:w,height:h,data};
 const base=P.detectFFBHeaders(image),landmarks=S.detect(image);
 assert.deepEqual(base.map(h=>h.seat),["north","west","east","south"]);
 assert.deepEqual(landmarks.map(h=>h.seat),["north","west","east","south"]);
 assert.equal(base[3].inferred,true);
 const oldSpade=P.cropForRow(base[3],0,w,h);
 assert.ok(oldSpade.y+oldSpade.h>710,
  "The old spade crop incorrectly includes South hearts");
 const refined=R.refine(base,landmarks);
 assert.equal(refined[3].refinedBySuitMarkers,true);
 const spade=P.cropForRow(refined[3],0,w,h);
 const heart=P.cropForRow(refined[3],1,w,h);
 const diamond=P.cropForRow(refined[3],2,w,h);
 assert.ok(spade.y+spade.h<710,JSON.stringify({spade,base:base[3],refined:refined[3]}));
 assert.ok(heart.y<710&&heart.y+heart.h>724,JSON.stringify(heart));
 assert.ok(diamond.y<740&&diamond.y+diamond.h>754,JSON.stringify(diamond));
 assert.equal(refined[3].x,base[3].x,"Do not shift rank X crops");
 assert.equal(refined[3].w,base[3].w);
 assert.equal(refined[1].y,base[1].y,"Do not touch detected West");
 assert.equal(refined[2].y,base[2].y,"Do not touch detected East");
});
test("V47: preserve known true headers and reject untrusted red markers",()=>{
 const original=[
  {seat:"north",x:240,y:85,w:180,h:70},
  {seat:"west",x:42,y:345,w:196,h:74},
  {seat:"east",x:505,y:346,w:196,h:74},
  {seat:"south",x:240,y:580,w:180,h:70,inferred:true}
 ];
 const wildlyDifferent=original.map(h=>({...h,y:h.y+140,h:h.h*2}));
 assert.deepEqual(R.refine(original,wildlyDifferent),original);
 const agrees=original.map(h=>({...h,y:h.y-11}));
 const result=R.refine(original,agrees);
 assert.equal(result[0].y,85,"True North header never replaced");
 assert.equal(result[3].y,569,"Inferred South is adjusted");
 assert.deepEqual(R.refine(original,[]),original);
});
