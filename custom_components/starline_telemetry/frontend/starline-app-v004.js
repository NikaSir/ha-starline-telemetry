import "./starline-app-v003.js?v=0.2.0-core-bridge";

const BASE_COMPONENT = customElements.get("starline-app-panel-v003");
const WRITABLE_DOMAINS = new Set(["lock", "switch", "button"]);

function domainOf(entityId) {
  return String(entityId || "").split(".", 1)[0];
}

class StarLineAppPanelV004 extends BASE_COMPONENT {
  _online(vehicle) {
    for (const keys of [["location", "vehicle_location"], ["gsm_lvl", "gsm_level"]]) {
      const entity = this._entity(vehicle, keys);
      const online = entity?.state?.attributes?.online;
      if (typeof online === "boolean") return online;
    }
    return super._online(vehicle);
  }

  _latestUpdate(vehicle) {
    const location = this._entity(vehicle, ["location", "vehicle_location"]);
    const updated = location?.state?.attributes?.updated;
    if (updated) {
      const timestamp = Date.parse(updated);
      if (Number.isFinite(timestamp)) return timestamp;
    }
    return super._latestUpdate(vehicle);
  }

  _historyPath(entityIds, hours, withAttributes = false) {
    const end = new Date();
    const start = new Date(end.getTime() - hours * 3600000);
    const params = new URLSearchParams({
      filter_entity_id: entityIds.join(","),
      end_time: end.toISOString(),
      significant_changes_only: withAttributes ? "0" : "1",
    });
    params.append("skip_initial_state", "");
    if (!withAttributes) params.append("no_attributes", "");
    return `history/period/${encodeURIComponent(start.toISOString())}?${params.toString()}`;
  }

  _eventsFromHistory(vehicle, payload) {
    const events = super._eventsFromHistory(vehicle, payload);
    const lastLabelByRole = new Map();
    return events.filter((event) => {
      const previous = lastLabelByRole.get(event.role);
      if (previous === event.label) return false;
      lastLabelByRole.set(event.role, event.label);
      return true;
    });
  }

  _parkingChip(vehicle) {
    const entity = this._entity(vehicle, ["hbrake"]);
    if (!entity) return "";
    const state = this._isOn(entity);
    const value = state === null ? "—" : state ? "Поднят" : "Опущен";
    const tone = state === true ? "active" : "muted";
    return `<button class="telemetry-chip parking ${tone}" data-entity="${this._escape(entity.entityId)}">
      <ha-icon icon="mdi:car-brake-hold"></ha-icon><span>Ручник</span><strong>${this._escape(value)}</strong>
    </button>`;
  }

  _vehicleSvg(vehicle) {
    const name = String(vehicle?.name || "");
    const body = name.includes("130") ? "#1677c8" : name.includes("683") ? "#343b40" : "#356f86";
    const highlight = name.includes("130") ? "#3b9be6" : name.includes("683") ? "#596168" : "#5d91a4";
    return `<svg class="vehicle-art" viewBox="0 0 560 230" role="img" aria-label="Автомобиль ${this._escape(name)}" style="width:min(78%,390px);height:auto;position:relative;z-index:1;filter:drop-shadow(0 14px 12px rgba(0,0,0,.16))">
      <ellipse cx="280" cy="194" rx="205" ry="17" fill="rgba(0,0,0,.10)"/>
      <path d="M74 153c8-31 27-52 58-61l74-21c21-27 50-42 86-43h84c31 1 58 16 81 45l31 38 34 8c19 5 31 18 34 39l2 18h-55c-5-34-27-53-59-53-34 0-56 19-61 53H204c-5-34-27-53-60-53-34 0-56 19-61 53H62l2-11c2-5 5-9 10-12z" fill="${body}"/>
      <path d="M216 75c19-23 42-34 70-35h84c24 1 44 12 62 34l27 34H196l20-33z" fill="#b9d6e2" opacity=".95"/>
      <path d="M294 41v66M382 43l54 65M194 109h272" stroke="#18343f" stroke-width="7" stroke-linecap="round" opacity=".72"/>
      <path d="M88 139h93M469 121l49 12" stroke="${highlight}" stroke-width="8" stroke-linecap="round" opacity=".9"/>
      <rect x="96" y="116" width="48" height="9" rx="4.5" fill="#dbeaf0" opacity=".85"/>
      <rect x="470" y="134" width="46" height="10" rx="5" fill="#f4d35e" opacity=".95"/>
      <circle cx="144" cy="176" r="43" fill="#1d2529"/><circle cx="144" cy="176" r="25" fill="#b8c4c9"/><circle cx="144" cy="176" r="10" fill="#66747a"/>
      <circle cx="444" cy="176" r="43" fill="#1d2529"/><circle cx="444" cy="176" r="25" fill="#b8c4c9"/><circle cx="444" cy="176" r="10" fill="#66747a"/>
      <path d="M199 113v46M375 113v46" stroke="#263f49" stroke-width="4" opacity=".45"/>
      <rect x="314" y="119" width="24" height="5" rx="2.5" fill="#17323c" opacity=".75"/>
    </svg>`;
  }

