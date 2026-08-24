import "./starline-app-v004.js?v=0.2.1-core-bridge";

const BASE_COMPONENT = customElements.get("starline-app-panel-v004");

class StarLineAppPanelV005 extends BASE_COMPONENT {
  _parkingChip(vehicle) {
    const entity = this._entity(vehicle, ["hbrake"]);
    if (!entity) return "";
    const state = this._isOn(entity);
    const value = state === null ? "—" : state ? "Поднят" : "Снят";
    const tone = state === true ? "active" : "muted";
    return `<button class="telemetry-chip parking ${tone}" data-entity="${this._escape(entity.entityId)}">
      <ha-icon icon="mdi:car-brake-hold"></ha-icon><span>Ручник</span><strong style="font-size:11px;letter-spacing:-0.01em">${this._escape(value)}</strong>
    </button>`;
  }
}

if (!customElements.get("starline-app-panel-v005")) {
  customElements.define("starline-app-panel-v005", StarLineAppPanelV005);
}
