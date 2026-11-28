import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync(new URL("../public-rooms-ui.js",import.meta.url),"utf8");

function quickMatchFallback(rooms){
 let joined=[];
 const elements=new Map([
  ["start",{parentNode:{insertBefore(){}}}],
  ["prApi",{value:"https://worker.test"}],
  ["prList",{innerHTML:"",querySelectorAll(){return []}}],
  ["prRefresh",{}],["prQuick",{}],["prSave",{}],
  ["name",{value:"Guest"}],["msg",{textContent:""}]
 ]);
 const document={getElementById(id){return elements.get(id)||null;},createElement(){return {innerHTML:"",className:"",id:""};}};
 const localStorage={getItem(){return "https://worker.test";},setItem(){}};
 const fetch=async()=>({ok:true,json:async()=>({rooms})});
 vm.runInNewContext(source,{document,localStorage,fetch,setInterval(){},alert(){},enterRoom(code){joined.push(code)},window:{}});
 return {elements,joined};
}

test("fallback Quick Match rejects malformed, full and started rooms",async()=>{
 const rooms=[
  {code:"111111",host:"Bad capacity",players:1,maxPlayers:8,mode:"duel",status:"waiting"},
  {code:"111112",host:"Bad capacity",players:1,maxPlayers:2,mode:"classic",status:"waiting"},
  {code:"111113",host:"Started",players:1,maxPlayers:8,mode:"classic",status:"playing"},
  {code:"111114",host:"Full",players:8,maxPlayers:8,mode:"classic",status:"waiting"},
  {code:"111115",host:"String count",players:"1",maxPlayers:8,mode:"classic",status:"waiting"},
  {code:"111116",host:"Unknown mode",players:1,maxPlayers:8,mode:"other",status:"waiting"},
  {code:"bad",host:"Bad code",players:1,maxPlayers:8,mode:"classic",status:"waiting"},
  {code:"111118",host:" ",players:1,maxPlayers:8,mode:"classic",status:"waiting"},
  {code:"222222",host:"Valid Duel",players:1,maxPlayers:2,mode:"duel",status:"waiting"},
  {code:"333333",host:"Valid Classic",players:2,maxPlayers:8,mode:"classic",status:"waiting"}
 ];
 const h=quickMatchFallback(rooms);
 await h.elements.get("prQuick").onclick();
 assert.deepEqual(h.joined,["333333"]);
});

test("fallback Quick Match does not join when every room is invalid",async()=>{
 const h=quickMatchFallback([{code:"444444",host:"Wrong mode capacity",players:1,maxPlayers:8,mode:"duel",status:"waiting"}]);
 await h.elements.get("prQuick").onclick();
 assert.deepEqual(h.joined,[]);
 assert.match(h.elements.get("msg").textContent,/No open room found/);
});
