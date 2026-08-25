import "./starline-app-v010.js?v=0.3.3-core-bridge";

const BASE_COMPONENT = customElements.get("starline-app-panel-v010");
const UI_VERSION = "0.4.0";
const ASSET_BASE = "/starline_telemetry_static/assets";

class StarLineAppPanelV011 extends BASE_COMPONENT {
  _assetFor(vehicle, kind) {
    const name = String(vehicle?.name || "");
    const id = name.includes("130") ? "130" : name.includes("683") ? "683" : "130";
    return `${ASSET_BASE}/starline-${kind}-${id}.svg?v=${UI_VERSION}`;
  }

  _summarySecurity(vehicle) {
    const entity = this._entity(vehicle, ["lock", "armed", "security"]);
    if (entity) {
      const locked = this._isLocked(entity);
      const text = locked === null ? "Нет данных" : locked ? "Норма" : "Снята";
      const tone = locked === null ? "muted" : locked ? "ok" : "warn";
      return `<div class="summary-security ${tone}"><ha-icon icon="mdi:shield-car"></ha-icon><div><span>Охрана</span><strong>${this._escape(text)}</strong></div></div>`;
    }
    const alarm = this._entity(vehicle, ["alarm"]);
    const active = alarm ? this._isOn(alarm) : null;
    const text = active === true ? "Тревога" : active === false ? "Норма" : "Нет данных";
    const tone = active === true ? "danger" : active === false ? "ok" : "muted";
    return `<div class="summary-security ${tone}"><ha-icon icon="mdi:shield-car"></ha-icon><div><span>Охрана</span><strong>${this._escape(text)}</strong></div></div>`;
  }

  _summaryMetric(vehicle, keys, label, icon, options = {}) {
    const entity = this._entity(vehicle, keys);
    const value = entity ? this._formatState(entity, options) : "—";
    return `<div class="summary-metric"><ha-icon icon="${icon}"></ha-icon><div><span>${label}</span><strong>${this._escape(value)}</strong></div></div>`;
  }

  _summaryConnection(vehicle) {
    const gsm = this._entity(vehicle, ["gsm_lvl", "gsm_level"]);
    const gps = this._entity(vehicle, ["gps_count", "gps_satellites"]);
    const gsmValue = gsm ? this._formatState(gsm, { digits: 0 }).replace(/\s+/g, " ") : "—";
    const gpsValue = gps ? this._formatState(gps, { digits: 0 }).replace(/\s*(satellites|спутников|спутника|спутник)\s*/gi, "").trim() : "—";
    return `<div class="summary-connection"><ha-icon icon="mdi:access-point-network"></ha-icon><div><span>Связь</span><strong>GSM ${this._escape(gsmValue)} · GPS ${this._escape(gpsValue)}</strong></div></div>`;
  }

  _summaryPerimeter(vehicle) {
    const item = (keys, label, icon, onText, offText) => {
      const entity = this._entity(vehicle, keys);
      const state = this._isOn(entity);
      const text = state === null ? "Нет данных" : state ? onText : offText;
      const tone = state === null ? "muted" : state ? "warn" : "ok";
      return `<div class="summary-state ${tone}"><ha-icon icon="${icon}"></ha-icon><div><span>${label}</span><strong>${text}</strong></div></div>`;
    };
    return [
      item(["hood"], "Капот", "mdi:car-lifted-pickup", "Открыт", "Закрыт"),
      item(["door"], "Двери", "mdi:car-door", "Открыты", "Закрыты"),
      item(["trunk"], "Багажник", "mdi:car-back", "Открыт", "Закрыт"),
    ].join("");
  }

  _summaryOperational(vehicle) {
    const engine = this._entity(vehicle, ["engine_running", "run", "ignition", "ign"]);
    const running = this._isOn(engine);
    const brake = this._entity(vehicle, ["hbrake"]);
    const parked = this._isOn(brake);
    return `<div class="summary-state ${running ? "active" : "ok"}"><ha-icon icon="${running ? "mdi:engine" : "mdi:engine-off-outline"}"></ha-icon><div><span>Двигатель</span><strong>${running === null ? "Нет данных" : running ? "Работает" : "Остановлен"}</strong></div></div>
      <div class="summary-state ${parked ? "active" : "muted"}"><ha-icon icon="mdi:car-brake-hold"></ha-icon><div><span>Ручник</span><strong>${parked === null ? "Нет данных" : parked ? "Поднят" : "Снят"}</strong></div></div>`;
  }

  _summaryEvent(vehicle) {
    const event = this._lastEvent(vehicle);
    if (!event) return `<div class="summary-event"><ha-icon icon="mdi:information-outline"></ha-icon><div><span>Последнее событие</span><strong>${this._escape(this._perimeter(vehicle).label)}</strong></div></div>`;
    return `<button class="summary-event" data-view-target="history"><ha-icon icon="${event.icon}"></ha-icon><div><span>${this._escape(this._formatDateTime(event.timestamp))}</span><strong>${this._escape(event.label)}</strong></div><ha-icon class="chevron" icon="mdi:chevron-right"></ha-icon></button>`;
  }

