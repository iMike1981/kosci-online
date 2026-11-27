import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const page = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const scripts = [...page.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(match => !/\bsrc\s*=/.test(match[1]) && !/\btype\s*=\s*["'](?:application\/(?:json|ld\+json))["']/i.test(match[1]))
  .map(match => match[2]);

test("all inline JavaScript blocks in the game page parse", () => {
  assert.ok(scripts.length > 0, "game page should contain inline JavaScript");
  scripts.forEach((source, index) => {
    assert.doesNotThrow(() => new vm.Script(source, { filename: `index.html inline script ${index}` }), `inline script ${index} should parse`);
  });
});
