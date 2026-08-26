const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");

const panel = fs.readFileSync("custom_components/starline_telemetry/panel.py", "utf8");
const manifest = JSON.parse(fs.readFileSync("custom_components/starline_telemetry/frontend/panel_manifest.json", "utf8"));
const bundle = fs.readFileSync("custom_components/starline_telemetry/frontend/starline-app.js", "utf8");
const source = fs.readFileSync("custom_components/starline_telemetry/frontend/starline-app-v016.js", "utf8");

assert.equal(manifest.entry_module, "starline-app.js");
assert.equal(manifest.web_component, "starline-app-panel");
assert.equal(manifest.version, "0.5.1");
assert.equal(manifest.zoom.native_vertical_scroll_at_or_below_percent, 100);
assert.equal(manifest.zoom.one_finger_pan, "above_100_percent_on_overflowing_axes_only");
assert.deepEqual(manifest.typography.floors_px, {
  compact_label: 11,
  standard_secondary_text: 12,
  summary_value: 14,
  view_title: 21,
  history_date_and_time: 16,
  history_action: 18,
});
assert.match(panel, /starline-app\.js\?v=/);
assert.doesNotMatch(bundle, /^import\s+/m, "production bundle must have no runtime imports");
assert.match(bundle, /customElements\.define\("starline-app-panel"/);

assert.match(source, /if \(scale <= 1\) return \{ minX: 0, maxX: 0, minY: 0, maxY: 0 \}/);
assert.match(source, /type: enlarged \? "pan" : "native"/);
assert.match(source, /overflow-x:hidden/);
assert.match(source, /overflow-y:auto/);
assert.match(source, /touch-action:pan-y/);
assert.match(source, /#content\.zoom-enlarged[\s\S]*touch-action:none/);
assert.match(source, /MIN_SCALE = 0\.75/);
assert.match(source, /MAX_SCALE = 2/);
assert.match(source, /SNAP_MIN = 0\.97/);
assert.match(source, /SNAP_MAX = 1\.03/);
assert.match(bundle, /Масштаб 100%/);

assert.match(source, /grid-template-columns:52px minmax\(0,1fr\) 52px/);
assert.match(source, /width:44px/);
assert.match(source, /border-radius:16px/);
assert.match(source, /--mdc-icon-size:25px/);
assert.match(source, /\.nika-title strong \{[^}]*font-size:21px[^}]*font-weight:800/);
assert.match(source, /nav ha-icon \{ --mdc-icon-size:28px/);
assert.match(source, /nav span \{[^}]*font-size:12px[^}]*font-weight:700/);
assert.match(source, /11%,transparent/);

assert.match(source, /starline_telemetry\/panel\/history/);
assert.match(source, /significant_changes_only: "1"/);
assert.match(source, /Оригинальный журнал StarLine · точное время события/);
assert.match(source, /font-size:16px !important/);
assert.match(source, /font-size:18px !important/);
assert.match(source, /\.trip-times,[\s\S]*\.diag-state > span,[\s\S]*font-size:12px !important/);
assert.match(source, /\.telemetry-chip span,[\s\S]*\.m-event span \{ font-size:11px !important/);

process.env.TZ = "Europe/Moscow";
const registry = new Map();
global.location = { hash: "#status" };
global.window = {
  addEventListener() {},
  removeEventListener() {},
  setTimeout,
  clearTimeout,
};
global.localStorage = { getItem() { return null; }, setItem() {} };
global.CustomEvent = class CustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    Object.assign(this, options);
  }
};
global.ResizeObserver = class ResizeObserver {
  observe() {}
  disconnect() {}
};
global.HTMLElement = class HTMLElement {
  constructor() {
    this.isConnected = false;
  }
  attachShadow() {
    this.shadowRoot = {
      innerHTML: "",
      querySelector() { return null; },
      querySelectorAll() { return []; },
      getElementById() { return null; },
      append() {},
    };
    return this.shadowRoot;
  }
};
global.customElements = {
  define(name, value) { registry.set(name, value); },
  get(name) { return registry.get(name); },
  whenDefined() { return Promise.resolve(); },
};

vm.runInThisContext(bundle, { filename: "starline-app.js" });
const Panel = customElements.get("starline-app-panel");
assert.ok(Panel, "stable production component must be registered");
const instance = new Panel();

const iso = (hour, minute, second) => new Date(Date.UTC(2026, 7, 26, hour, minute, second)).toISOString();
const vehicle = {
  entities: {
    armed: "binary_sensor.armed",
    ignition: "binary_sensor.ignition",
  },
};
const recorderEvents = instance._eventsFromHistory(vehicle, [
  [
    { entity_id: "binary_sensor.armed", state: "off", last_changed: iso(8, 0, 0) },
    { entity_id: "binary_sensor.armed", state: "off", last_changed: iso(8, 1, 0) },
    { entity_id: "binary_sensor.armed", state: "on", last_changed: iso(8, 2, 0) },
    { entity_id: "binary_sensor.armed", state: "unavailable", last_changed: iso(8, 3, 0) },
    { entity_id: "binary_sensor.armed", state: "off", last_changed: iso(8, 4, 0) },
  ],
  [
    { entity_id: "binary_sensor.ignition", state: "on", last_changed: iso(8, 20, 0) },
    { entity_id: "binary_sensor.ignition", state: "off", last_changed: iso(8, 23, 28) },
  ],
]);
assert.deepEqual(
  recorderEvents.map((event) => event.label),
  ["Зажигание отключено", "Охрана включена"],
);

const sourceSeconds = Date.UTC(2026, 7, 26, 8, 23, 42) / 1000;
const officialEvents = instance._starLineEvents({
  events: [{
    timestamp: sourceSeconds,
    event_id: 401,
    group_id: 2,
    description: "Охрана включена (Штатный брелок)",
  }],
});
assert.equal(officialEvents[0].timestamp, sourceSeconds * 1000);
assert.equal(officialEvents[0].label, "Охрана включена (Штатный брелок)");
assert.match(instance._historyRow(officialEvents[0]), /11:23:42/);

const content = { clientWidth: 400, clientHeight: 600 };
const canvas = {
  scrollWidth: 400,
  offsetWidth: 400,
  scrollHeight: 1000,
  offsetHeight: 1000,
  offsetLeft: 0,
  offsetTop: 0,
};
assert.deepEqual(
  instance._clampCanvasState(content, canvas, { scale: 1, x: -80, y: -90 }),
  { scale: 1, x: 0, y: 0 },
);
assert.deepEqual(
  instance._clampCanvasState(content, canvas, { scale: 0.75, x: -80, y: -90 }),
  { scale: 0.75, x: 0, y: 0 },
);
assert.deepEqual(
  instance._clampCanvasState(content, canvas, { scale: 1.5, x: -999, y: -999 }),
  { scale: 1.5, x: -200, y: -900 },
);

console.log("StarLine autonomous frontend bundle and UI standard checks passed");
