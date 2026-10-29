/* Véritable scénario dans Chromium, avec la version générée de DDS WASM.
   Teste le parcours contrat → 52 cartes → annuler → dernière carte. */
const test=require("node:test"),assert=require("node:assert/strict");
const {chromium}=require("playwright");
// Chromium's COOP/COEP service worker can need one navigation to claim a
// fresh isolated context. Retrying the page, not bypassing isolation,
// avoids an intermittent CI-only timeout in the full DDS browser suite.
async function waitIsolated(page,ready){
 for(let attempt=0;attempt<3;attempt++){
  try{
   await page.waitForFunction(ready,null,{timeout:20000});
   return;
  }catch(err){
   if(attempt===2)throw err;
   await page.reload({waitUntil:"domcontentloaded",timeout:40000});
  }
 }
}
test("52 actual legal card plays, optimal moves, undo, end of deal",{
 timeout:360000
},async()=>{
 const browser=await chromium.launch({
  headless:true,
  executablePath:process.env.BRIDGE_BROWSER||undefined,
  args:["--no-sandbox","--disable-dev-shm-usage"]
 });
 const errors=[];
 try{
  const page=await browser.newPage({viewport:{width:375,height:667},serviceWorkers:"allow"});
  page.on("pageerror",e=>errors.push(String(e.message||e)));
  await page.goto(process.env.BRIDGE_URL||"http://127.0.0.1:8766",{
   waitUntil:"domcontentloaded",timeout:40000
  });
  await waitIsolated(page,()=>window.crossOriginIsolated===true &&
   window.BridgeFFB && typeof window.startPlay==="function" &&
   !!document.getElementById("coach-start"));
  const setup=await page.evaluate(()=>{
   const {normalize,validate}=window.BridgeFFB;
   const deal=[
    ["AKQ762","84","K86","62"],
    ["T83","JT7","AJT2","KT7"],
    ["954","AQ93","3","A9854"],
    ["J","K652","Q9754","QJ3"]
   ].map(row=>row.map(value=>normalize(value).value).join("."));
   window.fillFormWithTestData(deal);
   window.dispatchEvent(new CustomEvent("bridge:deal-imported",
    {detail:{source:"test"}}));
   document.getElementById("coach-level").value="4";
   document.getElementById("coach-strain").value="S";
   document.getElementById("coach-seat").value="south";
   document.getElementById("coach-start").click();
   return {
    stage:document.body.dataset.bridgeStage,
    state:!!window.playState,
    source:window.playState?.hands&&Object.values(window.playState.hands).map(a=>a.length)
   };
  });
  assert.equal(setup.stage,"play");
  assert.equal(setup.state,true);
  assert.deepEqual(setup.source,[13,13,13,13]);
  for(let i=0;i<52;i++){
   await page.waitForFunction(()=>{
    const st=window.playState;
    return st && st.pendingDiffs &&
     Object.keys(st.pendingDiffs).length>0;
   },null,{timeout:30000});
   const next=await page.evaluate(()=>{
    const st=window.playState;
    const seat=window.replayPlayState(st).seat;
    const keys=Object.keys(st.pendingDiffs);
    const key=keys.find(key=>{
     const button=document.querySelector(".hand-card[data-card='"+key+
      "'][data-direction='"+seat+"']");
     return !!button&&!button.disabled;
    });
    if(!key)return {error:"No playable button",seat,keys};
    const before=st.history.length;
    const button=document.querySelector(".hand-card[data-card='"+key+
     "'][data-direction='"+seat+"']");
    button.click();
    const picker=document.getElementById("bridge-card-picker");
    if(picker&&!picker.hidden){
      const choice=picker.querySelector('.bridge-card-choice[data-card="'+key+'"]');
      if(!choice)return {error:"Palette ouverte mais carte absente",key,seat};
      if(choice.getBoundingClientRect().height<44)
        return {error:"Cible tactile trop petite",key,seat};
      choice.click();
    }
    const after=window.playState.history.length;
    return {key,seat,before,after,played:button.classList.contains("bridge-played")};
   });
   assert.ok(!next.error,
    "Turn "+(i+1)+": "+JSON.stringify(next)+" "+errors.join(" | "));
   assert.equal(next.before,i,"History before play "+i);
   assert.equal(next.after,i+1,"History after card "+next.key);
  }
  const done=await page.evaluate(()=>{
   const st=window.playState;
   return {
    history:st.history.length,
    distinct:new Set(st.history.map(p=>p.key)).size,
    completed:window.isPlayHistoryComplete(st),
    playedCards:document.querySelectorAll(".hand-card.bridge-played").length
   };
  });
  assert.equal(done.history,52);
  assert.equal(done.distinct,52);
  assert.equal(done.completed,true);
  assert.equal(done.playedCards,52,"Played cards remain visible and grayed");
  await page.evaluate(()=>window.undoPlay());
  assert.equal(await page.evaluate(()=>window.playState.history.length),51);
  await page.waitForFunction(()=>window.playState?.pendingDiffs &&
   Object.keys(window.playState.pendingDiffs).length>0,
   null,{timeout:30000});
  const replay=await page.evaluate(()=>{
   const s=window.playState,seat=window.replayPlayState(s).seat;
   const key=Object.keys(s.pendingDiffs)[0];
   const button=document.querySelector(".hand-card[data-card='"+key+
    "'][data-direction='"+seat+"']");
   if(!button||button.disabled)throw Error("Undo last card not playable");
   button.click();
   const picker=document.getElementById("bridge-card-picker");
   if(picker&&!picker.hidden){
    const choice=picker.querySelector('.bridge-card-choice[data-card="'+key+'"]');
    if(!choice)throw Error("Last card missing from the touch picker");
    choice.click();
   }
   return {count:window.playState.history.length,
    complete:window.isPlayHistoryComplete(window.playState)};
  });
  assert.equal(replay.count,52);
  assert.equal(replay.complete,true);
  await page.close();
 }finally{await browser.close();}
});

