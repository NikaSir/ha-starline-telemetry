const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");

const panel = fs.readFileSync("custom_components/starline_telemetry/panel.py", "utf8");
const constants = fs.readFileSync("custom_components/starline_telemetry/const.py", "utf8");
const integration = JSON.parse(fs.readFileSync("custom_components/starline_telemetry/manifest.json", "utf8"));
const manifest = JSON.parse(fs.readFileSync("custom_components/starline_telemetry/frontend/panel_manifest.json", "utf8"));
const source = fs.readFileSync("custom_components/starline_telemetry/frontend/starline-panel-source.js", "utf8");
const bundle = fs.readFileSync("custom_components/starline_telemetry/frontend/starline-app.js", "utf8");
const builder = fs.readFileSync("scripts/build_frontend_bundle.py", "utf8");

assert.equal(integration.version, "0.6.8");
assert.equal(manifest.version, "0.6.8");
assert.equal(manifest.ui_standard, "2.2");
assert.equal(manifest.entry_module, "starline-app.js");
assert.equal(manifest.web_component, "starline-app-panel");
assert.equal(manifest.runtime_architecture, "single_stable_component_point_patching");
assert.equal(manifest.shell.header.top_safe_area, "env(safe-area-inset-top)");
assert.match(constants, /PANEL_VERSION = "0\.6\.8-ui-standard-v2\.2"/);
assert.equal(manifest.summary.metric_tile_layout, "bold_centered_label_above_centered_icon_value_row");
assert.equal(manifest.summary.metric_label_weight, 750);
assert.equal(manifest.summary.metric_reading_alignment, "icon_and_value_same_line_centered");
assert.match(constants, /PANEL_PARENT_ROUTE = "\/dashboard-house-v13\/home"/);
assert.match(panel, /starline-app\.js\?v=/);
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

assert.match(source, /return_to/);
assert.match(source, /params\.get\("from"\)/);
assert.match(source, /nikas\.specialized\.source_route\.v1/);
assert.match(source, /\/dashboard-house-v13\/home/);
assert.match(source, /\/dashboard-rooms-v11\/rooms/);
assert.match(source, /\/dashboard-actions\/home/);
assert.match(source, /\/dashboard-infrastructure\/overview/);
assert.match(source, /nikas\.specialized\.source_route_at\.v1/);
assert.match(source, /handedOffRaw !== null/);
assert.match(source, /handedOffAtRaw !== null/);
assert.match(source, /handedOffAge >= 0/);
assert.match(source, /removeItem\(SOURCE_ROUTE_KEY\)/);
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
assert.match(source, /if \(car\.getAttribute\("src"\) !== scene\.src\)/);
assert.match(source, /this\._maps = new Map\(\)/);
assert.match(source, /this\._maps\.has\(id\)/);

