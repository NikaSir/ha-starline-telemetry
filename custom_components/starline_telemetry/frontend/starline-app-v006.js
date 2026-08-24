import "./starline-app-v005.js?v=0.2.2-core-bridge";

const BASE_COMPONENT = customElements.get("starline-app-panel-v005");

class StarLineAppPanelV006 extends BASE_COMPONENT {
  _parkingChip(vehicle) {
    const entity = this._entity(vehicle, ["hbrake"]);
    if (!entity) return "";
    const state = this._isOn(entity);
    const value = state === null ? "—" : state ? "Поднят" : "Снят";
    const tone = state === true ? "active" : "muted";
    return `<button class="telemetry-chip parking ${tone}" data-entity="${this._escape(entity.entityId)}">
      <ha-icon icon="mdi:car-brake-hold"></ha-icon>
      <div style="min-width:0;display:flex;flex-direction:column;justify-content:center;gap:3px">
        <span style="display:block">Ручник</span>
        <strong style="display:block;font-size:11px;line-height:1;overflow:visible;text-overflow:clip">${this._escape(value)}</strong>
      </div>
    </button>`;
  }
}

if (!customElements.get("starline-app-panel-v006")) {
  customElements.define("starline-app-panel-v006", StarLineAppPanelV006);
}
