import test from "node:test"; import assert from "node:assert/strict"; import { validRoom } from "../src/index.js";
test("valid listing",()=>assert.equal(validRoom({code:"123456",host:"Player",players:1,maxPlayers:8,mode:"classic",status:"waiting"}),true));
test("invalid code and bounds",()=>{assert.equal(validRoom({code:"abc123",host:"Player",players:1,maxPlayers:8,mode:"classic"}),false);assert.equal(validRoom({code:"123456",host:"Player",players:9,maxPlayers:8,mode:"classic"}),false);assert.equal(validRoom({code:"123456",host:"Player",players:1,maxPlayers:1,mode:"classic"}),false);});
test("blank mode or invalid status rejected",()=>{assert.equal(validRoom({code:"123456",host:"Player",players:1,maxPlayers:8,mode:""}),false);assert.equal(validRoom({code:"123456",host:"Player",players:1,maxPlayers:8,mode:"classic",status:"evil"}),false);});

test("directory accepts only supported modes with their game capacity",()=>{
 for(const mode of ["classic","train","hw","call","pig"])assert.equal(validRoom({code:"123456",host:"Player",players:1,maxPlayers:8,mode}),true,mode);
 assert.equal(validRoom({code:"123456",host:"Player",players:1,maxPlayers:2,mode:"duel"}),true);
 assert.equal(validRoom({code:"123456",host:"Player",players:1,maxPlayers:8,mode:"duel"}),false);
 assert.equal(validRoom({code:"123456",host:"Player",players:1,maxPlayers:2,mode:"classic"}),false);
 assert.equal(validRoom({code:"123456",host:"Player",players:1,maxPlayers:2,mode:"test"}),false);
});

test("strict schema rejects coercible numeric and non-string fields",()=>{
 const base={code:"123456",host:"Player",players:1,maxPlayers:8,mode:"classic",status:"waiting"};
 assert.equal(validRoom({...base,players:"1"}),false);
 assert.equal(validRoom({...base,maxPlayers:"8"}),false);
 assert.equal(validRoom({...base,players:true}),false);
 assert.equal(validRoom({...base,code:123456}),false);
 assert.equal(validRoom({...base,host:7}),false);
 assert.equal(validRoom(null),false);
 assert.equal(validRoom(undefined),false);
});
