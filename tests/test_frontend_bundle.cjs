const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");

const panel = fs.readFileSync("custom_components/starline_telemetry/panel.py", "utf8");
const manifest = JSON.parse(fs.readFileSync("custom_components/starline_telemetry/frontend/panel_manifest.json", "utf8"));
const bundle = fs.readFileSync("custom_components/starline_telemetry/frontend/starline-app.js", "utf8");
const source = fs.readFileSync("custom_components/starline_telemetry/frontend/starline-app-v016.js", "utf8");
const visualSource = fs.readFileSync("custom_components/starline_telemetry/frontend/starline-app-v017.js", "utf8");
const sceneSource = fs.readFileSync("custom_components/starline_telemetry/frontend/starline-app-v018.js", "utf8");
const splitSource = fs.readFileSync("custom_components/starline_telemetry/frontend/starline-app-v019.js", "utf8");
const stateSceneSource = fs.readFileSync("custom_components/starline_telemetry/frontend/starline-app-v020.js", "utf8");
const securityGeometrySource = fs.readFileSync("custom_components/starline_telemetry/frontend/starline-app-v021.js", "utf8");
const armedHeightSource = fs.readFileSync("custom_components/starline_telemetry/frontend/starline-app-v022.js", "utf8");

assert.equal(manifest.entry_module, "starline-app.js");
assert.equal(manifest.web_component, "starline-app-panel");
assert.equal(manifest.version, "0.5.7");
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
assert.deepEqual(manifest.summary.operational_order, [
  "engine_running",
  "last_event",
  "parking",
]);
assert.equal(manifest.summary.vehicle_switcher, "fixed_two_page_selector");
assert.equal(manifest.summary.vehicle_cards, "selected_one_per_page");
assert.deepEqual(manifest.summary.vehicle_page_order, ["130-й", "683-й"]);
assert.equal(manifest.summary.last_event_width, "expanded_from_parking_column");
assert.equal(manifest.summary.connection_position, "left_free_scene");
assert.equal(manifest.summary.scene_height, "fills_available_summary_viewport");
assert.deepEqual(manifest.summary.security_states, {
  armed: "Охрана / Включена",
  disarmed: "Охрана / Снята",
  alarm: "Охрана / Тревога",
  unknown: "Охрана / Нет данных",
});
assert.deepEqual(manifest.summary.state_scene_image_priority, [
  "hood_open",
  "trunk_open",
  "doors_open",
  "engine_running",
  "default",
]);
assert.deepEqual(manifest.summary.armed_source_priority, ["lock", "armed", "security", "arm", "guard"]);
assert.equal(manifest.summary.security_conflict_policy, "any_explicit_armed_source_wins");
assert.deepEqual(manifest.summary.vehicle_geometry, {
  130: { width_percent: 76, right_percent: -3, bottom_px: 126 },
  683: { width_percent: 73, right_percent: -1, bottom_px: 122 },
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

assert.match(visualSource, /if \(this\._view === "status"\) return;/);
assert.match(visualSource, /super\._installFixedVehicleSwitcher\(\)/);
assert.match(visualSource, /grid-template-columns:minmax\(92px,1fr\) minmax\(0,1\.55fr\) minmax\(80px,\.65fr\)/);
assert.match(visualSource, /\.operational-row > \.event-state \{[\s\S]*order:2;[\s\S]*border-right:1px solid var\(--border\)/);
assert.match(visualSource, /\.operational-row > \.summary-state:nth-child\(2\) \{[\s\S]*order:3;[\s\S]*border-right:0/);
assert.doesNotMatch(visualSource, /font-size:/, "visual layout pass must preserve typography floors");
assert.match(bundle, /starline-app-panel-v017/);

assert.match(sceneSource, /const text = locked === null \? "Нет данных" : locked \? "Включена" : "Снята"/);
assert.match(sceneSource, /class="summary-security \$\{tone\}"/);
assert.match(sceneSource, /\.summary-connection \{[\s\S]*left:8px !important;[\s\S]*right:auto !important/);
assert.match(sceneSource, /_summarySceneGrowth\(viewportHeight, canvasHeight, sceneCount\)/);
assert.match(sceneSource, /\.dual-summary > \.target-card > \.target-hero/);
assert.match(sceneSource, /new ResizeObserver\(\(\) => this\._fitSummaryScenes\(\)\)/);
assert.match(sceneSource, /\.summary-security\.armed[\s\S]*#e7f5ff/);
assert.match(sceneSource, /\.summary-security\.alarm[\s\S]*var\(--danger\)/);
assert.doesNotMatch(sceneSource, /font-size:/, "scene pass must preserve typography floors");
assert.doesNotMatch(sceneSource, /_eventsFromHistory|_starLineEvents|panel\/history/, "scene pass must not change history or statistics");
assert.match(bundle, /starline-app-panel-v018/);

assert.match(splitSource, /SWITCHER_COMPONENT\.prototype\._installFixedVehicleSwitcher\.call\(this\)/);
assert.match(splitSource, /class="dual-summary single-summary"/);
assert.match(splitSource, /this\._vehicleSummaryCard\(selected\)/);
assert.doesNotMatch(splitSource, /_eventsFromHistory|_starLineEvents|panel\/history/, "split-page pass must not change history or statistics");
assert.match(bundle, /starline-app-panel-v019/);

assert.match(stateSceneSource, /const image = hood === true[\s\S]*trunk === true[\s\S]*door === true[\s\S]*engine === true/);
assert.match(stateSceneSource, /const field = alarm === true \? "alarm" : armed === true \? "armed" : "none"/);
assert.match(stateSceneSource, /starline-car-\$\{id\}-\$\{state\}-v1\.webp/);
assert.match(stateSceneSource, /<div class="vehicle-state-field \$\{state\.field\}"/);
assert.match(stateSceneSource, /<strong>Нет данных<\/strong>/);
assert.match(stateSceneSource, /.vehicle-state-field\.armed[\s\S]*\.vehicle-state-field\.alarm/);
assert.doesNotMatch(stateSceneSource, /animation:/, "alarm and security fields must remain static");
assert.doesNotMatch(stateSceneSource, /_eventsFromHistory|_starLineEvents|panel\/history/, "state-scene pass must not change history or statistics");
assert.match(bundle, /starline-app-panel-v020/);

assert.match(securityGeometrySource, /\["armed", "security", "arm", "guard"\]/);
assert.doesNotMatch(securityGeometrySource, /\["lock", "armed"/);
assert.match(securityGeometrySource, /const field = state\.alarm === true \? "alarm" : armed === true \? "armed" : "none"/);
assert.match(securityGeometrySource, /starline-car-130-[^}]*\{[\s\S]*width:76% !important/);
assert.match(securityGeometrySource, /starline-car-683-[^}]*\{[\s\S]*width:73% !important/);
assert.match(securityGeometrySource, /bottom:38px !important/);
assert.doesNotMatch(securityGeometrySource, /font-size:/, "security and geometry pass must preserve typography floors");
assert.doesNotMatch(securityGeometrySource, /_eventsFromHistory|_starLineEvents|panel\/history/, "security and geometry pass must not change history or statistics");
assert.match(bundle, /starline-app-panel-v021/);

assert.match(armedHeightSource, /\["lock", "armed", "security", "arm", "guard"\]/);
assert.match(armedHeightSource, /if \(values\.includes\(true\)\) return true/);
assert.match(armedHeightSource, /starline-car-130-[^}]*\{[\s\S]*bottom:126px !important/);
assert.match(armedHeightSource, /starline-car-683-[^}]*\{[\s\S]*bottom:122px !important/);
assert.match(armedHeightSource, /\.vehicle-state-field \{[\s\S]*bottom:96px !important;[\s\S]*width:79% !important/);
assert.doesNotMatch(armedHeightSource, /font-size:/, "armed-state correction must preserve typography floors");
assert.doesNotMatch(armedHeightSource, /_eventsFromHistory|_starLineEvents|panel\/history/, "armed-state correction must not change history or statistics");
assert.match(bundle, /starline-app-panel-v022/);

for (const id of ["130", "683"]) {
  for (const state of ["engine", "door-open", "hood-open", "trunk-open"]) {
    const asset = `custom_components/starline_telemetry/frontend/assets/starline-car-${id}-${state}-v1.webp`;
    assert.ok(fs.existsSync(asset), `${asset} must be packaged`);
    assert.ok(fs.statSync(asset).size > 50_000, `${asset} must contain a production image`);
    assert.ok(fs.statSync(asset).size < 250_000, `${asset} must stay mobile-sized`);
  }
}

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
global.Image = class Image {
  set src(value) { this._src = value; }
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

instance._mobileOnly = () => true;
instance._vehicle = () => ({ device_id: "130", name: "130-й" });
instance._vehicleSummaryCard = (item) => `<article>${item.device_id}</article>`;
assert.equal(
  instance._statusView(null),
  '<div class="dual-summary single-summary"><article>130</article></div>',
  "Summary must render only the selected vehicle page",
);

assert.equal(instance._summarySceneGrowth(720, 660, 2), 30);
assert.equal(instance._summarySceneGrowth(720, 660, 1), 60);
assert.equal(instance._summarySceneGrowth(620, 660, 2), 0);
assert.equal(instance._summarySceneGrowth(720, 660, 0), 0);

const originalEntity = instance._entity;
const originalIsLocked = instance._isLocked;
const originalIsOn = instance._isOn;
instance._entity = (_vehicle, keys) => (keys.includes("armed") ? { state: { state: "on" } } : null);
instance._isLocked = () => true;
assert.match(instance._summarySecurity({}), /summary-security ok armed/);
assert.match(instance._summarySecurity({}), /mdi:shield-lock/);
assert.match(instance._summarySecurity({}), /<strong>Включена<\/strong>/);
instance._isLocked = () => false;
assert.match(instance._summarySecurity({}), /summary-security warn disarmed/);
assert.match(instance._summarySecurity({}), /<strong>Снята<\/strong>/);
instance._entity = (_vehicle, keys) => {
  if (keys.includes("alarm")) return { state: { state: "on" } };
  if (keys.includes("armed")) return { state: { state: "on" } };
  return null;
};
instance._isOn = () => true;
instance._isLocked = () => true;
assert.match(instance._summarySecurity({}), /summary-security danger alarm/);
assert.match(instance._summarySecurity({}), /mdi:shield-alert/);
assert.match(instance._summarySecurity({}), /<strong>Тревога<\/strong>/);
instance._entity = () => null;
instance._isOn = originalIsOn;
instance._isLocked = originalIsLocked;
assert.match(instance._summarySecurity({}), /summary-security muted unknown/);
assert.match(instance._summarySecurity({}), /<strong>Нет данных<\/strong>/);
instance._entity = originalEntity;
instance._isLocked = originalIsLocked;
instance._isOn = originalIsOn;

const originalSceneEntity = instance._sceneEntity;
const originalOnline = instance._online;
instance._sceneEntity = (_vehicle, keys) => ({ key: keys[0], state: { state: "on" } });
instance._isOn = (entity) => ["alarm", "hood", "trunk", "door", "engine_running"].includes(entity?.key);
instance._isLocked = () => true;
instance._online = () => true;
assert.deepEqual(instance._sceneState({}).image, "hood-open", "hood must have the highest image priority");
assert.deepEqual(instance._sceneState({}).field, "alarm", "alarm field must override armed field");
instance._isOn = (entity) => ["trunk", "door", "engine_running"].includes(entity?.key);
assert.equal(instance._sceneState({}).image, "trunk-open");
instance._isOn = (entity) => ["door", "engine_running"].includes(entity?.key);
assert.equal(instance._sceneState({}).image, "door-open");
instance._isOn = (entity) => entity?.key === "engine_running";
assert.equal(instance._sceneState({}).image, "engine");
instance._sceneEntity = originalSceneEntity;
instance._online = originalOnline;
instance._isLocked = originalIsLocked;
instance._isOn = originalIsOn;
const originalHass = instance._hass;
instance._hass = {
  states: {
    "lock.starline_security": { state: "locked" },
    "binary_sensor.armed": { state: "off" },
  },
};
assert.equal(
  instance._sceneState({ entities: { lock: "lock.starline_security", armed: "binary_sensor.armed" } }).armed,
  true,
  "an official locked StarLine security source must override a conflicting inactive source",
);
instance._hass = {
  states: {
    "lock.starline_security": { state: "unlocked" },
    "binary_sensor.armed": { state: "off" },
  },
};
assert.equal(
  instance._sceneState({ entities: { lock: "lock.starline_security", armed: "binary_sensor.armed" } }).armed,
  false,
  "protection is removed only when every explicit security source is inactive",
);
instance._hass = { states: { "binary_sensor.arm_state": { state: "on" } } };
assert.equal(
  instance._sceneState({ entities: { arm_state: "binary_sensor.arm_state" } }).armed,
  true,
  "arm-state aliases must drive the security field",
);
instance._hass = originalHass;

let fixedSwitcherQueries = 0;
instance.shadowRoot = {
  querySelector() {
    fixedSwitcherQueries += 1;
    return null;
  },
};
instance._orderedVehicles = () => [];
instance._view = "status";
instance._installFixedVehicleSwitcher();
assert.equal(fixedSwitcherQueries, 1, "Summary must install the two-page vehicle selector");
instance._view = "history";
instance._installFixedVehicleSwitcher();
assert.equal(fixedSwitcherQueries, 2, "single-vehicle views must retain the vehicle switcher path");

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
