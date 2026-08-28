import "./starline-app-v007.js?v=0.3.0-core-bridge";

const BASE_COMPONENT = customElements.get("starline-app-panel-v007");
const UI_VERSION = "0.3.1";

class StarLineAppPanelV008 extends BASE_COMPONENT {
  _orderedVehicles() {
    const priority = (name) => {
      const value = String(name || "");
      if (value.includes("683")) return 0;
      if (value.includes("130")) return 1;
      return 10;
    };
    return [...this._vehicles()].sort((a, b) => priority(a.name) - priority(b.name) || String(a.name).localeCompare(String(b.name), "ru"));
  }

  _vehicleSwitcher() {
    const vehicles = this._orderedVehicles();
    if (vehicles.length < 2) return "";
    return `<div class="m-vehicle-switcher" style="--vehicle-count:${vehicles.length}">
      ${vehicles.map((vehicle) => {
        const active = vehicle.device_id === this._vehicleId;
        const online = this._online(vehicle);
        return `<button type="button" data-vehicle="${this._escape(vehicle.device_id)}" class="${active ? "active" : ""}">
          <span class="vehicle-health-dot ${online ? "online" : "offline"}"></span>
          <span class="vehicle-button-copy"><strong>${this._escape(vehicle.name)}</strong><small>${online ? "В сети" : "Недоступен"}</small></span>
        </button>`;
      }).join("")}
    </div>`;
  }

