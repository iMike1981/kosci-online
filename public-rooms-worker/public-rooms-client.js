/* Dice Online Public Rooms API client helper.
 * Integrate into frontend after configuring window.DICE_PUBLIC_ROOMS_API.
 * Does not alter the existing MQTT gameplay transport.
 */
(function(){
 const API=window.DICE_PUBLIC_ROOMS_API;
 if(!API)return;
 const MODE_CAPACITY=Object.freeze({classic:8,train:8,hw:8,call:8,pig:8,duel:2});
 function maxPlayersForMode(mode){return MODE_CAPACITY[mode]||8;}
 async function request(path,options){
  const r=await fetch(API+path,Object.assign({headers:{"content-type":"application/json"}},options||{}));
  if(!r.ok)throw new Error("Public rooms API: "+r.status);
  return r.json();
 }
 window.DicePublicRooms={
  list:()=>request("/api/rooms"),
  publish:room=>request("/api/rooms",{method:"POST",body:JSON.stringify(room)}),
  async updateFromRoom(state,code,host,mode){
   if(!state||!state.lobby)return null;
   mode=mode||"classic";
   return this.publish({code,host,players:state.lobby.length,maxPlayers:maxPlayersForMode(mode),mode,status:state.G&&state.G.phase==="play"?"playing":"waiting"});
  }
 };
})();
