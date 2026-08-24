const PANEL_UI_VERSION = "0.2.0";
const EVENT_WINDOW_HOURS = 24;
const TRIP_WINDOW_HOURS = 72;
const WRITABLE_DOMAINS = new Set(["lock", "switch", "button"]);

function openHomeAssistantMenu(target) {
  target.dispatchEvent(
    new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true }),
  );
}

function domainOf(entityId) {
  return String(entityId || "").split(".", 1)[0];
}

class StarLineAppPanelV003 extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._panel = null;
    this._route = null;
    this._bootstrap = null;
    this._loading = false;
    this._error = null;
    this._view = this._viewFromLocation();
    this._vehicleId = null;
    this._pickerOpen = false;
    this._historyByVehicle = new Map();
    this._historyLoading = new Set();
    this._historyErrors = new Map();
    this._mapCard = null;
    this._lastStateSignature = "";
    this._hashListener = () => {
      this._view = this._viewFromLocation();
      this._pickerOpen = false;
      this._render();
      this._ensureHistory();
    };
  }

  set hass(value) {
    const first = !this._hass;
    this._hass = value;
    if (first && this.isConnected) {
      this._loadBootstrap();
      return;
    }
    if (!this._bootstrap) return;
    const signature = this._stateSignature();
    if (signature !== this._lastStateSignature) {
      this._lastStateSignature = signature;
      this._render();
    } else if (this._mapCard) {
      this._mapCard.hass = value;
    }
  }

  set panel(value) {
    this._panel = value;
    if (this.isConnected && this._hass && !this._bootstrap) this._loadBootstrap();
  }

  set route(value) {
    this._route = value;
  }

  connectedCallback() {
    window.addEventListener("hashchange", this._hashListener);
    this._render();
    if (this._hass) this._loadBootstrap();
  }

  disconnectedCallback() {
    window.removeEventListener("hashchange", this._hashListener);
  }

  _viewFromLocation() {
    const value = (location.hash || "#status").slice(1).toLowerCase();
    return ["status", "history", "trips", "diagnostics"].includes(value)
      ? value
      : "status";
  }

  async _loadBootstrap() {
    if (!this._hass || this._loading) return;
    this._loading = true;
    this._error = null;
    this._render();
    try {
      const entryId = this._panel?.config?.entry_id;
      this._bootstrap = await this._hass.callWS({
        type: "starline_telemetry/panel/bootstrap",
        ...(entryId ? { entry_id: entryId } : {}),
      });
      const vehicles = this._vehicles();
      if (!this._vehicleId || !vehicles.some((item) => item.device_id === this._vehicleId)) {
        this._vehicleId = vehicles[0]?.device_id || null;
      }
      this._lastStateSignature = this._stateSignature();
    } catch (err) {
      this._error = err?.message || String(err);
      this._bootstrap = this._panel?.config?.bootstrap_fallback || null;
      this._vehicleId = this._vehicles()[0]?.device_id || null;
    } finally {
      this._loading = false;
      this._render();
      this._ensureHistory();
    }
  }

  _vehicles() {
    return this._bootstrap?.vehicles || [];
  }

  _vehicle() {
    return this._vehicles().find((item) => item.device_id === this._vehicleId) || this._vehicles()[0] || null;
  }

  _stateSignature() {
    const vehicle = this._vehicle();
    if (!vehicle || !this._hass) return "";
    return Object.values(vehicle.entities || {})
      .map((entityId) => {
        const state = this._hass.states?.[entityId];
        return state ? `${entityId}:${state.state}:${state.last_updated}` : `${entityId}:missing`;
      })
      .sort()
      .join("|");
  }

  _escape(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  _entity(vehicle, keys) {
    if (!vehicle || !this._hass) return null;
    for (const key of keys) {
      const entityId = vehicle.entities?.[key];
      const state = entityId ? this._hass.states?.[entityId] : null;
      if (entityId && state) return { key, entityId, state };
    }
    return null;
  }

  _formatNumber(value, digits = 0) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return String(value ?? "—");
    return new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    }).format(numeric);
  }

  _formatState(entity, options = {}) {
    if (!entity?.state) return "—";
    const raw = entity.state.state;
    if (["unknown", "unavailable", "none", "null"].includes(String(raw).toLowerCase())) return "Нет данных";
    const unit = entity.state.attributes?.unit_of_measurement;
    const numeric = Number(raw);
    const value = Number.isFinite(numeric)
      ? this._formatNumber(numeric, options.digits ?? (Math.abs(numeric) < 20 ? 1 : 0))
      : String(raw);
    return `${value}${unit ? ` ${unit}` : ""}`;
  }

  _isOn(entity) {
    if (!entity?.state) return null;
    const raw = String(entity.state.state).toLowerCase();
    if (["unknown", "unavailable"].includes(raw)) return null;
    return ["on", "true", "open", "unlocked"].includes(raw);
  }

  _isLocked(entity) {
    if (!entity?.state) return null;
    const raw = String(entity.state.state).toLowerCase();
    if (["unknown", "unavailable"].includes(raw)) return null;
    if (raw === "locked") return true;
    if (raw === "unlocked") return false;
    return this._isOn(entity);
  }

  _online(vehicle) {
    const lock = this._entity(vehicle, ["lock", "armed"]);
    if (lock) return String(lock.state.state).toLowerCase() !== "unavailable";
    const states = Object.values(vehicle?.entities || {})
      .map((entityId) => this._hass?.states?.[entityId])
      .filter(Boolean);
    return states.some((state) => String(state.state).toLowerCase() !== "unavailable");
  }

  _latestUpdate(vehicle) {
    const timestamps = Object.values(vehicle?.entities || {})
      .map((entityId) => this._hass?.states?.[entityId]?.last_updated)
      .filter(Boolean)
      .map((value) => Date.parse(value))
      .filter(Number.isFinite);
    return timestamps.length ? Math.max(...timestamps) : null;
  }

  _relativeTime(timestamp) {
    if (!timestamp) return "Нет данных о свежести";
    const diff = Math.max(0, Date.now() - Number(timestamp));
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Только что";
    if (minutes < 60) return `${minutes} мин назад`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ч назад`;
    const days = Math.floor(hours / 24);
    return `${days} дн назад`;
  }

  _formatDateTime(timestamp, includeDate = true) {
    if (!timestamp) return "—";
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("ru-RU", {
      ...(includeDate ? { day: "2-digit", month: "2-digit", year: "numeric" } : {}),
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  _perimeter(vehicle) {
    const items = [
      ["door", "двери"],
      ["hood", "капот"],
      ["trunk", "багажник"],
    ];
    const open = [];
    let known = 0;
    for (const [key, label] of items) {
      const entity = this._entity(vehicle, [key]);
      const state = this._isOn(entity);
      if (state !== null) known += 1;
      if (state === true) open.push(label);
    }
    if (!known) return { label: "Периметр: нет данных", tone: "muted" };
    if (open.length) return { label: `Открыто: ${open.join(", ")}`, tone: "warn" };
    return { label: "Периметр закрыт", tone: "ok" };
  }

  _security(vehicle) {
    const lock = this._entity(vehicle, ["lock", "armed"]);
    const locked = this._isLocked(lock);
    if (locked === null) return { label: "Охрана: нет данных", tone: "muted", icon: "mdi:shield-outline" };
    return locked
      ? { label: "Под охраной", tone: "ok", icon: "mdi:shield-lock" }
      : { label: "Охрана снята", tone: "warn", icon: "mdi:shield-off-outline" };
  }

  _engine(vehicle) {
    const engine = this._entity(vehicle, ["engine_running", "run", "ignition"]);
    const running = this._isOn(engine);
    if (running === null) return { label: "Двигатель: нет данных", tone: "muted", icon: "mdi:engine-outline" };
    return running
      ? { label: "Двигатель работает", tone: "active", icon: "mdi:engine" }
      : { label: "Двигатель остановлен", tone: "muted", icon: "mdi:engine-off-outline" };
  }

  _parking(vehicle) {
    const brake = this._entity(vehicle, ["hbrake"]);
    const parked = this._isOn(brake);
    if (parked === null) return null;
    return parked
      ? { label: "P", tone: "active", icon: "mdi:parking" }
      : { label: "Ручник отпущен", tone: "muted", icon: "mdi:car-brake-release" };
  }

  _telemetryChip(vehicle, keys, label, icon, options = {}) {
    const entity = this._entity(vehicle, keys);
    if (!entity) return "";
    const raw = String(entity.state.state).toLowerCase();
    const unavailable = ["unknown", "unavailable"].includes(raw);
    let value = unavailable ? "—" : this._formatState(entity, options);
    if (options.prefix) value = `${options.prefix}${value}`;
    return `<button class="telemetry-chip ${unavailable ? "muted" : ""}" data-entity="${this._escape(entity.entityId)}">
      <ha-icon icon="${icon}"></ha-icon>
      <span>${this._escape(label)}</span>
      <strong>${this._escape(value)}</strong>
    </button>`;
  }

  _gpsChip(vehicle) {
    const gps = this._entity(vehicle, ["gps_count", "gps_satellites"]);
    const location = this._entity(vehicle, ["location", "vehicle_location"]);
    if (!gps && !location) return "";
    const value = gps && !["unknown", "unavailable"].includes(String(gps.state.state).toLowerCase())
      ? this._formatState(gps, { digits: 0 }).replace(/ satellites| спутников| спутник/gi, "")
      : "";
    const entityId = gps?.entityId || location?.entityId;
    return `<button class="telemetry-chip" data-entity="${this._escape(entityId)}"><ha-icon icon="mdi:satellite-variant"></ha-icon><span>GPS</span><strong>${this._escape(value || "OK")}</strong></button>`;
  }

  _parkingChip(vehicle) {
    const parking = this._parking(vehicle);
    const entity = this._entity(vehicle, ["hbrake"]);
    if (!parking || !entity) return "";
    return `<button class="telemetry-chip parking ${parking.tone}" data-entity="${this._escape(entity.entityId)}"><ha-icon icon="${parking.icon}"></ha-icon><strong>${this._escape(parking.label)}</strong></button>`;
  }

  _historyCache(vehicle = this._vehicle()) {
    return vehicle ? this._historyByVehicle.get(vehicle.device_id) : null;
  }

  _historyEntityIds(vehicle) {
    const keys = [
      "lock", "armed", "alarm", "door", "hood", "trunk", "hbrake",
      "run", "engine_running", "ignition", "r_start", "service_mode",
    ];
    return [...new Set(keys.map((key) => vehicle?.entities?.[key]).filter(Boolean))];
  }

  _historyPath(entityIds, hours, withAttributes = false) {
    const end = new Date();
    const start = new Date(end.getTime() - hours * 3600000);
    const params = new URLSearchParams({
      filter_entity_id: entityIds.join(","),
      end_time: end.toISOString(),
      significant_changes_only: "0",
    });
    params.append("skip_initial_state", "");
    if (!withAttributes) params.append("no_attributes", "");
    return `history/period/${encodeURIComponent(start.toISOString())}?${params.toString()}`;
  }

  async _ensureHistory(force = false) {
    const vehicle = this._vehicle();
    if (!vehicle || !this._hass) return;
    const id = vehicle.device_id;
    if (!force && this._historyByVehicle.has(id)) return;
    if (this._historyLoading.has(id)) return;

    this._historyLoading.add(id);
    this._historyErrors.delete(id);
    this._render();
    try {
      const eventIds = this._historyEntityIds(vehicle);
      const location = this._entity(vehicle, ["location", "vehicle_location"]);
      const eventPromise = eventIds.length
        ? this._hass.callApi("GET", this._historyPath(eventIds, EVENT_WINDOW_HOURS, false))
        : Promise.resolve([]);
      const locationPromise = location
        ? this._hass.callApi("GET", this._historyPath([location.entityId], TRIP_WINDOW_HOURS, true))
        : Promise.resolve([]);
      const [eventPayload, locationPayload] = await Promise.all([eventPromise, locationPromise]);
      const events = this._eventsFromHistory(vehicle, eventPayload);
      const points = this._pointsFromHistory(location?.entityId, locationPayload);
      const trips = this._buildTrips(points);
      this._historyByVehicle.set(id, {
        events,
        points,
        trips,
        loadedAt: Date.now(),
      });
    } catch (err) {
      this._historyErrors.set(id, err?.message || String(err));
    } finally {
      this._historyLoading.delete(id);
      this._render();
    }
  }

  _flattenHistory(payload) {
    if (!Array.isArray(payload)) return [];
    return payload.flatMap((series) => Array.isArray(series) ? series : []);
  }

  _eventDefinition(role, state) {
    const raw = String(state).toLowerCase();
    const on = ["on", "true", "open", "unlocked"].includes(raw);
    const locked = raw === "locked" || ((role === "armed") && on);
    const definitions = {
      lock: locked
        ? ["Охрана включена", "security", "mdi:shield-lock"]
        : ["Охрана отключена", "warning", "mdi:shield-off-outline"],
      armed: locked
        ? ["Охрана включена", "security", "mdi:shield-lock"]
        : ["Охрана отключена", "warning", "mdi:shield-off-outline"],
      alarm: on
        ? ["Тревога", "alarm", "mdi:alarm-light"]
        : ["Тревога снята", "security", "mdi:alarm-light-off-outline"],
      door: on
        ? ["Двери открыты", "perimeter", "mdi:car-door"]
        : ["Двери закрыты", "perimeter", "mdi:car-door-lock"],
      hood: on
        ? ["Капот открыт", "perimeter", "mdi:car-lifted-pickup"]
        : ["Капот закрыт", "perimeter", "mdi:car-lifted-pickup"],
      trunk: on
        ? ["Багажник открыт", "perimeter", "mdi:car-back"]
        : ["Багажник закрыт", "perimeter", "mdi:car-back"],
      hbrake: on
        ? ["Ручник поднят", "parking", "mdi:car-brake-hold"]
        : ["Ручник опущен", "parking", "mdi:car-brake-release"],
      run: on
        ? ["Зажигание включено", "engine", "mdi:car-key"]
        : ["Зажигание отключено", "engine", "mdi:car-key"],
      ignition: on
        ? ["Зажигание включено", "engine", "mdi:car-key"]
        : ["Зажигание отключено", "engine", "mdi:car-key"],
      engine_running: on
        ? ["Двигатель запущен", "engine", "mdi:engine"]
        : ["Двигатель остановлен", "engine", "mdi:engine-off-outline"],
      r_start: on
        ? ["Автозапуск активирован", "engine", "mdi:engine"]
        : ["Автозапуск завершён", "engine", "mdi:engine-off-outline"],
      service_mode: on
        ? ["Сервисный режим включён", "service", "mdi:wrench-clock"]
        : ["Сервисный режим выключен", "service", "mdi:wrench-clock"],
    };
    return definitions[role] || null;
  }

  _eventsFromHistory(vehicle, payload) {
    const reverse = new Map(
      Object.entries(vehicle?.entities || {}).map(([role, entityId]) => [entityId, role]),
    );
    return this._flattenHistory(payload)
      .map((item) => {
        const role = reverse.get(item.entity_id);
        const definition = role ? this._eventDefinition(role, item.state) : null;
        const timestamp = item.last_changed || item.last_updated || item.lc || item.lu;
        if (!definition || !timestamp) return null;
        return {
          role,
          entityId: item.entity_id,
          timestamp: Date.parse(timestamp),
          label: definition[0],
          category: definition[1],
          icon: definition[2],
        };
      })
      .filter((item) => item && Number.isFinite(item.timestamp))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 100);
  }

  _pointsFromHistory(entityId, payload) {
    if (!entityId) return [];
    return this._flattenHistory(payload)
      .filter((item) => item.entity_id === entityId)
      .map((item) => {
        const attributes = item.attributes || item.a || {};
        const lat = Number(attributes.latitude);
        const lon = Number(attributes.longitude);
        const timestamp = Date.parse(item.last_updated || item.last_changed || item.lu || item.lc || "");
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(timestamp)) return null;
        return { lat, lon, timestamp };
      })
      .filter(Boolean)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  _haversineKm(a, b) {
    const rad = (value) => value * Math.PI / 180;
    const earth = 6371;
    const dLat = rad(b.lat - a.lat);
    const dLon = rad(b.lon - a.lon);
    const lat1 = rad(a.lat);
    const lat2 = rad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * earth * Math.asin(Math.sqrt(h));
  }

  _buildTrips(points) {
    if (points.length < 2) return [];
    const trips = [];
    let current = null;
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const point = points[index];
      const gapMinutes = (point.timestamp - previous.timestamp) / 60000;
      const segmentKm = this._haversineKm(previous, point);
      const moving = segmentKm >= 0.05;

      if (!moving || gapMinutes > 45) {
        if (current && current.points.length >= 2 && current.distanceKm >= 0.2) trips.push(current);
        current = null;
        if (!moving) continue;
      }

      if (!current) {
        current = { points: [previous, point], distanceKm: segmentKm };
      } else {
        current.points.push(point);
        current.distanceKm += segmentKm;
      }
    }
    if (current && current.points.length >= 2 && current.distanceKm >= 0.2) trips.push(current);

    return trips
      .map((trip) => ({
        ...trip,
        start: trip.points[0].timestamp,
        end: trip.points[trip.points.length - 1].timestamp,
      }))
      .sort((a, b) => b.start - a.start)
      .slice(0, 20);
  }

  _lastEvent(vehicle) {
    return this._historyCache(vehicle)?.events?.[0] || null;
  }

  _lastEventMarkup(vehicle) {
    const event = this._lastEvent(vehicle);
    if (!event) {
      const perimeter = this._perimeter(vehicle);
      return `<div class="last-event ${perimeter.tone}"><ha-icon icon="mdi:information-outline"></ha-icon><span>${this._escape(perimeter.label)}</span></div>`;
    }
    return `<button class="last-event ${event.category}" data-view-target="history"><span class="event-date">${this._escape(this._formatDateTime(event.timestamp))}</span><ha-icon icon="${event.icon}"></ha-icon><strong>${this._escape(event.label)}</strong></button>`;
  }

  _statusView(vehicle) {
    const freshness = this._relativeTime(this._latestUpdate(vehicle));
    const security = this._security(vehicle);
    const engine = this._engine(vehicle);
    const perimeter = this._perimeter(vehicle);
    const parking = this._parking(vehicle);

    const chips = [
      this._gpsChip(vehicle),
      this._telemetryChip(vehicle, ["gsm_lvl", "gsm_level"], "GSM", "mdi:signal"),
      this._telemetryChip(vehicle, ["battery"], "АКБ", "mdi:car-battery", { digits: 1 }),
      this._telemetryChip(vehicle, ["fuel", "fuel_percent", "fuel_litres"], "Топливо", "mdi:gas-station-outline"),
      this._telemetryChip(vehicle, ["ctemp", "cabin_temperature"], "Салон", "mdi:car-seat-heater"),
      this._telemetryChip(vehicle, ["etemp", "engine_temperature"], "Двигатель", "mdi:thermometer"),
      this._telemetryChip(vehicle, ["mileage", "odometer"], "Пробег", "mdi:map-marker-distance"),
      this._parkingChip(vehicle),
    ].filter(Boolean).join("");

    const statusPills = [security, engine, perimeter, parking]
      .filter(Boolean)
      .map((item) => `<div class="status-pill ${item.tone}"><ha-icon icon="${item.icon || "mdi:checkbox-blank-circle-outline"}"></ha-icon><span>${this._escape(item.label)}</span></div>`)
      .join("");

    const location = this._entity(vehicle, ["location", "vehicle_location"]);
    const mapFallback = location
      ? `<div class="map-fallback"><ha-icon icon="mdi:map-marker-radius"></ha-icon><span>Загрузка карты…</span></div>`
      : `<div class="map-fallback"><ha-icon icon="mdi:map-marker-off-outline"></ha-icon><span>Местоположение недоступно</span></div>`;

    return `<div class="status-screen">
      <div class="telemetry-grid">${chips || `<div class="empty-inline">Телеметрия пока не найдена</div>`}</div>
      <div class="freshness"><ha-icon icon="mdi:clock-outline"></ha-icon><span>${this._escape(freshness)}</span></div>

      <section class="vehicle-stage">
        <div class="vehicle-halo"></div>
        <ha-icon class="vehicle-icon" icon="mdi:car-side"></ha-icon>
        <div class="vehicle-caption"><strong>${this._escape(vehicle?.name || "StarLine")}</strong><span>${this._escape(perimeter.label)}</span></div>
      </section>

      ${this._lastEventMarkup(vehicle)}
      <div class="status-pills">${statusPills}</div>

      <section class="map-section">
        <div class="section-title"><div><strong>Местоположение</strong><span>Текущая позиция автомобиля</span></div>${location ? `<button class="more-info" data-entity="${this._escape(location.entityId)}"><ha-icon icon="mdi:crosshairs-gps"></ha-icon></button>` : ""}</div>
        <div id="mapHost" class="map-host">${mapFallback}</div>
      </section>
    </div>`;
  }

  _groupEventsByDate(events) {
    const groups = [];
    let currentKey = null;
    let current = null;
    for (const event of events) {
      const key = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(event.timestamp));
      if (key !== currentKey) {
        currentKey = key;
        current = { key, events: [] };
        groups.push(current);
      }
      current.events.push(event);
    }
    return groups;
  }

  _historyView(vehicle) {
    const cache = this._historyCache(vehicle);
    const loading = this._historyLoading.has(vehicle?.device_id);
    const error = this._historyErrors.get(vehicle?.device_id);
    if (loading && !cache) return this._loadingState("Читаю историю Home Assistant…");
    if (error && !cache) return this._errorState("История недоступна", error);
    const events = cache?.events || [];
    if (!events.length) return this._emptyState("mdi:timeline-clock-outline", "История пока пуста", "Recorder не вернул изменений состояний StarLine за последние 24 часа.");

    const groups = this._groupEventsByDate(events);
    return `<div class="view-head"><div><strong>История</strong><span>События StarLine из HA Recorder · 24 часа</span></div><button data-refresh-history="1"><ha-icon icon="mdi:refresh"></ha-icon></button></div>
      <div class="history-list">${groups.map((group) => `<section class="history-day"><div class="day-chip">${this._escape(group.key)}</div>${group.events.map((event) => `<button class="history-row ${event.category}" data-entity="${this._escape(event.entityId)}"><time>${this._escape(new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(event.timestamp)))}</time><ha-icon icon="${event.icon}"></ha-icon><strong>${this._escape(event.label)}</strong></button>`).join("")}</section>`).join("")}</div>`;
  }

  _routeSvg(points) {
    if (!points?.length) return "";
    const lats = points.map((point) => point.lat);
    const lons = points.map((point) => point.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const spanLat = Math.max(0.0001, maxLat - minLat);
    const spanLon = Math.max(0.0001, maxLon - minLon);
    const mapped = points.map((point) => {
      const x = 8 + ((point.lon - minLon) / spanLon) * 84;
      const y = 48 - ((point.lat - minLat) / spanLat) * 40;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const start = mapped[0].split(",");
    const end = mapped[mapped.length - 1].split(",");
    return `<svg class="route-svg" viewBox="0 0 100 56" role="img" aria-label="Схема маршрута"><defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" stroke-opacity=".08" stroke-width=".6"/></pattern></defs><rect width="100" height="56" fill="url(#grid)"/><polyline points="${mapped.join(" ")}" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${start[0]}" cy="${start[1]}" r="4" class="route-marker"/><text x="${start[0]}" y="${Number(start[1]) + 1.4}" text-anchor="middle">A</text><circle cx="${end[0]}" cy="${end[1]}" r="4" class="route-marker"/><text x="${end[0]}" y="${Number(end[1]) + 1.4}" text-anchor="middle">B</text></svg>`;
  }

  _tripsView(vehicle) {
    const cache = this._historyCache(vehicle);
    const loading = this._historyLoading.has(vehicle?.device_id);
    const error = this._historyErrors.get(vehicle?.device_id);
    if (loading && !cache) return this._loadingState("Строю поездки по GPS Recorder…");
    if (error && !cache) return this._errorState("История перемещений недоступна", error);
    const trips = cache?.trips || [];
    if (!trips.length) return this._emptyState("mdi:map-marker-path", "Поездки не найдены", "За последние 72 часа Recorder не накопил достаточно GPS-точек для построения маршрута.");

    return `<div class="view-head"><div><strong>Поездки</strong><span>Маршруты, восстановленные из device_tracker · 72 часа</span></div><button data-refresh-history="1"><ha-icon icon="mdi:refresh"></ha-icon></button></div>
      <section class="trip-map-section"><div id="tripMapHost" class="map-host"><div class="map-fallback"><ha-icon icon="mdi:map-clock-outline"></ha-icon><span>Загрузка истории перемещений…</span></div></div></section>
      <div class="trip-list">${trips.map((trip) => `<article class="trip-card"><div class="trip-meta"><div><strong>${this._escape(this._formatNumber(trip.distanceKm, 1))} км</strong><span>${this._escape(new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" }).format(new Date(trip.start)))}</span></div><div class="trip-times"><span>A&nbsp; ${this._escape(this._formatDateTime(trip.start, false))}</span><ha-icon icon="mdi:arrow-right"></ha-icon><span>B&nbsp; ${this._escape(this._formatDateTime(trip.end, false))}</span></div></div>${this._routeSvg(trip.points)}<div class="trip-foot"><span>≈ по GPS</span><span>${trip.points.length} точек</span></div></article>`).join("")}</div>`;
  }

  _diagnosticsView(vehicle) {
    const cache = this._historyCache(vehicle);
    const entityPairs = Object.entries(vehicle?.entities || {});
    const unavailable = entityPairs.filter(([, entityId]) => {
      const state = this._hass?.states?.[entityId];
      return !state || ["unknown", "unavailable"].includes(String(state.state).toLowerCase());
    });
    const errors = this._entity(vehicle, ["errors"]);
    const source = this._bootstrap?.source?.primary === "starline_telemetry" ? "StarLine Telemetry" : "Home Assistant · StarLine";
    const online = this._online(vehicle);
    const freshness = this._relativeTime(this._latestUpdate(vehicle));

    const rows = entityPairs.map(([role, entityId]) => {
      const state = this._hass?.states?.[entityId];
      const unavailableState = !state || ["unknown", "unavailable"].includes(String(state.state).toLowerCase());
      const writable = WRITABLE_DOMAINS.has(domainOf(entityId));
      return `<div class="diag-entity ${unavailableState ? "unavailable" : ""}"><div><strong>${this._escape(role)}</strong><span>${this._escape(entityId)}</span></div><div class="diag-state"><span>${this._escape(state?.state ?? "missing")}</span>${writable ? `<ha-icon title="Команды заблокированы" icon="mdi:lock-outline"></ha-icon>` : `<button data-entity="${this._escape(entityId)}"><ha-icon icon="mdi:information-outline"></ha-icon></button>`}</div></div>`;
    }).join("");

    return `<div class="diagnostic-summary">
      <div class="diag-tile"><span>Источник</span><strong>${this._escape(source)}</strong></div>
      <div class="diag-tile ${online ? "ok" : "danger"}"><span>Связь</span><strong>${online ? "В сети" : "Недоступен"}</strong></div>
      <div class="diag-tile"><span>Свежесть</span><strong>${this._escape(freshness)}</strong></div>
      <div class="diag-tile ${unavailable.length ? "warn" : "ok"}"><span>Недоступно</span><strong>${unavailable.length} / ${entityPairs.length}</strong></div>
      ${errors ? `<div class="diag-tile ${Number(errors.state.state) > 0 ? "danger" : "ok"}"><span>Ошибки OBD</span><strong>${this._escape(this._formatState(errors, { digits: 0 }))}</strong></div>` : ""}
      <div class="diag-tile"><span>История</span><strong>${cache ? this._escape(this._relativeTime(cache.loadedAt)) : "Не загружена"}</strong></div>
    </div>
    <div class="read-only-banner"><ha-icon icon="mdi:shield-lock-outline"></ha-icon><div><strong>Read-only</strong><span>Панель не вызывает lock, switch, button и другие управляющие сервисы StarLine.</span></div></div>
    <section class="entity-section"><div class="section-title"><div><strong>Сущности автомобиля</strong><span>Привязка через Entity Registry</span></div></div><div class="diag-list">${rows || `<div class="empty-inline">Сущности не найдены</div>`}</div></section>`;
  }

  _emptyState(icon, title, description) {
    return `<div class="empty-state"><ha-icon icon="${icon}"></ha-icon><strong>${this._escape(title)}</strong><span>${this._escape(description)}</span></div>`;
  }

  _loadingState(text) {
    return `<div class="empty-state"><ha-icon class="spin" icon="mdi:loading"></ha-icon><strong>${this._escape(text)}</strong></div>`;
  }

  _errorState(title, detail) {
    return `<div class="empty-state danger"><ha-icon icon="mdi:alert-circle-outline"></ha-icon><strong>${this._escape(title)}</strong><span>${this._escape(detail)}</span><button data-refresh-history="1">Повторить</button></div>`;
  }

  _content(vehicle) {
    if (!vehicle) return this._emptyState("mdi:car-off", "Автомобили не найдены", "Проверьте штатную интеграцию StarLine в Home Assistant.");
    if (this._view === "history") return this._historyView(vehicle);
    if (this._view === "trips") return this._tripsView(vehicle);
    if (this._view === "diagnostics") return this._diagnosticsView(vehicle);
    return this._statusView(vehicle);
  }

  _vehicleMenu() {
    if (!this._pickerOpen || this._vehicles().length < 2) return "";
    return `<div class="vehicle-menu">${this._vehicles().map((vehicle) => `<button data-vehicle="${this._escape(vehicle.device_id)}" class="${vehicle.device_id === this._vehicleId ? "selected" : ""}"><ha-icon icon="mdi:car"></ha-icon><div><strong>${this._escape(vehicle.name)}</strong><span>${this._online(vehicle) ? "В сети" : "Недоступен"}</span></div>${vehicle.device_id === this._vehicleId ? `<ha-icon icon="mdi:check"></ha-icon>` : ""}</button>`).join("")}</div>`;
  }

  _tabbar() {
    const items = [
      ["status", "mdi:car-info", "Состояние"],
      ["history", "mdi:timeline-clock-outline", "История"],
      ["trips", "mdi:map-marker-path", "Поездки"],
      ["diagnostics", "mdi:stethoscope", "Диагностика"],
    ];
    return items.map(([view, icon, label]) => `<button data-view="${view}" class="${this._view === view ? "active" : ""}"><ha-icon icon="${icon}"></ha-icon><span>${label}</span></button>`).join("");
  }

  _setView(view) {
    history.replaceState(null, "", `${location.pathname}${location.search}#${view}`);
    this._view = view;
    this._pickerOpen = false;
    this._render();
    this._ensureHistory();
  }

  _openMoreInfo(entityId) {
    if (!entityId || WRITABLE_DOMAINS.has(domainOf(entityId))) return;
    this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        detail: { entityId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  async _mountMap() {
    if (!["status", "trips"].includes(this._view) || !this._hass) return;
    const vehicle = this._vehicle();
    const locationEntity = this._entity(vehicle, ["location", "vehicle_location"]);
    const hostId = this._view === "trips" ? "tripMapHost" : "mapHost";
    const host = this.shadowRoot?.getElementById(hostId);
    if (!host || !locationEntity || typeof window.loadCardHelpers !== "function") return;
    try {
      const helpers = await window.loadCardHelpers();
      if (!this.shadowRoot?.contains(host)) return;
      const card = await helpers.createCardElement({
        type: "map",
        entities: [locationEntity.entityId],
        hours_to_show: this._view === "trips" ? TRIP_WINDOW_HOURS : 0,
        default_zoom: this._view === "trips" ? 12 : 15,
      });
      card.hass = this._hass;
      card.classList.add("embedded-map-card");
      host.replaceChildren(card);
      this._mapCard = card;
    } catch (err) {
      host.innerHTML = `<div class="map-fallback"><ha-icon icon="mdi:map-marker-radius"></ha-icon><span>Карта HA недоступна</span></div>`;
      this._mapCard = null;
    }
  }

  _render() {
    if (!this.shadowRoot) return;
    const vehicle = this._vehicle();
    const online = vehicle ? this._online(vehicle) : false;
    const multi = this._vehicles().length > 1;
    const historyBusy = vehicle && this._historyLoading.has(vehicle.device_id);

    this.shadowRoot.innerHTML = `<style>
      :host { display:block; height:100dvh; color:var(--primary-text-color); background:var(--primary-background-color); --surface:var(--ha-card-background,var(--card-background-color,#fff)); --border:color-mix(in srgb,var(--primary-text-color) 10%,transparent); --muted:var(--secondary-text-color,#6b7280); --accent:var(--primary-color,#03a9f4); --ok:#43a047; --warn:#fb8c00; --danger:#e53935; --engine:#ef6c00; --perimeter:#29b6f6; --parking:#fbc02d; }
      * { box-sizing:border-box; }
      button { font:inherit; -webkit-tap-highlight-color:transparent; }
      .app { height:100%; min-height:0; display:grid; grid-template-rows:auto minmax(0,1fr) auto; overflow:hidden; }
      header { position:relative; min-height:64px; display:grid; grid-template-columns:52px minmax(0,1fr) 52px; align-items:center; padding:max(5px,env(safe-area-inset-top)) max(8px,env(safe-area-inset-right)) 5px max(8px,env(safe-area-inset-left)); background:var(--surface); border-bottom:1px solid var(--border); z-index:8; }
      header > button { width:46px; height:46px; border:0; border-radius:15px; background:transparent; color:var(--primary-text-color); display:grid; place-items:center; }
      header > button:last-child { justify-self:end; }
      header > button ha-icon { --mdc-icon-size:27px; }
      .vehicle-title { min-width:0; justify-self:center; max-width:100%; border:0; background:transparent; color:var(--primary-text-color); display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:5px; padding:3px 8px; text-align:left; }
      .vehicle-title .copy { min-width:0; }
      .vehicle-title strong { display:block; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:18px; line-height:1.05; font-weight:780; }
      .vehicle-title span { display:flex; align-items:center; gap:5px; margin-top:3px; color:var(--muted); font-size:10px; font-weight:650; }
      .vehicle-title span::before { content:""; width:6px; height:6px; border-radius:50%; background:${online ? "var(--ok)" : "var(--danger)"}; box-shadow:0 0 0 3px color-mix(in srgb,${online ? "var(--ok)" : "var(--danger)"} 12%,transparent); }
      .vehicle-title > ha-icon { display:${multi ? "block" : "none"}; color:var(--muted); --mdc-icon-size:20px; }
      .vehicle-menu { position:absolute; z-index:20; top:calc(100% + 6px); left:50%; transform:translateX(-50%); width:min(86vw,360px); padding:7px; border:1px solid var(--border); border-radius:18px; background:var(--surface); box-shadow:0 14px 35px color-mix(in srgb,#000 22%,transparent); }
      .vehicle-menu button { width:100%; min-height:54px; border:0; border-radius:13px; background:transparent; color:var(--primary-text-color); display:grid; grid-template-columns:34px minmax(0,1fr) 24px; align-items:center; gap:8px; padding:8px 10px; text-align:left; }
      .vehicle-menu button.selected { background:color-mix(in srgb,var(--accent) 10%,transparent); }
      .vehicle-menu button > ha-icon:first-child { color:var(--accent); }
      .vehicle-menu div { min-width:0; }
      .vehicle-menu strong,.vehicle-menu span { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .vehicle-menu strong { font-size:13px; }
      .vehicle-menu span { margin-top:2px; color:var(--muted); font-size:9px; }
      #content { min-height:0; overflow:auto; overscroll-behavior-y:contain; -webkit-overflow-scrolling:touch; }
      .shell { width:min(100%,980px); margin:0 auto; padding:12px max(12px,env(safe-area-inset-right)) 26px max(12px,env(safe-area-inset-left)); }
      .notice { margin-bottom:10px; padding:10px 12px; border-radius:14px; background:color-mix(in srgb,var(--warn) 10%,var(--surface)); color:var(--warn); font-size:10px; }
      .telemetry-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; }
      .telemetry-chip { min-width:0; min-height:48px; border:1px solid var(--border); border-radius:16px; padding:7px 9px; background:color-mix(in srgb,var(--accent) 5%,var(--surface)); color:var(--primary-text-color); display:grid; grid-template-columns:23px minmax(0,1fr); grid-template-rows:auto auto; column-gap:7px; text-align:left; }
      .telemetry-chip ha-icon { grid-row:1/3; align-self:center; color:var(--accent); --mdc-icon-size:21px; }
      .telemetry-chip span { color:var(--muted); font-size:8px; font-weight:700; line-height:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .telemetry-chip strong { align-self:end; font-size:13px; line-height:1.1; font-weight:780; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .telemetry-chip.muted { opacity:.65; }
      .telemetry-chip.parking { grid-template-columns:24px 1fr; grid-template-rows:1fr; align-items:center; }
      .telemetry-chip.parking ha-icon { grid-row:auto; }
      .telemetry-chip.parking.active { background:color-mix(in srgb,var(--accent) 12%,var(--surface)); }
      .freshness { min-height:34px; display:flex; align-items:center; justify-content:center; gap:6px; color:var(--muted); font-size:10px; }
      .freshness ha-icon { --mdc-icon-size:15px; }
      .vehicle-stage { position:relative; min-height:230px; margin-top:2px; border:1px solid var(--border); border-radius:24px; overflow:hidden; background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 10%,var(--surface)),var(--surface)); display:grid; place-items:center; align-content:center; }
      .vehicle-halo { position:absolute; width:250px; height:120px; border-radius:50%; background:radial-gradient(ellipse,color-mix(in srgb,var(--accent) 16%,transparent),transparent 68%); transform:translateY(30px); }
      .vehicle-icon { position:relative; z-index:1; color:color-mix(in srgb,var(--primary-text-color) 78%,var(--accent)); --mdc-icon-size:154px; filter:drop-shadow(0 14px 12px color-mix(in srgb,#000 18%,transparent)); }
      .vehicle-caption { position:absolute; left:14px; right:14px; bottom:13px; z-index:2; display:flex; align-items:end; justify-content:space-between; gap:10px; }
      .vehicle-caption strong { font-size:13px; font-weight:780; }
      .vehicle-caption span { color:var(--muted); font-size:10px; text-align:right; }
      .last-event { width:100%; min-height:46px; margin-top:10px; border:1px solid var(--border); border-radius:16px; background:var(--surface); color:var(--primary-text-color); padding:9px 12px; display:grid; grid-template-columns:auto 22px minmax(0,1fr); align-items:center; gap:8px; text-align:left; }
      .last-event > span:not(.event-date), .last-event > strong { font-size:11px; }
      .last-event .event-date { color:var(--muted); font-size:9px; white-space:nowrap; }
      .last-event ha-icon { --mdc-icon-size:19px; color:var(--accent); }
      .last-event.security ha-icon { color:var(--ok); }.last-event.warning ha-icon,.last-event.parking ha-icon { color:var(--warn); }.last-event.alarm ha-icon { color:var(--danger); }.last-event.engine ha-icon { color:var(--engine); }.last-event.perimeter ha-icon { color:var(--perimeter); }
      .status-pills { display:flex; gap:7px; overflow:auto; padding:10px 1px 2px; scrollbar-width:none; }
      .status-pills::-webkit-scrollbar { display:none; }
      .status-pill { flex:0 0 auto; min-height:32px; border-radius:999px; padding:6px 10px; background:color-mix(in srgb,var(--muted) 8%,var(--surface)); color:var(--muted); display:flex; align-items:center; gap:6px; font-size:9px; font-weight:700; }
      .status-pill ha-icon { --mdc-icon-size:16px; }.status-pill.ok { color:var(--ok); background:color-mix(in srgb,var(--ok) 9%,var(--surface)); }.status-pill.warn { color:var(--warn); background:color-mix(in srgb,var(--warn) 10%,var(--surface)); }.status-pill.active { color:var(--accent); background:color-mix(in srgb,var(--accent) 10%,var(--surface)); }
      .map-section,.entity-section { margin-top:16px; }
      .section-title { min-height:36px; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:0 2px 8px; }
      .section-title strong,.section-title span { display:block; }.section-title strong { font-size:14px; }.section-title span { margin-top:2px; color:var(--muted); font-size:9px; }
      .more-info,.view-head > button,.diag-state button { width:34px; height:34px; border:0; border-radius:12px; background:color-mix(in srgb,var(--accent) 8%,transparent); color:var(--accent); display:grid; place-items:center; }
      .map-host { min-height:260px; overflow:hidden; border:1px solid var(--border); border-radius:20px; background:var(--surface); }
      .map-host .embedded-map-card { display:block; height:100%; min-height:260px; }
      .map-fallback { min-height:260px; display:grid; place-items:center; align-content:center; gap:8px; color:var(--muted); font-size:10px; }
      .map-fallback ha-icon { --mdc-icon-size:34px; }
      .view-head { min-height:52px; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:1px 2px 12px; }
      .view-head strong,.view-head span { display:block; }.view-head strong { font-size:19px; }.view-head span { margin-top:3px; color:var(--muted); font-size:9px; }
      .history-list { display:grid; gap:14px; }
      .history-day { position:relative; padding-top:20px; }
      .day-chip { position:absolute; top:0; left:50%; transform:translateX(-50%); z-index:1; min-height:26px; border-radius:999px; padding:5px 12px; background:color-mix(in srgb,var(--accent) 11%,var(--surface)); color:var(--accent); font-size:10px; font-weight:750; }
      .history-row { position:relative; width:100%; min-height:54px; border:0; border-bottom:1px solid var(--border); background:var(--surface); color:var(--primary-text-color); padding:9px 10px 9px 14px; display:grid; grid-template-columns:68px 24px minmax(0,1fr); align-items:center; gap:8px; text-align:left; }
      .history-row:first-of-type { border-radius:17px 17px 0 0; }.history-row:last-child { border-radius:0 0 17px 17px; border-bottom:1px solid var(--border); }
      .history-row::before { content:""; position:absolute; left:0; top:0; bottom:0; width:5px; background:var(--perimeter); }.history-row.engine::before { background:var(--engine); }.history-row.security::before { background:var(--ok); }.history-row.warning::before,.history-row.parking::before { background:var(--warn); }.history-row.alarm::before { background:var(--danger); }.history-row.service::before { background:var(--parking); }
      .history-row time { color:var(--muted); font-size:10px; font-variant-numeric:tabular-nums; }.history-row ha-icon { color:var(--muted); --mdc-icon-size:19px; }.history-row strong { font-size:12px; font-weight:700; }
      .trip-map-section { margin-bottom:12px; }
      .trip-list { display:grid; gap:12px; }
      .trip-card { overflow:hidden; border:1px solid var(--border); border-radius:20px; background:var(--surface); }
      .trip-meta { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px 13px 7px; }.trip-meta > div:first-child strong,.trip-meta > div:first-child span { display:block; }.trip-meta > div:first-child strong { font-size:18px; }.trip-meta > div:first-child span { margin-top:2px; color:var(--muted); font-size:9px; }
      .trip-times { display:flex; align-items:center; gap:5px; color:var(--muted); font-size:9px; }.trip-times ha-icon { --mdc-icon-size:14px; }
      .route-svg { display:block; width:100%; height:158px; color:var(--accent); background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 6%,var(--surface)),var(--surface)); }.route-svg .route-marker { fill:var(--surface); stroke:currentColor; stroke-width:1.5; }.route-svg text { fill:currentColor; font-size:4px; font-weight:800; }
      .trip-foot { min-height:34px; display:flex; align-items:center; justify-content:space-between; padding:6px 12px; color:var(--muted); font-size:9px; border-top:1px solid var(--border); }
      .diagnostic-summary { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; }.diag-tile { min-height:78px; border:1px solid var(--border); border-radius:17px; background:var(--surface); padding:11px 12px; display:flex; flex-direction:column; justify-content:space-between; }.diag-tile span { color:var(--muted); font-size:9px; }.diag-tile strong { font-size:14px; overflow-wrap:anywhere; }.diag-tile.ok strong { color:var(--ok); }.diag-tile.warn strong { color:var(--warn); }.diag-tile.danger strong { color:var(--danger); }
      .read-only-banner { margin-top:12px; border:1px solid color-mix(in srgb,var(--accent) 22%,var(--border)); border-radius:18px; padding:12px; background:color-mix(in srgb,var(--accent) 7%,var(--surface)); display:grid; grid-template-columns:30px minmax(0,1fr); gap:9px; }.read-only-banner > ha-icon { color:var(--accent); }.read-only-banner strong,.read-only-banner span { display:block; }.read-only-banner strong { font-size:12px; }.read-only-banner span { margin-top:3px; color:var(--muted); font-size:9px; line-height:1.4; }
      .diag-list { overflow:hidden; border:1px solid var(--border); border-radius:18px; background:var(--surface); }.diag-entity { min-height:54px; padding:8px 10px 8px 12px; display:flex; align-items:center; justify-content:space-between; gap:10px; border-bottom:1px solid var(--border); }.diag-entity:last-child { border-bottom:0; }.diag-entity.unavailable { opacity:.62; }.diag-entity > div:first-child { min-width:0; }.diag-entity strong,.diag-entity span { display:block; }.diag-entity strong { font-size:11px; }.diag-entity > div:first-child span { margin-top:2px; color:var(--muted); font-size:8px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:62vw; }.diag-state { display:flex; align-items:center; gap:5px; color:var(--muted); }.diag-state > span { font-size:9px; }.diag-state > ha-icon { color:var(--muted); --mdc-icon-size:17px; }
      .empty-state { min-height:310px; display:grid; place-items:center; align-content:center; gap:9px; padding:26px; color:var(--muted); text-align:center; }.empty-state > ha-icon { --mdc-icon-size:42px; color:var(--accent); }.empty-state strong { color:var(--primary-text-color); font-size:15px; }.empty-state span { max-width:340px; font-size:10px; line-height:1.45; }.empty-state button { min-height:36px; border:0; border-radius:12px; padding:7px 12px; background:color-mix(in srgb,var(--accent) 10%,transparent); color:var(--accent); }.empty-state.danger > ha-icon { color:var(--danger); }
      .empty-inline { grid-column:1/-1; min-height:48px; border:1px dashed var(--border); border-radius:15px; display:grid; place-items:center; color:var(--muted); font-size:9px; }
      .spin { animation:spin 1s linear infinite; } @keyframes spin { to { transform:rotate(360deg); } }
      nav { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:3px; padding:6px max(6px,env(safe-area-inset-right)) calc(6px + env(safe-area-inset-bottom)) max(6px,env(safe-area-inset-left)); background:var(--surface); border-top:1px solid var(--border); box-shadow:0 -3px 14px color-mix(in srgb,#000 8%,transparent); z-index:8; }
      nav button { min-width:0; min-height:57px; border:0; border-radius:14px; background:transparent; color:var(--muted); display:grid; place-items:center; align-content:center; gap:2px; padding:4px 2px; }
      nav button.active { color:var(--accent); background:color-mix(in srgb,var(--accent) 10%,transparent); }
      nav ha-icon { --mdc-icon-size:22px; }.nav-busy { position:relative; }.nav-busy::after { content:""; position:absolute; top:5px; right:calc(50% - 16px); width:6px; height:6px; border-radius:50%; background:var(--accent); animation:pulse 1s ease-in-out infinite; } @keyframes pulse { 50% { opacity:.25; } }
      nav span { max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:9px; font-weight:700; }
      @media (min-width:700px) { .shell { padding-top:18px; }.telemetry-grid { grid-template-columns:repeat(4,minmax(0,1fr)); }.vehicle-stage { min-height:300px; }.vehicle-icon { --mdc-icon-size:210px; }.diagnostic-summary { grid-template-columns:repeat(3,minmax(0,1fr)); }.trip-list { grid-template-columns:repeat(2,minmax(0,1fr)); } }
    </style>
    <div class="app">
      <header>
        <button id="menu" aria-label="Открыть меню Home Assistant"><ha-icon icon="mdi:menu"></ha-icon></button>
        <button class="vehicle-title" id="vehiclePicker" aria-label="Выбрать автомобиль"><div class="copy"><strong>${this._escape(vehicle?.name || "StarLine")}</strong><span>${online ? "В сети" : "Недоступен"}</span></div><ha-icon icon="mdi:chevron-down"></ha-icon></button>
        <button id="diagnostics" aria-label="Диагностика"><ha-icon icon="mdi:cog-outline"></ha-icon></button>
        ${this._vehicleMenu()}
      </header>
      <div id="content"><div class="shell">
        ${this._loading ? `<div class="notice">Обновляю конфигурацию панели…</div>` : ""}
        ${this._error ? `<div class="notice">Bootstrap: ${this._escape(this._error)}</div>` : ""}
        ${this._content(vehicle)}
      </div></div>
      <nav aria-label="Разделы StarLine" class="${historyBusy ? "nav-busy" : ""}">${this._tabbar()}</nav>
    </div>`;

    this.shadowRoot.getElementById("menu")?.addEventListener("click", (event) => openHomeAssistantMenu(event.currentTarget));
    this.shadowRoot.getElementById("diagnostics")?.addEventListener("click", () => this._setView("diagnostics"));
    this.shadowRoot.getElementById("vehiclePicker")?.addEventListener("click", () => {
      if (this._vehicles().length < 2) return;
      this._pickerOpen = !this._pickerOpen;
      this._render();
    });
    this.shadowRoot.querySelectorAll("[data-vehicle]").forEach((button) => button.addEventListener("click", () => {
      this._vehicleId = button.dataset.vehicle;
      this._pickerOpen = false;
      this._lastStateSignature = this._stateSignature();
      this._render();
      this._ensureHistory();
    }));
    this.shadowRoot.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => this._setView(button.dataset.view)));
    this.shadowRoot.querySelectorAll("[data-view-target]").forEach((button) => button.addEventListener("click", () => this._setView(button.dataset.viewTarget)));
    this.shadowRoot.querySelectorAll("[data-entity]").forEach((button) => button.addEventListener("click", () => this._openMoreInfo(button.dataset.entity)));
    this.shadowRoot.querySelectorAll("[data-refresh-history]").forEach((button) => button.addEventListener("click", () => this._ensureHistory(true)));

    this._mapCard = null;
    this._mountMap();
  }
}

if (!customElements.get("starline-app-panel-v003")) {
  customElements.define("starline-app-panel-v003", StarLineAppPanelV003);
}