test("iPhone geometry, optional 52-card review, and playable suit picker",{
 timeout:120000
},async()=>{
 const browser=await chromium.launch({
  headless:true,executablePath:process.env.BRIDGE_BROWSER||undefined,
  args:["--no-sandbox","--disable-dev-shm-usage"]
 });
 try{
  const page=await browser.newPage({viewport:{width:375,height:667},serviceWorkers:"allow"});
  await page.goto(process.env.BRIDGE_URL||"http://127.0.0.1:8766",{
   waitUntil:"domcontentloaded",timeout:40000
  });
  await waitIsolated(page,()=>window.crossOriginIsolated===true&&
   !!window.BridgeFFBImport?.openReview&&typeof window.startPlay==="function");
  await page.evaluate(()=>{
   const P=window.BridgeFFB;
   const deal=[
    ["AKQ762","84","K86","62"],
    ["T83","JT7","AJT2","KT7"],
    ["954","AQ93","3","A9854"],
    ["J","K652","Q9754","QJ3"]
   ].map(row=>row.map(x=>P.normalize(x).value).join("."));
   window.fillFormWithTestData(deal);
   window.dispatchEvent(new CustomEvent("bridge:deal-imported",{detail:{source:"test"}}));
  });
  assert.equal(await page.locator("#bridge-verify-deal").isVisible(),true);
  await page.locator("#bridge-verify-deal").click();
  assert.equal(await page.locator("#ffb-dialog").isVisible(),true);
  assert.equal(await page.locator("#ffb-diagram").isVisible(),true,
   "A valid deal first opens as a compass diagram");
  assert.match(await page.locator("#ffb-validation").innerText(),/Donne valide/);
  await page.locator("#ffb-switch-edit").click();
  assert.equal(await page.locator("#ffb-hands").isVisible(),true);
  const north=page.locator('#ffb-hands input[data-seat="north"][data-suit="S"]');
  const original=await north.inputValue();
  await north.fill(original.replace("A",""));
  assert.equal(await page.locator("#ffb-apply").isDisabled(),true);
  await page.locator("#ffb-close").click();
  await page.locator("#bridge-verify-deal").click();
  assert.equal(await page.locator("#ffb-diagram").isVisible(),true);
  await page.locator("#ffb-switch-edit").click();
  assert.equal(await page.locator('#ffb-hands input[data-seat="north"][data-suit="S"]').inputValue(),original,
   "Cancelling review must restore previous confirmed hand");
  await page.locator("#ffb-close").click();
  await page.locator("#coach-start").click();
  const geom=await page.evaluate(()=>{
   const rect=s=>document.querySelector(s)?.getBoundingClientRect().toJSON();
   const n=rect(".grid-item.hand-north"),s=rect(".grid-item.hand-south"),
   w=rect(".grid-item.hand-west"),e=rect(".grid-item.hand-east"),
   c=rect(".bridge-compass"),outer=rect(".grid-outer");
   return {n,s,w,e,c,outer,viewport:window.innerWidth,
    scrollWidth:document.documentElement.scrollWidth};
  });
  assert.ok(geom.n&&geom.s&&geom.w&&geom.e&&geom.c,
   "All four hands and compass are rendered");
  assert.ok(Math.abs(geom.n.x-geom.s.x)<=3,"N/S suit labels must line up");
  assert.ok(Math.abs((geom.n.x+geom.n.width/2)-(geom.c.x+geom.c.width/2))<=4,
   "North center must match compass center");
  assert.ok(Math.abs((geom.s.x+geom.s.width/2)-(geom.c.x+geom.c.width/2))<=4,
   "South center must match compass center");
  assert.ok(geom.w.right<=geom.c.x+5,
   "West must stay on the west side of compass");
  assert.ok(geom.e.x>=geom.c.right-5,
   "East must stay on the east side of compass");
  assert.ok(geom.scrollWidth<=geom.viewport+2,
   "No horizontal scrolling on iPhone");
  for(const width of [320,414]){
   await page.setViewportSize({width,height:667});
   const responsive=await page.evaluate(()=>new Promise(resolve=>
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
     const box=selector=>document.querySelector(selector).getBoundingClientRect();
     const n=box(".grid-item.hand-north"),s=box(".grid-item.hand-south"),
      c=box(".bridge-compass");
     resolve({width:innerWidth,scroll:document.documentElement.scrollWidth,
      alignment:Math.abs(n.x-s.x),
      northOffset:Math.abs(n.x+n.width/2-c.x-c.width/2),
      southOffset:Math.abs(s.x+s.width/2-c.x-c.width/2)});
    }))));
   assert.ok(responsive.alignment<=3,"N/S alignment at "+width+"px");
   assert.ok(responsive.northOffset<=4&&responsive.southOffset<=4,
    "Compass center at "+width+"px");
   assert.ok(responsive.scroll<=responsive.width+2,
    "No overflow at "+width+"px: "+JSON.stringify(responsive));
  }
  await page.setViewportSize({width:375,height:667});
  await page.waitForFunction(()=>window.playState?.pendingDiffs&&
   Object.keys(window.playState.pendingDiffs).length>0,null,{timeout:30000});
  const chosen=await page.evaluate(()=>{
   const state=window.playState,seat=window.replayPlayState(state).seat;
   const button=[...document.querySelectorAll('.hand-card.hand-card-playable')]
    .find(el=>el.dataset.direction===seat&&!el.disabled);
   if(!button)throw Error("No legal playing card");
   const row=button.closest(".hand-suit");
   row.click(); // tapping the suit should open the large-card picker
   const modal=document.getElementById("bridge-card-picker");
   const item=modal.querySelector(".bridge-card-choice");
   if(modal.hidden||!item)throw Error("Touch picker did not open");
   const h=item.getBoundingClientRect().height;
   item.click();
   return {height:h,history:window.playState.history.length,closed:modal.hidden};
  });
  assert.ok(chosen.height>=44,"Touch choices must be at least 44px high");
  assert.equal(chosen.history,1);
  assert.equal(chosen.closed,true);
  await page.close();
 }finally{await browser.close();}
});

