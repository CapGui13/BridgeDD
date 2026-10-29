/* V47 — Keep the successful FFB banner detector, but calibrate only
   *inferred* north/south vertical positions with independently identified
   heart/diamond markers. A void spade suit otherwise shifts all four
   ranks into the wrong suit when an inferred pink header sits too low.
   Never modify actual detected headers or guess card identities. */
(function(root){"use strict";
function refine(headers,bySuits){
 if(!Array.isArray(headers)||headers.length!==4||
    !Array.isArray(bySuits)||bySuits.length!==4)return headers;
 const indexed=new Map(bySuits.map(h=>[h.seat,h]));
 if(indexed.size!==4)return headers;
 const west=headers.find(h=>h.seat==="west");
 const east=headers.find(h=>h.seat==="east");
 const sw=indexed.get("west"),se=indexed.get("east");
 if(!west||!east||!sw||!se)return headers;
 // The independently detected landmarks must first agree with the two
 // visible side headers, or ignore them entirely.
 const comparable=(original,found)=>{
  const height=original.h;
  const oldCenter=original.x+original.w/2;
  const newCenter=found.x+found.w/2;
  return Number.isFinite(height)&&height>0&&
   Math.abs(original.y-found.y)<=height*.42&&
   Math.abs(oldCenter-newCenter)<=original.w*.38&&
   found.h/height>=.66&&found.h/height<=1.37;
 };
 if(!comparable(west,sw)||!comparable(east,se))return headers;
 return headers.map(header=>{
  if(!header.inferred||!["north","south"].includes(header.seat))
   return header;
  const found=indexed.get(header.seat);
  if(!found||!comparable(header,found))return header;
  // Preserve horizontal boundaries, which have already been calibrated
  // by FFB colour-banner geometry (the red glyph's own x is not a card
  // text crop boundary). Only recenter the crop's row-spacing baseline.
  return {...header,y:found.y,h:found.h,
   refinedBySuitMarkers:true};
 });
}
const api={refine};root.BridgeFFBHeaderRefine=api;
if(typeof module==="object"&&module.exports)module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
