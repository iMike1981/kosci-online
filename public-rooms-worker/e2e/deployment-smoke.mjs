import path from "node:path";
import { fileURLToPath } from "node:url";
const TEST_WORKER = "https://dice-online-public-rooms-test.janowicz-michal.workers.dev";
export function validatePreviewOrigin(value) {
  let url; try { url=new URL(value); } catch { throw new Error("Invalid preview origin"); }
  const hostnamePattern=/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.dice-online-test\.pages\.dev$/;
  if(url.protocol!=="https:"||!hostnamePattern.test(url.hostname)||value!==url.origin)
    throw new Error("Preview origin must be an exact HTTPS origin for a branch-preview host under *.dice-online-test.pages.dev (no path or trailing slash)");
  return url.origin;
}
async function pageWithRetry(origin,fetchImpl,waitImpl,attempts=8){
  let last;
  for(let n=1;n<=attempts;n++){
    try{const r=await fetchImpl(origin,{headers:{"cache-control":"no-cache"}});if(r.ok)return await r.text();last=new Error(`Preview HTTP ${r.status}`);}
    catch(e){last=e;}
    if(n<attempts)await waitImpl(3000);
  }
  throw new Error(`Preview page did not become available: ${last?.message||"unknown error"}`);
}
function cors(r,origin,label){if(r.headers.get("access-control-allow-origin")!==origin)throw new Error(label+": incorrect or missing CORS origin");}
export async function runPreviewSmoke(previewOrigin,{fetchImpl=fetch,waitImpl=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
  const origin=validatePreviewOrigin(previewOrigin),html=await pageWithRetry(origin,fetchImpl,waitImpl);
  if(!html.includes("TEST PREVIEW — NOT PRODUCTION")||!html.includes(TEST_WORKER)||!html.includes("dicePublicRoomsApi"))throw new Error("Preview page is missing the test banner or isolated Worker configuration");
  const uiAsset=await fetchImpl(origin+"/public-rooms-worker/public-rooms-ui.js",{headers:{"cache-control":"no-cache"}});
  if(!uiAsset.ok)throw new Error(`Preview public-room UI asset failed HTTP ${uiAsset.status}`);
  const uiText=await uiAsset.text();
  if(!uiText.includes("Public rooms UI integration"))throw new Error("Preview public-room UI asset is missing its expected source marker");
  const health=await fetchImpl(TEST_WORKER+"/health",{headers:{origin}});
  if(!health.ok||(await health.json()).ok!==true)throw new Error("Test Worker health check failed");
  const url=TEST_WORKER+"/api/rooms",initial=await fetchImpl(url,{headers:{origin}});
  if(!initial.ok)throw new Error(`Directory GET failed HTTP ${initial.status}`);cors(initial,origin,"Directory GET");
  if(!Array.isArray((await initial.json()).rooms))throw new Error("Directory GET did not return a rooms array");
  const pre=await fetchImpl(url,{method:"OPTIONS",headers:{origin,"access-control-request-method":"POST","access-control-request-headers":"content-type"}});
  if(pre.status!==204)throw new Error(`POST preflight failed HTTP ${pre.status}`);cors(pre,origin,"Directory preflight");
  if(!pre.headers.get("access-control-allow-methods")?.includes("POST")||!pre.headers.get("access-control-allow-headers")?.toLowerCase().includes("content-type"))throw new Error("Preflight did not allow POST/content-type");
  const code=String(Math.floor(Math.random()*1_000_000)).padStart(6,"0"),room={code,host:"Preview smoke",players:1,maxPlayers:2,mode:"duel",status:"playing"};
  const post=await fetchImpl(url,{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify(room)});
  if(!post.ok)throw new Error(`Directory POST failed HTTP ${post.status}`);cors(post,origin,"Directory POST");
  const posted=await post.json();if(!posted.ok||posted.room?.code!==code)throw new Error("POST did not confirm the smoke room");
  const confirm=await fetchImpl(url,{headers:{origin}});if(!confirm.ok)throw new Error(`Confirmation GET failed HTTP ${confirm.status}`);cors(confirm,origin,"Confirmation GET");
  if(!(await confirm.json()).rooms.some(x=>x.code===code&&x.status==="playing"))throw new Error("Smoke room not visible after publish");
  console.log(`PASS: preview page, static UI asset, Worker health, CORS, GET/POST/preflight and publish/confirm (${code}).`);
  return {code,origin};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))runPreviewSmoke(process.argv[2]).catch(e=>{console.error(e.message);process.exitCode=1;});
