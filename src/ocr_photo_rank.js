/* Photo FFB: isolate ranks from moire, coloured suit pips and blue badges. */
(function(root){"use strict";
function isolate(image){
 const w=image?.width|0,h=image?.height|0,data=image?.data;
 if(w<4||h<4||!data||data.length<w*h*4)return {width:0,height:0,mask:new Uint8Array(0),boxes:[]};
 const n=w*h,mask=new Uint8Array(n);
 let x0=w,x1=-1,y0=h,y1=-1,bc=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4,r=data[i],g=data[i+1],b=data[i+2];
  if(b>140&&b>r*1.7&&b>g*1.17&&g<180){
   bc++;x0=Math.min(x0,x);x1=Math.max(x1,x);
   y0=Math.min(y0,y);y1=Math.max(y1,y);
  }
 }
 const rv=new Uint8Array(9),gv=new Uint8Array(9),bv=new Uint8Array(9);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=y*w+x;
  let r=data[i*4],g=data[i*4+1],b=data[i*4+2];
  if(x>0&&x<w-1&&y>0&&y<h-1){
   let k=0;
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const j=((y+dy)*w+x+dx)*4;
    rv[k]=data[j];gv[k]=data[j+1];bv[k++]=data[j+2];
   }
   rv.sort();gv.sort();bv.sort();
   r=rv[4];g=gv[4];b=bv[4];
  }
  if(Math.max(r,g,b)-Math.min(r,g,b)<50&&
     .299*r+.587*g+.114*b<118)mask[i]=1;
 }
 const bw=x1-x0+1,bh=y1-y0+1;
 if(bc>=90&&bw>=15&&bh>=15&&
    Math.abs(bw-bh)<Math.max(12,h*.25)&&
    bw<h*1.35&&bh<h*1.35){
  const cx=(x0+x1)/2,cy=(y0+y1)/2;
  const radius=Math.max(bw,bh)*.38;
  const white=new Uint8Array(n),dilated=new Uint8Array(n);
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   const i=y*w+x,j=i*4;
   mask[i]=0;
   if((x-cx)**2+(y-cy)**2>=radius*radius)continue;
   if(data[j]>125&&data[j+1]>125&&data[j+2]>125)white[i]=1;
  }
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   const i=y*w+x;if(!white[i])continue;
   for(let dy=0;dy<=1;dy++)for(let dx=0;dx<=1;dx++)
    if(x+dx<w&&y+dy<h)dilated[(y+dy)*w+x+dx]=1;
  }
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   const i=y*w+x;
   if(x+1<w&&y+1<h&&dilated[i]&&dilated[i+1]&&
      dilated[i+w]&&dilated[i+w+1])mask[i]=1;
  }
 }
 const visited=new Uint8Array(n),queue=new Int32Array(n),boxes=[];
 const cleaned=new Uint8Array(n),minHeight=Math.max(9,Math.floor(h*.17));
 for(let start=0;start<n;start++){
  if(!mask[start]||visited[start])continue;
  visited[start]=1;queue[0]=start;
  let head=0,tail=1,left=w,right=-1,top=h,bottom=-1;
  while(head<tail){
   const i=queue[head++],y=Math.floor(i/w),x=i-y*w;
   left=Math.min(left,x);right=Math.max(right,x);
   top=Math.min(top,y);bottom=Math.max(bottom,y);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const nx=x+dx,ny=y+dy;
    if(nx<0||nx>=w||ny<0||ny>=h)continue;
    const j=ny*w+nx;
    if(mask[j]&&!visited[j]){visited[j]=1;queue[tail++]=j;}
   }
  }
  const cw=right-left+1,ch=bottom-top+1;
  if(ch<minHeight||cw<2||tail<15||
     cw>Math.max(65,h*.7)||ch>Math.max(70,h*.9))continue;
  for(let i=0;i<tail;i++)cleaned[queue[i]]=1;
  boxes.push({x:left,y:top,w:cw,h:ch,area:tail});
 }
 boxes.sort((a,b)=>a.x-b.x);
 return {width:w,height:h,mask:cleaned,boxes};
}
const api={isolate};
root.BridgePhotoRank=api;
if(typeof module==="object"&&module.exports)module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
