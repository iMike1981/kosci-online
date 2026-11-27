import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

function makeEnv(origin=null) {
  let forwarded;
  const stub = {
    async fetch(url, init) {
      forwarded = { url, init };
      return new Response(JSON.stringify({ delegated: true }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  };
  const env = {
    ROOM_REGISTRY: {
      idFromName(name) { return { name }; },
      get(id) { assert.equal(id.name, "public-registry"); return stub; }
    }
  };
  if(origin)env.DICE_PUBLIC_ROOMS_ORIGIN=origin;
  return { env, getForwarded: () => forwarded };
}

test("health endpoint responds without invoking the registry", async () => {
  const { env, getForwarded } = makeEnv();
  const response = await worker.fetch(new Request("https://worker/health"), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, service: "dice-online-public-rooms", version: 1 });
  assert.equal(getForwarded(), undefined);
});

test("API rejects a disallowed browser origin", async () => {
  const { env, getForwarded } = makeEnv();
  const response = await worker.fetch(new Request("https://worker/api/rooms", {
    headers: { origin: "https://attacker.example" }
  }), env);
  assert.equal(response.status, 403);
  assert.equal(getForwarded(), undefined);
});

test("API forwards the trusted origin and overwrites spoofed IP headers", async () => {
  const { env, getForwarded } = makeEnv();
  const response = await worker.fetch(new Request("https://worker/api/rooms", {
    headers: {
      origin: "https://imike1981.github.io",
      "CF-Connecting-IP": "203.0.113.7",
      "x-directory-ip": "spoofed"
    }
  }), env);
  assert.equal(response.status, 200);
  const forwarded = getForwarded();
  assert.equal(forwarded.url, "https://registry/rooms");
  assert.equal(forwarded.init.headers.get("x-directory-ip"), "203.0.113.7");
  assert.equal(forwarded.init.headers.get("origin"), "https://imike1981.github.io");
});

test("unknown API method is not delegated", async () => {
  const { env, getForwarded } = makeEnv();
  const response = await worker.fetch(new Request("https://worker/api/rooms", {
    method: "PUT",
    headers: { origin: "https://imike1981.github.io" }
  }), env);
  assert.equal(response.status, 404);
  assert.equal(getForwarded(), undefined);
});


test("local preview origin is accepted and preflight advertises it",async()=>{
 const origin="http://127.0.0.1:5173", {env}=makeEnv(origin);
 const response=await worker.fetch(new Request("https://worker/api/rooms",{method:"OPTIONS",headers:{origin,"access-control-request-method":"POST","access-control-request-headers":"content-type"}}),env);
 assert.equal(response.status,204);
 assert.equal(response.headers.get("access-control-allow-origin"),origin);
});
test("configured preview origin is forwarded to the registry",async()=>{
 const origin="http://127.0.0.1:5173", {env,getForwarded}=makeEnv(origin);
 const response=await worker.fetch(new Request("https://worker/api/rooms",{headers:{origin}}),env);
 assert.equal(response.status,200);
 assert.equal(getForwarded().init.headers.get("origin"),origin);
});
