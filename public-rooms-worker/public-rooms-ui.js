/* Public rooms UI integration (directory only; existing MQTT gameplay untouched). */
(function(){
"use strict";
// The main game already contains the public-room panel and Quick Match.
// Avoid injecting a second, disconnected panel when this fallback is loaded there.
if(document.getElementById("pubrooms")||document.getElementById("pubquick"))return;
const APIKEY="dice_public_rooms_api";
const start=document.getElementById("start");
if(!start)return;
const panel=document.createElement("section");
panel.id="publicRooms";
panel.className="card";
panel.innerHTML='<h3>🌐 Public rooms / Publiczne pokoje</h3><p class="small">Find a game or create a public room. / Znajdź grę lub utwórz publiczny pokój.</p><div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" id="prQuick">⚡ Quick Match</button><button type="button" class="alt" id="prRefresh">↻ Refresh</button></div><div id="prList" style="margin-top:10px"></div><details style="margin-top:8px"><summary>Directory setup</summary><p class="small">Enter the deployed Cloudflare Worker URL (once deployed).</p><input id="prApi" placeholder="https://your-worker.workers.dev" style="width:min(95%,400px)"><button class="alt" id="prSave">Save</button></details>';
start.parentNode.insertBefore(panel,start);
const $=id=>document.getElementById(id), esc=s=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let api=localStorage.getItem(APIKEY)||"";
$("prApi").value=api;
function show(msg){$("prList").innerHTML=msg}
function endpoint(){return api.replace(/\/$/,"")}
async function listRooms(){
 if(!endpoint()){show('<p class="small">Public lobby is prepared, but its directory server has not been deployed/configured yet.</p>');return []}
 try{const r=await fetch(endpoint()+"/api/rooms",{cache:"no-store"});if(!r.ok)throw Error("HTTP "+r.status);const d=await r.json();const rooms=(d.rooms||[]).filter(x=>x.status!=="playing"&&x.players<x.maxPlayers);if(!rooms.length){show('<p>No waiting rooms found. / Brak wolnych pokoi.</p>');return []}
 show(rooms.map(x=>'<div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap"><div><b>'+esc(x.host)+'</b> <span class="small">· '+esc(x.mode)+' · '+x.players+'/'+x.maxPlayers+'</span><br><span class="small">Room '+esc(x.code)+'</span></div><button type="button" data-room="'+esc(x.code)+'">Join</button></div>').join(""));
 $("prList").querySelectorAll("[data-room]").forEach(b=>b.onclick=()=>{const n=$("name").value.trim();if(!n){alert("Enter your name first.");return}enterRoom(b.dataset.room,false)});
 return rooms;
 }catch(e){show('<p class="small">Directory unavailable: '+esc(e.message)+' — check the Worker URL/deployment.</p>');return []}
}
async function publish(){
 try{if(!endpoint()||!window.ROOM||!window.S||!window.me||!window.S.host)return;
 const d={code:window.ROOM,host:window.S.host,players:(window.S.lobby||[]).length,maxPlayers:8,mode:window.S.mode||"classic",status:window.S.G&&window.S.G.phase==="play"?"playing":"waiting"};
 await fetch(endpoint()+"/api/rooms",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(d)});
 }catch(e){}
}
$("prRefresh").onclick=listRooms;
$("prQuick").onclick=async()=>{const n=$("name").value.trim();if(!n){alert("Enter your name first.");return}const rooms=await listRooms();if(rooms&&rooms.length){const room=rooms.find(x=>x.players<x.maxPlayers);if(room){enterRoom(room.code,false);return}}$("msg").textContent="No open room found. Create a new public room.";
};
$("prSave").onclick=()=>{api=$("prApi").value.trim();localStorage.setItem(APIKEY,api);listRooms()};
listRooms();
setInterval(()=>{listRooms();publish()},30000);
})();
