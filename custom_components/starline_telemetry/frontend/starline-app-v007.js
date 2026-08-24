import "./starline-app-v005.js?v=0.2.3-core-bridge";

const BASE_COMPONENT = customElements.get("starline-app-panel-v005");

class StarLineAppPanelV007 extends BASE_COMPONENT {
  _mobileOnly() {
    return window.matchMedia?.("(max-width: 699px)")?.matches ?? true;
  }

  _carAccent(vehicle) {
    const name = String(vehicle?.name || "");
    if (name.includes("130")) return "#1677c8";
    if (name.includes("683")) return "#343b40";
    return "var(--accent)";
  }

  _metric(vehicle, keys, label, icon, options = {}) {
    const entity = this._entity(vehicle, keys);
    if (!entity) return "";
    const raw = String(entity.state.state).toLowerCase();
    const unavailable = ["unknown", "unavailable"].includes(raw);
    const value = unavailable ? "—" : this._formatState(entity, options);
    return `<button class="m-metric ${unavailable ? "muted" : ""}" data-entity="${this._escape(entity.entityId)}">
      <ha-icon icon="${icon}"></ha-icon>
      <div><span>${this._escape(label)}</span><strong>${this._escape(value)}</strong></div>
    </button>`;
  }

  _connectionMetric(vehicle) {
    const gsm = this._entity(vehicle, ["gsm_lvl", "gsm_level"]);
    const gps = this._entity(vehicle, ["gps_count", "gps_satellites"]);
    if (!gsm && !gps) return "";
    const gsmValue = gsm ? this._formatState(gsm, { digits: 0 }).replace(/\s+/g, " ") : "—";
    const gpsRaw = gps ? this._formatState(gps, { digits: 0 }) : "—";
    const gpsValue = gpsRaw.replace(/\s*(satellites|спутников|спутника|спутник)\s*/gi, "").trim();
    const entityId = gsm?.entityId || gps?.entityId;
    return `<button class="m-metric" data-entity="${this._escape(entityId)}">
      <ha-icon icon="mdi:access-point-network"></ha-icon>
      <div><span>Связь</span><strong class="dual">GSM ${this._escape(gsmValue)} · GPS ${this._escape(gpsValue)}</strong></div>
    </button>`;
  }

  _binaryStateCard(vehicle, keys, label, icon, onText, offText, semantics = "normal") {
    const entity = this._entity(vehicle, keys);
    if (!entity) {
      return `<div class="m-state muted"><ha-icon icon="${icon}"></ha-icon><div><span>${label}</span><strong>Нет данных</strong></div></div>`;
    }
    const state = this._isOn(entity);
    const text = state === null ? "Нет данных" : state ? onText : offText;
    let tone = "ok";
    if (state === null) tone = "muted";
    else if (semantics === "open") tone = state ? "warn" : "ok";
    else if (semantics === "alarm") tone = state ? "danger" : "ok";
    else if (semantics === "active") tone = state ? "active" : "muted";
    return `<button class="m-state ${tone}" data-entity="${this._escape(entity.entityId)}"><ha-icon icon="${icon}"></ha-icon><div><span>${label}</span><strong>${this._escape(text)}</strong></div></button>`;
  }

  _securityCard(vehicle) {
    const entity = this._entity(vehicle, ["lock", "armed"]);
    const locked = this._isLocked(entity);
    const text = locked === null ? "Нет данных" : locked ? "Под охраной" : "Снята";
    const tone = locked === null ? "muted" : locked ? "ok" : "warn";
    return `<div class="m-state ${tone}"><ha-icon icon="mdi:shield-car"></ha-icon><div><span>Охрана</span><strong>${this._escape(text)}</strong></div></div>`;
  }

  _engineCard(vehicle) {
    const entity = this._entity(vehicle, ["engine_running", "run", "ignition", "ign"]);
    const running = this._isOn(entity);
    const text = running === null ? "Нет данных" : running ? "Работает" : "Остановлен";
    const tone = running === true ? "active" : running === false ? "muted" : "muted";
    return `<div class="m-state ${tone}"><ha-icon icon="${running ? "mdi:engine" : "mdi:engine-off-outline"}"></ha-icon><div><span>Двигатель</span><strong>${this._escape(text)}</strong></div></div>`;
  }

