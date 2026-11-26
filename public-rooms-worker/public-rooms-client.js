/* Dice Online Public Rooms API client helper.
 * Integrate into frontend after configuring window.DICE_PUBLIC_ROOMS_API.
 * Does not alter the existing MQTT gameplay transport.
 */
(function(){
 const API=window.DICE_PUBLIC_ROOMS_API;
 if(!API)return;
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
   return this.publish({code,host,players:state.lobby.length,maxPlayers:8,mode,status:state.G&&state.G.phase==="play"?"playing":"waiting"});
  }
 };
})();
