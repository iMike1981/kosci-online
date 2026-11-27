import test from "node:test";import assert from "node:assert/strict";import {spawnSync} from "node:child_process";import path from "node:path";import {fileURLToPath} from "node:url";import {runPreviewSmoke,validatePreviewOrigin} from "../e2e/deployment-smoke.mjs";
const origin="https://feature-public-rooms-cloudflare.dice-online-test.pages.dev",worker="https://dice-online-public-rooms-test.janowicz-michal.workers.dev";
test("preview origin is restricted to exact HTTPS Pages test origins",()=>{assert.equal(validatePreviewOrigin(origin),origin);assert.throws(()=>validatePreviewOrigin(origin+"/"),/exact HTTPS origin/);assert.throws(()=>validatePreviewOrigin("http://feature.dice-online-test.pages.dev"),/exact HTTPS origin/);assert.throws(()=>validatePreviewOrigin("https://production.pages.dev"),/exact HTTPS origin/);});
test("deployment smoke verifies preview, health, CORS and room publish",async()=>{
 const roomMap=new Map(),calls=[];
 const fakeFetch=async(url,init={})=>{const u=String(url),m=init.method||"GET";calls.push({u,m});
 if(u===origin)return new Response(`<div>TEST PREVIEW — NOT PRODUCTION</div><script>localStorage.setItem("dicePublicRoomsApi","${worker}")</script>`,{status:200});
 if(u===worker+"/health")return new Response(JSON.stringify({ok:true}),{status:200});
 if(u===worker+"/api/rooms"&&m==="OPTIONS")return new Response(null,{status:204,headers:{"access-control-allow-origin":origin,"access-control-allow-methods":"GET,POST,OPTIONS","access-control-allow-headers":"content-type"}});
 if(u===worker+"/api/rooms"&&m==="POST"){const r=JSON.parse(init.body);roomMap.set(r.code,r);return new Response(JSON.stringify({ok:true,room:r}),{status:200,headers:{"access-control-allow-origin":origin}});}
 if(u===worker+"/api/rooms"&&m==="GET")return new Response(JSON.stringify({rooms:[...roomMap.values()]}),{status:200,headers:{"access-control-allow-origin":origin}});
 throw new Error("Unexpected request "+m+" "+u);};
 const r=await runPreviewSmoke(origin,{fetchImpl:fakeFetch,waitImpl:async()=>{}});
 assert.equal(r.origin,origin);assert.equal(roomMap.get(r.code)?.status,"playing");assert.equal(calls.filter(c=>c.m==="POST").length,1);assert.equal(calls.filter(c=>c.m==="OPTIONS").length,1);
});
test("smoke fails if page is not the isolated test page",async()=>{await assert.rejects(()=>runPreviewSmoke(origin,{fetchImpl:async()=>new Response("production page",{status:200}),waitImpl:async()=>{}}),/missing the test banner/);});
test("CLI entrypoint executes with a relative script path",()=>{const scriptPath=fileURLToPath(new URL("../e2e/deployment-smoke.mjs",import.meta.url)),relative=path.relative(process.cwd(),scriptPath),r=spawnSync(process.execPath,[relative],{encoding:"utf8"});assert.equal(r.status,1);assert.match(r.stderr,/Invalid preview origin/);});