  _statusView(vehicle) {
    return super._statusView(vehicle).replace(
      '<ha-icon class="vehicle-icon" icon="mdi:car-side"></ha-icon>',
      this._vehicleSvg(vehicle),
    );
  }

  _routeSvg() {
    return "";
  }

  _diagnosticsView(vehicle) {
    const cache = this._historyCache(vehicle);
    const entityPairs = Object.entries(vehicle?.entities || {});
    const missing = entityPairs.filter(([, entityId]) => !this._hass?.states?.[entityId]);
    const unavailable = entityPairs.filter(([, entityId]) => {
      const state = this._hass?.states?.[entityId];
      return state && ["unknown", "unavailable"].includes(String(state.state).toLowerCase());
    });
    const active = entityPairs.length - missing.length - unavailable.length;
    const errors = this._entity(vehicle, ["errors"]);
    const source = this._bootstrap?.source?.primary === "starline_telemetry" ? "StarLine Telemetry" : "Home Assistant · StarLine";
    const online = this._online(vehicle);
    const freshness = this._relativeTime(this._latestUpdate(vehicle));

    const rows = entityPairs.map(([role, entityId]) => {
      const state = this._hass?.states?.[entityId];
      const unavailableState = state && ["unknown", "unavailable"].includes(String(state.state).toLowerCase());
      const missingState = !state;
      const writable = WRITABLE_DOMAINS.has(domainOf(entityId));
      const stateLabel = missingState ? "не загружено" : state?.state ?? "—";
      return `<div class="diag-entity ${unavailableState || missingState ? "unavailable" : ""}"><div><strong>${this._escape(role)}</strong><span>${this._escape(entityId)}</span></div><div class="diag-state"><span>${this._escape(stateLabel)}</span>${writable || missingState ? `<ha-icon title="${missingState ? "Сущность не загружена в HA" : "Команды заблокированы"}" icon="${missingState ? "mdi:eye-off-outline" : "mdi:lock-outline"}"></ha-icon>` : `<button data-entity="${this._escape(entityId)}"><ha-icon icon="mdi:information-outline"></ha-icon></button>`}</div></div>`;
    }).join("");

    return `<div class="diagnostic-summary">
      <div class="diag-tile"><span>Источник</span><strong>${this._escape(source)}</strong></div>
      <div class="diag-tile ${online ? "ok" : "danger"}"><span>Связь</span><strong>${online ? "В сети" : "Недоступен"}</strong></div>
      <div class="diag-tile"><span>Свежесть StarLine</span><strong>${this._escape(freshness)}</strong></div>
      <div class="diag-tile ok"><span>Активно в HA</span><strong>${active} / ${entityPairs.length}</strong></div>
      <div class="diag-tile ${unavailable.length ? "warn" : "ok"}"><span>Недоступно</span><strong>${unavailable.length}</strong></div>
      <div class="diag-tile ${missing.length ? "warn" : "ok"}"><span>Не загружено</span><strong>${missing.length}</strong></div>
      ${errors ? `<div class="diag-tile ${Number(errors.state.state) > 0 ? "danger" : "ok"}"><span>Ошибки OBD</span><strong>${this._escape(this._formatState(errors, { digits: 0 }))}</strong></div>` : ""}
      <div class="diag-tile"><span>История</span><strong>${cache ? this._escape(this._relativeTime(cache.loadedAt)) : "Не загружена"}</strong></div>
    </div>
    <div class="read-only-banner"><ha-icon icon="mdi:shield-lock-outline"></ha-icon><div><strong>Read-only</strong><span>Панель не вызывает lock, switch, button и другие управляющие сервисы StarLine.</span></div></div>
    <section class="entity-section"><div class="section-title"><div><strong>Сущности автомобиля</strong><span>Активные, недоступные и не загруженные сущности разделены</span></div></div><div class="diag-list">${rows || `<div class="empty-inline">Сущности не найдены</div>`}</div></section>`;
  }
}

if (!customElements.get("starline-app-panel-v004")) {
  customElements.define("starline-app-panel-v004", StarLineAppPanelV004);
}