  _handbrakeCard(vehicle) {
    const entity = this._entity(vehicle, ["hbrake"]);
    const state = this._isOn(entity);
    const text = state === null ? "Нет данных" : state ? "Поднят" : "Снят";
    return `<button class="m-state ${state === true ? "active" : state === false ? "muted" : "muted"}" ${entity ? `data-entity="${this._escape(entity.entityId)}"` : ""}><ha-icon icon="mdi:car-brake-hold"></ha-icon><div><span>Ручник</span><strong>${this._escape(text)}</strong></div></button>`;
  }

  _mobileLastEvent(vehicle) {
    const event = this._lastEvent(vehicle);
    if (!event) {
      return `<div class="m-event"><ha-icon icon="mdi:information-outline"></ha-icon><div><span>Последнее событие</span><strong>${this._escape(this._perimeter(vehicle).label)}</strong></div></div>`;
    }
    return `<button class="m-event" data-view-target="history">
      <ha-icon icon="${event.icon}"></ha-icon>
      <div><span>${this._escape(this._formatDateTime(event.timestamp))}</span><strong>${this._escape(event.label)}</strong></div>
      <ha-icon class="chevron" icon="mdi:chevron-right"></ha-icon>
    </button>`;
  }

  _statusView(vehicle) {
    if (!this._mobileOnly()) return super._statusView(vehicle);

    const freshness = this._relativeTime(this._latestUpdate(vehicle));
    const metrics = [
      this._metric(vehicle, ["battery"], "АКБ", "mdi:car-battery", { digits: 1 }),
      this._metric(vehicle, ["fuel", "fuel_percent", "fuel_litres"], "Топливо", "mdi:gas-station-outline", { digits: 0 }),
      this._metric(vehicle, ["mileage", "odometer"], "Пробег", "mdi:counter", { digits: 0 }),
      this._metric(vehicle, ["ctemp", "cabin_temperature"], "Салон", "mdi:car-seat-heater", { digits: 0 }),
      this._metric(vehicle, ["etemp", "engine_temperature"], "Двигатель", "mdi:thermometer", { digits: 0 }),
      this._connectionMetric(vehicle),
    ].filter(Boolean).join("");

    const perimeter = [
      this._binaryStateCard(vehicle, ["hood"], "Капот", "mdi:car-lifted-pickup", "Открыт", "Закрыт", "open"),
      this._binaryStateCard(vehicle, ["door"], "Двери", "mdi:car-door", "Открыты", "Закрыты", "open"),
      this._binaryStateCard(vehicle, ["trunk"], "Багажник", "mdi:car-back", "Открыт", "Закрыт", "open"),
    ].join("");

    const operational = [
      this._securityCard(vehicle),
      this._engineCard(vehicle),
      this._handbrakeCard(vehicle),
    ].join("");

    const location = this._entity(vehicle, ["location", "vehicle_location"]);
    const mapFallback = location
      ? `<div class="map-fallback"><ha-icon icon="mdi:map-marker-radius"></ha-icon><span>Загрузка карты…</span></div>`
      : `<div class="map-fallback"><ha-icon icon="mdi:map-marker-off-outline"></ha-icon><span>Местоположение недоступно</span></div>`;

    return `<div class="m-status">
      <div class="m-identity">
        <div class="m-car" style="--car-accent:${this._carAccent(vehicle)}"><ha-icon icon="mdi:car-side"></ha-icon></div>
        <div><strong>${this._escape(vehicle?.name || "StarLine")}</strong><span>${this._online(vehicle) ? "В сети" : "Недоступен"} · ${this._escape(freshness)}</span></div>
      </div>

      <div class="m-metrics">${metrics || `<div class="empty-inline">Телеметрия не найдена</div>`}</div>

      <div class="m-section-label"><strong>Периметр</strong></div>
      <div class="m-state-grid perimeter">${perimeter}</div>

      <div class="m-section-label"><strong>Состояние</strong></div>
      <div class="m-state-grid operational">${operational}</div>

      ${this._mobileLastEvent(vehicle)}

      <section class="m-map-section">
        <div class="m-map-head"><div><strong>Местоположение</strong><span>${location ? this._escape(location.state.state) : "Нет данных"}</span></div><ha-icon icon="mdi:crosshairs-gps"></ha-icon></div>
        <div id="mapHost" class="map-host m-map-host">${mapFallback}</div>
      </section>
    </div>`;
  }

