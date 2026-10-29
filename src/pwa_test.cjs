const test=require("node:test"), assert=require("node:assert/strict");
const fs=require("node:fs");
test("PWA manifest installed under BridgeDD with standalone scope",()=>{
 const m=JSON.parse(fs.readFileSync("docs/manifest.webmanifest","utf8"));
 assert.equal(m.start_url,"/BridgeDD/");
 assert.equal(m.scope,"/BridgeDD/");
 assert.equal(m.display,"standalone");
 assert.equal(m.short_name,"Bridge DDS");
 assert.match(m.name,/^Bridge DDS/);
 assert.ok(m.icons.some(x=>x.sizes==="192x192"&&x.type==="image/png"));
 assert.ok(m.icons.some(x=>x.sizes==="512x512"&&x.type==="image/png"));
});
test("Apple install icon and manifest metadata exist",()=>{
 const html=fs.readFileSync("docs/index.html","utf8");
 assert.match(html,/name="apple-mobile-web-app-capable" content="yes"/);
 assert.match(html,/rel="apple-touch-icon" sizes="180x180"/);
 assert.match(html,/rel="manifest" href="manifest\.webmanifest\?v=pwa-v52"/);
 assert.match(html,/name="apple-mobile-web-app-title" content="Bridge DDS"/);
 assert.match(html,/name="application-name" content="Bridge DDS"/);
 assert.match(html,/<title>Bridge DDS · Jeu interactif<\/title>/);
 assert.match(html,/apple-touch-icon\.png\?v=pwa-v52/);
 for(const [name,size] of [["apple-touch-icon.png",180],["icon-192.png",192],["icon-512.png",512]]){
   const bytes=fs.readFileSync("docs/"+name);
   assert.equal(bytes.subarray(1,4).toString(),"PNG");
   assert.equal(bytes.readUInt32BE(16),size);
   assert.equal(bytes.readUInt32BE(20),size);
 }
});
test("DDS cross origin isolation worker preserved for installed app",()=>{
 const html=fs.readFileSync("docs/index.html","utf8");
 assert.match(html,/src="coi-serviceworker\.js"/);
 assert.ok(fs.existsSync("docs/coi-serviceworker.js"));
});
