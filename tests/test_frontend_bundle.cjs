const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");

const panel = fs.readFileSync("custom_components/starline_telemetry/panel.py", "utf8");
const constants = fs.readFileSync("custom_components/starline_telemetry/const.py", "utf8");
const integration = JSON.parse(fs.readFileSync("custom_components/starline_telemetry/manifest.json", "utf8"));
const manifest = JSON.parse(fs.readFileSync("custom_components/starline_telemetry/frontend/panel_manifest.json", "utf8"));
const source = fs.readFileSync("custom_components/starline_telemetry/frontend/starline-panel-source.js", "utf8");
const standard = JSON.parse(fs.readFileSync(".nikas-ui-standard.json", "utf8"));
const contract = fs.readFileSync("contracts/starline_ui_contract.yaml", "utf8");
const bundle = fs.readFileSync("custom_components/starline_telemetry/frontend/starline-app.js", "utf8");
const builder = fs.readFileSync("scripts/build_frontend_bundle.py", "utf8");

const version = source.match(/^const UI_VERSION = "([^"]+)";/m)?.[1];
assert.match(version, /^\d+\.\d+\.\d+(?:-beta\d{3})?$/);
assert.equal(integration.version, version);
assert.equal(manifest.version, version);
assert.equal(standard.ui_version, version.split("-")[0]);
assert.equal(contract.match(/^version: "?([^"\r\n]+)"?$/m)?.[1], version);
assert.equal(bundle.match(/^const UI_VERSION = "([^"]+)";/m)?.[1], version);
assert.equal(manifest.ui_standard, "2.2");
assert.equal(manifest.entry_module, "starline-app.js");
assert.equal(manifest.web_component, "starline-app-panel");
assert.equal(manifest.runtime_architecture, "single_stable_component_point_patching");
assert.equal(manifest.shell.header.top_safe_area, "env(safe-area-inset-top)");
assert.equal(constants.match(/^PANEL_VERSION = "([^"]+)"/m)?.[1], version);
assert.equal(manifest.summary.metric_tile_layout, "bold_centered_label_above_centered_icon_value_row");
assert.equal(manifest.summary.metric_label_weight, 750);
assert.equal(manifest.summary.metric_reading_alignment, "icon_and_value_same_line_centered");
assert.match(constants, /PANEL_PARENT_ROUTE = "\/home\/overview"/);
assert.match(panel, /starline-app\.js\?v=\{PANEL_VERSION\}/);
assert.match(panel, /read_only.*True/);