test("user's screenshot deal: visible N/S card content centered on compass",{
 timeout:120000
},async()=>{
 const browser=await chromium.launch({
  headless:true,executablePath:process.env.BRIDGE_BROWSER||undefined,
  args:["--no-sandbox","--disable-dev-shm-usage"]
 });
 try{
  const page=await browser.newPage({viewport:{width:375,height:667},serviceWorkers:"allow"});
  await page.goto(process.env.BRIDGE_URL||"http://127.0.0.1:8766",{
   waitUntil:"domcontentloaded",timeout:40000
  });
  await page.waitForFunction(()=>window.crossOriginIsolated&&
   typeof window.startPlay==="function",null,{timeout:45000});
  await page.evaluate(()=>{
   // Same 52 cards as the screenshot submitted on 28 Oct, without names.
   const deal=[
    ["Q86","KT6","AQ","QJT43"],
    ["AJ","AQ7","T984","A862"],
    ["KT5","J94","KJ632","K9"],
    ["97432","8532","75","75"]
   ].map(row=>row.join("."));
   window.fillFormWithTestData(deal);
   window.dispatchEvent(new CustomEvent("bridge:deal-imported",{detail:{source:"test"}}));
   document.getElementById("coach-start").click();
  });
  for(const width of [320,375,414]){
   await page.setViewportSize({width,height:667});
   await page.waitForTimeout(120);
   const pos=await page.evaluate(()=>{
    const rect=sel=>document.querySelector(sel).getBoundingClientRect();
    const north=rect(".grid-item.hand-north"),south=rect(".grid-item.hand-south"),
      compass=rect(".bridge-compass"),body=document.documentElement;
    const symbols=["north","south"].flatMap(seat=>
      [...document.querySelectorAll(".grid-item.hand-"+seat+
        " .hand-suit > :is(spade-suit,heart-suit,diamond-suit,club-suit)")]);
    const buttons=["north","south"].flatMap(seat=>
      [...document.querySelectorAll(".grid-item.hand-"+seat+" .hand-card")]);
    const left=Math.min(...symbols.map(x=>x.getBoundingClientRect().left));
    const right=Math.max(...buttons.map(x=>x.getBoundingClientRect().right));
    const cx=compass.x+compass.width/2;
    return {left,right,cx,contentCenter:(left+right)/2,
      northX:north.x,southX:south.x,actualWidth:right-left,
      compassY:compass.y,scrollWidth:body.scrollWidth,viewport:innerWidth};
   });
   assert.ok(Math.abs(pos.northX-pos.southX)<=3,
    "North and South suit glyphs align "+width+": "+JSON.stringify(pos));
   assert.ok(Math.abs(pos.contentCenter-pos.cx)<=5,
    "VISIBLE cards, not just their blank container, centered "+width+": "+JSON.stringify(pos));
   assert.ok(pos.scrollWidth<=pos.viewport+2,
    "No horizontal overflow "+width+": "+JSON.stringify(pos));
  }
 }finally{await browser.close();}
});

