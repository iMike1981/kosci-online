/**
 * Dice Online public-room directory (Cloudflare Workers + SQLite Durable Objects).
 * This is a discovery registry only; the existing MQTT game remains authoritative
 * for the current game session. Do not treat this registry as anti-cheat security.
 */
const ALLOWED_ORIGIN = "https://imike1981.github.io";
const TTL_MS = 120000;
const MAX_ROOMS = 100;
const RATE_WINDOW_MS = 60000;
const RATE_LIMIT = 60;
const MAX_RATE_KEYS = 500;
const MAX_BODY_BYTES = 2048;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const allowed = originFor(env);
    if (request.method === "OPTIONS") return new Response(null,{status:204,headers:corsHeaders(allowed)});
    if (url.pathname === "/health" && request.method === "GET")
      return json({ok:true,service:"dice-online-public-rooms",version:1},200,allowed);
    if (!originAllowed(request,allowed)) return json({error:"origin not allowed"},403,allowed);
    if (url.pathname === "/api/rooms" && (request.method === "GET" || request.method === "POST")) {
      const id = env.ROOM_REGISTRY.idFromName("public-registry");
      const headers=new Headers(request.headers);
      headers.set("x-directory-ip",request.headers.get("CF-Connecting-IP")||"unknown");
      return env.ROOM_REGISTRY.get(id).fetch("https://registry/rooms",{method:request.method,headers,body:request.method==="POST"?request.body:null});
    }
    return json({error:"not found"},404,allowed);
  }
};
function originFor(env){const value=env&&env.DICE_PUBLIC_ROOMS_ORIGIN;return typeof value==="string"&&value.trim()?value.trim():ALLOWED_ORIGIN;}
function originAllowed(req,allowed=ALLOWED_ORIGIN){const o=req.headers.get("origin");return !o || o===allowed;}
async function safeJson(req){
  const length=req.headers.get("content-length");
  if(length!==null && (!/^\d+$/.test(length)||Number(length)>MAX_BODY_BYTES))return null;
  if(!req.body)return null;
  const reader=req.body.getReader(),chunks=[];
  let total=0;
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      total+=value.byteLength;
      if(total>MAX_BODY_BYTES){await reader.cancel();return null;}
      chunks.push(value);
    }
    const bytes=new Uint8Array(total);
    let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    return JSON.parse(new TextDecoder().decode(bytes));
  }catch{
    try{await reader.cancel()}catch{}
    return null;
  }finally{
    try{reader.releaseLock()}catch{}
  }
}
function corsHeaders(allowed=ALLOWED_ORIGIN){return {"content-type":"application/json;charset=utf-8","cache-control":"no-store","access-control-allow-origin":allowed,"access-control-allow-methods":"GET,POST,OPTIONS","access-control-allow-headers":"content-type"}}
function json(data,status=200,allowed=ALLOWED_ORIGIN){return new Response(JSON.stringify(data),{status,headers:corsHeaders(allowed)})}

export class RoomRegistry {
  constructor(state,env){this.state=state;this.env=env;}
  async rateLimit(request,allowed=originFor(this.env)){
    const ip=(request.headers.get("x-directory-ip")||"unknown").slice(0,80);
    const key="rate:"+ip,now=Date.now();
    return this.state.storage.transaction(async tx=>{
      const previous=await tx.get(key);
      const rates=await tx.list({prefix:"rate:",limit:MAX_RATE_KEYS+1});
      for(const [k,v] of rates)if(!v||v.resetAt<=now)await tx.delete(k);
      const activeCount=[...rates].filter(([,v])=>v&&v.resetAt>now).length;
      const keyIsActive=previous&&previous.resetAt>now;
      if(!keyIsActive&&activeCount>=MAX_RATE_KEYS)
        return json({error:"registry temporarily busy"},503,allowed);
      if(previous&&previous.resetAt>now&&previous.count>=RATE_LIMIT)
        return json({error:"rate limit exceeded"},429,allowed);
      const next=previous&&previous.resetAt>now?{count:previous.count+1,resetAt:previous.resetAt}:{count:1,resetAt:now+RATE_WINDOW_MS};
      await tx.put(key,next);
      return null;
    });
  }
  async fetch(request){
    const allowed=originFor(this.env);
    if(request.method==="GET"){
      const limited=await this.rateLimit(request,allowed);if(limited)return limited;
      return this.state.storage.transaction(async tx=>{
        const entries=await tx.list({prefix:"room:",limit:MAX_ROOMS+1});
        const now=Date.now(),out=[];
        for(const [key,r] of entries){
          if(!isStoredRoom(r,now)){await tx.delete(key);continue;}
          out.push(r);
        }
        out.sort((a,b)=>b.updatedAt-a.updatedAt);
        return json({rooms:out},200,allowed);
      });
    }
    if(request.method==="POST"){
      const limited=await this.rateLimit(request,allowed);if(limited)return limited;
      const d=await safeJson(request);
      if(!d||!validRoom(d))return json({error:"invalid room data"},400,allowed);
      const key="room:"+d.code;
      const room={code:d.code,host:safeText(d.host,20),players:Number(d.players),maxPlayers:Number(d.maxPlayers),mode:safeText(d.mode,24),status:d.status==="playing"?"playing":"waiting",updatedAt:Date.now()};
      // Capacity check, expiry cleanup, and insertion share one transaction so
      // concurrent publishers cannot race the 100-room limit.
      return this.state.storage.transaction(async tx=>{
        const existing=await tx.get(key);
        if(!existing){
          const all=await tx.list({prefix:"room:",limit:MAX_ROOMS+1});
          const now=Date.now();
          for(const [k,v] of all)if(!isStoredRoom(v,now))await tx.delete(k);
          const remaining=await tx.list({prefix:"room:",limit:MAX_ROOMS+1});
          if(remaining.size>=MAX_ROOMS)return json({error:"room directory full"},503,allowed);
        }
        await tx.put(key,room);
        return json({ok:true,room},200,allowed);
      });
    }
    return json({error:"method not allowed"},405,allowed);
  }
}
function isStoredRoom(r,now){
  return !!r&&Number.isFinite(r.updatedAt)&&r.updatedAt>0&&r.updatedAt<=now+5000&&
    now-r.updatedAt<=TTL_MS&&validRoom(r);
}
const MODE_CAPACITY=Object.freeze({classic:8,train:8,hw:8,call:8,pig:8,duel:2});
export function validRoom(d){
 return !!d&&typeof d==="object"&&
 typeof d.code==="string"&&/^\d{6}$/.test(d.code)&&
 typeof d.host==="string"&&d.host.trim().length>0&&
 typeof d.players==="number"&&Number.isInteger(d.players)&&d.players>=1&&d.players<=8&&
 typeof d.mode==="string"&&Object.prototype.hasOwnProperty.call(MODE_CAPACITY,d.mode)&&
 typeof d.maxPlayers==="number"&&Number.isInteger(d.maxPlayers)&&d.maxPlayers===MODE_CAPACITY[d.mode]&&
 d.players<=d.maxPlayers&&
 (d.status===undefined||d.status==="waiting"||d.status==="playing");
}
function safeText(v,n){return String(v||"").replace(/[<>]/g,"").trim().slice(0,n)}