  _render() {
    super._render();
    if (!this._mobileOnly() || !this.shadowRoot) return;
    const style = document.createElement("style");
    style.textContent = `
      .shell { padding-top:8px !important; }
      .m-status { display:grid; gap:9px; }
      .m-identity { min-height:48px; display:grid; grid-template-columns:42px minmax(0,1fr); align-items:center; gap:9px; padding:5px 7px; }
      .m-car { width:42px; height:42px; border-radius:13px; display:grid; place-items:center; background:color-mix(in srgb,var(--car-accent) 11%,var(--surface)); color:var(--car-accent); }
      .m-car ha-icon { --mdc-icon-size:28px; }
      .m-identity strong { display:block; font-size:15px; line-height:1.05; font-weight:780; }
      .m-identity span { display:block; margin-top:4px; color:var(--muted); font-size:9px; font-weight:650; }

      .m-metrics { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; }
      .m-metric { min-width:0; min-height:57px; border:1px solid var(--border); border-radius:16px; background:color-mix(in srgb,var(--accent) 4%,var(--surface)); color:var(--primary-text-color); display:grid; grid-template-columns:27px minmax(0,1fr); align-items:center; gap:8px; padding:8px 10px; text-align:left; }
      .m-metric > ha-icon { color:var(--accent); --mdc-icon-size:23px; }
      .m-metric > div { min-width:0; }
      .m-metric span { display:block; color:var(--muted); font-size:8px; font-weight:700; line-height:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .m-metric strong { display:block; margin-top:5px; font-size:14px; line-height:1; font-weight:780; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .m-metric strong.dual { font-size:10px; letter-spacing:-.02em; }
      .m-metric.muted { opacity:.62; }

      .m-section-label { min-height:21px; display:flex; align-items:end; padding:2px 2px 0; }
      .m-section-label strong { font-size:11px; font-weight:780; }
      .m-state-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; }
      .m-state { min-width:0; min-height:57px; border:1px solid var(--border); border-radius:15px; background:var(--surface); color:var(--primary-text-color); display:grid; grid-template-columns:22px minmax(0,1fr); align-items:center; gap:6px; padding:7px 7px; text-align:left; }
      .m-state ha-icon { color:var(--muted); --mdc-icon-size:19px; }
      .m-state > div { min-width:0; }
      .m-state span { display:block; color:var(--muted); font-size:7px; font-weight:700; line-height:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .m-state strong { display:block; margin-top:5px; font-size:10px; line-height:1.05; font-weight:760; white-space:normal; overflow-wrap:anywhere; }
      .m-state.ok ha-icon,.m-state.ok strong { color:var(--ok); }
      .m-state.warn ha-icon,.m-state.warn strong { color:var(--warn); }
      .m-state.danger ha-icon,.m-state.danger strong { color:var(--danger); }
      .m-state.active ha-icon,.m-state.active strong { color:var(--accent); }
      .m-state.muted strong { color:var(--muted); }

      .m-event { width:100%; min-height:58px; border:1px solid var(--border); border-radius:17px; background:var(--surface); color:var(--primary-text-color); display:grid; grid-template-columns:27px minmax(0,1fr) 18px; align-items:center; gap:8px; padding:9px 11px; text-align:left; }
      .m-event > ha-icon:first-child { color:var(--accent); --mdc-icon-size:23px; }
      .m-event > div { min-width:0; }
      .m-event span { display:block; color:var(--muted); font-size:8px; line-height:1; }
      .m-event strong { display:block; margin-top:5px; font-size:12px; line-height:1.1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .m-event .chevron { color:var(--muted); --mdc-icon-size:18px; }

      .m-map-section { margin-top:1px; }
      .m-map-head { min-height:37px; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:0 3px 7px; }
      .m-map-head > div { min-width:0; }
      .m-map-head strong { display:block; font-size:12px; font-weight:780; }
      .m-map-head span { display:block; margin-top:3px; color:var(--muted); font-size:8px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .m-map-head > ha-icon { color:var(--accent); --mdc-icon-size:25px; }
      .m-map-host { min-height:178px !important; height:178px !important; border-radius:18px !important; overflow:hidden; }
      .m-map-host .embedded-map-card { height:178px !important; }

      @media (max-width:360px) {
        .m-metric { min-height:54px; padding:7px 8px; grid-template-columns:24px minmax(0,1fr); }
        .m-metric strong { font-size:13px; }
        .m-state { grid-template-columns:19px minmax(0,1fr); padding:6px; }
        .m-state strong { font-size:9px; }
      }
    `;
    this.shadowRoot.append(style);
  }
}

if (!customElements.get("starline-app-panel-v007")) {
  customElements.define("starline-app-panel-v007", StarLineAppPanelV007);
}
