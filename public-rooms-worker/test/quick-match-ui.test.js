import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const page = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const marker = "/* Public-room directory UI (registry only; game joining still uses the existing room engine) */";
const start = page.indexOf(marker);
const end = page.indexOf("})();", start) + 4;
assert.ok(start >= 0 && end > start, "embedded public-room UI must be present");
const script = page.slice(start, end);

function harness({ rooms = [], api = "https://worker.test", fetchError = null, savedApi = api } = {}) {
  let joinClicks = 0, fetchCalls = [];
  const elements = new Map([
    ["pubapi", { value: "" }],
    ["publist", { textContent: "", innerHTML: "", querySelectorAll() { return []; } }],
    ["pubsave", {}], ["pubrefresh", {}], ["pubquick", {}],
    ["code", { value: "" }],
    ["pubrooms", { open: true }],
    ["join", { click() { joinClicks++; } }],
    ["msg", { textContent: "" }]
  ]);
  const localStorage = {
    getItem(key) { return key === "dicePublicRoomsApi" ? savedApi : null; },
    setItem() {}
  };
  const fetch = async url => {
    fetchCalls.push(url);
    if (fetchError) throw fetchError;
    return { ok: true, async json() { return { rooms }; } };
  };
  vm.runInNewContext(script, { document: { getElementById(id) { return elements.get(id) || null; } }, localStorage, fetch });
  return { elements, fetchCalls, getJoinClicks: () => joinClicks };
}

test("Quick Match selects a valid waiting room and triggers the existing Join flow", async () => {
  const rooms = [
    { code: "111111", host: "One", players: 1, maxPlayers: 8, mode: "classic", status: "waiting" },
    { code: "222222", host: "Nearly full", players: 7, maxPlayers: 8, mode: "classic", status: "waiting" },
    { code: "333333", host: "Full", players: 2, maxPlayers: 2, mode: "duel", status: "waiting" },
    { code: "444444", host: "Playing", players: 2, maxPlayers: 8, mode: "classic", status: "playing" },
    { code: "555555", host: "Malformed", players: "2", maxPlayers: 8, mode: "classic", status: "waiting" },
    { code: "666666", host: "Duel", players: 1, maxPlayers: 2, mode: "duel", status: "waiting" }
  ];
  const h = harness({ rooms });
  await h.elements.get("pubquick").onclick();
  assert.equal(h.fetchCalls.length, 1);
  assert.equal(h.fetchCalls[0], "https://worker.test/api/rooms");
  assert.equal(h.elements.get("code").value, "222222");
  assert.equal(h.elements.get("pubrooms").open, false);
  assert.equal(h.getJoinClicks(), 1);
});

test("Quick Match reports an empty directory without attempting to join", async () => {
  const h = harness({ rooms: [] });
  await h.elements.get("pubquick").onclick();
  assert.match(h.elements.get("publist").textContent, /No waiting rooms found/);
  assert.equal(h.getJoinClicks(), 0);
  assert.equal(h.elements.get("code").value, "");
});

test("Quick Match reports directory errors and does not join", async () => {
  const h = harness({ fetchError: new Error("HTTP 503") });
  await h.elements.get("pubquick").onclick();
  assert.match(h.elements.get("publist").textContent, /Quick Match failed: HTTP 503/);
  assert.equal(h.getJoinClicks(), 0);
});

test("Quick Match refuses to search until a directory URL is configured", async () => {
  const h = harness({ api: "", savedApi: "" });
  await h.elements.get("pubquick").onclick();
  assert.match(h.elements.get("publist").textContent, /Configure API first/);
  assert.equal(h.fetchCalls.length, 0);
  assert.equal(h.getJoinClicks(), 0);
});
