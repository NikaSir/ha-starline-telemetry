import "./starline-app-v022.js?v=0.5.7-armed-state-and-height";

const BASE_COMPONENT = customElements.get("starline-app-panel-v022");
const UI_VERSION = "0.5.8";

class StarLineAppPanelV023 extends BASE_COMPONENT {
  _liveArmedState(vehicle) {
    const raw = vehicle?.live_security?.arm;
    if (raw === true || raw === 1 || raw === "1") return true;
    if (raw === false || raw === 0 || raw === 2 || raw === "0" || raw === "2") return false;
    const value = String(raw ?? "").trim().toLowerCase();
    if (["on", "true", "locked", "armed"].includes(value)) return true;
    if (["off", "false", "unlocked", "disarmed"].includes(value)) return false;
    return null;
  }

  _resolvedArmedState(vehicle) {
    const live = this._liveArmedState(vehicle);
    return live === null ? super._resolvedArmedState(vehicle) : live;
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
    if (this.shadowRoot.querySelector("style[data-starline-summary-v023]")) return;

    const style = document.createElement("style");
    style.dataset.starlineSummaryV023 = "true";
    style.textContent = `
      .state-car {
        left:50% !important;
        right:auto !important;
        transform:translateX(-50%) !important;
      }
      .state-car[src*="starline-car-130-"] {
        bottom:216px !important;
        width:76% !important;
      }
      .state-car[src*="starline-car-683-"] {
        bottom:232px !important;
        width:73% !important;
      }
      .scene-hood-open .state-car[src*="starline-car-130-"],
      .scene-trunk-open .state-car[src*="starline-car-130-"],
      .scene-door-open .state-car[src*="starline-car-130-"] {
        bottom:210px !important;
      }
      .scene-hood-open .state-car[src*="starline-car-683-"],
      .scene-trunk-open .state-car[src*="starline-car-683-"],
      .scene-door-open .state-car[src*="starline-car-683-"] {
        bottom:226px !important;
      }
      .vehicle-state-field {
        left:50% !important;
        right:auto !important;
        bottom:186px !important;
        width:79% !important;
        transform:translateX(-50%) !important;
      }
      .summary-metric span {
        white-space:normal !important;
        overflow:visible !important;
        text-overflow:clip !important;
        overflow-wrap:anywhere;
        line-height:1 !important;
      }
      @media (max-width:390px) {
        .state-car[src*="starline-car-130-"] {
          bottom:210px !important;
          width:78% !important;
        }
        .state-car[src*="starline-car-683-"] {
          bottom:227px !important;
          width:75% !important;
        }
        .vehicle-state-field {
          bottom:180px !important;
          width:81% !important;
        }
      }
    `;
    this.shadowRoot.append(style);
  }
}

if (!customElements.get("starline-app-panel-v023")) {
  customElements.define("starline-app-panel-v023", StarLineAppPanelV023);
}
