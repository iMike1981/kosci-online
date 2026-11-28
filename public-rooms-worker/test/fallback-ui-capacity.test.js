import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { validRoom } from "../src/index.js";

const source=fs.readFileSync(new URL("../public-rooms-ui.js",import.meta.url),"utf8");
async function publishFromFallback(mode){
 let intervalCallback,posted;
 const elements=new Map([
  ["start",{parentNode:{insertBefore(){}}}],
  ["prApi",{value:"https://worker.test"}],
  ["prList",{innerHTML:"",querySelectorAll(){return []}}],
  ["prRefresh",{}],["prQuick",{}],["prSave",{}],
  ["name",{value:"Host"}],["msg",{textContent:""}]
 ]);
 const document={getElementById(id){return elements.get(id)||null;},createElement(){return {innerHTML:"",className:"",id:""};}};
 const localStorage={getItem(){return "https://worker.test";},setItem(){}};
 const window={ROOM:"123456",S:{host:"Host",lobby:["host","guest"],mode,G:{phase:"play"}},me:true};
 const fetch=async(url,options)=>{if(options?.method==="POST")posted=JSON.parse(options.body);return {ok:true,json:async()=>({rooms:[]})};};
 vm.runInNewContext(source,{document,localStorage,window,fetch,setInterval(fn){intervalCallback=fn;},alert(){},enterRoom(){}});
 intervalCallback();
 await new Promise(resolve=>setImmediate(resolve));
 return posted;
}

test("fallback UI publishes Duel rooms with two-player capacity",async()=>{
 const payload=await publishFromFallback("duel");
 assert.equal(payload.maxPlayers,2);
 assert.equal(payload.status,"playing");
 assert.equal(validRoom(payload),true);
});

test("fallback UI publishes standard rooms with eight-player capacity",async()=>{
 const payload=await publishFromFallback("classic");
 assert.equal(payload.maxPlayers,8);
 assert.equal(payload.status,"playing");
 assert.equal(validRoom(payload),true);
});
