import "./starline-app-v018.js?v=0.5.3-summary-scene-security";

const BASE_COMPONENT = customElements.get("starline-app-panel-v018");
const UI_VERSION = "0.5.4";
const SOURCE_ROUTE_KEY = "nikas.specialized.source_route.v1";
const RETURN_ROUTE_KEY = "nikas.starline.return_route.v1";
const SAFE_DEFAULT_ROUTE = "/dashboard-house";
const SAFE_ROUTE_PREFIXES = ["/dashboard-house", "/dashboard-actions", "/dashboard-infrastructure"];

function safeReturnRoute(value) {
  if (!value) return null;
  try {
    const url = new URL(decodeURIComponent(String(value).trim()), window.location.origin);
    if (url.origin !== window.location.origin) return null;
    const allowed = SAFE_ROUTE_PREFIXES.some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`));
    return allowed ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch (_error) {
    return null;
  }
}

function resolveReturnRoute(panel) {
  const current = new URL(window.location.href);
  const explicit = ["return_to", "from"]
    .map((key) => safeReturnRoute(current.searchParams.get(key)))
    .find(Boolean) || null;
  let handedOff = null;
  let saved = null;
  try {
    handedOff = safeReturnRoute(sessionStorage.getItem(SOURCE_ROUTE_KEY));
    sessionStorage.removeItem(SOURCE_ROUTE_KEY);
    saved = safeReturnRoute(sessionStorage.getItem(RETURN_ROUTE_KEY));
  } catch (_error) {}
  const configured = safeReturnRoute(panel?._panel?.config?.parent_route || panel?._panel?.config?.parent_path);
  const route = explicit || handedOff || saved || safeReturnRoute(document.referrer) || configured || SAFE_DEFAULT_ROUTE;
  try { sessionStorage.setItem(RETURN_ROUTE_KEY, route); } catch (_error) {}
  return route;
}

function navigateToSource(route) {
  const target = safeReturnRoute(route) || SAFE_DEFAULT_ROUTE;
  window.history.pushState(null, "", target);
  window.dispatchEvent(new Event("location-changed"));
}

function sameStableNode(current, next) {
  return current?.nodeType === next?.nodeType
    && (current.nodeType !== 1 || current.localName === next.localName);
}

function syncStableAttributes(current, next) {
  const preserveRuntimeStyle = current.matches?.(".target-hero");
  for (const attribute of [...current.attributes]) {
    if (preserveRuntimeStyle && attribute.name === "style") continue;
    if (!next.hasAttribute(attribute.name)) current.removeAttribute(attribute.name);
  }
  for (const attribute of [...next.attributes]) {
    if (preserveRuntimeStyle && attribute.name === "style") continue;
    if (current.getAttribute(attribute.name) !== attribute.value) {
      current.setAttribute(attribute.name, attribute.value);
    }
  }
}

function morphStableNode(current, next) {
  if (!sameStableNode(current, next)) {
    current.replaceWith(next.cloneNode(true));
    return;
  }
  if (current.nodeType === 3 || current.nodeType === 8) {
    if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
    return;
  }
  syncStableAttributes(current, next);
  morphStableChildren(current, next);
}

function morphStableChildren(current, next) {
  let index = 0;
  while (index < current.childNodes.length || index < next.childNodes.length) {
    const oldChild = current.childNodes[index];
    const newChild = next.childNodes[index];
    if (!newChild) {
      oldChild?.remove();
      continue;
    }
    if (!oldChild) {
      current.append(newChild.cloneNode(true));
      index += 1;
      continue;
    }
    morphStableNode(oldChild, newChild);
    index += 1;
  }
}

class StarLineAppPanelV019 extends BASE_COMPONENT {
  constructor() {
    super();
    this._stableWorkBindings = new WeakSet();
    this._stableViewCache = new Map();
    this._activeStableViewKey = null;
    this._stableRenderHandle = null;
    this._stableRenderUsesAnimationFrame = false;
    this._returnRoute = null;
  }

  set hass(value) {
    const first = !this._hass;
    this._hass = value;
    this._stableViewCache.forEach((shell) => {
      shell.querySelectorAll?.(".embedded-map-card").forEach((card) => {
        card.hass = value;
      });
    });
    if (this._mapCard) this._mapCard.hass = value;
    if (first && this.isConnected) {
      this._loadBootstrap();
      return;
    }
    if (!this._bootstrap) return;
    const signature = this._stateSignature();
    if (signature !== this._lastStateSignature) {
      this._lastStateSignature = signature;
      this._queueStableRender();
    }
  }

  disconnectedCallback() {
    if (this._stableRenderHandle !== null) {
      if (this._stableRenderUsesAnimationFrame) {
        window.cancelAnimationFrame?.(this._stableRenderHandle);
      } else {
        window.clearTimeout(this._stableRenderHandle);
      }
    }
    this._stableRenderHandle = null;
    super.disconnectedCallback();
  }

  _queueStableRender() {
    if (this._stableRenderHandle !== null) return;
    const render = () => {
      this._stableRenderHandle = null;
      this._render();
    };
    if (typeof window.requestAnimationFrame === "function") {
      this._stableRenderUsesAnimationFrame = true;
      this._stableRenderHandle = window.requestAnimationFrame(render);
    } else {
      this._stableRenderUsesAnimationFrame = false;
      this._stableRenderHandle = window.setTimeout(render, 16);
    }
  }

  _stateSignature() {
    const vehicles = this._view === "status"
      ? this._vehicles()
      : [this._vehicle()].filter(Boolean);
    if (!vehicles.length || !this._hass) return "";
    return vehicles.flatMap((vehicle) => Object.values(vehicle.entities || {}))
      .map((entityId) => {
        const state = this._hass.states?.[entityId];
        return state ? `${entityId}:${state.state}:${state.last_updated}` : `${entityId}:missing`;
      })
      .sort()
      .join("|");
  }

  _stableViewKey() {
    return this._view === "status"
      ? "status:all"
      : `${this._vehicleId || "none"}:${this._view}`;
  }

  _workMarkup() {
    const vehicle = this._vehicle();
    return `${this._loading ? '<div class="notice">Обновляю конфигурацию панели…</div>' : ""}
      ${this._error ? `<div class="notice">Bootstrap: ${this._escape(this._error)}</div>` : ""}
      ${this._content(vehicle)}`;
  }

  _bindStableWorkActions(shell, markExisting = false) {
    if (!shell) return;
    const bind = (selector, action) => {
      shell.querySelectorAll(selector).forEach((element) => {
        if (this._stableWorkBindings.has(element)) return;
        this._stableWorkBindings.add(element);
        if (!markExisting) element.addEventListener("click", () => action(element));
      });
    };
    bind("[data-view-target]", (element) => this._setView(element.dataset.viewTarget));
    bind("[data-entity]", (element) => this._openMoreInfo(element.dataset.entity));
    bind("[data-refresh-history]", () => this._ensureHistory(true));
    bind("[data-vehicle]", (element) => this._selectStableVehicle(element.dataset.vehicle));
  }

  _preserveEmbeddedMaps(shell) {
    const maps = [];
    shell.querySelectorAll(".embedded-map-card").forEach((card) => {
      const hostId = card.parentElement?.id;
      if (!hostId) return;
      maps.push({ hostId, card });
      card.remove();
    });
    return maps;
  }

  _restoreEmbeddedMaps(shell, maps) {
    maps.forEach(({ hostId, card }) => {
      const host = shell.querySelector(`#${hostId}`);
      if (!host) return;
      host.replaceChildren(card);
      card.hass = this._hass;
    });
  }

  _patchStableShell(shell) {
    if (!shell) return;
    const maps = this._preserveEmbeddedMaps(shell);
    const template = document.createElement("template");
    template.innerHTML = this._workMarkup();
    morphStableChildren(shell, template.content);
    this._restoreEmbeddedMaps(shell, maps);
    this._bindStableWorkActions(shell);
  }

  _createStableShell() {
    const shell = document.createElement("div");
    shell.className = "shell";
    shell.style.width = "100%";
    shell.style.margin = "0";
    shell.innerHTML = this._workMarkup();
    this._bindStableWorkActions(shell);
    return shell;
  }

  _activateStableView() {
    const content = this.shadowRoot?.getElementById("content");
    const canvas = content?.querySelector(":scope > .zoom-workspace");
    if (!content || !canvas) return false;

    const currentShell = canvas.querySelector(":scope > .shell");
    if (currentShell && this._activeStableViewKey) {
      this._stableViewCache.set(this._activeStableViewKey, currentShell);
    }

    const nextKey = this._stableViewKey();
    let nextShell = this._stableViewCache.get(nextKey);
    if (!nextShell) {
      nextShell = currentShell && !this._activeStableViewKey
        ? currentShell
        : this._createStableShell();
      this._stableViewCache.set(nextKey, nextShell);
      if (nextShell === currentShell) this._bindStableWorkActions(nextShell, true);
    } else {
      this._patchStableShell(nextShell);
    }

    if (nextShell !== currentShell) canvas.replaceChildren(nextShell);
    this._activeStableViewKey = nextKey;
    nextShell.style.width = "100%";
    nextShell.style.margin = "0";

    const mountedMap = nextShell.querySelector(".embedded-map-card");
    if (mountedMap) {
      mountedMap.hass = this._hass;
      this._mapCard = mountedMap;
    } else {
      this._mapCard = null;
      this._mountMap();
    }

    this._applyCanvasState(content, canvas, this._canvasState, false);
    if (this._view === "status") {
      if (this._summarySceneResizeObserver) this._fitSummaryScenes();
      else this._installSummarySceneFit();
    }
    return true;
  }

  _syncBottomNavigation() {
    const vehicle = this._vehicle();
    const historyBusy = vehicle && this._historyLoading.has(vehicle.device_id);
    const nav = this.shadowRoot?.querySelector("nav");
    nav?.classList.toggle("nav-busy", Boolean(historyBusy));
    nav?.querySelectorAll("[data-view]").forEach((button) => {
      const active = button.dataset.view === this._view;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
  }

  _installFixedVehicleSwitcher() {
    if (!this.shadowRoot) return;
    const app = this.shadowRoot.querySelector(".app");
    const header = app?.querySelector(":scope > header");
    const vehicles = this._orderedVehicles();
    if (!app || !header) return;

    let selector = app.querySelector(":scope > .fixed-vehicle-switcher");
    if (!selector && vehicles.length > 1) {
      selector = document.createElement("div");
      selector.className = "fixed-vehicle-switcher";
      selector.setAttribute("aria-label", "Автомобили");
      vehicles.forEach((vehicle) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.fixedVehicle = vehicle.device_id;
        const lamp = document.createElement("i");
        const label = document.createElement("span");
        button.append(lamp, label);
        button.addEventListener("click", () => this._selectStableVehicle(button.dataset.fixedVehicle));
        selector.append(button);
      });
      header.after(selector);
    }

    const visible = Boolean(selector && vehicles.length > 1 && this._view !== "status");
    if (selector) selector.hidden = !visible;
    app.classList.toggle("has-fixed-vehicle-switcher", visible);
    this._syncFixedVehicleSwitcher();
  }

  _syncFixedVehicleSwitcher() {
    const selector = this.shadowRoot?.querySelector(".fixed-vehicle-switcher");
    if (!selector) return;
    const vehicles = new Map(this._vehicles().map((vehicle) => [String(vehicle.device_id), vehicle]));
    selector.querySelectorAll("[data-fixed-vehicle]").forEach((button) => {
      const vehicle = vehicles.get(String(button.dataset.fixedVehicle));
      const online = Boolean(vehicle && this._online(vehicle));
      button.classList.toggle("active", button.dataset.fixedVehicle === this._vehicleId);
      const lamp = button.querySelector("i");
      lamp?.classList.toggle("online", online);
      lamp?.classList.toggle("offline", !online);
      const label = button.querySelector("span");
      if (label && vehicle && label.textContent !== vehicle.name) label.textContent = vehicle.name;
    });
  }

  _selectStableVehicle(vehicleId) {
    if (!vehicleId || vehicleId === this._vehicleId) return;
    this._saveCanvasState();
    this._vehicleId = vehicleId;
    this._canvasStateKeyLoaded = null;
    this._loadCanvasState();
    this._pickerOpen = false;
    this._lastStateSignature = this._stateSignature();
    const content = this.shadowRoot?.getElementById("content");
    const canvas = content?.querySelector(":scope > .zoom-workspace");
    content?.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
    if (content && canvas) this._applyCanvasState(content, canvas, this._canvasState, false);
    this._render();
    this._ensureHistory();
  }

  _setView(view) {
    if (!view || view === this._view) return;
    history.replaceState(null, "", `${location.pathname}${location.search}#${view}`);
    this._view = view;
    this._pickerOpen = false;
    this._canvasState = { ...this._canvasState, x: 0, y: 0 };
    const content = this.shadowRoot?.getElementById("content");
    const canvas = content?.querySelector(":scope > .zoom-workspace");
    content?.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
    if (content && canvas) this._applyCanvasState(content, canvas, this._canvasState, false);
    this._render();
    this._ensureHistory();
  }

  _installCommonHeader() {
    super._installCommonHeader();
    let plaque = this.shadowRoot?.querySelector(".nika-title");
    if (plaque && plaque.localName !== "button") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nika-title";
      button.setAttribute("aria-label", "Вернуться в базовую панель NikaS");
      button.innerHTML = plaque.innerHTML;
      plaque.replaceWith(button);
      plaque = button;
    }
    if (!this._returnRoute) this._returnRoute = resolveReturnRoute(this);
    if (plaque && !plaque.dataset.returnBound) {
      plaque.dataset.returnBound = "true";
      plaque.addEventListener("click", () => navigateToSource(this._returnRoute));
    }
    const title = plaque?.querySelector("strong");
    const subtitle = plaque?.querySelector("span");
    if (title) title.textContent = "StarLine";
    if (subtitle) subtitle.textContent = `UI v${UI_VERSION}`;
  }

  _installV019Styles() {
    if (!this.shadowRoot || this.shadowRoot.querySelector("style[data-starline-v019]")) return;
    const style = document.createElement("style");
    style.dataset.starlineV019 = "true";
    style.textContent = `
      :host {
        display:block !important;
        height:100dvh !important;
        max-height:100dvh !important;
        min-height:0 !important;
        overflow:hidden !important;
        overscroll-behavior:none !important;
      }
      .app {
        height:100% !important;
        min-height:0 !important;
        overflow:hidden !important;
      }
      header,.fixed-vehicle-switcher,nav {
        position:relative;
        flex:none;
        transform:translateZ(0);
      }
      #content { min-height:0 !important; }
      .fixed-vehicle-switcher[hidden] { display:none !important; }

      .nika-title strong { font-size:23px !important; line-height:1.05 !important; font-weight:800 !important; }
      .nika-title span { font-size:14px !important; line-height:1.1 !important; font-weight:560 !important; }
      .nika-title { min-height:44px !important; padding:5px 14px !important; border:1px solid var(--divider-color,var(--border)) !important; border-radius:16px !important; background:var(--card-background-color,var(--surface)) !important; color:var(--primary-text-color) !important; box-shadow:0 4px 14px rgba(23,45,76,.06) !important; font:inherit !important; cursor:pointer !important; }
      .nika-title:active { transform:scale(.985); }
      .nika-title:focus-visible { outline:2px solid var(--primary-color,var(--accent)); outline-offset:2px; }

      .notice,.vehicle-menu span,.telemetry-chip span,.freshness,
      .vehicle-caption span,.last-event>span:not(.event-date),.last-event>strong,
      .last-event .event-date,.status-pill,.section-title span,.map-fallback,
      .view-head span,.trip-meta>div:first-child span,.trip-times,.trip-foot,
      .diag-tile span,.read-only-banner span,.diag-entity strong,
      .diag-entity>div:first-child span,.diag-state>span,.empty-state span,
      .empty-inline,.group-title,.metric-label,.source-card div span,.readonly,
      .location-line,.m-freshness,.m-map-head span,.m-metric span,.m-state span,
      .m-event span,.summary-identity small,.summary-security span,
      .summary-connection span,.summary-metric span,
      .target-state-row .summary-state span,.summary-event span { font-size:12px !important; }

      .summary-identity strong { font-size:25px !important; }
      .summary-identity span { font-size:13px !important; }
      .summary-security strong,.summary-connection strong,.summary-metric strong,
      .target-state-row .summary-state strong,.summary-event strong { font-size:14px !important; }
      .vehicle-menu strong,.telemetry-chip strong,.vehicle-caption strong,
      .source-card div strong,.diag-entity strong,.read-only-banner strong,
      .m-state strong,.m-metric strong { font-size:14px !important; }
      .section-title strong,.empty-state strong,.m-section-label strong,
      .m-event strong,.m-map-head strong { font-size:16px !important; }
      .view-head strong { font-size:21px !important; }
      .history-row time { font-size:16px !important; }
      .history-row strong { font-size:18px !important; }
      .route-svg text { font-size:9px !important; }

      nav button { min-height:52px !important; border-radius:16px !important; }
      nav ha-icon { --mdc-icon-size:28px !important; }
      nav span { font-size:12px !important; font-weight:700 !important; }
      nav button.active {
        color:var(--primary-color,var(--accent)) !important;
        background:color-mix(in srgb,var(--primary-color,var(--accent)) 11%,transparent) !important;
        box-shadow:none !important;
      }

      @media(max-width:420px) {
        .nika-title strong { font-size:21px !important; }
        .nika-title span { font-size:13px !important; }
      }
    `;
    this.shadowRoot.append(style);
  }

  _render() {
    if (!this.shadowRoot?.querySelector(".app")) {
      super._render();
      if (!this.shadowRoot?.querySelector(".app")) return;
      this._activeStableViewKey = this._stableViewKey();
      const shell = this.shadowRoot.querySelector(".zoom-workspace > .shell");
      if (shell) {
        this._stableViewCache.set(this._activeStableViewKey, shell);
        this._bindStableWorkActions(shell, true);
      }
      this._installV019Styles();
      this._installCommonHeader();
      this._installFixedVehicleSwitcher();
      this._syncBottomNavigation();
      return;
    }

    this._installV019Styles();
    this._installCommonHeader();
    this._installFixedVehicleSwitcher();
    this._activateStableView();
    this._syncBottomNavigation();
  }
}

if (!customElements.get("starline-app-panel-v019")) {
  customElements.define("starline-app-panel-v019", StarLineAppPanelV019);
}

if (!customElements.get("starline-app-panel")) {
  customElements.define("starline-app-panel", class extends StarLineAppPanelV019 {});
}
