const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

let Panel;
vm.runInNewContext(fs.readFileSync("custom_components/starline_telemetry/frontend/starline-panel-source.js", "utf8"), {
  HTMLElement: class {},
  document: { visibilityState: "visible" },
  customElements: { get() {}, define(_name, value) { Panel = value; } },
});

const panel = Object.create(Panel.prototype);
const fuel = "sensor.murano_fuel";
const door = "binary_sensor.murano_doors";
const ignition = "binary_sensor.murano_ignition";
const vehicle = {
  name: "Murano 130",
  entities: { fuel, door, ignition },
  fuel_calibration: { status: "ready", factor: 1.75, entity_id: fuel, unit: "%" },
};
const timestamp = new Date().toISOString();
const state = (value, unit, reported = timestamp) => ({
  state: value, last_reported: reported, attributes: { unit_of_measurement: unit },
});
panel._hass = { states: { [fuel]: state("40", "%"), [door]: state("off"), [ignition]: state("on") } };

assert.equal(typeof panel._fuelMetric, "function", "overview should resolve calibrated fuel");
assert.equal(panel._fuelMetric(vehicle).value, "70 %");
assert.equal(panel._fuelMetric(vehicle).label, "Топливо · оценка");
panel._hass.states[fuel] = state("60", "%");
assert.equal(panel._fuelMetric(vehicle).value, "100 %");
panel._hass.states[fuel] = state("40", "L");
assert.equal(panel._fuelMetric(vehicle).value, "40 L");
assert.equal(panel._fuelMetric(vehicle).label, "Топливо");
panel._hass.states[fuel] = state("40", "%", "2020-01-01T00:00:00Z");
assert.equal(panel._fuelMetric(vehicle).value, "40 %", "outdated readings must stay uncorrected");
assert.equal(panel._fuelMetric(vehicle).quality, "stale");
panel._hass.states[fuel] = state("unavailable", "%");
assert.equal(panel._fuelMetric(vehicle).value, "Нет данных");
panel._hass.states[fuel] = state("40", "%");
assert.equal(panel._fuelMetric({ ...vehicle, fuel_calibration: { ...vehicle.fuel_calibration, entity_id: "sensor.other" } }).value, "40 %");
assert.equal(panel._engineMetric(vehicle).value, "Нет данных", "ignition alone must not mean engine running");
assert.equal(panel._perimeterLabel([
  { label: "Двери", tone: "ok" }, { label: "Капот", tone: "muted" }, { label: "Багажник", tone: "ok" },
]), "Нет данных: капот");
assert.equal(panel._perimeterLabel([
  { label: "Двери", tone: "warn" }, { label: "Капот", tone: "muted" }, { label: "Багажник", tone: "ok" },
]), "Открыто: двери · Нет данных: капот");
console.log("StarLine fuel, engine and perimeter behavior passed");

const running = "binary_sensor.murano_running";
const engineVehicle = { entities: { engine_running: running } };
panel._hass.states[running] = state("on");
assert.equal(panel._engineMetric(engineVehicle).value, "Работает");
panel._hass.states[running] = state("off", undefined, "2020-01-01T00:00:00Z");
assert.equal(panel._engineMetric(engineVehicle).value, "Устарело");
assert.equal(panel._perimeterLabel([{ label: "Двери", tone: "stale" }]), "Данные устарели: двери");
panel._hass.connected = false;
assert.equal(panel._engineMetric(engineVehicle).value, "Нет данных");
panel._hass.connected = true;
panel._hass.states[fuel] = state("40", "%", "2020-01-01T00:00:00Z");
panel._reports = { [fuel]: { value: "40", reported_at: timestamp } };
assert.equal(panel._fuelMetric(vehicle).value, "70 %", "server-side unchanged-state report keeps a matching value fresh");
panel._reports[fuel].value = "41";
assert.equal(panel._fuelMetric(vehicle).quality, "stale", "a report for a different value must not refresh cached telemetry");

(async () => {
  const calibrated = { ...vehicle, device_id: "130" };
  const other = { name: "Murano 683", device_id: "683", entities: {} };
  panel._bootstrap = { vehicles: [calibrated, other] };
  panel._queuePatch = () => {};
  panel._fuelSaving = new Set();
  panel._fuelRevision = 0;
  panel._hass.callWS = async ({ type }) => {
    assert.equal(type, "starline_telemetry/panel/report_times");
    return { reports: {}, calibrations: { 130: { status: "inconsistent" } } };
  };
  await panel._loadReportTimes();
  assert.equal(calibrated.fuel_calibration.status, "inconsistent", "a calibration change saved in another panel must be applied");
  assert.equal(other.fuel_calibration, null);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

const coreEngine = "switch.murano_engine";
const coreIgnition = "binary_sensor.murano_ignition";
const coreVehicle = {
  entities: { ign: coreEngine, run: coreIgnition },
  sources: { ign: "core_starline", run: "core_starline" },
};
panel._hass.states[coreEngine] = state("off");
panel._hass.states[coreIgnition] = state("on");
assert.equal(panel._engineMetric(coreVehicle).value, "Остановлен", "core run is ignition, while core switch ign is the engine");
assert.equal(panel._ignitionMetric(coreVehicle).value, "Включено");
panel._hass.states[coreEngine] = state("on");
panel._hass.states[coreIgnition] = state("off");
assert.equal(panel._engineMetric(coreVehicle).value, "Работает");
assert.equal(panel._ignitionMetric(coreVehicle).value, "Выключено");
