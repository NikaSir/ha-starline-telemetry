import "./starline-app-v012.js?v=0.4.1-core-bridge";

const BASE_COMPONENT = customElements.get("starline-app-panel-v012");
const UI_VERSION = "0.4.2";
const ASSET_BASE = "/starline_telemetry_static/assets";

class StarLineAppPanelV013 extends BASE_COMPONENT {
  _assetFor(vehicle, kind) {
    const name = String(vehicle?.name || "");
    const id = name.includes("130") ? "130" : name.includes("683") ? "683" : "130";
    return `${ASSET_BASE}/starline-${kind}-${id}-v2.webp?v=${UI_VERSION}`;
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
    if (this.shadowRoot.querySelector("style[data-starline-summary-v013]")) return;

    const style = document.createElement("style");
    style.dataset.starlineSummaryV013 = "true";
    style.textContent = `
      .summary-bg { filter:saturate(.96) contrast(.98); }
      .summary-bg[src*="bg-130"] { object-position:center 53%; }
      .summary-bg[src*="bg-683"] { object-position:center 52%; }
      .summary-overlay {
        background:linear-gradient(90deg,rgba(255,255,255,.80) 0%,rgba(255,255,255,.38) 31%,rgba(255,255,255,.06) 57%,rgba(255,255,255,0) 76%) !important;
      }
      .summary-car {
        max-width:none !important;
        filter:drop-shadow(0 11px 9px rgba(0,0,0,.24)) !important;
      }
      .summary-car[src*="car-130"] { right:2% !important; bottom:33px !important; width:58% !important; }
      .summary-car[src*="car-683"] { right:2% !important; bottom:35px !important; width:60% !important; }

      @media (max-width:390px) {
        .summary-car[src*="car-130"] { right:1% !important; bottom:31px !important; width:59% !important; }
        .summary-car[src*="car-683"] { right:1% !important; bottom:33px !important; width:61% !important; }
      }
    `;
    this.shadowRoot.append(style);
  }
}

if (!customElements.get("starline-app-panel-v013")) {
  customElements.define("starline-app-panel-v013", StarLineAppPanelV013);
}