  _statusView(vehicle) {
    if (!this._mobileOnly()) return super._statusView(vehicle);

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

    return `<div class="m-status-v008">
      ${this._vehicleSwitcher()}
      <div class="m-freshness"><span class="m-freshness-dot ${this._online(vehicle) ? "online" : "offline"}"></span><strong>${this._escape(vehicle?.name || "StarLine")}</strong><span>${this._escape(this._relativeTime(this._latestUpdate(vehicle)))}</span></div>

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

  _installCommonHeader() {
    if (!this.shadowRoot) return;
    const header = this.shadowRoot.querySelector("header");
    if (!header) return;

    const picker = header.querySelector("#vehiclePicker");
    if (picker) {
      const title = document.createElement("div");
      title.className = "nika-title";
      title.innerHTML = `<strong>StarLine</strong><span>Автомобили · UI v${UI_VERSION}</span>`;
      picker.replaceWith(title);
    }

    const diagnostics = header.querySelector("#diagnostics");
    if (diagnostics) {
      const refresh = document.createElement("button");
      refresh.type = "button";
      refresh.id = "nikaRefresh";
      refresh.className = "nika-refresh";
      refresh.setAttribute("aria-label", "Обновить");
      refresh.innerHTML = `<ha-icon icon="mdi:refresh"></ha-icon>`;
      diagnostics.replaceWith(refresh);
      refresh.addEventListener("click", () => {
        this._loadBootstrap(true).then(() => this._ensureHistory(true));
      });
    }
  }

  _render() {
    super._render();
    if (!this._mobileOnly() || !this.shadowRoot) return;
    this._installCommonHeader();

    const style = document.createElement("style");
    style.dataset.starlineMobileV008 = "true";
    style.textContent = `
      header {
        grid-template-columns:52px minmax(0,1fr) 52px !important;
        min-height:56px !important;
        gap:4px !important;
        padding:max(4px,env(safe-area-inset-top)) max(8px,env(safe-area-inset-right)) 4px max(8px,env(safe-area-inset-left)) !important;
      }
      header > #menu, .nika-refresh {
        width:44px !important; min-width:44px !important; height:44px !important; min-height:44px !important;
        border:0 !important; border-radius:14px !important; background:transparent !important;
        color:var(--primary-text-color) !important; display:grid !important; place-items:center !important; padding:0 !important;
      }
      header > #menu { justify-self:start !important; }
      .nika-refresh { justify-self:end !important; color:var(--accent) !important; }
      header > #menu ha-icon, .nika-refresh ha-icon { --mdc-icon-size:24px !important; }
      .nika-title { min-width:0; text-align:center; line-height:1.1; }
      .nika-title strong { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:17px; font-weight:750; }
      .nika-title span { display:block; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--muted); font-size:9px; font-weight:600; letter-spacing:.02em; }

      .shell { padding:12px max(14px,env(safe-area-inset-right)) 28px max(14px,env(safe-area-inset-left)) !important; }
      .m-status-v008 { display:grid; gap:14px; }
      .m-vehicle-switcher { width:100%; display:grid; grid-template-columns:repeat(var(--vehicle-count),minmax(0,1fr)); gap:10px; }
      .m-vehicle-switcher button {
        min-width:0; min-height:58px; border:1px solid var(--border); border-radius:20px; background:var(--surface); color:var(--primary-text-color);
        display:grid; grid-template-columns:11px minmax(0,1fr); align-items:center; gap:9px; padding:9px 12px; text-align:left; font:inherit;
      }
      .m-vehicle-switcher button.active { color:var(--accent); border-color:color-mix(in srgb,var(--accent) 42%,var(--border)); background:color-mix(in srgb,var(--accent) 9%,var(--surface)); }
      .vehicle-health-dot { width:10px; height:10px; border-radius:50%; background:var(--muted); }
      .vehicle-health-dot.online { background:var(--ok); box-shadow:0 0 0 4px color-mix(in srgb,var(--ok) 13%,transparent); }
      .vehicle-health-dot.offline { background:var(--danger); }
      .vehicle-button-copy { min-width:0; }
      .vehicle-button-copy strong { display:block; font-size:17px; line-height:1.05; font-weight:780; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .vehicle-button-copy small { display:block; margin-top:4px; color:var(--muted); font-size:12px; line-height:1.1; font-weight:650; }
      .m-freshness { display:flex; align-items:center; justify-content:center; gap:7px; min-height:25px; color:var(--muted); font-size:13px; }
      .m-freshness strong { color:var(--primary-text-color); font-size:14px; }
      .m-freshness-dot { width:8px; height:8px; border-radius:50%; background:var(--muted); }
      .m-freshness-dot.online { background:var(--ok); }
      .m-freshness-dot.offline { background:var(--danger); }

      .m-metrics { gap:10px !important; }
      .m-metric { min-height:76px !important; border-radius:19px !important; grid-template-columns:34px minmax(0,1fr) !important; gap:10px !important; padding:11px 13px !important; }
      .m-metric > ha-icon { --mdc-icon-size:29px !important; }
      .m-metric span { font-size:11px !important; line-height:1.1 !important; }
      .m-metric strong { margin-top:7px !important; font-size:18px !important; line-height:1.05 !important; }
      .m-metric strong.dual { font-size:14px !important; line-height:1.15 !important; white-space:normal !important; }

      .m-section-label { min-height:28px !important; padding:4px 3px 0 !important; }
      .m-section-label strong { font-size:16px !important; line-height:1.1 !important; }
      .m-state-grid { gap:8px !important; }
      .m-state { min-height:76px !important; border-radius:18px !important; grid-template-columns:27px minmax(0,1fr) !important; gap:8px !important; padding:10px 9px !important; }
      .m-state ha-icon { --mdc-icon-size:23px !important; }
      .m-state span { font-size:10px !important; line-height:1.05 !important; }
      .m-state strong { margin-top:7px !important; font-size:14px !important; line-height:1.12 !important; overflow-wrap:normal !important; }

      .m-event { min-height:72px !important; border-radius:19px !important; grid-template-columns:32px minmax(0,1fr) 22px !important; gap:10px !important; padding:11px 13px !important; }
      .m-event > ha-icon:first-child { --mdc-icon-size:27px !important; }
      .m-event span { font-size:11px !important; line-height:1.1 !important; }
      .m-event strong { margin-top:7px !important; font-size:16px !important; line-height:1.15 !important; }
      .m-event .chevron { --mdc-icon-size:21px !important; }

      .m-map-head { min-height:50px !important; padding:2px 4px 9px !important; }
      .m-map-head strong { font-size:17px !important; line-height:1.1 !important; }
      .m-map-head span { margin-top:5px !important; font-size:12px !important; }
      .m-map-head > ha-icon { --mdc-icon-size:29px !important; }
      .m-map-host { min-height:220px !important; height:220px !important; border-radius:20px !important; }
      .m-map-host .embedded-map-card { height:220px !important; }

      nav span { font-size:11px !important; }
      nav ha-icon { --mdc-icon-size:24px !important; }
      nav button { min-height:60px !important; }

      @media (max-width:380px) {
        .m-vehicle-switcher { gap:8px; }
        .m-vehicle-switcher button { padding:8px 9px; }
        .vehicle-button-copy strong { font-size:16px; }
        .m-metric { min-height:72px !important; padding:10px 11px !important; }
        .m-metric strong { font-size:17px !important; }
        .m-state { min-height:72px !important; grid-template-columns:24px minmax(0,1fr) !important; padding:9px 8px !important; }
        .m-state strong { font-size:13px !important; }
      }
    `;
    this.shadowRoot.append(style);
  }
}

if (!customElements.get("starline-app-panel-v008")) {
  customElements.define("starline-app-panel-v008", StarLineAppPanelV008);
}