  _vehicleSummaryCard(vehicle) {
    const online = this._online(vehicle);
    const freshness = this._relativeTime(this._latestUpdate(vehicle));
    const metrics = [
      this._summaryMetric(vehicle, ["battery"], "АКБ", "mdi:car-battery", { digits: 1 }),
      this._summaryMetric(vehicle, ["fuel", "fuel_percent", "fuel_litres"], "Топливо", "mdi:gas-station-outline", { digits: 0 }),
      this._summaryMetric(vehicle, ["etemp", "engine_temperature"], "Двигатель", "mdi:thermometer", { digits: 0 }),
      this._summaryMetric(vehicle, ["ctemp", "cabin_temperature"], "Салон", "mdi:car-seat-heater", { digits: 0 }),
    ].join("");

    return `<article class="vehicle-summary-card">
      <div class="summary-hero">
        <img class="summary-bg" src="${this._assetFor(vehicle, "bg")}" alt="" aria-hidden="true">
        <div class="summary-overlay"></div>
        <div class="summary-identity"><strong>${this._escape(vehicle.name)}</strong><span>Nissan MURANO Z52</span><small><i class="status-dot ${online ? "online" : "offline"}"></i>${online ? "В сети" : "Недоступен"} · ${this._escape(freshness)}</small></div>
        ${this._summarySecurity(vehicle)}
        <img class="summary-car" src="${this._assetFor(vehicle, "car")}" alt="Nissan Murano ${this._escape(vehicle.name)}">
        <div class="summary-metrics">${metrics}</div>
        ${this._summaryConnection(vehicle)}
      </div>
      <div class="summary-status-row"><div class="summary-group"><span class="group-title">Периметр</span><div class="summary-state-grid">${this._summaryPerimeter(vehicle)}</div></div><div class="summary-group"><span class="group-title">Состояние</span><div class="summary-state-grid operational">${this._summaryOperational(vehicle)}</div></div></div>
      ${this._summaryEvent(vehicle)}
    </article>`;
  }

  _statusView(vehicle) {
    if (!this._mobileOnly()) return super._statusView(vehicle);
    const vehicles = this._orderedVehicles();
    return `<div class="dual-summary"><div class="summary-heading"><ha-icon icon="mdi:car-multiple"></ha-icon><div><strong>Сводка</strong><span>Состояние обоих автомобилей</span></div></div>${vehicles.map((item) => this._vehicleSummaryCard(item)).join("")}</div>`;
  }

  _installCommonHeader() {
    super._installCommonHeader();
    if (!this._mobileOnly() || !this.shadowRoot) return;
    const title = this.shadowRoot.querySelector(".nika-title span");
    if (title) title.textContent = `Автомобили · UI v${UI_VERSION}`;
  }

