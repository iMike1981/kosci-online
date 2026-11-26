import test from "node:test";
import assert from "node:assert/strict";
import { RoomRegistry, validRoom } from "../src/index.js";

function makeStorage(){
 const map=new Map();
 let tail=Promise.resolve();
 const storage={map,
  async get(k){return map.get(k)},
  async put(k,v){map.set(k,v)},
  async delete(k){map.delete(k)},
  async list({prefix="",limit=Infinity}={}){const entries=[...map.entries()].filter(([k])=>k.startsWith(prefix)).slice(0,limit);return new Map(entries)},
  async transaction(fn){
    const prior=tail;let release;tail=new Promise(resolve=>release=resolve);
    await prior;
    try{return await fn(storage)}finally{release();}
  }
 };
 return storage;
}
function registry(){const storage=makeStorage();return {storage,instance:new RoomRegistry({storage},{})};}
const room={code:"123456",host:"Player",players:1,maxPlayers:8,mode:"classic",status:"waiting"};
const req=(method,body,ip="test-ip")=>{
 const headers={"x-directory-ip":ip};
 if(body)headers["content-type"]="application/json";
 return new Request("https://registry/rooms",{method,headers,...(body?{body:JSON.stringify(body)}:{})});
};

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
 assert.equal(data.rooms.length,1);assert.equal(data.rooms[0].code,"123456");assert.equal([...storage.map.keys()].filter(k=>k.startsWith("room:")).length,1);
});
test("invalid JSON/data rejected",async()=>{
 const {instance}=registry();
 const r=await instance.fetch(new Request("https://registry/rooms",{method:"POST",headers:{"x-directory-ip":"test-ip"},body:"not-json"}));
 assert.equal(r.status,400);
 const bad=await instance.fetch(req("POST",{...room,players:0}));assert.equal(bad.status,400);
});
test("expired listing cleaned on GET",async()=>{
 const {instance,storage}=registry();storage.map.set("room:expired",{...room,updatedAt:Date.now()-180000});
 const response=await instance.fetch(req("GET"));const data=await response.json();
 assert.equal(data.rooms.length,0);assert.equal([...storage.map.keys()].filter(k=>k.startsWith("room:")).length,0);
});
test("malformed and future-dated stored rooms are removed while valid rooms remain",async()=>{
 const {instance,storage}=registry(),now=Date.now();
 storage.map.set("room:missing-time",{...room});
 storage.map.set("room:future",{...room,code:"234567",updatedAt:now+60000});
 storage.map.set("room:invalid-code",{...room,code:"bad",updatedAt:now});
 storage.map.set("room:345678",{...room,code:"345678",updatedAt:now});
 const response=await instance.fetch(req("GET")),data=await response.json();
 assert.deepEqual(data.rooms.map(r=>r.code),["345678"]);
 assert.deepEqual([...storage.map.keys()].filter(k=>k.startsWith("room:")).sort(),["room:345678"]);
});
test("room update replaces existing entry",async()=>{
 const {instance,storage}=registry();await instance.fetch(req("POST",room));
 await instance.fetch(req("POST",{...room,players:2,host:"New host"}));
 assert.equal([...storage.map.keys()].filter(k=>k.startsWith("room:")).length,1);assert.equal(storage.map.get("room:123456").players,2);
});
test("method not supported",async()=>{
 const {instance}=registry();const r=await instance.fetch(new Request("https://registry/rooms",{method:"DELETE"}));assert.equal(r.status,405);
});
test("oversized body rejected by byte count, including multibyte UTF-8",async()=>{
 const {instance}=registry();
 const unicode={...room,host:"é".repeat(1100)};
 const r=await instance.fetch(req("POST",unicode));assert.equal(r.status,400);
});
test("oversized streamed body rejected",async()=>{
 const {instance}=registry();
 const r=await instance.fetch(new Request("https://registry/rooms",{method:"POST",headers:{"x-directory-ip":"test-ip"},body:"x".repeat(4096)}));
 assert.equal(r.status,400);
});
test("rate limit blocks excess updates from one IP",async()=>{
 const {instance}=registry();let last;
 for(let i=0;i<61;i++)last=await instance.fetch(req("POST",{...room,code:String(i).padStart(6,"0")}));
 assert.equal(last.status,429);
});
test("concurrent room creation never exceeds capacity",async()=>{
 const {instance,storage}=registry();
 const results=await Promise.all(Array.from({length:101},(_,i)=>instance.fetch(req("POST",{...room,code:String(i).padStart(6,"0")}, "ip-"+i))));
 const accepted=results.filter(r=>r.status===200).length,full=results.filter(r=>r.status===503).length;
 assert.equal(accepted,100);assert.equal(full,1);
 assert.equal([...storage.map.keys()].filter(k=>k.startsWith("room:")).length,100);
});
test("concurrent GET and POST are rate limited per IP",async()=>{
 const {instance}=registry();
 const results=await Promise.all(Array.from({length:61},()=>instance.fetch(req("GET",null,"read-test"))));
 assert.equal(results.filter(r=>r.status===200).length,60);assert.equal(results.filter(r=>r.status===429).length,1);
});
