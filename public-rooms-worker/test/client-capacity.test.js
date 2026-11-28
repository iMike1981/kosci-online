import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { validRoom } from "../src/index.js";

const source=fs.readFileSync(new URL("../public-rooms-client.js",import.meta.url),"utf8");
function harness(){
 let published;
 const window={DICE_PUBLIC_ROOMS_API:"https://worker.test"};
 const fetch=async(url,options)=>{published={url,options};return {ok:true,json:async()=>({ok:true})};};
 vm.runInNewContext(source,{window,fetch});
 return {window,get published(){return published;}};
}

test("client helper publishes Duel rooms with the backend's two-player capacity",async()=>{
 const h=harness();
 await h.window.DicePublicRooms.updateFromRoom({lobby:["host","guest"],G:{phase:"play"}},"123456","Host","duel");
 const payload=JSON.parse(h.published.options.body);
 assert.equal(payload.maxPlayers,2);
 assert.equal(payload.status,"playing");
 assert.equal(validRoom(payload),true);
});

test("client helper publishes standard modes with eight-player capacity",async()=>{
 const h=harness();
 await h.window.DicePublicRooms.updateFromRoom({lobby:["host"],G:{phase:"lobby"}},"234567","Host","classic");
 const payload=JSON.parse(h.published.options.body);
 assert.equal(payload.maxPlayers,8);
 assert.equal(payload.status,"waiting");
 assert.equal(validRoom(payload),true);
});