test("Wrong photo: choose another image, cancel, and abort slow OCR",{
 timeout:120000
},async()=>{
 const browser=await chromium.launch({headless:true,
  executablePath:process.env.BRIDGE_BROWSER||undefined,
  args:["--no-sandbox","--disable-dev-shm-usage"]});
 try{
  const page=await browser.newPage({viewport:{width:375,height:667},serviceWorkers:"allow"});
  await page.goto(process.env.BRIDGE_URL||"http://127.0.0.1:8766",{
   waitUntil:"domcontentloaded",timeout:40000});
  await page.waitForFunction(()=>!!window.BridgeFFBImport&&
   !!document.getElementById("ffb-file"),null,{timeout:45000});
  const wrong={name:"mauvaise-photo.png",mimeType:"image/png",
   buffer:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2Rfs4AAAAASUVORK5CYII=","base64")};
  // iOS-like flow: the application's upload button opens a file chooser.
  const upload=page.waitForEvent("filechooser");
  await page.locator("#bridge-upload-gallery").click();
  await (await upload).setFiles(wrong);
  await page.locator("#ffb-status").getByText("Reconnaissance impossible",{exact:false}).waitFor({timeout:12000});
  assert.equal(await page.locator("#ffb-dialog").isVisible(),true);
  assert.equal(await page.locator("#ffb-choose-another").isEnabled(),true);
  const retryChooser=page.waitForEvent("filechooser");
  await page.locator("#ffb-choose-another").click();
  await (await retryChooser).setFiles(wrong); // same filename is allowed
  await page.locator("#ffb-status").getByText("Reconnaissance impossible",{exact:false}).waitFor({timeout:12000});
  await page.locator("#ffb-close").click();
  assert.equal(await page.locator("#ffb-dialog").isVisible(),false);
  assert.equal(await page.locator("#bridge-upload-gallery").isVisible(),true);
  // Long OCR must never trap the user or reopen the dialog afterwards.
  await page.evaluate(()=>{
   window.BridgeFFB.detectFFBHeaders=()=>[
    {seat:"north",x:0,y:0,w:1,h:1},
    {seat:"west",x:0,y:0,w:1,h:1},
    {seat:"east",x:0,y:0,w:1,h:1},
    {seat:"south",x:0,y:0,w:1,h:1}];
   window.BridgeFFBFast.recognize=()=>({
    hands:window.BridgeFFB.empty(),readCount:16,uncertain:8});
   window.Tesseract={createWorker:()=>new Promise(resolve=>{
    window.finishSlowOcr=()=>resolve({
     terminate:async()=>{},setParameters:async()=>{},
     recognize:async()=>({data:{text:"A"}})});
   })};
  });
  await page.locator("#ffb-file").setInputFiles(wrong);
  await page.waitForFunction(()=>typeof window.finishSlowOcr==="function",null,{timeout:12000});
  assert.equal(await page.locator("#ffb-choose-another").isEnabled(),true);
  assert.equal(await page.locator("#ffb-close").isEnabled(),true);
  await page.locator("#ffb-close").click();
  assert.equal(await page.locator("#ffb-dialog").isVisible(),false);
  await page.evaluate(()=>window.finishSlowOcr());
  await page.waitForTimeout(300);
  assert.equal(await page.locator("#ffb-dialog").isVisible(),false,
   "Cancelled OCR must not reopen the correction window");
  assert.equal(await page.locator("#bridge-upload-gallery").isVisible(),true);
 }finally{await browser.close();}
});

test("Monitor photo geometry is recognized in canvas even with colored pixel interference",{
 timeout:120000
},async()=>{
 const browser=await chromium.launch({headless:true,
  executablePath:process.env.BRIDGE_BROWSER||undefined,
  args:["--no-sandbox","--disable-dev-shm-usage"]});
 try{
  const page=await browser.newPage({viewport:{width:375,height:667},serviceWorkers:"allow"});
  await page.goto(process.env.BRIDGE_URL||"http://127.0.0.1:8766",{
   waitUntil:"domcontentloaded",timeout:40000});
  await page.waitForFunction(()=>!!window.BridgeFFB?.detectFFBHeaders,null,{timeout:45000});
  const found=await page.evaluate(()=>{
   const canvas=document.createElement("canvas");
   canvas.width=1000;canvas.height=1333;
   const c=canvas.getContext("2d");
   c.fillStyle="#c3c4c0";c.fillRect(0,0,1000,1333);
   for(const [x,y,w,h] of [[371,123,273,108],[69,455,262,101],
    [690,451,268,101],[385,759,253,95]]){
    c.fillStyle="#13601f";c.fillRect(x,y,w,h);
    c.fillStyle="#d8d8ce";c.font="bold 20px Arial";
    c.fillText("JOUEUR",x+60,y+45);
   }
   const data=c.getImageData(0,0,1000,1333);
   return window.BridgeFFB.detectFFBHeaders(data);
  });
  assert.deepEqual(found.map(x=>x.seat),["north","west","east","south"]);
  assert.ok(found.every(x=>x.photo===true));
  assert.equal(found[3].inferred,undefined);
 }finally{await browser.close();}
});

test("OCR photo crop: trim blank area while preserving all visible digits",{
 timeout:120000
},async()=>{
 const browser=await chromium.launch({
  headless:true,executablePath:process.env.BRIDGE_BROWSER||undefined,
  args:["--no-sandbox","--disable-dev-shm-usage"]
 });
 try{
  const page=await browser.newPage({viewport:{width:375,height:667},serviceWorkers:"allow"});
  await page.goto(process.env.BRIDGE_URL||"http://127.0.0.1:8766",{
   waitUntil:"domcontentloaded",timeout:40000
  });
  await page.waitForFunction(()=>!!window.BridgeFFBImport?.trimPhotoInk,null,{timeout:45000});
  const stats=await page.evaluate(()=>{
   const source=document.createElement("canvas");
   source.width=330;source.height=60;
   const c=source.getContext("2d");
   c.fillStyle="#fff";c.fillRect(0,0,330,60);
   c.fillStyle="#000";c.font="bold 28px Arial";
   c.fillText("97432",26,42);
   const trimmed=window.BridgeFFBImport.trimPhotoInk(source);
   const p=trimmed.getContext("2d").getImageData(0,0,trimmed.width,trimmed.height).data;
   let count=0;for(let i=0;i<p.length;i+=4)if(p[i]<100)count++;
   return {from:source.width,to:trimmed.width,height:trimmed.height,black:count};
  });
  assert.ok(stats.to<140,"Blank area is removed: "+JSON.stringify(stats));
  assert.ok(stats.to>65&&stats.black>150,
   "All glyphs remain in photo crop: "+JSON.stringify(stats));
 }finally{await browser.close();}
});

test("V31: alternative photo crops can add left margin and avoid overflow",{
 timeout:90000
},async()=>{
 const browser=await chromium.launch({headless:true,
  executablePath:process.env.BRIDGE_BROWSER||undefined,
  args:["--no-sandbox","--disable-dev-shm-usage"]});
 try{
  const page=await browser.newPage({viewport:{width:375,height:667},serviceWorkers:"allow"});
  await page.goto(process.env.BRIDGE_URL||"http://127.0.0.1:8766",{
   waitUntil:"domcontentloaded",timeout:40000});
  await page.waitForFunction(()=>!!window.BridgeFFBImport?.shiftCrop,null,{timeout:45000});
  const r=await page.evaluate(()=>{
   const crop={x:100,y:300,w:260,h:48};
   const expand=window.BridgeFFBImport.shiftCrop(crop,-29,1000);
   const tighten=window.BridgeFFBImport.shiftCrop(crop,20,1000);
   const bound=window.BridgeFFBImport.shiftCrop(crop,-300,1000);
   return {expand,tighten,bound};
  });
  assert.deepEqual(r.expand,{x:71,y:300,w:289,h:48});
  assert.deepEqual(r.tighten,{x:120,y:300,w:240,h:48});
  assert.equal(r.bound.x,0);
 }finally{await browser.close();}
});

test("Photo moire speckles do not extend OCR crop beyond the actual ranks",{
 timeout:120000
},async()=>{
 const browser=await chromium.launch({headless:true,
  executablePath:process.env.BRIDGE_BROWSER||undefined,
  args:["--no-sandbox","--disable-dev-shm-usage"]});
 try{
  const page=await browser.newPage({viewport:{width:375,height:667},serviceWorkers:"allow"});
  await page.goto(process.env.BRIDGE_URL||"http://127.0.0.1:8766",{
   waitUntil:"domcontentloaded",timeout:40000});
  await page.waitForFunction(()=>window.BridgeFFBImport?.trimPhotoInk,null,{timeout:45000});
  const result=await page.evaluate(()=>{
   const source=document.createElement("canvas");source.width=360;source.height=58;
   const ctx=source.getContext("2d");
   ctx.fillStyle="white";ctx.fillRect(0,0,360,58);
   ctx.fillStyle="black";ctx.font="bold 29px Arial";ctx.fillText("A 8 6 4",26,39);
   // Noise persists in the empty right half, spanning many columns.
   for(let x=180;x<359;x+=11){
    for(let y=3;y<53;y+=10)ctx.fillRect(x,y,1,1);
   }
   // A cropped suit fragment should not influence rank detection.
   ctx.fillRect(0,12,2,16);
   const output=window.BridgeFFBImport.trimPhotoInk(source);
   return {from:source.width,to:output.width,height:output.height};
  });
  assert.ok(result.to<150,JSON.stringify(result));
  assert.ok(result.to>90,JSON.stringify(result));
 }finally{await browser.close();}
});

test("V35: old and boosted photo thresholds must remain separate OCR alternatives",{
 timeout:90000
},async()=>{
 const browser=await chromium.launch({headless:true,
  executablePath:process.env.BRIDGE_BROWSER||undefined,
  args:["--no-sandbox","--disable-dev-shm-usage"]});
 try{
  const page=await browser.newPage({viewport:{width:375,height:667},serviceWorkers:"allow"});
  await page.goto(process.env.BRIDGE_URL||"http://127.0.0.1:8766",{
   waitUntil:"domcontentloaded",timeout:40000});
  await page.waitForFunction(()=>!!window.BridgeFFBImport?.cropCanvas,
   null,{timeout:45000});
  const result=await page.evaluate(()=>{
   const input=document.createElement("canvas");
   input.width=220;input.height=52;
   const ctx=input.getContext("2d");
   const src=ctx.createImageData(input.width,input.height);
   for(let i=0;i<src.data.length;i+=4){
    src.data[i]=src.data[i+1]=src.data[i+2]=225;
    src.data[i+3]=255;
   }
   // Text with intermediate gray antialiasing similar to a photographed LCD.
   ctx.putImageData(src,0,0);
   ctx.fillStyle="rgb(116,116,116)";
   ctx.font="bold 29px Arial";
   ctx.fillText("A 8 6 4",15,38);
   for(let x=160;x<215;x+=13)
    for(let y=3;y<50;y+=12)ctx.fillRect(x,y,1,1);
   const rect={x:0,y:0,w:220,h:52};
   const imgA=window.BridgeFFBImport.cropCanvas(input,rect,true,false);
   const imgB=window.BridgeFFBImport.cropCanvas(input,rect,true,"boosted");
   function fingerprint(canvas){
    const im=canvas.getContext("2d").getImageData(
      0,0,canvas.width,canvas.height).data;
    let ink=0;for(let i=0;i<im.length;i+=4)if(im[i]<128)ink++;
    return {w:canvas.width,h:canvas.height,ink};
   }
   return {legacy:fingerprint(imgA),boosted:fingerprint(imgB)};
  });
  assert.ok(result.legacy.ink>0);
  assert.ok(result.boosted.ink>0);
  assert.notDeepEqual(result.legacy,result.boosted,
    "Two photo threshold variants must not silently collapse to one");
 }finally{await browser.close();}
});


test("Accueil V38: camera and phototheque use independent image pickers",{
 timeout:90000
},async()=>{
 const browser=await chromium.launch({headless:true,
  executablePath:process.env.BRIDGE_BROWSER||undefined,
  args:["--no-sandbox","--disable-dev-shm-usage"]});
 try{
  const page=await browser.newPage({viewport:{width:375,height:812},
   serviceWorkers:"allow"});
  await page.goto(process.env.BRIDGE_URL||"http://127.0.0.1:8766",{
   waitUntil:"domcontentloaded",timeout:40000});
  await page.waitForSelector("#bridge-upload-camera",{timeout:45000});
  await page.waitForSelector("#bridge-upload-gallery",{timeout:45000});
  const ui=await page.evaluate(()=>{
   const camera=document.getElementById("ffb-camera-file");
   const gallery=document.getElementById("ffb-file");
   const cameraButton=document.getElementById("bridge-upload-camera");
   const galleryButton=document.getElementById("bridge-upload-gallery");
   const clicks=[];
   // Intercept native file pickers without needing a physical iPhone.
   camera.click=()=>clicks.push("camera");
   gallery.click=()=>clicks.push("gallery");
   cameraButton.click();galleryButton.click();
   const bounds=[cameraButton,galleryButton].map(b=>b.getBoundingClientRect());
   return {
    camera:{type:camera.type,accept:camera.accept,capture:camera.capture},
    gallery:{type:gallery.type,accept:gallery.accept,capture:gallery.getAttribute("capture")},
    labels:[cameraButton.textContent,galleryButton.textContent],
    clicks,
    bounds:bounds.map(b=>({w:b.width,h:b.height}))
   };
  });
  assert.equal(ui.camera.type,"file");
  assert.equal(ui.gallery.type,"file");
  assert.equal(ui.camera.accept,"image/*");
  assert.equal(ui.gallery.accept,"image/*");
  assert.equal(ui.camera.capture,"environment");
  assert.equal(ui.gallery.capture,null);
  assert.deepEqual(ui.clicks,["camera","gallery"]);
  assert.match(ui.labels[0],/Prendre une photo/);
  assert.match(ui.labels[1],/Photothèque/);
  assert.ok(ui.bounds.every(x=>x.w>=120&&x.h>=44),JSON.stringify(ui.bounds));
 }finally{await browser.close();}
});


test("V40: grayscale OCR fallback preserves faint monitor characters and blue badges",{
 timeout:90000
},async()=>{
 const browser=await chromium.launch({headless:true,
  executablePath:process.env.BRIDGE_BROWSER||undefined,
  args:["--no-sandbox","--disable-dev-shm-usage"]});
 try{
  const page=await browser.newPage({viewport:{width:375,height:800},serviceWorkers:"allow"});
  await page.goto(process.env.BRIDGE_URL||"http://127.0.0.1:8766",{
   waitUntil:"domcontentloaded",timeout:40000});
  await page.waitForFunction(()=>!!window.BridgeFFBImport?.cropPhotoDenoised,null,{timeout:45000});
  const answer=await page.evaluate(()=>{
   const canvas=document.createElement("canvas");
   canvas.width=310;canvas.height=62;
   const ctx=canvas.getContext("2d");
   ctx.fillStyle="rgb(207,204,199)";ctx.fillRect(0,0,310,62);
   ctx.fillStyle="rgb(50,48,45)";
   ctx.font="bold 29px Arial";ctx.fillText("A 10 7 3",32,41);
   // Fine RGB LCD stripes; smoothing must remove them without losing text.
   for(let x=0;x<310;x+=3){
    ctx.fillStyle="rgba(210,10,10,.07)";
    ctx.fillRect(x,0,1,62);
   }
   const result=window.BridgeFFBImport.cropPhotoDenoised(
    canvas,{x:0,y:0,w:310,h:62});
   const img=result.getContext("2d").getImageData(0,0,result.width,result.height);
   let ink=0,gray=0;
   for(let i=0;i<img.data.length;i+=4){
    if(img.data[i]<100)ink++;
    if(img.data[i]===img.data[i+1]&&img.data[i+1]===img.data[i+2])gray++;
   }
   return {width:result.width,height:result.height,ink,gray,total:result.width*result.height};
  });
  assert.ok(answer.ink>1000,JSON.stringify(answer));
  assert.equal(answer.gray,answer.total);
  assert.ok(answer.width>900&&answer.height>160);
 }finally{await browser.close();}
});


test("V48: build marker and partial OCR progress remain available for iPhone diagnosis",()=>{
 const fs=require("node:fs");
 const index=fs.readFileSync("docs/index.html","utf8");
 const importScript=fs.readFileSync("docs/ffb_import.js","utf8");
 assert.ok(index.includes("ffb_import.js?v=contract-v48"));
 assert.ok(index.includes("coach.js?v=mobile-v48"));
 assert.ok(fs.readFileSync("docs/coach.js","utf8").includes('id="bridge-app-version">V48'));
 assert.ok(importScript.includes("if(done%4===0)showProvisional"));
 assert.ok(importScript.includes("if(provisional.total>0)"));
});

test("V43: real page integrates alternative paired-heart-diamond locator",()=>{
 const fs=require("node:fs");
 const html=fs.readFileSync("docs/index.html","utf8");
 assert.ok(html.includes("ffb_suit_locator.js?v=photo-v43"));
 const text=fs.readFileSync("docs/ffb_import.js","utf8");
 assert.ok(text.includes("window.BridgeSuitLocator?.detect(pixels)"));
 assert.ok(text.includes("repères FFB introuvables (bandeaux et symboles ♥♦)"));
});


test("V44: compass diagram positions, metadata edits and return to card review",{
 timeout:90000
},async()=>{
 const browser=await chromium.launch({headless:true,
  executablePath:process.env.BRIDGE_BROWSER||undefined,
  args:["--no-sandbox","--disable-dev-shm-usage"]});
 try{
  const page=await browser.newPage({viewport:{width:375,height:812},serviceWorkers:"allow"});
  await page.goto(process.env.BRIDGE_URL||"http://127.0.0.1:8766",{
   waitUntil:"domcontentloaded",timeout:40000});
  await page.waitForFunction(()=>!!window.BridgeFFBImport?.openReview&&
   !!window.fillFormWithTestData,null,{timeout:45000});
  await page.evaluate(()=>{
   const P=window.BridgeFFB;
   const deal=[
    ["KJ2","T54","82","86543"],
    ["Q9","KJ972","K9","QT72"],
    ["8654","Q3","AQT63","AJ"],
    ["AT73","A86","J754","K9"]
   ].map(row=>row.map(s=>P.normalize(s).value).join("."));
   window.fillFormWithTestData(deal);
   window.dispatchEvent(new CustomEvent("bridge:deal-imported",
    {detail:{source:"test"}}));
  });
  await page.locator("#bridge-verify-deal").click();
  assert.equal(await page.locator("#ffb-diagram").isVisible(),true);
  assert.equal(await page.locator("#ffb-hands").isVisible(),false);
  assert.equal(await page.locator("#ffb-apply").isEnabled(),true);
  const data=await page.evaluate(()=>{
   const rect=s=>document.querySelector(s).getBoundingClientRect();
   const n=rect(".ffb-diagram-north"),s=rect(".ffb-diagram-south");
   const w=rect(".ffb-diagram-west"),e=rect(".ffb-diagram-east");
   const d=rect("#ffb-diagram");
   return {northCenter:n.x+n.width/2,southCenter:s.x+s.width/2,
    diagramCenter:d.x+d.width/2,westRight:w.right,eastLeft:e.left,
    scrollWidth:document.documentElement.scrollWidth,
    viewport:window.innerWidth,
    lineCount:document.querySelectorAll(".ffb-diagram-line").length,
    metadata:document.querySelector("#ffb-diagram-meta").textContent};
  });
  assert.equal(data.lineCount,16);
  assert.ok(Math.abs(data.northCenter-data.diagramCenter)<4,JSON.stringify(data));
  assert.ok(Math.abs(data.southCenter-data.diagramCenter)<4,JSON.stringify(data));
  assert.ok(data.westRight<data.eastLeft,JSON.stringify(data));
  assert.ok(data.scrollWidth<=data.viewport+2,JSON.stringify(data));
  assert.match(data.metadata,/Non renseigné/);
  await page.locator("#ffb-switch-edit").click();
  assert.equal(await page.locator("#ffb-hands").isVisible(),true);
  await page.locator("#ffb-board-number").fill("6");
  assert.equal(await page.locator("#ffb-board-dealer").inputValue(),"east");
  assert.equal(await page.locator("#ffb-board-vul").inputValue(),"ew");
  const north=page.locator('#ffb-hands input[data-seat="north"][data-suit="S"]');
  const original=await north.inputValue();
  await north.fill(original.slice(1));
  assert.equal(await page.locator("#ffb-apply").isDisabled(),true);
  await north.fill(original);
  assert.equal(await page.locator("#ffb-apply").isEnabled(),true);
  await page.locator("#ffb-switch-edit").click();
  assert.equal(await page.locator("#ffb-diagram").isVisible(),true);
  const metadata=await page.locator("#ffb-diagram-meta").innerText();
  assert.match(metadata,/Donne n°6/);
  assert.match(metadata,/Donneur : Est/);
  assert.match(metadata,/Vulnérabilité : Est – Ouest/);
  await page.locator("#ffb-apply").click();
  assert.equal(await page.locator("#ffb-dialog").isVisible(),false);
  assert.equal(await page.locator("#bridge-step-contract").isVisible(),true);
 }finally{await browser.close();}
});

test("V45: FFB contract and declarer detected on photo preselect editable dropdowns",{
 timeout:90000
},async()=>{
 const browser=await chromium.launch({headless:true,
  executablePath:process.env.BRIDGE_BROWSER||undefined,
  args:["--no-sandbox","--disable-dev-shm-usage"]});
 try{
  const page=await browser.newPage({viewport:{width:375,height:812},serviceWorkers:"allow"});
  await page.goto(process.env.BRIDGE_URL||"http://127.0.0.1:8766",{
   waitUntil:"domcontentloaded",timeout:40000});
  await page.waitForFunction(()=>!!document.getElementById("coach-level")&&
   !!window.BridgeFFBContract?.parseContract,null,{timeout:45000});
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent("bridge:deal-imported",{
   detail:{source:"ffb",contract:{level:2,strain:"N",declarer:"west"}}
  })));
  assert.equal(await page.locator("#coach-level").inputValue(),"2");
  assert.equal(await page.locator("#coach-strain").inputValue(),"N");
  assert.equal(await page.locator("#coach-seat").inputValue(),"west");
  assert.match(await page.locator("#bridge-contract-ocr-hint").innerText(),/Lu sur la photo : contrat 2SA · déclarant Ouest/);
  await page.locator("#coach-level").selectOption("4");
  await page.locator("#coach-strain").selectOption("H");
  await page.locator("#coach-seat").selectOption("south");
  assert.equal(await page.locator("#coach-level").inputValue(),"4");
  assert.equal(await page.locator("#coach-strain").inputValue(),"H");
  assert.equal(await page.locator("#coach-seat").inputValue(),"south");
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent("bridge:deal-imported",{
   detail:{source:"ffb",contract:{level:3,strain:"S"}}
  })));
  assert.equal(await page.locator("#coach-level").inputValue(),"3");
  assert.equal(await page.locator("#coach-strain").inputValue(),"S");
  assert.equal(await page.locator("#coach-seat").inputValue(),"south",
   "Unrecognized declarer must not be guessed or overwritten");
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent("bridge:deal-imported",{
   detail:{source:"ffb"}
  })));
  assert.equal(await page.locator("#bridge-contract-ocr-hint").isVisible(),false);
 }finally{await browser.close();}
});

