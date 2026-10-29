const test=require("node:test"),assert=require("node:assert/strict");
const {detect}=require("./ffb_suit_locator.js");
function picture(){
 const w=768,h=1024,data=new Uint8ClampedArray(w*h*4);
 for(let i=0;i<data.length;i+=4){
  data[i]=189;data[i+1]=188;data[i+2]=184;data[i+3]=255;
 }
 const fill=(x,y,ww,hh,r=190,g=42,b=33)=>{
  for(let cy=y;cy<y+hh;cy++)for(let cx=x;cx<x+ww;cx++){
   const j=(cy*w+cx)*4;
   data[j]=r;data[j+1]=g;data[j+2]=b;
  }
 };
 return {width:w,height:h,data,fill};
}
test("V43: four repeated ♥/♦ positions recover all seats without any coloured headers",()=>{
 const im=picture();
 // Approximate user photo's two red suit marks per seat; no names,
 // cards or copied photo is embedded in this synthetic fixture.
 for(const [x,y,gap] of [[290,250,36],[54,494,33],
  [529,498,34],[292,727,32]]){
  im.fill(x,y,17,17);im.fill(x+1,y+gap,15,17);
 }
 // Unpaired red ornament and text must not become a hand.
 im.fill(110,160,12,19);
 const headers=detect(im);
 assert.deepEqual(headers.map(h=>h.seat),["north","west","east","south"]);
 assert.ok(headers.every(h=>h.recoveredFromPips&&h.inferred&&h.photo));
 assert.ok(Math.abs(headers[1].y-355)<35,JSON.stringify(headers[1]));
 assert.ok(Math.abs(headers[2].x-517)<40,JSON.stringify(headers[2]));
 assert.ok(Math.abs(headers[3].y-606)<35,JSON.stringify(headers[3]));
});
test("V43: do not invent four seats from one red logo",()=>{
 const im=picture();im.fill(60,100,25,25);
 assert.deepEqual(detect(im),[]);
});
test("V43: gray screenshot without suit marks remains an error",()=>{
 const im=picture();assert.deepEqual(detect(im),[]);
});
