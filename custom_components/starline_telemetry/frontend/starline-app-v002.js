import "./starline-app-v001.js?v=0.1.0-core-bridge";

const BASE_COMPONENT = customElements.get("starline-app-panel-v001");

class StarLineAppPanelV002 extends BASE_COMPONENT {
  _openMoreInfo(entityId) {
    if (!entityId) return;
    const domain = String(entityId).split(".", 1)[0];
    if (["lock", "switch", "button"].includes(domain)) return;
    super._openMoreInfo(entityId);
  }
}

if (!customElements.get("starline-app-panel-v002")) {
  customElements.define("starline-app-panel-v002", StarLineAppPanelV002);
}
