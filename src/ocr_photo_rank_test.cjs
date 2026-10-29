const test=require("node:test"),assert=require("node:assert/strict");
const {isolate}=require("./ocr_photo_rank.js");
function image(w=180,h=48){
 const data=new Uint8ClampedArray(w*h*4);
 for(let i=0;i<w*h;i++){
  const k=i*4;data[k]=data[k+1]=data[k+2]=195;data[k+3]=255;
 }
 function fill(x,y,ww,hh,r,g,b){
  for(let yy=y;yy<y+hh;yy++)for(let xx=x;xx<x+ww;xx++){
   const k=(yy*w+xx)*4;data[k]=r;data[k+1]=g;data[k+2]=b;
  }
 }
 return {width:w,height:h,data,fill};
}
test("Ignore red diamond emblem while retaining a black card rank",()=>{
 const i=image();i.fill(4,10,12,24,208,65,58);i.fill(42,12,16,23,32,32,32);
 const v=isolate(i);assert.equal(v.boxes.length,1);assert.equal(v.boxes[0].x,42);
});
test("Recognize single rank inside wide photographic strip",()=>{
 const i=image(310,52);i.fill(28,11,13,26,25,25,25);
 const v=isolate(i);assert.equal(v.boxes.length,1);assert.ok(v.boxes[0].area>=325&&v.boxes[0].area<=338);
});
test("Blue badge background is not a rank glyph",()=>{
 const i=image(180,82),cx=76,cy=40,r=24;
 for(let y=0;y<i.height;y++)for(let x=0;x<i.width;x++)
  if((x-cx)**2+(y-cy)**2<r*r)i.fill(x,y,1,1,16,45,148);
 i.fill(69,29,16,7,210,210,212);i.fill(75,33,7,18,210,210,212);
 const v=isolate(i);assert.ok(v.boxes.length>=1);
 assert.ok(v.boxes.every(b=>b.w<30));
});
