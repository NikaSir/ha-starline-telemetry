import "./starline-app-v020.js?v=0.5.5-state-aware-vehicle-scenes";

const BASE_COMPONENT = customElements.get("starline-app-panel-v020");
const UI_VERSION = "0.5.6";

class StarLineAppPanelV021 extends BASE_COMPONENT {
  _sceneState(vehicle) {
    const state = super._sceneState(vehicle);
    const armedEntity = this._sceneEntity(
      vehicle,
      ["armed", "security", "arm", "guard"],
      /(?:^|_)(?:arm(?:ed)?|security|guard)(?:_|$)/i,
    );
    const armed = this._isLocked(armedEntity);
    const field = state.alarm === true ? "alarm" : armed === true ? "armed" : "none";
    return { ...state, armed, field };
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
    if (this.shadowRoot.querySelector("style[data-starline-summary-v021]")) return;

    const style = document.createElement("style");
    style.dataset.starlineSummaryV021 = "true";
    style.textContent = `
      .state-car {
        max-width:none !important;
        transform-origin:50% 100% !important;
      }
      .state-car[src*="starline-car-130-"] {
        right:-3% !important;
        bottom:38px !important;
        width:76% !important;
      }
      .state-car[src*="starline-car-683-"] {
        right:-1% !important;
        bottom:36px !important;
        width:73% !important;
      }
      .scene-hood-open .state-car,
      .scene-trunk-open .state-car,
      .scene-door-open .state-car {
        bottom:36px !important;
      }
      @media (max-width:390px) {
        .state-car[src*="starline-car-130-"] {
          right:-4% !important;
          bottom:36px !important;
          width:78% !important;
        }
        .state-car[src*="starline-car-683-"] {
          right:-2% !important;
          bottom:34px !important;
          width:75% !important;
        }
      }
    `;
    this.shadowRoot.append(style);
  }
}

if (!customElements.get("starline-app-panel-v021")) {
  customElements.define("starline-app-panel-v021", StarLineAppPanelV021);
}

if (!customElements.get("starline-app-panel")) {
  customElements.define("starline-app-panel", class extends StarLineAppPanelV021 {});
}
