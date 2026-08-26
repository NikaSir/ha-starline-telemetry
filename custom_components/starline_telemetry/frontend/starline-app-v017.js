import "./starline-app-v016.js?v=0.5.1-history-journal";

const BASE_COMPONENT = customElements.get("starline-app-panel-v016");
const UI_VERSION = "0.5.2";

class StarLineAppPanelV017 extends BASE_COMPONENT {
  _installFixedVehicleSwitcher() {
    if (this._view === "status") return;
    super._installFixedVehicleSwitcher();
  }

  _installCommonHeader() {
    super._installCommonHeader();
    if (!this.shadowRoot) return;
    const title = this.shadowRoot.querySelector(".nika-title span");
    if (title) title.textContent = `Автомобили · UI v${UI_VERSION}`;
  }

  _render() {
    super._render();
    if (!this.shadowRoot || !this._mobileOnly()) return;
    if (this.shadowRoot.querySelector("style[data-starline-summary-v017]")) return;

    const style = document.createElement("style");
    style.dataset.starlineSummaryV017 = "true";
    style.textContent = `
      .operational-row {
        grid-template-columns:minmax(92px,1fr) minmax(0,1.55fr) minmax(80px,.65fr) !important;
      }
      .operational-row > .summary-state:first-child {
        order:1;
      }
      .operational-row > .event-state {
        order:2;
        border-right:1px solid var(--border) !important;
      }
      .operational-row > .summary-state:nth-child(2) {
        order:3;
        border-right:0 !important;
      }
    `;
    this.shadowRoot.append(style);
  }
}

if (!customElements.get("starline-app-panel-v017")) {
  customElements.define("starline-app-panel-v017", StarLineAppPanelV017);
}

if (!customElements.get("starline-app-panel")) {
  customElements.define("starline-app-panel", class extends StarLineAppPanelV017 {});
}
