import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const index = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const helperLine = index.split("\n").find(line => line.startsWith("function availableRooms(rooms){"));
const maxPlayersLine = index.split("\n").find(line => line.startsWith("function publicRoomMaxPlayers(mode){"));
assert.ok(helperLine, "availability helper must be present in the game page");
const availableRooms = vm.runInNewContext(helperLine + "\navailableRooms");
assert.ok(maxPlayersLine, "mode capacity helper must be present in the game page");
const publicRoomMaxPlayers = vm.runInNewContext(maxPlayersLine + "\npublicRoomMaxPlayers");

test("public room availability excludes playing, full and malformed entries", () => {
  const rooms = [
    { code: "111111", host: "Player", mode: "classic", status: "waiting", players: 1, maxPlayers: 8 },
    { code: "222222", host: "Player", mode: "classic", status: "playing", players: 2, maxPlayers: 8 },
    { code: "333333", host: "Player", mode: "classic", status: "waiting", players: 8, maxPlayers: 8 },
    { code: "444444", host: "Player", mode: "classic", status: "waiting", players: 0, maxPlayers: 8 },
    { code: "555555", host: "Player", mode: "classic", status: "waiting", players: 2, maxPlayers: 8 },
    { code: "222223", host: "Player", mode: "duel", status: "waiting", players: 1, maxPlayers: 2 },
    { code: "222224", host: "Player", mode: "duel", status: "waiting", players: 2, maxPlayers: 2 },
    { code: "12345", host: "Player", mode: "classic", status: "waiting", players: 1, maxPlayers: 8 },
    { code: "666666", host: "Player", mode: "classic", status: "waiting", players: "2", maxPlayers: 8 },
    { code: "777777", host: "Player", mode: "classic", status: "waiting", players: 1, maxPlayers: 1 },
    { code: "888888", host: "Player", mode: "classic", status: "waiting", players: 1, maxPlayers: 9 },
    { code: "999999", host: " ", mode: "classic", status: "waiting", players: 1, maxPlayers: 8 },
    { code: "000000", host: "Player", mode: "", status: "waiting", players: 1, maxPlayers: 8 },
    null
  ];
  assert.deepEqual(Array.from(availableRooms(rooms), r => r.code), ["555555", "111111", "222223"]);
});

test("both manual refresh and Quick Match use the shared availability filter", () => {
  assert.ok(index.includes("const rooms=availableRooms(data.rooms);"));
  assert.ok(index.includes("const candidates=availableRooms(d.rooms);"));
});

test("directory publishes the correct player capacity for Duel rooms", () => {
  assert.equal(publicRoomMaxPlayers("duel"), 2);
  assert.equal(publicRoomMaxPlayers("classic"), 8);
  assert.equal(publicRoomMaxPlayers("train"), 8);
  assert.ok(index.includes("maxPlayers:publicRoomMaxPlayers(S.mode||'classic')"));
});
