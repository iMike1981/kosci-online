/**
 * Dice Online public-room registry — Cloudflare Worker + Durable Objects.
 * Registry advertises public rooms; existing MQTT gameplay remains untouched
 * during this initial rollout. Room codes are validated and updates are bounded.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") return json({ok:true,service:"dice-online-public-rooms",version:1});
    if (url.pathname === "/api/rooms" && request.method === "GET") {
      const id = env.ROOM_REGISTRY.idFromName("public-registry");
      return env.ROOM_REGISTRY.get(id).fetch("https://registry/rooms");
    }
    if (url.pathname === "/api/rooms" && request.method === "POST") {
      if (!originAllowed(request)) return json({error:"origin not allowed"},403);
      const body = await safeJson(request);
      if (!body) return json({error:"invalid JSON"},400);
      const id = env.ROOM_REGISTRY.idFromName("public-registry");
      return env.ROOM_REGISTRY.get(id).fetch("https://registry/rooms",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
    }
    if (url.pathname === "/api/rooms/remove" && request.method === "POST") {
      if (!originAllowed(request)) return json({error:"origin not allowed"},403);
      const body=await safeJson(request); if(!body)return json({error:"invalid JSON"},400);
      const id=env.ROOM_REGISTRY.idFromName("public-registry");
      return env.ROOM_REGISTRY.get(id).fetch("https://registry/remove",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
    }
    return json({error:"not found"},404);
  }
};
function originAllowed(req){const o=req.headers.get("origin");return !o || o==="https://imike1981.github.io";}
async function safeJson(req){try{return await req.json()}catch{return null}}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json;charset=utf-8","cache-control":"no-store","access-control-allow-origin":"https://imike1981.github.io"}})}

export class RoomRegistry {
  constructor(state,env){this.state=state;this.env=env;}
  async fetch(request){
    const path=new URL(request.url).pathname;
    if(path==="/rooms"&&request.method==="GET"){
      const rooms=await this.state.storage.list({prefix:"room:",limit:100});
      const now=Date.now(),out=[];
      for(const [key,r] of rooms){if(now-r.updatedAt>120000){await this.state.storage.delete(key);continue;}out.push(r)}
      out.sort((a,b)=>b.updatedAt-a.updatedAt);
      return json({rooms:out});
    }
    if(path==="/rooms"&&request.method==="POST"){
      const d=await safeJson(request);
      if(!d||!validRoom(d))return json({error:"invalid room data"},400);
      const key="room:"+d.code.toUpperCase();
      const room={code:d.code.toUpperCase(),host:safeText(d.host,20),players:Math.max(1,Math.min(8,Number(d.players)||1)),maxPlayers:Math.max(2,Math.min(8,Number(d.maxPlayers)||8)),mode:safeText(d.mode,24),status:d.status==="playing"?"playing":"waiting",updatedAt:Date.now()};
      await this.state.storage.put(key,room);
      return json({ok:true,room});
    }
    if(path==="/remove"&&request.method==="POST"){
      const d=await safeJson(request);if(!d||!/^\d{6}$/.test(d.code||""))return json({error:"invalid code"},400);
      await this.state.storage.delete("room:"+d.code);return json({ok:true});
    }
    return json({error:"not found"},404);
  }
}
function validRoom(d){return /^\d{6}$/.test(d.code||"")&&typeof d.host==="string"&&d.host.trim().length>0&&Number.isFinite(Number(d.players))}
function safeText(v,n){return String(v||"").replace(/[<>]/g,"").trim().slice(0,n)}