test("V46: FFB contract OCR uses single-word mode and never filters faint declarer by confidence",()=>{
 const fs=require("node:fs");
 const s=fs.readFileSync("docs/ffb_import.js","utf8");
 assert.ok(s.includes('tessedit_pageseg_mode:kind==="declarer"?"8":"7"'));
 assert.ok(s.includes('?["median","tight","binary"]'));
 assert.ok(s.includes('kind==="declarer"||'));
});

test("V47: align inferred south rows without moving detected green banners",{
 timeout:90000
},async()=>{
 const browser=await chromium.launch({headless:true,
  executablePath:process.env.BRIDGE_BROWSER||undefined,
  args:["--no-sandbox","--disable-dev-shm-usage"]});
 try{
  const page=await browser.newPage({viewport:{width:375,height:812},serviceWorkers:"allow"});
  await page.goto(process.env.BRIDGE_URL||"http://127.0.0.1:8766",{
   waitUntil:"domcontentloaded",timeout:40000});
  await page.waitForFunction(()=>!!window.BridgeFFBHeaderRefine?.refine&&
   !!window.BridgeSuitLocator?.detect,null,{timeout:45000});
  const result=await page.evaluate(()=>{
   const h=[
    {seat:"north",x:243,y:127,w:196,h:75,inferred:true},
    {seat:"west",x:41,y:370,w:196,h:75},
    {seat:"east",x:504,y:372,w:203,h:75},
    {seat:"south",x:243,y:615,w:196,h:75,inferred:true}
   ];
   const anchor=[
    {seat:"north",x:253,y:126,w:183,h:79},
    {seat:"west",x:35,y:368,w:187,h:74},
    {seat:"east",x:498,y:366,w:187,h:74},
    {seat:"south",x:255,y:596,w:187,h:67}
   ];
   const ready=window.BridgeFFBHeaderRefine.refine(h,anchor);
   const first=window.BridgeFFB.cropForRow(ready[3],0,768,1024);
   const second=window.BridgeFFB.cropForRow(ready[3],1,768,1024);
   return {refined:ready[3],first,second,
    westOriginal:ready[1].y===h[1].y,
    eastOriginal:ready[2].y===h[2].y};
  });
  assert.equal(result.refined.refinedBySuitMarkers,true);
  assert.ok(result.first.y+result.first.h<710,JSON.stringify(result));
  assert.ok(result.second.y<710&&result.second.y+result.second.h>724,JSON.stringify(result));
  assert.equal(result.westOriginal,true);
  assert.equal(result.eastOriginal,true);
 }finally{await browser.close();}
});

