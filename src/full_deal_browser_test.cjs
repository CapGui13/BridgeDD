/* Véritable scénario dans Chromium, avec la version générée de DDS WASM.
   Teste le parcours contrat → 52 cartes → annuler → dernière carte. */
const test=require("node:test"),assert=require("node:assert/strict");
const {chromium}=require("playwright");
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
  await page.waitForFunction(()=>window.crossOriginIsolated===true &&
   window.BridgeFFB && typeof window.startPlay==="function" &&
   !!document.getElementById("coach-start"),null,{timeout:45000});
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
  await page.waitForFunction(()=>window.crossOriginIsolated===true&&
   !!window.BridgeFFBImport?.openReview&&typeof window.startPlay==="function",null,{timeout:45000});
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
  assert.match(await page.locator("#ffb-validation").innerText(),/Donne valide/);
  const north=page.locator('#ffb-hands input[data-seat="north"][data-suit="S"]');
  const original=await north.inputValue();
  await north.fill(original.replace("A",""));
  assert.equal(await page.locator("#ffb-apply").isDisabled(),true);
  await page.locator("#ffb-close").click();
  await page.locator("#bridge-verify-deal").click();
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