assert.deepEqual(manifest.summary.vehicle_page_order, ["130-й", "683-й"]);
assert.deepEqual(manifest.summary.operational_order, ["engine_running", "last_event", "parking"]);
assert.deepEqual(manifest.summary.state_scene_image_priority, ["hood_open", "trunk_open", "doors_open", "engine_running", "default"]);
assert.equal(manifest.summary.security_conflict_policy, "any_explicit_armed_source_wins");
assert.equal(manifest.summary.security_field_geometry, "grounded_half_dome_open_at_wheel_line");
assert.match(source, /states\.hood \? "hood-open" : states\.trunk \? "trunk-open" : states\.door \? "door-open" : states\.engine \? "engine" : "default"/);
assert.match(source, /known\.includes\(true\) \? true : known\.includes\(false\)/);
assert.match(source, /if \(alarm === true\) return \{ key: "alarm"/);
assert.match(source, /security-field\.armed,.security-field\.alarm\{opacity:1\}/);
assert.match(source, /border-bottom-color:transparent/);
assert.equal(manifest.summary.vehicle_geometry.mode, "visual_landmark_frame");
assert.equal(manifest.summary.vehicle_geometry.visible_width_percent, 72);
assert.equal(manifest.summary.vehicle_geometry.proportion_reference_vehicle, "683");
assert.deepEqual(manifest.summary.vehicle_geometry.landmark_basis, ["wheel_line", "roofline", "front_bumper", "rear_bumper"]);
assert.deepEqual(manifest.summary.vehicle_geometry.landmark_height_scale, { "130": 1.04, "683": 1 });
assert.deepEqual(manifest.summary.vehicle_geometry.reference_visible_size_by_state, {
  default: [1824, 793],
  engine: [1866, 843],
  door_open: [1862, 840],
  hood_open: [1692, 825],
  trunk_open: [1599, 820],
});
assert.equal(manifest.summary.vehicle_geometry.horizontal, "visible_alpha_center");
assert.equal(manifest.summary.vehicle_geometry.wheel_line_bottom_px, 167);
assert.equal(manifest.summary.vehicle_geometry.narrow_wheel_line_bottom_px, 161);
assert.equal(manifest.summary.scene_height_source, "remaining_fixed_shell_grid_viewport");
assert.equal(manifest.summary.status_row_height_px, 74);
assert.equal(manifest.summary.status_value_lines, 2);
assert.deepEqual(manifest.summary.operational_columns_percent, [40, 38, 22]);
assert.equal(manifest.summary.operational_value_layout, "icon_with_aligned_label_and_value");
assert.equal(manifest.summary.engine_value_line, "single_line_no_clip");
assert.equal(manifest.summary.security_field_lower_edge, "open_and_faded");
assert.match(source, /const CAR_VISIBLE_WIDTH_PERCENT = 72/);
assert.match(source, /const CAR_REFERENCE_VISIBLE_SIZE = Object\.freeze/);
assert.match(source, /const CAR_LANDMARK_HEIGHT_SCALE = Object\.freeze\(\{ "130": 1\.04, "683": 1 \}\)/);
assert.doesNotMatch(source, /CAR_VISIBLE_HEIGHT_SCALE/);
assert.match(source, /const CAR_WHEEL_LINE_BOTTOM_PX = 167/);
assert.match(source, /summary-car-frame\{[^}]*bottom:\$\{CAR_WHEEL_LINE_BOTTOM_PX\}px[^}]*width:\$\{CAR_VISIBLE_WIDTH_PERCENT\}%/);
assert.match(source, /summary-car-frame\{bottom:161px\}/);
assert.match(source, /state-row\{height:74px/);
assert.match(source, /summary-card\{height:100%;min-height:588px/);
assert.match(source, /grid-template-rows:minmax\(440px,1fr\) 74px 74px/);
assert.match(source, /canvas\{width:100%;height:100%;min-height:100%/);
assert.doesNotMatch(source, /summary-hero\{[^}]*100dvh/);
assert.match(source, /mask-image:linear-gradient\(to bottom,#000 0 80%,transparent 100%\)/);
assert.match(source, /-webkit-line-clamp:2/);
assert.match(source, /metric strong\{[^}]*overflow:visible;text-overflow:clip/);
assert.match(source, /metric\{[^}]*grid-template-rows:auto auto[^}]*text-align:center/);
assert.match(source, /metric>span\{[^}]*font-weight:750[^}]*text-align:center/);
assert.match(source, /metric-reading\{[^}]*display:flex[^}]*align-items:center[^}]*justify-content:center/);
assert.match(source, /class="metric"[^>]*><span><\/span><div class="metric-reading"><ha-icon><\/ha-icon><strong><\/strong><\/div><\/button>/);
assert.match(source, /_patchMetric\(node, spec\)[\s\S]*?this\._setIcon\(node, "ha-icon", spec\.icon\)[\s\S]*?this\._setText\(node, "span", spec\.label\)[\s\S]*?this\._setText\(node, "strong", spec\.value\)/);
assert.doesNotMatch(source, /metric\{[^}]*grid-template-columns:22px/);
assert.match(source, /summary-car\{[^}]*height:var\(--car-image-height\)/);
assert.match(source, /operational-row\{grid-template-columns:minmax\(0,40fr\) minmax\(0,38fr\) minmax\(0,22fr\)\}/);
assert.match(source, /operational-row \.state span,.operational-row \.event span\{white-space:nowrap;overflow:visible;text-overflow:clip\}/);
assert.match(source, /operational-row \.engine strong,.operational-row \.brake strong\{display:block;white-space:nowrap;overflow:visible;-webkit-line-clamp:unset\}/);
assert.match(source, /class="state engine"[^>]*>[\s\S]*?<div><span>Двигатель<\/span><strong><\/strong><\/div>/);
assert.doesNotMatch(source, /summary-car\.id-(?:130|683)/);
assert.doesNotMatch(source, /open-state/);

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
assert.match(source, /state strong,.event strong\{[^}]*font-size:16px/);
assert.match(source, /@media\(max-width:390px\)[\s\S]*state strong,.event strong\{font-size:14px/);

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
const geometryStyle = new Map();
const geometryFrame = {
  dataset: {},
  style: { setProperty(name, value) { geometryStyle.set(name, value); } },
  classList: { add(name) { this.value = name; } },
};
runtime._applyCarGeometry(geometryFrame, [1774, 887, 48, 100, 1702, 785], [1824, 793], 1.04);
assert.equal(geometryStyle.get("--car-visible-aspect"), "1824 / 824.72");
assert.ok(Math.abs(parseFloat(geometryStyle.get("--car-image-width")) - 107.2551) < 0.001);
assert.ok(Math.abs(parseFloat(geometryStyle.get("--car-image-height")) - 129.4890) < 0.001);
assert.ok(Math.abs(parseFloat(geometryStyle.get("--car-image-left")) + 2.9021) < 0.001);
assert.ok(Math.abs(parseFloat(geometryStyle.get("--car-image-top")) + 14.5985) < 0.001);
assert.equal(geometryFrame.classList.value, "geometry-ready");
const scene130 = runtime._scene({ name: "130-й", entities: {} });
const scene683 = runtime._scene({ name: "683-й", entities: {} });
assert.deepEqual(scene130.geometry, [1774, 887, 48, 100, 1702, 785]);
assert.deepEqual(scene683.geometry, [1866, 843, 26, 19, 1850, 812]);
assert.deepEqual(scene130.referenceSize, [1824, 793]);
assert.deepEqual(scene683.referenceSize, [1824, 793]);
assert.equal(scene130.landmarkHeightScale, 1.04);
assert.equal(scene683.landmarkHeightScale, 1);
assert.ok((793 * scene130.landmarkHeightScale) / 793 >= 1.04, "130-й must receive a visible four-percent landmark correction");
const stateReferenceSize = {
  engine: [1866, 843],
  "door-open": [1862, 840],
  "hood-open": [1692, 825],
  "trunk-open": [1599, 820],
};
for (const name of ["130-й", "683-й"]) {
  for (const [role, expectedState] of [["engine_running", "engine"], ["door", "door-open"], ["hood", "hood-open"], ["trunk", "trunk-open"]]) {
    const entityId = `binary_sensor.${name.slice(0, 3)}_${role}`;
    runtime._hass.states = { [entityId]: { state: "on" } };
    const scene = runtime._scene({ name, entities: { [role]: entityId } });
    assert.equal(scene.state, expectedState);
    assert.equal(scene.geometry.length, 6);
    assert.deepEqual(scene.referenceSize, stateReferenceSize[expectedState]);
    assert.equal(scene.landmarkHeightScale, name === "130-й" ? 1.04 : 1);
    assert.ok(scene.geometry[4] > scene.geometry[2]);
    assert.ok(scene.geometry[5] > scene.geometry[3]);
  }
}
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

console.log("StarLine v0.6.8 centred live-metric plaque checks passed");
