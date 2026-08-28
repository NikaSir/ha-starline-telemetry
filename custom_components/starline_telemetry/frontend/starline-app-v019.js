import "./starline-app-v018.js?v=0.5.3-summary-scene-security";

const BASE_COMPONENT = customElements.get("starline-app-panel-v018");
const SWITCHER_COMPONENT = customElements.get("starline-app-panel-v015");
const UI_VERSION = "0.5.4";

class StarLineAppPanelV019 extends BASE_COMPONENT {
  _installFixedVehicleSwitcher() {
    SWITCHER_COMPONENT.prototype._installFixedVehicleSwitcher.call(this);
  }

  _statusView(vehicle) {
    if (!this._mobileOnly()) return super._statusView(vehicle);
    const selected = vehicle || this._vehicle() || this._orderedVehicles()[0];
    if (!selected) return '<div class="empty">Автомобили не найдены</div>';
    return `<div class="dual-summary single-summary">${this._vehicleSummaryCard(selected)}</div>`;
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
    if (this.shadowRoot.querySelector("style[data-starline-summary-v019]")) return;

    const style = document.createElement("style");
    style.dataset.starlineSummaryV019 = "true";
    style.textContent = `
      .single-summary {
        gap:0 !important;
      }
    `;
    this.shadowRoot.append(style);
  }
}

if (!customElements.get("starline-app-panel-v019")) {
  customElements.define("starline-app-panel-v019", StarLineAppPanelV019);
}
