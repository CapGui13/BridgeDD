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
   return {count:window.playState.history.length,
    complete:window.isPlayHistoryComplete(window.playState)};
  });
  assert.equal(replay.count,52);
  assert.equal(replay.complete,true);
  await page.close();
 }finally{await browser.close();}
});
