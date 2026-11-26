import test from "node:test";
import assert from "node:assert/strict";
import { RoomRegistry, validRoom } from "../src/index.js";

function makeStorage(){
 const map=new Map();
 return {map,
  async get(k){return map.get(k)},
  async put(k,v){map.set(k,v)},
  async delete(k){map.delete(k)},
  async list({prefix="",limit=Infinity}={}){const entries=[...map.entries()].filter(([k])=>k.startsWith(prefix)).slice(0,limit);return new Map(entries)}
 };
}
function registry(){const storage=makeStorage();return {storage,instance:new RoomRegistry({storage},{})};}
const room={code:"123456",host:"Player",players:1,maxPlayers:8,mode:"classic",status:"waiting"};
const req=(method,body)=>new Request("https://registry/rooms",{method,...(body?{headers:{"content-type":"application/json","x-directory-ip":"test-ip"},body:JSON.stringify(body)}:{})});

test("valid listing and reject invalid bounds",()=>{
 assert.equal(validRoom(room),true);
 assert.equal(validRoom({...room,players:9}),false);
 assert.equal(validRoom({...room,code:"bad"}),false);
 assert.equal(validRoom({...room,status:"bogus"}),false);
});
test("POST stores room, GET returns it",async()=>{
 const {instance,storage}=registry();
 const post=await instance.fetch(req("POST",room));assert.equal(post.status,200);
 const get=await instance.fetch(req("GET"));const data=await get.json();
 assert.equal(data.rooms.length,1);assert.equal(data.rooms[0].code,"123456");assert.equal(storage.map.size,1);
});
test("invalid JSON/data rejected",async()=>{
 const {instance}=registry();
 const r=await instance.fetch(new Request("https://registry/rooms",{method:"POST",body:"not-json"}));
 assert.equal(r.status,400);
 const bad=await instance.fetch(req("POST",{...room,players:0}));assert.equal(bad.status,400);
});
test("expired listing cleaned on GET",async()=>{
 const {instance,storage}=registry();storage.map.set("room:expired",{...room,updatedAt:Date.now()-180000});
 const response=await instance.fetch(req("GET"));const data=await response.json();
 assert.equal(data.rooms.length,0);assert.equal(storage.map.size,0);
});
test("room update replaces existing entry",async()=>{
 const {instance,storage}=registry();await instance.fetch(req("POST",room));
 await instance.fetch(req("POST",{...room,players:2,host:"New host"}));
 assert.equal(storage.map.size,1);assert.equal(storage.map.get("room:123456").players,2);
});
test("method not supported",async()=>{
 const {instance}=registry();const r=await instance.fetch(new Request("https://registry/rooms",{method:"DELETE"}));assert.equal(r.status,405);
});

test("oversized body is rejected",async()=>{
 const {instance}=registry();const huge={...room,host:"x".repeat(3000)};
 const r=await instance.fetch(req("POST",huge));assert.equal(r.status,400);
});
test("rate limit blocks excess updates from one IP",async()=>{
 const {instance}=registry();let last;
 for(let i=0;i<61;i++)last=await instance.fetch(req("POST",{...room,code:String(i).padStart(6,"0")}));
 assert.equal(last.status,429);
});
