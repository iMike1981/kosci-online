import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workerDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(workerDir, "..");
const outputDir = path.resolve(process.argv[2] || path.join(repoRoot, "preview"));
const testApi = "https://dice-online-public-rooms-test.janowicz-michal.workers.dev";
const testBanner = '<div id="dice-test-preview-banner" role="status" style="position:sticky;top:0;z-index:99999;padding:8px 12px;background:#8b1d1d;color:#fff;text-align:center;font:700 14px system-ui">TEST PREVIEW — NOT PRODUCTION</div>';

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });
for (const entry of fs.readdirSync(repoRoot, { withFileTypes: true })) {
  if (!entry.isFile() || entry.name.startsWith(".") || entry.name === "THIRD-PARTY.md" || entry.name === "LICENSES") continue;
  fs.copyFileSync(path.join(repoRoot, entry.name), path.join(outputDir, entry.name));
}
const indexPath = path.join(outputDir, "index.html");
let html = fs.readFileSync(indexPath, "utf8");
const bootstrap = '<script>localStorage.setItem("dicePublicRoomsApi",' + JSON.stringify(testApi) + ');</script>';
if (!/<\/head>/i.test(html) || !/<body\b[^>]*>/i.test(html)) throw new Error("Preview HTML is missing head/body tags");
html = html.replace(/<\/head>/i, bootstrap + "</head>").replace(/<body\b[^>]*>/i, match => match + testBanner);
fs.writeFileSync(indexPath, html);
console.log("Prepared isolated test preview at " + outputDir);