assert.doesNotMatch(bundle, /^import\s+/m);
assert.equal(bundle.split("const UI_VERSION").length - 1, 1);
assert.match(bundle, /customElements\.define\("starline-app-panel"/);
assert.match(builder, /SOURCE = FRONTEND \/ "starline-panel-source\.js"/);
assert.doesNotMatch(builder, /starline-app-v0\d+/);
assert.doesNotMatch(source, /extends\s+customElements\.get/);

assert.match(source, /grid-template-rows:calc\(60px \+ env\(safe-area-inset-top,0px\)\) 52px minmax\(0,1fr\) calc\(64px \+ env\(safe-area-inset-bottom,0px\)\)/);
assert.match(source, /grid-template-columns:52px minmax\(0,1fr\) 52px/);
assert.match(source, /\.app-header\{[^}]*height:100%/);
assert.match(source, /padding:env\(safe-area-inset-top,0px\)/);
assert.match(source, /width:44px;height:44px/);
assert.match(source, /--mdc-icon-size:25px/);
assert.match(source, /title-button strong\{font-size:23px/);
assert.match(source, /title-button span\{[^}]*font-size:14px/);
assert.match(source, /UI v\$\{UI_VERSION\}/);
assert.match(source, /bottom-nav ha-icon\{--mdc-icon-size:26px/);
assert.match(source, /bottom-nav span\{[^}]*font-size:12px/);
assert.match(source, /vehicle-selector.*role="tablist"/s);
assert.match(source, /\.vehicle-selector\{[^}]*height:52px/);
assert.match(source, /\.bottom-nav button\{[^}]*height:52px/);
assert.match(source, /createNikasShellScrollBoundaryGuard/);
assert.match(source, /touchmove", moveTouch, \{ passive: false, capture: true \}/);
assert.match(source, /this\._scrollBoundaryCleanup\?\.\(\)/);

require("./test_title_parent.cjs");
assert.match(source, /const SAFE_DEFAULT_ROUTE = "\/home\/overview"/);
assert.doesNotMatch(source, /["']\/dashboard-house["']/);
assert.match(source, /history\.pushState/);
assert.match(source, /location-changed/);
assert.doesNotMatch(source, /history\.back\s*\(/);

assert.match(source, /translate3d\(\$\{x\}px,\$\{y\}px,0\) scale\(\$\{scale\}\)/);
assert.match(source, /if \(scale <= 1\) return \{ scale, x: 0, y: 0 \}/);
assert.match(source, /overflow-y:auto;overflow-x:hidden/);
assert.match(source, /touch-action:pan-y/);
assert.match(source, /viewport\.zoom-enlarged\{overflow:hidden;touch-action:none/);
assert.match(source, /clamp\(finite\(next\.scale, 1\), 0\.75, 2\)/);
assert.match(source, /scale >= 0\.97 && scale <= 1\.03/);
assert.match(source, /lastTwoFingerTap/);
assert.match(source, /Масштаб 100%/);
assert.doesNotMatch(source, /\bzoom\s*:/);

assert.equal(source.split("this.shadowRoot.innerHTML =").length - 1, 1);
assert.match(source, /requestAnimationFrame\(\(\) =>/);
assert.match(source, /this\._viewPanes = new Map\(\)/);
assert.match(source, /if \(this\._viewPanes\.has\(view\)\)/);
assert.match(source, /this\._maps = new Map\(\)/);
assert.match(source, /this\._maps\.has\(id\)/);

assert.deepEqual(manifest.summary.vehicle_order, ["130", "683"]);
assert.equal(manifest.summary.vehicle_cards, "simultaneous_overview");
assert.deepEqual(manifest.shell.peer_selector.visible_on, ["history", "trips", "diagnostics"]);
assert.equal(manifest.summary.security_conflict_policy, "first_reliable_home_assistant_source_wins");
assert.match(source, /SECURITY_BOOTSTRAP_MAX_AGE_MS = 60_000/);
assert.match(source, /entityCandidates\.length/);
assert.match(source, /if \(alarm === true\) return \{ key: "alarm"/);
assert.match(source, /canvas\{width:100%;height:100%;min-height:100%/);
assert.match(source, /metric\{[^}]*grid-template-rows:auto auto[^}]*text-align:center/);
assert.match(source, /metric>span\{[^}]*font-weight:750[^}]*text-align:center/);
assert.match(source, /metric-reading\{[^}]*display:flex[^}]*align-items:center[^}]*justify-content:center/);
assert.match(source, /class="metric"[^>]*><span><\/span><div class="metric-reading"><ha-icon><\/ha-icon><strong><\/strong><\/div><\/button>/);
assert.match(source, /_patchMetric\(node, spec\)[\s\S]*?this\._setIcon\(node, "ha-icon", spec\.icon\)[\s\S]*?this\._setText\(node, "span", spec\.label\)[\s\S]*?this\._setText\(node, "strong", spec\.value\)/);
assert.doesNotMatch(source, /metric\{[^}]*grid-template-columns:22px/);

assert.match(source, /starline_telemetry\/panel\/history/);
assert.match(source, /Журнал StarLine · исходное время события/);
assert.match(source, /Резерв HA Recorder · время обнаружения Home Assistant/);
assert.match(source, /significant_changes_only: "1"/);
assert.match(source, /item\?\.state \?\? item\?\.s/);
assert.match(source, /crossedUnavailableGap/);
assert.match(source, /raw < 1e12 \? raw \* 1000 : raw/);
assert.match(source, /WRITABLE_DOMAINS\.has\(domainOf\(entityId\)\)/);
assert.doesNotMatch(source, /callService\s*\(/);

assert.match(source, /history-row time\{[^}]*font-size:16px/);
assert.match(source, /history-row strong\{font-size:18px/);

const registry = new Map();
class HTMLElementShim {}
const context = {
  customElements: { get: (name) => registry.get(name), define: (name, value) => registry.set(name, value) },
  HTMLElement: HTMLElementShim,
  location: { origin: "https://ha.local", pathname: "/starline", search: "", hash: "" },
  history: { pushState() {}, replaceState() {} },
  window: { location: { origin: "https://ha.local", pathname: "/starline", search: "", hash: "" }, dispatchEvent() {}, addEventListener() {}, removeEventListener() {} },
  document: { referrer: "" },
  sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  localStorage: { getItem() { return null; }, setItem() {} },
  URL, URLSearchParams, Event: class {}, CustomEvent: class {},
  ResizeObserver: class { observe() {} },
  requestAnimationFrame(callback) { callback(); }, performance: { now: () => 0 },
  setTimeout, clearTimeout, Intl, Date, Map, Set, Math, Number, String,
  CSS: { escape: (value) => String(value) },
};
vm.runInNewContext(source, context, { filename: "starline-panel-source.js" });
assert.ok(registry.has("starline-app-panel"));

const Panel = registry.get("starline-app-panel");
const runtime = Object.create(Panel.prototype);
runtime._hass = { states: {} };
assert.equal(runtime._isOn({ state: { state: "unknown" } }), null);
assert.equal(runtime._isOn({ state: { state: "unexpected" } }), null);
const armedEntityId = "binary_sensor.starline_armed";
const report = (state, timestamp = new Date().toISOString()) => ({ state, last_reported: timestamp });
const oldBootstrap = {
  entities: { armed: armedEntityId },
  live_security: {
    arm: true,
    fetched_at: new Date(Date.now() - 86_400_000).toISOString(),
  },
};
runtime._hass.states[armedEntityId] = report("on");
assert.equal(runtime._security(oldBootstrap, true).key, "armed");
runtime._hass.states[armedEntityId] = report("off");
assert.equal(runtime._security(oldBootstrap, true).key, "disarmed", "current HA disarm must outrank old bootstrap arm=true");
runtime._hass.states[armedEntityId] = report("off", oldBootstrap.live_security.fetched_at);
assert.equal(runtime._security(oldBootstrap, true).label, "Устарело", "stale disarm must not be displayed as current");
runtime._hass.states[armedEntityId] = report("unavailable");
assert.equal(runtime._security(oldBootstrap, true).key, "unknown", "unavailable HA security must not fall back to old bootstrap arm=true");
runtime._hass.states[armedEntityId] = report("on");
runtime._hass.connected = false;
assert.equal(runtime._security(oldBootstrap, true).key, "unknown", "lost HA connectivity must invalidate security");
runtime._hass.connected = true;
assert.equal(runtime._security(oldBootstrap, true).key, "armed", "recovered HA security must become authoritative again");
runtime._hass.states = {
  "lock.starline_security": report("unlocked"),
  [armedEntityId]: report("on"),
};
assert.equal(runtime._security({
  entities: { lock: "lock.starline_security", armed: armedEntityId },
  live_security: { arm: true, fetched_at: new Date().toISOString() },
}, true).key, "disarmed", "the first reliable HA source must win a conflict deterministically");
assert.equal(runtime._security({
  entities: {},
  live_security: { arm: true, fetched_at: new Date().toISOString() },
}, true).key, "armed", "a fresh bootstrap may provide the initial security state");
assert.equal(runtime._security({
  entities: {},
  live_security: { arm: true, fetched_at: new Date(Date.now() - 86_400_000).toISOString() },
}, true).key, "unknown", "an expired bootstrap must not remain an armed authority");
const carImages = manifest.summary.vehicle_order.map((id) => {
  const pane = {};
  runtime._mountSummary(pane, { name: `Murano ${id}`, entities: {} });
  const img = pane.innerHTML.match(/<img\b[^>]*class="summary-car"[^>]*>/)?.[0] || "";
  const src = img.match(/\bsrc="([^"]+)"/)?.[1];
  assert.ok(src, `Murano ${id} has a dedicated local image`);
  const url = new URL(src, "https://ha.local");
  assert.equal(url.origin, "https://ha.local");
  assert.equal(url.searchParams.get("v"), version);
  assert.ok(manifest.assets.includes(`assets/${url.pathname.split("/").at(-1)}`));
  return { src, width: img.match(/\bwidth="(\d+)"/)?.[1], height: img.match(/\bheight="(\d+)"/)?.[1] };
});
assert.notEqual(carImages[0].src, carImages[1].src);
assert.ok(Number(carImages[0].width) > 0 && Number(carImages[0].height) > 0);
assert.equal(carImages[0].width, carImages[1].width);
assert.equal(carImages[0].height, carImages[1].height);
runtime._hass.states = {};
const recorderEvents = runtime._eventsFromRecorder(
  { entities: { door: "binary_sensor.starline_door" } },
  [[
    { entity_id: "binary_sensor.starline_door", s: "off", lu: 1_700_000_000 },
    { s: "off", lu: 1_700_000_030 },
    { s: "on", lu: 1_700_000_060 },
    { s: "unavailable", lu: 1_700_000_090 },
    { s: "off", lu: 1_700_000_120 },
  ]],
);
assert.equal(recorderEvents.length, 1, "same-state polls and unavailable recovery must be omitted");
assert.equal(recorderEvents[0].label, "Двери открыты");
assert.equal(recorderEvents[0].timestamp, 1_700_000_060_000);
const recorderPoints = runtime._pointsFromHistory("device_tracker.starline", [[
  { entity_id: "device_tracker.starline", a: { latitude: 56.8, longitude: 35.9 }, lu: 1_700_000_000 },
  { a: { latitude: 56.81, longitude: 35.91 }, lu: 1_700_000_060 },
]]);
assert.equal(recorderPoints.length, 2, "compact GPS records inherit the series entity id");
assert.equal(recorderPoints[1].timestamp, 1_700_000_060_000);

require("./test_telemetry_overview.cjs");

console.log("StarLine frontend bundle and security-quality checks passed");
