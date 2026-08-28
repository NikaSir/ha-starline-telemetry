import "./starline-app-v023.js?v=0.5.8-centered-live-security";

const BASE_COMPONENT = customElements.get("starline-app-panel-v023");
const UI_VERSION = "0.5.9";

class StarLineAppPanelV024 extends BASE_COMPONENT {
  _installCommonHeader() {
    super._installCommonHeader();
    if (!this.shadowRoot) return;
    const title = this.shadowRoot.querySelector(".nika-title");
    const heading = title?.querySelector("strong");
    const subtitle = title?.querySelector("span");
    if (heading) heading.textContent = "Автомобили";
    if (subtitle) subtitle.textContent = `UI v${UI_VERSION}`;
  }

  _render() {
    super._render();
    if (!this.shadowRoot || !this._mobileOnly()) return;
    if (this.shadowRoot.querySelector("style[data-starline-summary-v024]")) return;

    const style = document.createElement("style");
    style.dataset.starlineSummaryV024 = "true";
    style.textContent = `
      .state-car[src*="starline-car-130-"] {
        bottom:146px !important;
      }
      .state-car[src*="starline-car-683-"] {
        bottom:162px !important;
      }
      .scene-hood-open .state-car[src*="starline-car-130-"],
      .scene-trunk-open .state-car[src*="starline-car-130-"],
      .scene-door-open .state-car[src*="starline-car-130-"] {
        bottom:140px !important;
      }
      .scene-hood-open .state-car[src*="starline-car-683-"],
      .scene-trunk-open .state-car[src*="starline-car-683-"],
      .scene-door-open .state-car[src*="starline-car-683-"] {
        bottom:156px !important;
      }
      .vehicle-state-field {
        bottom:160px !important;
        width:84% !important;
        height:230px !important;
        aspect-ratio:auto !important;
        border-radius:50% 50% 0 0 / 100% 100% 0 0 !important;
      }
      .vehicle-state-field.armed {
        border-color:rgba(22,139,209,.46) !important;
        border-bottom-color:rgba(22,139,209,.58) !important;
        background:radial-gradient(ellipse at 50% 100%,rgba(50,174,237,.02) 30%,rgba(36,159,224,.10) 75%,rgba(18,129,197,.05) 100%) !important;
        box-shadow:inset 0 0 20px rgba(30,151,216,.14),0 0 14px rgba(30,151,216,.12) !important;
      }
      .vehicle-state-field.alarm {
        border-radius:50% 50% 0 0 / 100% 100% 0 0 !important;
        background:radial-gradient(ellipse at 50% 100%,transparent 30%,color-mix(in srgb,var(--danger) 13%,transparent) 76%,color-mix(in srgb,var(--danger) 6%,transparent) 100%) !important;
      }
      .summary-metric span {
        white-space:nowrap !important;
        overflow:hidden !important;
        text-overflow:clip !important;
        overflow-wrap:normal !important;
      }
      .summary-metric:nth-child(3) {
        grid-template-columns:20px minmax(0,1fr) !important;
        column-gap:2px !important;
        padding-left:5px !important;
        padding-right:4px !important;
      }
      .summary-metric:nth-child(3) ha-icon {
        --mdc-icon-size:22px !important;
      }
      @media (max-width:390px) {
        .state-car[src*="starline-car-130-"] {
          bottom:140px !important;
        }
        .state-car[src*="starline-car-683-"] {
          bottom:157px !important;
        }
        .vehicle-state-field {
          bottom:154px !important;
          width:86% !important;
          height:220px !important;
        }
      }
    `;
    this.shadowRoot.append(style);
  }
}

if (!customElements.get("starline-app-panel-v024")) {
  customElements.define("starline-app-panel-v024", StarLineAppPanelV024);
}

if (!customElements.get("starline-app-panel")) {
  customElements.define("starline-app-panel", class extends StarLineAppPanelV024 {});
}
