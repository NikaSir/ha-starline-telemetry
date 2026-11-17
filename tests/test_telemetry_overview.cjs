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

const ignitionOnly = { entities: { run: coreIgnition }, sources: { run: "core_starline" } };
assert.equal(panel._overviewPower(ignitionOnly).primary.label, "Зажигание");
assert.equal(panel._overviewPower(ignitionOnly).primary.value, "Выключено");
assert.equal(panel._overviewPower(ignitionOnly).secondary.label, "Двигатель");
assert.equal(panel._overviewPower(ignitionOnly).secondary.value, "Нет данных");
assert.equal(panel._overviewPower(coreVehicle).primary.label, "Двигатель");
panel._hass.states[coreEngine] = state("unavailable");
assert.equal(panel._overviewPower(coreVehicle).primary.label, "Зажигание");
panel._hass.states[coreIgnition] = state("unavailable");
assert.equal(panel._overviewPower(coreVehicle).primary.value, "Нет данных");

const battery = "sensor.murano_battery";
vehicle.entities.battery = battery;
panel._hass.states[ignition] = state("off");
panel._hass.states[fuel] = state("29", "%");
assert.equal(panel._fuelMetric(vehicle).gauge.level, 51, "the strip follows the displayed estimate");
panel._hass.states[fuel] = state("0", "%");
assert.equal(panel._fuelMetric(vehicle).gauge.level, 0, "zero fuel is a valid reading");
panel._hass.states[fuel] = state("40", "L");
assert.equal(panel._fuelMetric(vehicle).gauge, null, "litres alone cannot fill a percentage scale");
panel._hass.states[fuel] = state("40", "%", "2020-01-01T00:00:00Z");
assert.equal(panel._fuelMetric(vehicle).gauge, null, "stale fuel must not show a live fill");

panel._hass.states[battery] = state("12.4", "V");
assert.equal(panel._batteryMetric(vehicle).value, "12,4 V");
assert.equal(panel._batteryMetric(vehicle).gauge.type, "voltage");
assert.equal(panel._batteryMetric(vehicle).gauge.level, 60);
panel._hass.states[battery] = state("12.6", "V");
assert.equal(panel._batteryMetric(vehicle).gauge.level, 80);
const ignitionOffAt = new Date(Date.parse(timestamp) - 60_000).toISOString();
panel._hass.states[ignition].last_changed = ignitionOffAt;
panel._hass.states[battery] = state("12.6", "V", new Date(Date.parse(timestamp) - 120_000).toISOString());
assert.equal(panel._batteryMetric(vehicle).gauge, null, "a reading from before ignition switched off cannot show as parked voltage");
panel._hass.states[battery] = state("12.6", "V");
assert.equal(panel._batteryMetric(vehicle).gauge.level, 80, "a new report after shutdown restores the marker");
vehicle.entities.engine_running = running;
panel._hass.states[running] = state("on", undefined, "2020-01-01T00:00:00Z");
assert.equal(panel._batteryMetric(vehicle).gauge, null, "a stale running report must not be interpreted as stopped");
delete vehicle.entities.engine_running;
panel._hass.states[ignition] = state("on");
assert.equal(panel._batteryMetric(vehicle).gauge, null, "ignition on disables the standing-voltage scale");
panel._hass.states[ignition] = state("off");
panel._hass.states[battery] = state("14.2", "V");
assert.equal(panel._batteryMetric(vehicle).gauge, null, "charging voltage must not indicate a full battery");
panel._hass.states[battery] = state("75", "%");
assert.equal(panel._batteryMetric(vehicle).value, "75 %");
assert.equal(panel._batteryMetric(vehicle).gauge.level, 75);
panel._hass.states[battery] = state("unavailable", "V");
assert.equal(panel._batteryMetric(vehicle).value, "Нет данных");
assert.equal(panel._batteryMetric(vehicle).gauge, null);
panel._hass.states[battery] = state("12.4", "V", "2020-01-01T00:00:00Z");
assert.equal(panel._batteryMetric(vehicle).gauge, null);
panel._hass.states[battery] = state("12.4", "V");
panel._hass.connected = false;
assert.equal(panel._batteryMetric(vehicle).gauge, null);
assert.equal(panel._connectionStatus().icon, "mdi:cloud-off-outline");
panel._hass.connected = undefined;
assert.equal(panel._connectionStatus().icon, "mdi:cloud-question-outline");
panel._hass.connected = true;
assert.equal(panel._connectionStatus().icon, "mdi:cloud");
const freshness = () => panel._summaryFreshness(panel._fuelMetric(vehicle), panel._batteryMetric(vehicle)).icon;
panel._hass.states[fuel] = state("0", "%");
assert.equal(freshness(), "mdi:check-circle-outline", "a new zero fuel report is valid");
panel._hass.states[battery] = state("12.4", "V", "2020-01-01T00:00:00Z");
assert.equal(freshness(), "mdi:clock-alert-outline", "one old required reading makes the summary stale");
panel._hass.states[battery] = state("unavailable", "V");
assert.equal(freshness(), "mdi:clock-question-outline");
panel._hass.states[battery] = state("12.4", "V", new Date(Date.now() + 30000).toISOString());
assert.equal(freshness(), "mdi:clock-question-outline", "a future report cannot establish freshness");

const textByNode = new Map();
const consumptionPanel = Object.create(Panel.prototype);
const pane = {};
const tile = {};
const unit = { hidden: true };
consumptionPanel.$ = (selector) => {
  if (selector === ".consumption-unit") return unit;
  assert.equal(selector, ".fuel-consumption");
  return tile;
};
consumptionPanel._setClass = (node, name, enabled) => {
  assert.equal(node, tile);
  assert.equal(name, "muted");
  tile.muted = enabled;
};
consumptionPanel._setText = (_node, selector, text) => textByNode.set(selector, text);
const consumed = {
  from_at: "2025-05-06T17:11:00+00:00",
  to_at: "2025-05-18T14:54:00+00:00",
  start: { km: 15060, period_start: "2025-05-06T21:00:00+00:00", reported_at: "2025-05-06T22:00:00+00:00" },
  end: { km: 15300, reported_at: "2025-05-18T15:33:40+00:00" },
  litres: 35.40,
  distance_km: 240,
  litres_per_100_km: 14.75,
};
consumptionPanel._patchFuelConsumption(pane, { consumption: consumed });
assert.equal(textByNode.get(".consumption-value"), "≈ 14,8");
assert.equal(unit.hidden, false);
assert.match(textByNode.get(".consumption-source"), /35,40 л за 240,0 км/);
assert.match(textByNode.get(".consumption-source"), /06\.05\.2025.*20:11.*18\.05\.2025.*17:54 МСК/);
assert.match(textByNode.get(".consumption-source"), /почасовая статистика/);
assert.equal(tile.muted, false);
consumptionPanel._patchFuelConsumption(pane, { samples: [{}] });
assert.equal(textByNode.get(".consumption-value"), "—");
assert.equal(unit.hidden, true);
assert.match(textByNode.get(".consumption-source"), /две записи полного бака/);
assert.equal(tile.muted, true);
