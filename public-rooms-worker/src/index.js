/**
 * Dice Online public-room directory (Cloudflare Workers + SQLite Durable Objects).
 * This is a discovery registry only; the existing MQTT game remains authoritative
 * for the current game session. Do not treat this registry as anti-cheat security.
 */
const ALLOWED_ORIGIN = "https://imike1981.github.io";
const TTL_MS = 120000;
const MAX_ROOMS = 100;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null,{status:204,headers:corsHeaders()});
    if (url.pathname === "/health" && request.method === "GET")
      return json({ok:true,service:"dice-online-public-rooms",version:1});
    if (!originAllowed(request)) return json({error:"origin not allowed"},403);
    if (url.pathname === "/api/rooms" && (request.method === "GET" || request.method === "POST")) {
      const id = env.ROOM_REGISTRY.idFromName("public-registry");
      return env.ROOM_REGISTRY.get(id).fetch("https://registry/rooms",{method:request.method,headers:request.headers,body:request.method==="POST"?request.body:null});
    }
    return json({error:"not found"},404);
  }
};
function originAllowed(req){const o=req.headers.get("origin");return !o || o===ALLOWED_ORIGIN;}
async function safeJson(req){try{return await req.json()}catch{return null}}
function corsHeaders(){return {"content-type":"application/json;charset=utf-8","cache-control":"no-store","access-control-allow-origin":ALLOWED_ORIGIN,"access-control-allow-methods":"GET,POST,OPTIONS","access-control-allow-headers":"content-type"}}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:corsHeaders()})}

export class RoomRegistry {
  constructor(state,env){this.state=state;this.env=env;}
  async fetch(request){
    if(request.method==="GET"){
      const entries=await this.state.storage.list({prefix:"room:",limit:MAX_ROOMS});
      const now=Date.now(),out=[];
      for(const [key,r] of entries){if(!r||now-r.updatedAt>TTL_MS){await this.state.storage.delete(key);continue;}out.push(r);}
      out.sort((a,b)=>b.updatedAt-a.updatedAt);
      return json({rooms:out});
    }
    if(request.method==="POST"){
      const d=await safeJson(request);
      if(!d||!validRoom(d))return json({error:"invalid room data"},400);
      const key="room:"+d.code;
      const room={code:d.code,host:safeText(d.host,20),players:Number(d.players),maxPlayers:Number(d.maxPlayers),mode:safeText(d.mode,24),status:d.status==="playing"?"playing":"waiting",updatedAt:Date.now()};
      // Keep public room listing bounded; expire old entries and refuse new rooms when full.
      const existing=await this.state.storage.get(key);
      if(!existing){
        const all=await this.state.storage.list({prefix:"room:",limit:MAX_ROOMS+1});
        for(const [k,v] of all)if(!v||Date.now()-v.updatedAt>TTL_MS)await this.state.storage.delete(k);
        const remaining=await this.state.storage.list({prefix:"room:",limit:MAX_ROOMS+1});
        if(remaining.size>=MAX_ROOMS)return json({error:"room directory full"},503);
      }
      await this.state.storage.put(key,room);
      return json({ok:true,room});
    }
    return json({error:"method not allowed"},405);
  }
}
function validRoom(d){
 return /^\d{6}$/.test(d.code||"")&&typeof d.host==="string"&&d.host.trim().length>0&&
 Number.isInteger(Number(d.players))&&Number(d.players)>=1&&Number(d.players)<=8&&
 Number.isInteger(Number(d.maxPlayers))&&Number(d.maxPlayers)>=2&&Number(d.maxPlayers)<=8&&
 Number(d.players)<=Number(d.maxPlayers)&&typeof d.mode==="string"&&d.mode.length<=24;
}
function safeText(v,n){return String(v||"").replace(/[<>]/g,"").trim().slice(0,n)}
