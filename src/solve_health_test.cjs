const test=require("node:test"),assert=require("node:assert/strict");
const H=require("./solve_health.js");
test("DDS failures are recognized, normal computation output is not",()=>{
 assert.equal(H.classifyNativeStatus("Solved in 250 ms."),null);
 assert.equal(H.classifyNativeStatus("Computing…"),null);
 assert.match(H.classifyNativeStatus("DDS error (code -1)."),/DDS error/);
 assert.match(H.classifyNativeStatus("Solving needs HTTP with cross-origin isolation."),/needs HTTP/);
 assert.match(H.classifyNativeStatus("DDS play solve error (code -3)"),/solve error/);
});
test("New card creates a new solve generation",()=>{
 const state={declarer:"south",denomination:"S",targetTricks:10,history:[],pendingDiffs:null};
 const first=H.stateKey(state);
 assert.equal(H.waiting(state,false),true);
 state.history.push({seat:"west",key:"SA"});
 assert.notEqual(H.stateKey(state),first);
 state.pendingDiffs={SK:11};
 assert.equal(H.waiting(state,false),false);
 assert.equal(H.waiting(state,true),false);
});
