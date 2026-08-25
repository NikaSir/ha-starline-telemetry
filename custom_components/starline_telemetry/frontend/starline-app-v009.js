import "./starline-app-v008.js?v=0.3.1-core-bridge";

const BASE_COMPONENT = customElements.get("starline-app-panel-v008");
const UI_VERSION = "0.3.2";

class StarLineAppPanelV009 extends BASE_COMPONENT {
  _vehicleSwitcher() {
    const vehicles = this._orderedVehicles();
    if (vehicles.length < 2) return "";
    return `<div class="m-vehicle-switcher" style="--vehicle-count:${vehicles.length}">
      ${vehicles.map((vehicle) => {
        const active = vehicle.device_id === this._vehicleId;
        const online = this._online(vehicle);
        const freshness = this._relativeTime(this._latestUpdate(vehicle));
        return `<button type="button" data-vehicle="${this._escape(vehicle.device_id)}" class="${active ? "active" : ""}">
          <span class="vehicle-health-dot ${online ? "online" : "offline"}"></span>
          <span class="vehicle-button-copy"><strong>${this._escape(vehicle.name)}</strong><small>${online ? "В сети" : "Недоступен"} · ${this._escape(freshness)}</small></span>
        </button>`;
      }).join("")}
    </div>`;
  }

  _securityCard(vehicle) {
    const entity = this._entity(vehicle, ["lock", "armed", "security"]);
    if (entity) {
      const locked = this._isLocked(entity);
      const text = locked === null ? "Нет данных" : locked ? "Под охраной" : "Снята";
      const tone = locked === null ? "muted" : locked ? "ok" : "warn";
      return `<div class="m-state ${tone}"><ha-icon icon="mdi:shield-car"></ha-icon><div><span>Охрана</span><strong>${this._escape(text)}</strong></div></div>`;
    }

    const alarm = this._entity(vehicle, ["alarm"]);
    if (alarm) {
      const active = this._isOn(alarm);
      const text = active === null ? "Нет данных" : active ? "Тревога" : "Норма";
      const tone = active === true ? "danger" : active === false ? "ok" : "muted";
      return `<button class="m-state ${tone}" data-entity="${this._escape(alarm.entityId)}"><ha-icon icon="mdi:alarm-light-outline"></ha-icon><div><span>Тревога</span><strong>${this._escape(text)}</strong></div></button>`;
    }

    return `<div class="m-state muted"><ha-icon icon="mdi:shield-outline"></ha-icon><div><span>Охрана</span><strong>Нет данных</strong></div></div>`;
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

    this.shadowRoot.querySelector(".m-freshness")?.remove();

    const style = document.createElement("style");
    style.dataset.starlineMobileV009 = "true";
    style.textContent = `
      .m-status-v008 { gap:16px !important; }
      .vehicle-button-copy small { font-size:11px !important; line-height:1.2 !important; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .m-vehicle-switcher button { min-height:64px !important; }
      .m-metrics { margin-top:2px; }
    `;
    this.shadowRoot.append(style);
  }
}

if (!customElements.get("starline-app-panel-v009")) {
  customElements.define("starline-app-panel-v009", StarLineAppPanelV009);
}