  _render() {
    super._render();
    if (!this._mobileOnly() || !this.shadowRoot) return;
    const firstNavLabel = this.shadowRoot.querySelector('nav button[data-view="status"] span');
    if (firstNavLabel) firstNavLabel.textContent = "Сводка";
    const firstNavIcon = this.shadowRoot.querySelector('nav button[data-view="status"] ha-icon');
    if (firstNavIcon) firstNavIcon.setAttribute("icon", "mdi:car-multiple");

    if (this.shadowRoot.querySelector("style[data-starline-summary-v011]")) return;
    const style = document.createElement("style");
    style.dataset.starlineSummaryV011 = "true";
    style.textContent = `
      .dual-summary { display:grid; gap:14px; }
      .summary-heading { display:grid; grid-template-columns:42px minmax(0,1fr); gap:10px; align-items:center; padding:2px 4px; }
      .summary-heading > ha-icon { color:var(--accent); --mdc-icon-size:31px; }
      .summary-heading strong { display:block; font-size:20px; line-height:1.05; font-weight:800; }
      .summary-heading span { display:block; margin-top:4px; color:var(--muted); font-size:12px; }
      .vehicle-summary-card { overflow:hidden; border:1px solid var(--border); border-radius:24px; background:var(--surface); box-shadow:0 4px 18px color-mix(in srgb,#000 8%,transparent); }
      .summary-hero { position:relative; min-height:335px; overflow:hidden; background:#dcecf3; }
      .summary-bg { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
      .summary-overlay { position:absolute; inset:0; background:linear-gradient(90deg,rgba(255,255,255,.92) 0%,rgba(255,255,255,.64) 38%,rgba(255,255,255,.08) 70%,rgba(255,255,255,.02) 100%); }
      .summary-identity { position:absolute; z-index:3; left:18px; top:16px; max-width:56%; }
      .summary-identity strong { display:block; color:#0b67b2; font-size:29px; line-height:1; font-weight:850; }
      .summary-identity span { display:block; margin-top:7px; color:var(--primary-text-color); font-size:15px; font-weight:650; }
      .summary-identity small { display:flex; align-items:center; gap:6px; margin-top:7px; color:var(--muted); font-size:12px; font-weight:650; }
      .status-dot { width:9px; height:9px; border-radius:50%; background:var(--muted); }
      .status-dot.online { background:var(--ok); } .status-dot.offline { background:var(--danger); }
      .summary-security { position:absolute; z-index:4; right:12px; top:12px; min-width:104px; min-height:52px; display:grid; grid-template-columns:26px minmax(0,1fr); align-items:center; gap:7px; padding:8px 10px; border:1px solid rgba(255,255,255,.9); border-radius:17px; background:rgba(255,255,255,.88); backdrop-filter:blur(7px); box-shadow:0 3px 12px rgba(0,0,0,.12); }
      .summary-security ha-icon { color:#0b67b2; --mdc-icon-size:24px; } .summary-security span { display:block; color:var(--muted); font-size:9px; } .summary-security strong { display:block; margin-top:3px; font-size:14px; }
      .summary-security.ok strong { color:var(--primary-text-color); } .summary-security.warn strong { color:var(--warn); } .summary-security.danger strong { color:var(--danger); }
      .summary-car { position:absolute; z-index:2; right:-22px; bottom:66px; width:70%; max-width:470px; height:auto; filter:drop-shadow(0 14px 12px rgba(0,0,0,.2)); pointer-events:none; }
      .summary-metrics { position:absolute; z-index:4; left:14px; bottom:12px; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; width:min(48%,320px); }
      .summary-metric { min-height:64px; display:grid; grid-template-columns:28px minmax(0,1fr); align-items:center; gap:8px; padding:8px 10px; border:1px solid rgba(255,255,255,.9); border-radius:16px; background:rgba(255,255,255,.89); backdrop-filter:blur(7px); box-shadow:0 2px 9px rgba(0,0,0,.1); }
      .summary-metric ha-icon,.summary-connection ha-icon { color:#0b67b2; --mdc-icon-size:25px; } .summary-metric span,.summary-connection span { display:block; color:var(--muted); font-size:9px; } .summary-metric strong,.summary-connection strong { display:block; margin-top:4px; font-size:16px; line-height:1.05; font-weight:800; }
      .summary-connection { position:absolute; z-index:4; right:12px; bottom:14px; max-width:44%; min-height:58px; display:grid; grid-template-columns:28px minmax(0,1fr); align-items:center; gap:8px; padding:8px 10px; border:1px solid rgba(255,255,255,.9); border-radius:17px; background:rgba(255,255,255,.89); backdrop-filter:blur(7px); box-shadow:0 2px 9px rgba(0,0,0,.1); }
      .summary-connection strong { font-size:13px; }
      .summary-status-row { display:grid; grid-template-columns:3fr 2fr; border-top:1px solid var(--border); }
      .summary-group { min-width:0; padding:10px 12px 8px; } .summary-group + .summary-group { border-left:1px solid var(--border); }
      .group-title { display:block; margin-bottom:7px; color:var(--muted); font-size:9px; font-weight:750; }
      .summary-state-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; } .summary-state-grid.operational { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .summary-state { min-width:0; display:grid; grid-template-columns:24px minmax(0,1fr); align-items:center; gap:6px; }
      .summary-state ha-icon { color:var(--muted); --mdc-icon-size:22px; } .summary-state span { display:block; color:var(--muted); font-size:8px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; } .summary-state strong { display:block; margin-top:4px; font-size:11px; line-height:1.05; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .summary-state.ok ha-icon,.summary-state.ok strong { color:var(--ok); } .summary-state.warn ha-icon,.summary-state.warn strong { color:var(--warn); } .summary-state.danger ha-icon,.summary-state.danger strong { color:var(--danger); } .summary-state.active ha-icon,.summary-state.active strong { color:var(--accent); }
      .summary-event { width:100%; min-height:54px; border:0; border-top:1px solid var(--border); background:var(--surface); color:var(--primary-text-color); display:grid; grid-template-columns:27px minmax(0,1fr) 20px; align-items:center; gap:9px; padding:9px 13px; text-align:left; }
      .summary-event > ha-icon:first-child { color:var(--accent); --mdc-icon-size:23px; } .summary-event span { display:block; color:var(--muted); font-size:9px; } .summary-event strong { display:block; margin-top:3px; font-size:13px; line-height:1.1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; } .summary-event .chevron { color:var(--muted); --mdc-icon-size:20px; }
      @media (max-width:390px) { .summary-hero { min-height:322px; } .summary-car { width:73%; right:-35px; bottom:72px; } .summary-identity strong { font-size:26px; } .summary-identity span { font-size:13px; } .summary-metrics { width:49%; gap:6px; } .summary-metric { min-height:60px; padding:7px 8px; } .summary-metric strong { font-size:14px; } .summary-connection { max-width:45%; } .summary-status-row { grid-template-columns:1fr; } .summary-group + .summary-group { border-left:0; border-top:1px solid var(--border); } }
    `;
    this.shadowRoot.append(style);
  }
}

if (!customElements.get("starline-app-panel-v011")) {
  customElements.define("starline-app-panel-v011", StarLineAppPanelV011);
}
