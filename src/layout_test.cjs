const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const css=fs.readFileSync("src/classic.css","utf8");
const js=fs.readFileSync("src/classic.js","utf8");
test("4 hands placed symmetrically around compass",()=>{
 assert.match(css,/grid-template-columns:minmax\(0,41%\) minmax\(0,18%\) minmax\(0,41%\)/);
 assert.match(css,/\.grid-item\.hand-north,\.grid-item\.hand-south\{width:max-content!important;max-width:100%!important;justify-self:center!important/);
 assert.match(css,/\.grid-item\.hand-west\{width:max-content!important;max-width:100%!important;[^\n]*justify-self:end!important/);
 assert.match(css,/\.grid-item\.hand-east\{width:max-content!important;max-width:100%!important;[^\n]*justify-self:start!important/);
});
test("consistent gap for all lengths, shrink text instead",()=>{
 assert.match(css,/\.hand-holding\.bridge-dense[^}]*gap:3px!important/s);
 assert.match(js,/while\(verticalSize>9&&longest\(\)>maxVerticalWidth\)/);
 assert.match(js,/--bridge-vertical-hand-width/);
 assert.match(js,/const actualRowWidth=holder=>/);
});
