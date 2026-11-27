import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../..");
const script = path.join(repoRoot, "public-rooms-worker", "prepare-preview.mjs");

test("test preview build copies the static game and injects an isolated test marker/API", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dice-preview-"));
  const out = path.join(tmp, "site");
  try {
    const run = spawnSync(process.execPath, [script, out], { cwd: repoRoot, encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr || run.stdout);
    const html = fs.readFileSync(path.join(out, "index.html"), "utf8");
    assert.match(html, /TEST PREVIEW — NOT PRODUCTION/);
    assert.match(html, /dice-online-public-rooms-test\.janowicz-michal\.workers\.dev/);
    assert.ok(fs.existsSync(path.join(out, "sw.js")), "service worker should be copied");
    assert.ok(fs.existsSync(path.join(out, "manifest.webmanifest")), "manifest should be copied");
    assert.ok(fs.existsSync(path.join(out, "flags.svg")), "flag asset should be copied");
    assert.ok(!fs.existsSync(path.join(out, "public-rooms-worker")), "backend source should not be included in static preview");
    const original = fs.readFileSync(path.join(repoRoot, "index.html"), "utf8");
    assert.doesNotMatch(original, /TEST PREVIEW — NOT PRODUCTION/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("preview builder refuses an output directory inside the source repository", () => {
  const run = spawnSync(process.execPath, [script, repoRoot], { cwd: repoRoot, encoding: "utf8" });
  assert.notEqual(run.status, 0, "the source tree must not be used as the build output");
  assert.match(run.stderr, /Preview output must be outside the repository/);
  assert.ok(fs.existsSync(path.join(repoRoot, "index.html")), "source index should remain intact");
});

test("test deployment workflow is manual, branch-gated and targets the test Worker config", () => {
  const workflow = fs.readFileSync(path.join(repoRoot, ".github/workflows/deploy-test-preview.yml"), "utf8");
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /refs\/heads\/feature\/public-rooms-cloudflare/);
  assert.match(workflow, /wrangler\.test\.toml/);
  assert.match(workflow, /dice-online-test/);
  assert.match(workflow, /Only the dice-online-test Pages preview origin is allowed/);
  assert.match(workflow, /--project-name dice-online-test/);
  assert.doesNotMatch(workflow, /wrangler deploy --config public-rooms-worker\/wrangler\.toml/);
  assert.match(workflow, /Smoke-test isolated preview and public-room API/);
  assert.match(workflow, /deployment-smoke\\.mjs/);
});
