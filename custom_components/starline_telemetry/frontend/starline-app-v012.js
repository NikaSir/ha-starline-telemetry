import "./starline-app-v011.js?v=0.4.0-core-bridge";

const BASE_COMPONENT = customElements.get("starline-app-panel-v011");
const UI_VERSION = "0.4.1";

class StarLineAppPanelV012 extends BASE_COMPONENT {
  _orderedVehicles() {
    const priority = (name) => {
      const value = String(name || "");
      if (value.includes("130")) return 0;
      if (value.includes("683")) return 1;
      return 10;
    };
    return [...this._vehicles()].sort((a, b) => priority(a.name) - priority(b.name) || String(a.name).localeCompare(String(b.name), "ru"));
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

    return `<article class="vehicle-summary-card target-card">
      <div class="summary-hero target-hero">
        <img class="summary-bg" src="${this._assetFor(vehicle, "bg")}" alt="" aria-hidden="true">
        <div class="summary-overlay"></div>
        <div class="summary-identity"><strong>${this._escape(vehicle.name)}</strong><span>Nissan MURANO Z52</span><small><i class="status-dot ${online ? "online" : "offline"}"></i>${online ? "В сети" : "Недоступен"} · ${this._escape(freshness)}</small></div>
        ${this._summarySecurity(vehicle)}
        <img class="summary-car" src="${this._assetFor(vehicle, "car")}" alt="Nissan Murano Z52 ${this._escape(vehicle.name)}">
        ${this._summaryConnection(vehicle)}
        <div class="summary-metrics target-metrics">${metrics}</div>
      </div>
      <div class="target-state-row perimeter-row">${this._summaryPerimeter(vehicle)}</div>
      <div class="target-state-row operational-row">${this._summaryOperational(vehicle)}</div>
      ${this._summaryEvent(vehicle)}
    </article>`;
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
    if (this.shadowRoot.querySelector("style[data-starline-summary-v012]")) return;
    const style = document.createElement("style");
    style.dataset.starlineSummaryV012 = "true";
    style.textContent = `
      .shell { padding:8px max(12px,env(safe-area-inset-right)) 18px max(12px,env(safe-area-inset-left)) !important; }
      .dual-summary { gap:10px !important; }
      .summary-heading { min-height:43px !important; grid-template-columns:34px minmax(0,1fr) !important; gap:8px !important; padding:0 4px 2px !important; }
      .summary-heading > ha-icon { --mdc-icon-size:27px !important; }
      .summary-heading strong { font-size:18px !important; }
      .summary-heading span { margin-top:3px !important; font-size:10px !important; }

      .target-card { border-radius:19px !important; box-shadow:0 3px 13px color-mix(in srgb,#000 7%,transparent) !important; }
      .target-hero { min-height:218px !important; }
      .summary-overlay { background:linear-gradient(90deg,rgba(255,255,255,.90) 0%,rgba(255,255,255,.55) 30%,rgba(255,255,255,.06) 58%,rgba(255,255,255,0) 100%) !important; }
      .summary-identity { left:13px !important; top:11px !important; max-width:50% !important; }
      .summary-identity strong { font-size:24px !important; }
      .summary-identity span { margin-top:4px !important; font-size:12px !important; }
      .summary-identity small { margin-top:5px !important; gap:5px !important; font-size:10px !important; }
      .status-dot { width:8px !important; height:8px !important; }

      .summary-security { right:9px !important; top:9px !important; min-width:90px !important; min-height:43px !important; grid-template-columns:22px minmax(0,1fr) !important; gap:5px !important; padding:6px 8px !important; border-radius:14px !important; }
      .summary-security ha-icon { --mdc-icon-size:20px !important; }
      .summary-security span { font-size:8px !important; }
      .summary-security strong { margin-top:2px !important; font-size:12px !important; }

      .summary-car { right:-10px !important; bottom:49px !important; width:61% !important; max-width:none !important; }
      .summary-connection { right:8px !important; bottom:53px !important; max-width:44% !important; min-height:42px !important; grid-template-columns:22px minmax(0,1fr) !important; gap:5px !important; padding:6px 8px !important; border-radius:13px !important; }
      .summary-connection ha-icon { --mdc-icon-size:20px !important; }
      .summary-connection span { font-size:7px !important; }
      .summary-connection strong { margin-top:2px !important; font-size:10px !important; }

      .target-metrics { left:8px !important; right:8px !important; bottom:7px !important; width:auto !important; display:grid !important; grid-template-columns:repeat(4,minmax(0,1fr)) !important; gap:5px !important; }
      .summary-metric { min-width:0 !important; min-height:42px !important; grid-template-columns:20px minmax(0,1fr) !important; gap:5px !important; padding:5px 6px !important; border-radius:12px !important; }
      .summary-metric ha-icon { --mdc-icon-size:18px !important; }
      .summary-metric span { font-size:7px !important; white-space:nowrap !important; overflow:hidden !important; text-overflow:ellipsis !important; }
      .summary-metric strong { margin-top:2px !important; font-size:11px !important; white-space:nowrap !important; }

      .summary-status-row { display:none !important; }
      .target-state-row { min-height:50px; display:grid; align-items:center; padding:7px 11px; background:var(--surface); }
      .target-state-row + .target-state-row { border-top:1px solid var(--border); }
      .perimeter-row { grid-template-columns:repeat(3,minmax(0,1fr)); }
      .operational-row { grid-template-columns:repeat(2,minmax(0,1fr)); padding-left:12px; padding-right:12px; }
      .target-state-row .summary-state { padding:0 7px; border-right:1px solid var(--border); grid-template-columns:22px minmax(0,1fr) !important; gap:5px !important; }
      .target-state-row .summary-state:last-child { border-right:0; }
      .target-state-row .summary-state ha-icon { --mdc-icon-size:20px !important; }
      .target-state-row .summary-state span { font-size:8px !important; }
      .target-state-row .summary-state strong { margin-top:3px !important; font-size:11px !important; }

      .summary-event { min-height:48px !important; grid-template-columns:25px minmax(0,1fr) 18px !important; gap:7px !important; padding:7px 12px !important; border-top:1px solid var(--border) !important; }
      .summary-event > ha-icon:first-child { --mdc-icon-size:21px !important; }
      .summary-event span { font-size:8px !important; }
      .summary-event strong { margin-top:3px !important; font-size:12px !important; }

      nav { padding-top:4px !important; }
      nav button { min-height:56px !important; }
      nav ha-icon { --mdc-icon-size:23px !important; }
      nav span { font-size:10px !important; }

      .zoom-controls { position:sticky !important; bottom:4px !important; margin:7px auto 0 !important; transform:scale(.88); transform-origin:center bottom; }

      @media (max-width:390px) {
        .target-hero { min-height:205px !important; }
        .summary-car { width:59% !important; bottom:47px !important; }
        .summary-identity strong { font-size:22px !important; }
        .summary-identity span { font-size:11px !important; }
        .summary-metric strong { font-size:10px !important; }
        .target-state-row { min-height:47px; padding-left:8px; padding-right:8px; }
        .target-state-row .summary-state { padding:0 5px; }
      }
    `;
    this.shadowRoot.append(style);
  }
}

if (!customElements.get("starline-app-panel-v012")) {
  customElements.define("starline-app-panel-v012", StarLineAppPanelV012);
}
