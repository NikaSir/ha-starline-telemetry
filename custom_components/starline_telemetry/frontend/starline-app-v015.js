import "./starline-app-v014.js?v=0.4.3-core-bridge";

const BASE_COMPONENT = customElements.get("starline-app-panel-v014");
const UI_VERSION = "0.4.4";

class StarLineAppPanelV015 extends BASE_COMPONENT {
  _compactEventLabel(timestamp) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "Событие";
    const time = new Intl.DateTimeFormat("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
    const today = new Date();
    const sameDay = date.getFullYear() === today.getFullYear()
      && date.getMonth() === today.getMonth()
      && date.getDate() === today.getDate();
    if (sameDay) return `Событие · ${time}`;
    const day = new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
    }).format(date);
    return `${day} · ${time}`;
  }

  _compactSummaryEvent(vehicle) {
    const event = this._lastEvent(vehicle);
    if (!event) {
      return `<div class="summary-state event-state">
        <ha-icon icon="mdi:information-outline"></ha-icon>
        <div><span>Событие</span><strong>${this._escape(this._perimeter(vehicle).label)}</strong></div>
      </div>`;
    }
    const fullDate = this._formatDateTime(event.timestamp);
    return `<button
      type="button"
      class="summary-state event-state"
      data-view-target="history"
      aria-label="${this._escape(`${fullDate}: ${event.label}`)}"
    >
      <ha-icon icon="${event.icon}"></ha-icon>
      <div><span>${this._escape(this._compactEventLabel(event.timestamp))}</span><strong>${this._escape(event.label)}</strong></div>
    </button>`;
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
      <div class="target-state-row operational-row">${this._summaryOperational(vehicle)}${this._compactSummaryEvent(vehicle)}</div>
    </article>`;
  }

  _statusView(vehicle) {
    if (!this._mobileOnly()) return super._statusView(vehicle);
    return `<div class="dual-summary">${this._orderedVehicles().map((item) => this._vehicleSummaryCard(item)).join("")}</div>`;
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
    if (this.shadowRoot.querySelector("style[data-starline-summary-v015]")) return;

    const style = document.createElement("style");
    style.dataset.starlineSummaryV015 = "true";
    style.textContent = `
      .summary-identity strong { font-size:26px !important; }
      .summary-identity span { font-size:13px !important; }
      .summary-identity small { font-size:11px !important; }

      .summary-security span { font-size:9px !important; }
      .summary-security strong { font-size:14px !important; }
      .summary-connection span { font-size:9px !important; }
      .summary-connection strong { font-size:12px !important; }

      .summary-metric span { font-size:9px !important; }
      .summary-metric strong { font-size:13px !important; }

      .target-state-row .summary-state span { font-size:9px !important; }
      .target-state-row .summary-state strong { font-size:13px !important; }
      .operational-row {
        grid-template-columns:repeat(3,minmax(0,1fr)) !important;
        padding-left:11px !important;
        padding-right:11px !important;
      }
      .event-state {
        width:100%;
        min-width:0;
        border-top:0;
        border-bottom:0;
        border-left:0;
        background:transparent;
        color:var(--primary-text-color);
        font:inherit;
        text-align:left;
      }
      .event-state ha-icon { color:var(--accent) !important; }
      .event-state > div { min-width:0; }
      .event-state span,
      .event-state strong {
        display:block;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }

      @media (max-width:390px) {
        .summary-identity strong { font-size:24px !important; }
        .summary-identity span { font-size:12px !important; }
        .summary-security strong { font-size:13px !important; }
        .summary-connection strong { font-size:11px !important; }
        .summary-metric strong { font-size:12px !important; }
        .target-state-row .summary-state strong { font-size:12px !important; }
        .operational-row { padding-left:8px !important; padding-right:8px !important; }
      }
    `;
    this.shadowRoot.append(style);
  }
}

if (!customElements.get("starline-app-panel-v015")) {
  customElements.define("starline-app-panel-v015", StarLineAppPanelV015);
}
