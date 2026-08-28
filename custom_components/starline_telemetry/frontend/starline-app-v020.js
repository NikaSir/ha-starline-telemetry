import "./starline-app-v019.js?v=0.5.4-split-vehicle-summary-pages";

const BASE_COMPONENT = customElements.get("starline-app-panel-v019");
const UI_VERSION = "0.5.5";
const ASSET_BASE = "/starline_telemetry_static/assets";

class StarLineAppPanelV020 extends BASE_COMPONENT {
  _sceneEntity(vehicle, keys, pattern = null) {
    const direct = this._entity(vehicle, keys);
    if (direct || !pattern) return direct;
    const matchedKey = Object.keys(vehicle?.entities || {}).find((key) => pattern.test(key) && key !== "alarm");
    return matchedKey ? this._entity(vehicle, [matchedKey]) : null;
  }

  _sceneState(vehicle) {
    const alarm = this._isOn(this._sceneEntity(vehicle, ["alarm"]));
    const armedEntity = this._sceneEntity(
      vehicle,
      ["lock", "armed", "security", "arm", "guard"],
      /(?:^|_)(?:arm(?:ed)?|security|guard|lock)(?:_|$)/i,
    );
    const armed = this._isLocked(armedEntity);
    const door = this._isOn(this._sceneEntity(vehicle, ["door", "doors"]));
    const hood = this._isOn(this._sceneEntity(vehicle, ["hood"]));
    const trunk = this._isOn(this._sceneEntity(vehicle, ["trunk", "tailgate"]));
    const engine = this._isOn(this._sceneEntity(vehicle, ["engine_running", "run", "ignition", "ign"]));
    const online = this._online(vehicle);
    const image = hood === true
      ? "hood-open"
      : trunk === true
        ? "trunk-open"
        : door === true
          ? "door-open"
          : engine === true
            ? "engine"
            : "default";
    const field = alarm === true ? "alarm" : armed === true ? "armed" : "none";
    return { alarm, armed, door, hood, trunk, engine, online, image, field };
  }

  _stateCarAsset(vehicle, state) {
    if (state === "default") return this._assetFor(vehicle, "car");
    const name = String(vehicle?.name || "");
    const id = name.includes("683") ? "683" : "130";
    return `${ASSET_BASE}/starline-car-${id}-${state}-v1.webp?v=${UI_VERSION}`;
  }

  _summarySecurity(vehicle) {
    const state = this._sceneState(vehicle);
    if (state.alarm === true) {
      return '<div class="summary-security danger alarm"><ha-icon icon="mdi:shield-alert"></ha-icon><div><span>Охрана</span><strong>Тревога</strong></div></div>';
    }
    if (state.armed === true) {
      return '<div class="summary-security ok armed"><ha-icon icon="mdi:shield-lock"></ha-icon><div><span>Охрана</span><strong>Включена</strong></div></div>';
    }
    if (state.armed === false) {
      return '<div class="summary-security warn disarmed"><ha-icon icon="mdi:shield-off-outline"></ha-icon><div><span>Охрана</span><strong>Снята</strong></div></div>';
    }
    return '<div class="summary-security muted unknown"><ha-icon icon="mdi:shield-question-outline"></ha-icon><div><span>Охрана</span><strong>Нет данных</strong></div></div>';
  }

  _vehicleSummaryCard(vehicle) {
    const state = this._sceneState(vehicle);
    const freshness = this._relativeTime(this._latestUpdate(vehicle));
    const metrics = [
      this._summaryMetric(vehicle, ["battery"], "АКБ", "mdi:car-battery", { digits: 1 }),
      this._summaryMetric(vehicle, ["fuel", "fuel_percent", "fuel_litres"], "Топливо", "mdi:gas-station-outline", { digits: 0 }),
      this._summaryMetric(vehicle, ["etemp", "engine_temperature"], "Двигатель", "mdi:thermometer", { digits: 0 }),
      this._summaryMetric(vehicle, ["ctemp", "cabin_temperature"], "Салон", "mdi:car-seat-heater", { digits: 0 }),
    ].join("");
    const sceneClasses = [
      `scene-${state.image}`,
      `field-${state.field}`,
      state.online ? "scene-online" : "scene-offline",
    ].join(" ");

    return `<article class="vehicle-summary-card target-card ${sceneClasses}">
      <div class="summary-hero target-hero">
        <img class="summary-bg" src="${this._assetFor(vehicle, "bg")}" alt="" aria-hidden="true">
        <div class="summary-overlay"></div>
        <div class="summary-identity"><strong>${this._escape(vehicle.name)}</strong><span>Nissan MURANO Z52</span><small><i class="status-dot ${state.online ? "online" : "offline"}"></i>${state.online ? "В сети" : "Недоступен"} · ${this._escape(freshness)}</small></div>
        ${this._summarySecurity(vehicle)}
        <div class="vehicle-state-field ${state.field}" aria-hidden="true"></div>
        <img class="summary-car state-car" src="${this._stateCarAsset(vehicle, state.image)}" alt="Nissan Murano Z52 ${this._escape(vehicle.name)}: ${this._escape(state.image)}">
        ${this._summaryConnection(vehicle)}
        <div class="summary-metrics target-metrics">${metrics}</div>
      </div>
      <div class="target-state-row perimeter-row">${this._summaryPerimeter(vehicle)}</div>
      <div class="target-state-row operational-row">${this._summaryOperational(vehicle)}${this._compactSummaryEvent(vehicle)}</div>
    </article>`;
  }

