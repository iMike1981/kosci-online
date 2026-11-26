import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const index = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const helperLine = index.split("\n").find(line => line.startsWith("function availableRooms(rooms){"));
assert.ok(helperLine, "availability helper must be present in the game page");
const availableRooms = vm.runInNewContext(helperLine + "\\navailableRooms");

test("public room availability excludes playing, full and malformed entries", () => {
  const rooms = [
    { code: "111111", status: "waiting", players: 1, maxPlayers: 8 },
    { code: "222222", status: "playing", players: 2, maxPlayers: 8 },
    { code: "333333", status: "waiting", players: 8, maxPlayers: 8 },
    { code: "444444", status: "waiting", players: 0, maxPlayers: 8 },
    { code: "555555", status: "waiting", players: 2, maxPlayers: 8 },
    null
  ];
  assert.deepEqual(Array.from(availableRooms(rooms), r => r.code), ["555555", "111111"]);
});

test("both manual refresh and Quick Match use the shared availability filter", () => {
  assert.ok(index.includes("const rooms=availableRooms(data.rooms);"));
  assert.ok(index.includes("const candidates=availableRooms(d.rooms);"));
});
