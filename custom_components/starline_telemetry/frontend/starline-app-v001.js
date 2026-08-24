const PANEL_UI_VERSION = "0.1.0";

function openHomeAssistantMenu(target) {
  target.dispatchEvent(
    new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true }),
  );
}

class StarLineAppPanelV001 extends HTMLElement {
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
    this._hashListener = () => {
      this._view = this._viewFromLocation();
      this._render();
    };
  }

  set hass(value) {
    const first = !this._hass;
    this._hass = value;
    if (first && this.isConnected) this._loadBootstrap();
    else this._render();
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
    const value = (location.hash || "#overview").slice(1).toLowerCase();
    return ["overview", "security", "engine", "auto", "service"].includes(value)
      ? value
      : "overview";
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
      const vehicles = this._bootstrap?.vehicles || [];
      if (!this._vehicleId || !vehicles.some((v) => v.device_id === this._vehicleId)) {
        this._vehicleId = vehicles[0]?.device_id || null;
      }
    } catch (err) {
      this._error = err?.message || String(err);
      this._bootstrap = this._panel?.config?.bootstrap_fallback || null;
      const vehicles = this._bootstrap?.vehicles || [];
      this._vehicleId = vehicles[0]?.device_id || null;
    } finally {
      this._loading = false;
      this._render();
    }
  }

  _vehicles() {
    return this._bootstrap?.vehicles || [];
  }

  _vehicle() {
    return this._vehicles().find((v) => v.device_id === this._vehicleId) || this._vehicles()[0] || null;
  }

  _entity(vehicle, keys) {
    if (!vehicle) return null;
    for (const key of keys) {
      const entityId = vehicle.entities?.[key];
      if (entityId && this._hass?.states?.[entityId]) return { entityId, key, state: this._hass.states[entityId] };
    }
    return null;
  }

  _escape(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  _formatState(entity) {
    if (!entity?.state) return "—";
    const state = entity.state.state;
    if (["unknown", "unavailable", "none", "null"].includes(String(state).toLowerCase())) return "Нет данных";
    const unit = entity.state.attributes?.unit_of_measurement;
    return `${state}${unit ? ` ${unit}` : ""}`;
  }

  _binaryText(entity, kind) {
    if (!entity) return "—";
    const raw = String(entity.state.state).toLowerCase();
    if (["unknown", "unavailable"].includes(raw)) return "Нет данных";
    const on = ["on", "true", "open", "unlocked"].includes(raw);
    const locked = raw === "locked" || (entity.key === "armed" && on);
    const map = {
      lock: locked ? "Под охраной" : "Снята охрана",
      alarm: on ? "Тревога" : "Норма",
      door: on ? "Открыты" : "Закрыты",
      hood: on ? "Открыт" : "Закрыт",
      trunk: on ? "Открыт" : "Закрыт",
      engine: on ? "Работает" : "Остановлен",
      autostart: on ? "Активен" : "Не активен",
      brake: on ? "Включён" : "Выключен",
      yesno: on ? "Да" : "Нет",
    };
    return map[kind] || (on ? "Включено" : "Выключено");
  }

  _tone(entity, kind) {
    if (!entity) return "muted";
    const raw = String(entity.state.state).toLowerCase();
    if (["unknown", "unavailable"].includes(raw)) return "muted";
    const on = ["on", "true", "open", "unlocked"].includes(raw);
    if (kind === "alarm") return on ? "danger" : "ok";
    if (["door", "hood", "trunk"].includes(kind)) return on ? "warn" : "ok";
    if (kind === "lock") return raw === "locked" || (entity.key === "armed" && on) ? "ok" : "warn";
    if (kind === "engine") return on ? "active" : "muted";
    return on ? "active" : "muted";
  }

  _openMoreInfo(entityId) {
    if (!entityId) return;
    this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        detail: { entityId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  _metric(vehicle, keys, label, icon, kind = null) {
    const entity = this._entity(vehicle, keys);
    if (!entity) return "";
    const value = kind ? this._binaryText(entity, kind) : this._formatState(entity);
    const tone = kind ? this._tone(entity, kind) : "neutral";
    return `<button class="metric ${tone}" data-entity="${this._escape(entity.entityId)}">
      <ha-icon icon="${icon}"></ha-icon>
      <span class="metric-label">${label}</span>
      <strong>${this._escape(value)}</strong>
    </button>`;
  }

  _section(title, subtitle, content) {
    if (!content || !content.trim()) return "";
    return `<section class="section">
      <div class="section-head"><div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ""}</div></div>
      <div class="grid">${content}</div>
    </section>`;
  }

  _renderOverview(vehicle) {
    const lock = this._entity(vehicle, ["lock", "armed"]);
    const engine = this._entity(vehicle, ["run", "engine_running"]);
    const alarm = this._entity(vehicle, ["alarm"]);
    const lockText = lock ? this._binaryText(lock, "lock") : "Нет данных";
    const engineText = engine ? this._binaryText(engine, "engine") : "Нет данных";
    const alarmText = alarm ? this._binaryText(alarm, "alarm") : "Нет данных";
    const heroTone = alarm && this._tone(alarm, "alarm") === "danger" ? "danger" : "normal";

    const status = [
      this._metric(vehicle, ["lock", "armed"], "Охрана", "mdi:shield-car", "lock"),
      this._metric(vehicle, ["alarm"], "Тревога", "mdi:alarm-light-outline", "alarm"),
      this._metric(vehicle, ["door"], "Двери", "mdi:car-door", "door"),
      this._metric(vehicle, ["hood"], "Капот", "mdi:car-lifted-pickup", "hood"),
      this._metric(vehicle, ["trunk"], "Багажник", "mdi:car-back", "trunk"),
      this._metric(vehicle, ["run", "engine_running"], "Двигатель", "mdi:engine", "engine"),
    ].join("");

    const resources = [
      this._metric(vehicle, ["battery"], "АКБ", "mdi:car-battery"),
      this._metric(vehicle, ["fuel", "fuel_percent", "fuel_litres"], "Топливо", "mdi:gas-station-outline"),
      this._metric(vehicle, ["mileage", "odometer"], "Пробег", "mdi:counter"),
      this._metric(vehicle, ["ctemp", "cabin_temperature"], "Салон", "mdi:car-seat-heater"),
      this._metric(vehicle, ["etemp", "engine_temperature"], "Двигатель °", "mdi:thermometer"),
      this._metric(vehicle, ["gsm_lvl", "gsm_level"], "GSM", "mdi:signal"),
    ].join("");

    return `<div class="hero ${heroTone}">
      <div class="hero-icon"><ha-icon icon="mdi:car-connected"></ha-icon></div>
      <div class="hero-copy"><span>Состояние автомобиля</span><strong>${this._escape(vehicle?.name || "StarLine")}</strong>
        <p>${this._escape(lockText)} · ${this._escape(engineText)} · ${this._escape(alarmText)}</p></div>
      <div class="readonly">READ ONLY</div>
    </div>
    ${this._section("Сейчас", "Ключевые состояния", status)}
    ${this._section("Ресурсы", "Данные штатной интеграции StarLine", resources)}`;
  }

  _renderSecurity(vehicle) {
    const cards = [
      this._metric(vehicle, ["lock", "armed"], "Охрана", "mdi:shield-lock-outline", "lock"),
      this._metric(vehicle, ["alarm"], "Тревога", "mdi:alarm-light-outline", "alarm"),
      this._metric(vehicle, ["door"], "Двери", "mdi:car-door", "door"),
      this._metric(vehicle, ["hood"], "Капот", "mdi:car-lifted-pickup", "hood"),
      this._metric(vehicle, ["trunk"], "Багажник", "mdi:car-back", "trunk"),
      this._metric(vehicle, ["hbrake"], "Ручник", "mdi:car-brake-hold", "brake"),
    ].join("");
    return this._section("Охрана", "Панель намеренно не отправляет команды автомобилю", cards) || this._empty();
  }

  _renderEngine(vehicle) {
    const cards = [
      this._metric(vehicle, ["run", "engine_running"], "Двигатель", "mdi:engine", "engine"),
      this._metric(vehicle, ["r_start"], "Автозапуск", "mdi:engine-outline", "autostart"),
      this._metric(vehicle, ["etemp", "engine_temperature"], "Температура двигателя", "mdi:thermometer"),
      this._metric(vehicle, ["ctemp", "cabin_temperature"], "Температура салона", "mdi:car-seat-heater"),
      this._metric(vehicle, ["battery"], "Аккумулятор", "mdi:car-battery"),
      this._metric(vehicle, ["ignition"], "Зажигание", "mdi:car-key", "yesno"),
    ].join("");
    return this._section("Двигатель", "Состояние и температуры", cards) || this._empty();
  }

  _renderAuto(vehicle) {
    const location = this._entity(vehicle, ["location", "vehicle_location"]);
    const cards = [
      location ? this._metric(vehicle, ["location", "vehicle_location"], "Местоположение", "mdi:map-marker-radius-outline") : "",
      this._metric(vehicle, ["mileage", "odometer"], "Пробег", "mdi:counter"),
      this._metric(vehicle, ["fuel", "fuel_percent", "fuel_litres"], "Топливо", "mdi:gas-station-outline"),
      this._metric(vehicle, ["gsm_lvl", "gsm_level"], "GSM", "mdi:signal"),
      this._metric(vehicle, ["gps_count", "gps_satellites"], "GPS", "mdi:satellite-variant"),
      this._metric(vehicle, ["balance"], "Баланс", "mdi:wallet-outline"),
    ].join("");
    let mapInfo = "";
    if (location) {
      const lat = location.state.attributes?.latitude;
      const lon = location.state.attributes?.longitude;
      if (lat != null && lon != null) {
        mapInfo = `<div class="location-line"><ha-icon icon="mdi:crosshairs-gps"></ha-icon><span>${this._escape(lat)}, ${this._escape(lon)}</span></div>`;
      }
    }
    return `${mapInfo}${this._section("Автомобиль", "Положение, пробег и связь", cards) || this._empty()}`;
  }

  _renderService(vehicle) {
    const cards = [
      this._metric(vehicle, ["errors"], "Ошибки OBD", "mdi:car-wrench"),
      this._metric(vehicle, ["hfree"], "Hands Free", "mdi:access-point", "yesno"),
      this._metric(vehicle, ["neutral"], "Нейтраль", "mdi:car-shift-pattern", "yesno"),
      this._metric(vehicle, ["arm_moving_pb"], "Запрет движения", "mdi:car-brake-alert", "yesno"),
      this._metric(vehicle, ["service_mode"], "Сервисный режим", "mdi:wrench-clock", "yesno"),
      this._metric(vehicle, ["last_activity"], "Последняя активность", "mdi:clock-outline"),
    ].join("");
    const source = this._bootstrap?.source?.primary === "starline_telemetry" ? "StarLine Telemetry" : "Home Assistant · StarLine";
    return `<div class="source-card"><div><span>Источник данных</span><strong>${this._escape(source)}</strong></div><span class="readonly">READ ONLY</span></div>
      ${this._section("Сервис", "Диагностика без управляющих команд", cards) || this._empty()}`;
  }

  _empty() {
    return `<div class="empty"><ha-icon icon="mdi:database-off-outline"></ha-icon><strong>Нет доступных данных</strong><span>Панель показывает только реально существующие сущности StarLine.</span></div>`;
  }

  _content(vehicle) {
    if (!vehicle) return this._empty();
    if (this._view === "security") return this._renderSecurity(vehicle);
    if (this._view === "engine") return this._renderEngine(vehicle);
    if (this._view === "auto") return this._renderAuto(vehicle);
    if (this._view === "service") return this._renderService(vehicle);
    return this._renderOverview(vehicle);
  }

  _setView(view) {
    history.replaceState(null, "", `${location.pathname}${location.search}#${view}`);
    this._view = view;
    this._render();
    this.shadowRoot.getElementById("content")?.scrollTo({ top: 0, behavior: "auto" });
  }

  _vehicleSelector() {
    const vehicles = this._vehicles();
    if (vehicles.length <= 1) return "";
    return `<div class="vehicle-tabs">${vehicles.map((vehicle) => `<button class="${vehicle.device_id === this._vehicleId ? "active" : ""}" data-vehicle="${this._escape(vehicle.device_id)}"><ha-icon icon="mdi:car"></ha-icon><span>${this._escape(vehicle.name)}</span></button>`).join("")}</div>`;
  }

  _tabbar() {
    const items = [
      ["overview", "mdi:view-dashboard-outline", "Обзор"],
      ["security", "mdi:shield-car", "Охрана"],
      ["engine", "mdi:engine", "Двигатель"],
      ["auto", "mdi:car-info", "Авто"],
      ["service", "mdi:wrench-cog-outline", "Сервис"],
    ];
    return items.map(([view, icon, label]) => `<button data-view="${view}" class="${this._view === view ? "active" : ""}"><ha-icon icon="${icon}"></ha-icon><span>${label}</span></button>`).join("");
  }

  _render() {
    if (!this.shadowRoot) return;
    const vehicle = this._vehicle();
    const sourceLabel = this._bootstrap?.source?.primary === "starline_telemetry" ? "Telemetry" : "Core StarLine";
    this.shadowRoot.innerHTML = `<style>
      :host { display:block; height:100dvh; color:var(--primary-text-color); background:var(--primary-background-color); --surface:var(--ha-card-background,var(--card-background-color,#fff)); --border:color-mix(in srgb,var(--primary-text-color) 10%,transparent); --muted:var(--secondary-text-color,#6b7280); --accent:var(--primary-color,#03a9f4); }
      * { box-sizing:border-box; }
      .app { height:100%; min-height:0; display:grid; grid-template-rows:auto minmax(0,1fr) auto; overflow:hidden; }
      header { min-height:58px; display:grid; grid-template-columns:48px 1fr 48px; align-items:center; padding:max(4px,env(safe-area-inset-top)) max(8px,env(safe-area-inset-right)) 4px max(8px,env(safe-area-inset-left)); background:var(--surface); border-bottom:1px solid var(--border); z-index:3; }
      header button { width:44px; height:44px; border:0; border-radius:14px; background:transparent; color:var(--primary-text-color); display:grid; place-items:center; }
      header button:last-child { justify-self:end; }
      .title { min-width:0; text-align:center; line-height:1.1; }
      .title strong { display:block; font-size:17px; font-weight:750; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .title span { display:block; margin-top:3px; color:var(--muted); font-size:9px; font-weight:650; letter-spacing:.03em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      #content { min-height:0; overflow:auto; overscroll-behavior-y:contain; -webkit-overflow-scrolling:touch; }
      .shell { width:min(100%,980px); margin:0 auto; padding:12px max(12px,env(safe-area-inset-right)) 24px max(12px,env(safe-area-inset-left)); }
      .vehicle-tabs { display:flex; gap:8px; overflow:auto; padding:2px 0 10px; scrollbar-width:none; }
      .vehicle-tabs::-webkit-scrollbar { display:none; }
      .vehicle-tabs button { flex:0 0 auto; min-height:38px; border:1px solid var(--border); border-radius:14px; background:var(--surface); color:var(--muted); padding:7px 12px; display:flex; align-items:center; gap:7px; font:inherit; font-size:12px; font-weight:700; }
      .vehicle-tabs button.active { color:var(--accent); border-color:color-mix(in srgb,var(--accent) 45%,var(--border)); background:color-mix(in srgb,var(--accent) 9%,var(--surface)); }
      .hero { display:grid; grid-template-columns:54px minmax(0,1fr) auto; gap:12px; align-items:center; padding:16px; border:1px solid var(--border); border-radius:22px; background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 8%,var(--surface)),var(--surface)); box-shadow:0 5px 18px color-mix(in srgb,#000 5%,transparent); }
      .hero.danger { background:linear-gradient(135deg,color-mix(in srgb,#f44336 12%,var(--surface)),var(--surface)); }
      .hero-icon { width:54px; height:54px; border-radius:18px; display:grid; place-items:center; color:var(--accent); background:color-mix(in srgb,var(--accent) 12%,transparent); }
      .hero-icon ha-icon { --mdc-icon-size:31px; }
      .hero-copy { min-width:0; }
      .hero-copy span { color:var(--muted); font-size:10px; font-weight:700; }
      .hero-copy strong { display:block; margin-top:2px; font-size:20px; font-weight:780; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .hero-copy p { margin:5px 0 0; color:var(--muted); font-size:11px; line-height:1.35; }
      .readonly { flex:0 0 auto; display:inline-flex; align-items:center; min-height:24px; border-radius:999px; padding:4px 8px; background:color-mix(in srgb,var(--accent) 9%,transparent); color:var(--accent); font-size:8px; font-weight:800; letter-spacing:.08em; }
      .section { margin-top:16px; }
      .section-head { display:flex; align-items:end; justify-content:space-between; padding:0 2px 8px; }
      .section h2 { margin:0; font-size:14px; font-weight:780; }
      .section p { margin:2px 0 0; color:var(--muted); font-size:9px; }
      .grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; }
      .metric { min-width:0; min-height:92px; border:1px solid var(--border); border-radius:18px; padding:12px; background:var(--surface); color:var(--primary-text-color); text-align:left; display:grid; grid-template-columns:30px minmax(0,1fr); grid-template-rows:auto 1fr; column-gap:8px; font:inherit; -webkit-tap-highlight-color:transparent; }
      .metric ha-icon { grid-row:1/3; align-self:start; color:var(--muted); --mdc-icon-size:24px; }
      .metric-label { color:var(--muted); font-size:9px; font-weight:650; }
      .metric strong { min-width:0; align-self:end; font-size:16px; line-height:1.15; font-weight:780; overflow-wrap:anywhere; }
      .metric.ok ha-icon,.metric.ok strong { color:#43a047; }
      .metric.warn ha-icon,.metric.warn strong { color:#fb8c00; }
      .metric.danger ha-icon,.metric.danger strong { color:#e53935; }
      .metric.active ha-icon,.metric.active strong { color:var(--accent); }
      .metric.muted strong { color:var(--muted); }
      .source-card,.location-line { margin-bottom:12px; border:1px solid var(--border); border-radius:18px; background:var(--surface); padding:13px 14px; display:flex; align-items:center; justify-content:space-between; gap:12px; }
      .source-card div { min-width:0; }
      .source-card div span { display:block; color:var(--muted); font-size:9px; }
      .source-card div strong { display:block; margin-top:2px; font-size:13px; }
      .location-line { justify-content:flex-start; color:var(--muted); font-size:11px; }
      .empty { min-height:220px; display:grid; place-items:center; align-content:center; gap:8px; color:var(--muted); text-align:center; padding:24px; }
      .empty ha-icon { --mdc-icon-size:38px; }
      .empty strong { color:var(--primary-text-color); font-size:14px; }
      .empty span { max-width:300px; font-size:10px; line-height:1.4; }
      .notice { margin-bottom:10px; padding:10px 12px; border-radius:14px; background:color-mix(in srgb,#fb8c00 10%,var(--surface)); color:#ef6c00; font-size:10px; }
      nav { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:2px; padding:6px max(6px,env(safe-area-inset-right)) calc(6px + env(safe-area-inset-bottom)) max(6px,env(safe-area-inset-left)); background:var(--surface); border-top:1px solid var(--border); box-shadow:0 -3px 14px color-mix(in srgb,#000 8%,transparent); z-index:4; }
      nav button { min-width:0; min-height:56px; border:0; border-radius:14px; background:transparent; color:var(--muted); display:grid; place-items:center; align-content:center; gap:2px; padding:4px 2px; font:inherit; }
      nav button.active { color:var(--accent); background:color-mix(in srgb,var(--accent) 11%,transparent); }
      nav ha-icon { --mdc-icon-size:22px; }
      nav span { max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:9px; font-weight:700; }
      @media (min-width:700px) { .grid { grid-template-columns:repeat(3,minmax(0,1fr)); } .metric { min-height:104px; } }
    </style>
    <div class="app">
      <header>
        <button id="menu" aria-label="Открыть меню Home Assistant"><ha-icon icon="mdi:menu"></ha-icon></button>
        <div class="title"><strong>StarLine</strong><span>${this._escape(vehicle?.name || sourceLabel)} · UI v${PANEL_UI_VERSION}</span></div>
        <button id="refresh" aria-label="Обновить"><ha-icon icon="mdi:refresh"></ha-icon></button>
      </header>
      <div id="content"><div class="shell">
        ${this._loading ? `<div class="notice">Обновляю данные панели…</div>` : ""}
        ${this._error ? `<div class="notice">Bootstrap: ${this._escape(this._error)}</div>` : ""}
        ${this._vehicleSelector()}
        ${this._content(vehicle)}
      </div></div>
      <nav aria-label="Разделы StarLine">${this._tabbar()}</nav>
    </div>`;

    this.shadowRoot.getElementById("menu")?.addEventListener("click", (event) => openHomeAssistantMenu(event.currentTarget));
    this.shadowRoot.getElementById("refresh")?.addEventListener("click", () => this._loadBootstrap());
    this.shadowRoot.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => this._setView(button.dataset.view)));
    this.shadowRoot.querySelectorAll("[data-vehicle]").forEach((button) => button.addEventListener("click", () => { this._vehicleId = button.dataset.vehicle; this._render(); }));
    this.shadowRoot.querySelectorAll("[data-entity]").forEach((button) => button.addEventListener("click", () => this._openMoreInfo(button.dataset.entity)));
  }
}

if (!customElements.get("starline-app-panel-v001")) {
  customElements.define("starline-app-panel-v001", StarLineAppPanelV001);
}
