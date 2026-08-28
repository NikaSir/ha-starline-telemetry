import "./starline-app-v024.js?v=0.5.9-grounded-security-dome";

const BASE_COMPONENT = customElements.get("starline-app-panel-v024");
const UI_VERSION = "0.5.10";

class StarLineAppPanelV025 extends BASE_COMPONENT {
  _installCommonHeader() {
    super._installCommonHeader();
    if (!this.shadowRoot) return;
    const title = this.shadowRoot.querySelector(".nika-title span");
    if (title) title.textContent = `Автомобили · UI v${UI_VERSION}`;
  }

  _render() {
    super._render();
    if (!this.shadowRoot || !this._mobileOnly()) return;
    if (this.shadowRoot.querySelector("style[data-starline-summary-v025]")) return;

    const style = document.createElement("style");
    style.dataset.starlineSummaryV025 = "true";
    style.textContent = `
      .vehicle-state-field,
      .vehicle-state-field.armed,
      .vehicle-state-field.alarm {
        border-bottom-color:transparent !important;
      }
    `;
    this.shadowRoot.append(style);
  }
}

if (!customElements.get("starline-app-panel-v025")) {
  customElements.define("starline-app-panel-v025", StarLineAppPanelV025);
}

if (!customElements.get("starline-app-panel")) {
  customElements.define("starline-app-panel", class extends StarLineAppPanelV025 {});
}
