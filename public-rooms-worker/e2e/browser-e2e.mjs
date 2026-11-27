import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright";

const mqttBundle = fs.readFileSync(new URL("../node_modules/mqtt/dist/mqtt.min.js", import.meta.url), "utf8");
const appURL = "http://127.0.0.1:5173/";
const apiURL = "http://127.0.0.1:8787";
const timeout = 120_000;
const stamp = Date.now().toString(36);
const hostName = "Host-" + stamp;
const guestName = "Guest-" + stamp;

async function roomFromDirectory(code) {
  const response = await fetch(apiURL + "/api/rooms");
  assert.equal(response.status, 200, "local test directory must respond");
  const { rooms } = await response.json();
  return rooms.find(room => room.code === code);
}
async function waitFor(fn, description, ms = 30_000) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    try { last = await fn(); if (last) return last; } catch {}
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  throw new Error("Timed out waiting for " + description + (last ? ": " + last : ""));
}
async function makeClient(browser, name) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  
  const page = await context.newPage();
  await page.route("https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js", route =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: mqttBundle }));
  page.on("console", msg => { if (msg.type() === "error") console.error("[browser console]", msg.text()); });
  page.on("pageerror", error => console.error("[browser page error]", error.message));
  page.on("requestfailed", request => { if (request.url().includes("127.0.0.1:8787")) console.error("[API request failed]", request.url(), request.failure()?.errorText); });
  await page.goto(appURL, { waitUntil: "domcontentloaded", timeout });
  await page.locator("#create").waitFor({ state: "visible", timeout: 15_000 });
  await page.evaluate(({ name, apiURL }) => {
    localStorage.setItem("kname", name);
    localStorage.setItem("dicePublicRoomsApi", apiURL);
    localStorage.setItem("klang", "en");
    localStorage.setItem("kmode", "duel");
    localStorage.removeItem("kroom");
    localStorage.removeItem("ksess");
  }, { name, apiURL });
  const configured = await page.evaluate(() => ({ name: localStorage.getItem("kname"), api: localStorage.getItem("dicePublicRoomsApi"), mode: localStorage.getItem("kmode") }));
  assert.equal(configured.api, apiURL, "Public-room API must be configured in the browser");
  assert.equal(configured.mode, "duel", "test Host must use Duel mode");
  const probe = await page.evaluate(async api => {
    try {
      const r = await fetch(api + "/api/rooms", { cache: "no-store" });
      return { status: r.status, body: await r.text() };
    } catch (e) { return { error: e.message }; }
  }, apiURL);
  console.log("[API GET probe]", JSON.stringify(probe));
  assert.equal(probe.status, 200, "Browser origin must be able to read local directory API");
  const postProbe = await page.evaluate(async api => {
    try {
      const r = await fetch(api + "/api/rooms", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: "999999", host: "CORS-probe", players: 1, maxPlayers: 2, mode: "duel", status: "playing" }) });
      return { status: r.status, body: await r.text() };
    } catch (e) { return { error: e.message }; }
  }, apiURL);
  console.log("[API POST probe]", JSON.stringify(postProbe));
  assert.equal(postProbe.status, 200, "Browser origin must be able to publish to local directory API");
  await page.locator("#name").fill(name);
  return { context, page };
}
async function diceValues(page) {
  return page.locator("#dice .die").evaluateAll(dice => dice.map(die => die.querySelectorAll("i.on").length));
}

const browser = await chromium.launch({ headless: true });
let host, guest;
try {
  host = await makeClient(browser, hostName);
  guest = await makeClient(browser, guestName);

  await host.page.locator("#create").click();
  await host.page.locator("#lobby").waitFor({ state: "visible", timeout });
  await waitFor(() => host.page.locator("#net").textContent().then(s => s.includes("online")), "Host MQTT connection", timeout);
  const code = (await host.page.locator("#rc").textContent()).trim();
  assert.match(code, /^\d{6}$/, "Host must create a six-digit room");

  await waitFor(async () => {
    const room = await roomFromDirectory(code);
    return room && room.players === 1 && room.status === "waiting" && room.maxPlayers === 2;
  }, "Host room published to the isolated local directory", 30_000);

  await guest.page.locator("#pubrooms summary").click();
  await guest.page.locator("#pubquick").click();
  await guest.page.locator("#lobby").waitFor({ state: "visible", timeout });
  assert.equal((await guest.page.locator("#rc").textContent()).trim(), code, "Quick Match must select the Host's room");
  await waitFor(() => guest.page.locator("#net").textContent().then(s => s.includes("online")), "Guest MQTT connection", timeout);

  await waitFor(async () => {
    const hostList = await host.page.locator("#plist").textContent();
    const guestList = await guest.page.locator("#plist").textContent();
    return hostList.includes(guestName) && guestList.includes(hostName);
  }, "both players visible in both lobbies", timeout);

  await host.page.locator("#go").click();
  await host.page.locator("#game").waitFor({ state: "visible", timeout });
  await guest.page.locator("#game").waitFor({ state: "visible", timeout });

  const active = await waitFor(async () => {
    if (await host.page.locator("#rollb").isEnabled()) return host.page;
    if (await guest.page.locator("#rollb").isEnabled()) return guest.page;
    return null;
  }, "one player to receive the first turn", 30_000);
  const before = await active.locator("#rinfo").textContent();
  await active.locator("#rollb").click();
  await active.waitForFunction(old => document.getElementById("rinfo")?.textContent !== old, before, { timeout });
  await waitFor(async () => {
    const h = await host.page.locator("#rinfo").textContent();
    const g = await guest.page.locator("#rinfo").textContent();
    return h === g && h !== before;
  }, "roll state synchronized to both clients", timeout);
  const hDice = await diceValues(host.page);
  const gDice = await diceValues(guest.page);
  assert.equal(hDice.length, 6, "expected six dice");
  assert.ok(hDice.every(v => v >= 1 && v <= 6), "Host must display a valid rolled result");
  assert.deepEqual(gDice, hDice, "Guest and Host must display the same dice after a real roll");

  console.log("PASS: real browser Host -> local public-room directory -> Quick Match Guest -> shared lobby -> game start -> synchronized dice roll.");
} finally {
  if (guest) await guest.context.close().catch(() => {});
  if (host) await host.context.close().catch(() => {});
  await browser.close().catch(() => {});
}
