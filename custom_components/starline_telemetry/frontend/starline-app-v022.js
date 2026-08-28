import "./starline-app-v021.js?v=0.5.6-security-and-car-geometry";

const BASE_COMPONENT = customElements.get("starline-app-panel-v021");
const UI_VERSION = "0.5.7";

class StarLineAppPanelV022 extends BASE_COMPONENT {
  _securityEntities(vehicle) {
    const candidates = ["lock", "armed", "security", "arm", "guard"];
    const aliases = Object.keys(vehicle?.entities || {}).filter((key) =>
      /(?:^|_)(?:arm(?:ed)?|security|guard|lock)(?:_|$)/i.test(key),
    );
    const entities = [];
    const seen = new Set();
    [...candidates, ...aliases].forEach((key) => {
      const entity = this._entity(vehicle, [key]);
      if (!entity || seen.has(entity.entityId)) return;
      seen.add(entity.entityId);
      entities.push(entity);
    });
    return entities;
  }

  _resolvedArmedState(vehicle) {
    const values = this._securityEntities(vehicle)
      .map((entity) => this._isLocked(entity))
      .filter((value) => value !== null);
    if (values.includes(true)) return true;
    return values.length ? false : null;
  }

  _sceneState(vehicle) {
    const state = super._sceneState(vehicle);
    const armed = this._resolvedArmedState(vehicle);
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
    if (this.shadowRoot.querySelector("style[data-starline-summary-v022]")) return;

    const style = document.createElement("style");
    style.dataset.starlineSummaryV022 = "true";
    style.textContent = `
      .state-car[src*="starline-car-130-"] {
        right:-3% !important;
        bottom:126px !important;
        width:76% !important;
      }
      .state-car[src*="starline-car-683-"] {
        right:-1% !important;
        bottom:122px !important;
        width:73% !important;
      }
      .scene-hood-open .state-car[src*="starline-car-130-"],
      .scene-trunk-open .state-car[src*="starline-car-130-"],
      .scene-door-open .state-car[src*="starline-car-130-"] {
        bottom:120px !important;
      }
      .scene-hood-open .state-car[src*="starline-car-683-"],
      .scene-trunk-open .state-car[src*="starline-car-683-"],
      .scene-door-open .state-car[src*="starline-car-683-"] {
        bottom:116px !important;
      }
      .vehicle-state-field {
        right:-2% !important;
        bottom:96px !important;
        width:79% !important;
      }
      @media (max-width:390px) {
        .state-car[src*="starline-car-130-"] {
          right:-4% !important;
          bottom:120px !important;
          width:78% !important;
        }
        .state-car[src*="starline-car-683-"] {
          right:-2% !important;
          bottom:116px !important;
          width:75% !important;
        }
        .vehicle-state-field {
          right:-3% !important;
          bottom:90px !important;
          width:81% !important;
        }
      }
    `;
    this.shadowRoot.append(style);
  }
}

if (!customElements.get("starline-app-panel-v022")) {
  customElements.define("starline-app-panel-v022", StarLineAppPanelV022);
}