test("V48: visually verified spade OCR from photograph-like canvas, not unknown suit guesses",{
 timeout:90000
},async()=>{
 const browser=await chromium.launch({headless:true,
  executablePath:process.env.BRIDGE_BROWSER||undefined,
  args:["--no-sandbox","--disable-dev-shm-usage"]});
 try{
  const page=await browser.newPage({viewport:{width:375,height:812},serviceWorkers:"allow"});
  await page.goto(process.env.BRIDGE_URL||"http://127.0.0.1:8766",{
   waitUntil:"domcontentloaded",timeout:40000});
  await page.waitForFunction(()=>!!window.BridgeFFBContract?.parseContractVisual,null,{timeout:45000});
  const result=await page.evaluate(()=>{
   const C=window.BridgeFFBContract,make=(suit)=>{
    const canvas=document.createElement("canvas");
    canvas.width=610;canvas.height=220;
    const ctx=canvas.getContext("2d");
    ctx.fillStyle="#fff";ctx.fillRect(0,0,610,220);
    ctx.fillStyle="#111";
    ctx.font="bold 92px Arial, sans-serif";
    ctx.fillText("1"+suit+" X-1",35,137);
    return canvas;
   };
   const boxes=canvas=>{
    const w=canvas.width,h=canvas.height,
     src=canvas.getContext("2d").getImageData(0,0,w,h).data,
     mask=new Uint8Array(w*h),q=new Int32Array(w*h);
    for(let i=0;i<w*h;i++)
     if(.299*src[i*4]+.587*src[i*4+1]+.114*src[i*4+2]<105)mask[i]=1;
    const results=[];
    for(let start=0;start<mask.length;start++){
     if(!mask[start])continue;
     let head=0,tail=1,minX=w,minY=h,maxX=-1,maxY=-1;q[0]=start;mask[start]=0;
     while(head<tail){
      const i=q[head++],y=Math.floor(i/w),x=i-y*w;
      minX=Math.min(x,minX);minY=Math.min(y,minY);
      maxX=Math.max(x,maxX);maxY=Math.max(y,maxY);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
       if(!dx&&!dy)continue;
       const xx=x+dx,yy=y+dy;
       if(xx<0||yy<0||xx>=w||yy>=h)continue;
       const k=yy*w+xx;if(mask[k]){mask[k]=0;q[tail++]=k;}
      }
     }
     const bw=maxX-minX+1,bh=maxY-minY+1;
     if(tail>=35&&bh>=h*.19&&bw>=5)
      results.push({x:minX,y:minY,w:bw,h:bh,area:tail});
    }
    return results.sort((a,b)=>a.x-b.x);
   };
   return {spades:C.parseContractVisual("1@ X-1",make("♠")),
    clubs:C.parseContractVisual("1@ X-1",make("♣")),
    hearts:C.parseContractVisual("1@ X-1",make("♥")),
    spadesNumerical:C.parseContractVisual("1@ X-1",make("5")),
    shapeBoxes:boxes(make("♠")),clubBoxes:boxes(make("♣")),
    metrics:["♠","♣","♥","♦"].map(char=>{
     const canvas=make(char),ctx=canvas.getContext("2d"),img=ctx.getImageData(0,0,canvas.width,canvas.height).data,
     all=boxes(canvas),g=all[1],widths=[];
     if(!g)return {char,all};
     for(let y=0;y<g.h;y++){
      let count=0;
      for(let x=g.x;x<g.x+g.w;x++){
       const j=((g.y+y)*canvas.width+x)*4;
       if(.299*img[j]+.587*img[j+1]+.114*img[j+2]<105)count++;
      }
      widths.push(count);
     }
     const avg=(lo,hi)=>{
      const start=Math.floor(g.h*lo),end=Math.max(start+1,Math.floor(g.h*hi));
      return +(widths.slice(start,end).reduce((a,b)=>a+b,0)/(end-start)).toFixed(2);
     };
     return {char,top:avg(0,.12),middle:avg(.41,.63),stem:avg(.83,.96),
      decreases:widths.slice(2,Math.floor(g.h*.50)).filter((v,i)=>widths[i+3]<v-Math.max(2,g.w*.03)).length,
      ratio:g.h/all[0].h};
    })};
  });
  assert.deepEqual(result.spades,{level:1,strain:"S"},JSON.stringify(result));
  assert.equal(result.clubs,null,JSON.stringify(result));
  assert.equal(result.hearts,null,JSON.stringify(result));
  assert.equal(result.spadesNumerical,null,JSON.stringify(result));
 }finally{await browser.close();}
});