  _preloadStateAssets() {
    if (this._stateAssetsPreloaded) return;
    this._stateAssetsPreloaded = true;
    ["130", "683"].forEach((id) => {
      ["engine", "door-open", "hood-open", "trunk-open"].forEach((state) => {
        const image = new Image();
        image.decoding = "async";
        image.src = `${ASSET_BASE}/starline-car-${id}-${state}-v1.webp?v=${UI_VERSION}`;
      });
    });
  }

  _installCommonHeader() {
    super._installCommonHeader();
    if (!this.shadowRoot) return;
    const title = this.shadowRoot.querySelector(".nika-title span");
    if (title) title.textContent = `Автомобили · UI v${UI_VERSION}`;
  }

  _render() {
    super._render();
    this._preloadStateAssets();
    if (!this.shadowRoot || !this._mobileOnly()) return;
    if (this.shadowRoot.querySelector("style[data-starline-summary-v020]")) return;

    const style = document.createElement("style");
    style.dataset.starlineSummaryV020 = "true";
    style.textContent = `
      .state-car {
        right:-3% !important;
        bottom:72px !important;
        width:66% !important;
        transition:opacity .16s ease !important;
      }
      .scene-hood-open .state-car,
      .scene-trunk-open .state-car,
      .scene-door-open .state-car {
        bottom:67px !important;
      }
      .vehicle-state-field {
        position:absolute;
        z-index:1;
        right:-1%;
        bottom:54px;
        width:70%;
        aspect-ratio:1.72;
        border-radius:50%;
        pointer-events:none;
        opacity:0;
      }
      .vehicle-state-field.armed {
        opacity:1;
        border:2px solid rgba(22,139,209,.58);
        background:radial-gradient(ellipse at center,rgba(50,174,237,.05) 42%,rgba(36,159,224,.16) 74%,rgba(18,129,197,.08) 100%);
        box-shadow:inset 0 0 22px rgba(30,151,216,.2),0 0 18px rgba(30,151,216,.18);
      }
      .vehicle-state-field.alarm {
        opacity:1;
        border:2px solid color-mix(in srgb,var(--danger) 70%,transparent);
        background:radial-gradient(ellipse at center,transparent 42%,color-mix(in srgb,var(--danger) 17%,transparent) 78%,color-mix(in srgb,var(--danger) 8%,transparent) 100%);
        box-shadow:inset 0 0 24px color-mix(in srgb,var(--danger) 22%,transparent),0 0 18px color-mix(in srgb,var(--danger) 20%,transparent);
      }
      .scene-offline .summary-bg {
        filter:grayscale(.72) saturate(.38) contrast(.92) !important;
      }
      .scene-offline .state-car {
        filter:grayscale(.8) saturate(.3) opacity(.72) drop-shadow(0 11px 9px rgba(0,0,0,.18)) !important;
      }
      .operational-row {
        grid-template-columns:minmax(112px,.9fr) minmax(0,1.45fr) minmax(80px,.6fr) !important;
      }
      .operational-row .event-state strong {
        white-space:normal !important;
        display:-webkit-box !important;
        -webkit-box-orient:vertical;
        -webkit-line-clamp:2;
        line-height:1.05 !important;
      }
      .summary-security.unknown strong,
      .summary-security.unknown ha-icon {
        color:var(--secondary-text-color,var(--muted)) !important;
      }
      @media (max-width:390px) {
        .state-car { right:-5% !important; width:68% !important; }
        .vehicle-state-field { right:-3%; width:72%; }
      }
    `;
    this.shadowRoot.append(style);
  }
}

if (!customElements.get("starline-app-panel-v020")) {
  customElements.define("starline-app-panel-v020", StarLineAppPanelV020);
}

if (!customElements.get("starline-app-panel")) {
  customElements.define("starline-app-panel", class extends StarLineAppPanelV020 {});
}
