const assert = require("node:assert");
const fs = require("node:fs");

const panel = fs.readFileSync("custom_components/starline_telemetry/panel.py", "utf8");
const manifest = JSON.parse(fs.readFileSync("custom_components/starline_telemetry/frontend/panel_manifest.json", "utf8"));
const bundle = fs.readFileSync("custom_components/starline_telemetry/frontend/starline-app.js", "utf8");
const source = fs.readFileSync("custom_components/starline_telemetry/frontend/starline-app-v015.js", "utf8");

assert.equal(manifest.entry_module, "starline-app.js");
assert.equal(manifest.web_component, "starline-app-panel");
assert.equal(manifest.version, "0.5.0");
assert.match(panel, /starline-app\.js\?v=/);
assert.doesNotMatch(bundle, /^import\s+/m, "production bundle must have no runtime imports");
assert.match(bundle, /customElements\.define\("starline-app-panel"/);

assert.match(source, /if \(scale <= 1\) return \{ minX: 0, maxX: 0, minY: 0, maxY: 0 \}/);
assert.match(source, /gesture\.startState\.scale > 1/);
assert.match(source, /overflow-x:hidden/);
assert.match(source, /overflow-y:auto/);
assert.match(source, /touch-action:pan-y/);
assert.match(source, /#content\.canvas-zoomed[\s\S]*touch-action:none/);
assert.match(source, /FINAL_MIN_SCALE = 0\.75/);
assert.match(source, /FINAL_MAX_SCALE = 2/);
assert.match(source, /FINAL_SNAP_MIN = 0\.97/);
assert.match(source, /FINAL_SNAP_MAX = 1\.03/);
assert.match(bundle, /Масштаб 100%/);

assert.match(source, /grid-template-columns:52px minmax\(0,1fr\) 52px/);
assert.match(source, /width:44px/);
assert.match(source, /border-radius:16px/);
assert.match(source, /--mdc-icon-size:25px/);
assert.match(source, /\.nika-title strong \{ font-size:21px[^}]*font-weight:800/);
assert.match(source, /nav ha-icon \{ --mdc-icon-size:28px/);
assert.match(source, /nav span \{ font-size:12px[^}]*font-weight:700/);
assert.match(source, /11%,transparent/);

console.log("StarLine autonomous frontend bundle and UI standard checks passed");
