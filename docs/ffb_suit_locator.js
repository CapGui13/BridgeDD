/* Bridge DD: recover FFB four seat zones from the paired red heart and
   diamond suit glyphs when monitor glare hides coloured player banners.
   Reads only pixels and geometric repetition; does NOT infer any cards. */
(function(root){"use strict";
function detect(image){
 const ow=image?.width|0,oh=image?.height|0,src=image?.data;
 if(ow<300||oh<350||!src||src.length<ow*oh*4||ow*oh>14000000)return [];
 const shrink=Math.max(1,Math.ceil(ow/900));
 const w=Math.floor(ow/shrink),h=Math.floor(oh/shrink);
 const mask=new Uint8Array(w*h),queue=new Int32Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  let r=0,g=0,b=0;
  const sx=x*shrink,sy=y*shrink;
  for(let dy=0;dy<shrink;dy++)for(let dx=0;dx<shrink;dx++){
   const j=((sy+dy)*ow+sx+dx)*4;
   r+=src[j];g+=src[j+1];b+=src[j+2];
  }
  const div=shrink*shrink;
  r/=div;g/=div;b/=div;
  if(r>90&&r-g>34&&r-b>34)mask[y*w+x]=1;
 }
 const parts=[];
 const minSide=w*.008,maxSide=w*.065;
 for(let start=0;start<mask.length;start++){
  if(!mask[start])continue;
  let head=0,tail=1,x0=w,y0=h,x1=-1,y1=-1;
  queue[0]=start;mask[start]=0;
  while(head<tail){
   const i=queue[head++],y=Math.floor(i/w),x=i-y*w;
   x0=Math.min(x0,x);y0=Math.min(y0,y);
   x1=Math.max(x1,x);y1=Math.max(y1,y);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    if(!dy&&!dx)continue;
    const nx=x+dx,ny=y+dy;
    if(nx<0||nx>=w||ny<0||ny>=h)continue;
    const j=ny*w+nx;
    if(mask[j]){mask[j]=0;queue[tail++]=j;}
   }
  }
  const bw=x1-x0+1,bh=y1-y0+1;
  if(bw>minSide&&bw<maxSide&&bh>minSide&&bh<maxSide&&
     tail>w*w*.000025&&tail<w*w*.002)
   parts.push({x:x0,y:y0,w:bw,h:bh,area:tail,
    cx:x0+bw/2,cy:y0+bh/2});
 }
 const paired=[];
 for(const top of parts)for(const bottom of parts){
  if(bottom.cy<=top.cy)continue;
  const dy=bottom.cy-top.cy,dx=Math.abs(bottom.cx-top.cx);
  if(dy<w*.026||dy>w*.095||
     dx>Math.max(w*.018,top.w*.65)||
     Math.max(top.w,bottom.w)>Math.min(top.w,bottom.w)*2.1)continue;
  paired.push({cx:(top.cx+bottom.cx)/2,
   cy:top.cy,topY:top.y,dy,score:top.area+bottom.area-5*dx});
 }
 const middle=paired.filter(p=>p.cx>w*.30&&p.cx<w*.70)
  .sort((a,b)=>a.cy-b.cy);
 if(middle.length<2)return [];
 // Central N/S red suit columns must be vertically separated and aligned.
 const north=middle[0],south=middle[middle.length-1];
 const spacing=(north.dy+south.dy)/2;
 if(south.cy-north.cy<spacing*8||
    south.cy-north.cy>spacing*22||
    Math.abs(south.cx-north.cx)>spacing*2.2)return [];
 const centerY=(north.cy+south.cy)/2;
 const choose=(subset)=>subset
  .filter(p=>Math.abs(p.cy-centerY)<spacing*2.5)
  .sort((a,b)=>(Math.abs(a.cy-centerY)-Math.abs(b.cy-centerY))*10+
   (b.score-a.score)*.01)[0];
 const west=choose(paired.filter(p=>p.cx<w*.34));
 const east=choose(paired.filter(p=>p.cx>w*.65));
 if(!west||!east||Math.abs(west.cy-east.cy)>spacing*1.5)return [];
 const lateralWidth=(east.cx-west.cx)*.41;
 const make=(seat,p)=>{
  const height=p.dy/.445;
  const width=Math.max(height*2.35,lateralWidth);
  // North's first rank is slightly to the right of its heart/diamond
  // symbols on FFB; other seats' header boxes start left of their symbols.
  const left=p.cx-height*(seat==="north"?.04:.28);
  const top=p.topY-height*1.68;
  return {seat,
   x:Math.max(0,Math.round(left*shrink)),
   y:Math.round(top*shrink),
   w:Math.min(ow,Math.round(width*shrink)),
   h:Math.round(height*shrink),
   photo:true,inferred:true,recoveredFromPips:true};
 };
 const result=[make("north",north),make("west",west),
  make("east",east),make("south",south)];
 if(result.some(x=>x.h<=0||x.w<=0||x.x+x.w>ow||x.y<0||
     x.y+x.h>oh))return [];
 return result;
}
const api={detect};root.BridgeSuitLocator=api;
if(typeof module==="object"&&module.exports)module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
