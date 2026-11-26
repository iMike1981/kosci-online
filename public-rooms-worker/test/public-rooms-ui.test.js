import test from "node:test";
import assert from "node:assert/strict";

let insertions = 0;
const embeddedPanel = {};
const start = { parentNode: { insertBefore() { insertions++; } } };
const elements = new Map([["pubrooms", embeddedPanel], ["start", start]]);
globalThis.document = {
  getElementById(id) { return elements.get(id) || null; },
  createElement() { return { innerHTML: "", className: "", id: "" }; }
};
globalThis.window = { DICE_PUBLIC_ROOMS_API: "" };
globalThis.localStorage = { getItem() { return null; }, setItem() {} };

await import("../public-rooms-ui.js");

test("fallback does not inject a duplicate panel into the integrated game", () => {
  assert.equal(insertions, 0);
});
