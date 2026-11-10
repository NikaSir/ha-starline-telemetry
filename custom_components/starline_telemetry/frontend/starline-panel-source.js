const UI_VERSION = "0.7.0-beta002";
const ASSET_BASE = "/starline_telemetry_static/assets";
const EVENT_WINDOW_HOURS = 24;
const TRIP_WINDOW_HOURS = 72;
const VIEWS = ["status", "history", "trips", "diagnostics"];
const WRITABLE_DOMAINS = new Set(["lock", "switch", "button"]);
const UNRELIABLE_STATES = new Set(["", "none", "null", "unknown", "unavailable"]);
const SOURCE_ROUTE_KEY = "nikas.specialized.source_route.v1";
const SOURCE_ROUTE_AT_KEY = "nikas.specialized.source_route_at.v1";
const RETURN_ROUTE_KEY = "nikas.starline.return_route.v1";
const SAFE_DEFAULT_ROUTE = "/home/overview";
const SOURCE_ROUTE_TTL_MS = 30_000;
const SECURITY_BOOTSTRAP_MAX_AGE_MS = 60_000;
const FUEL_KEYS = ["fuel", "fuel_percent", "fuel_litres", "fuel_volume"];
const HA_REPORT_MAX_AGE_MS = 30 * 60_000;
const MOSCOW_TIME = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit",
  hour: "2-digit", minute: "2-digit",
});
const FUEL_ERRORS = {
  fuel_unavailable: "Показание топлива недоступно.",
  fuel_stale: "Показание топлива устарело. Дождитесь обновления StarLine.",
  fuel_unit_unsupported: "Калибровка доступна для показаний в процентах.",
  refuel_in_progress: "Начало заправки уже сохранено. Обновите панель.",
  refuel_conflict: "Запись изменилась на другом устройстве. Обновите панель.",
  fuel_source_changed: "Источник показаний изменился. Начните новую запись.",
  fuel_report_pending: "Дождитесь увеличения уровня топлива. Можно нажать «Обновить» в шапке.",
  refuel_not_marked: "Сначала подтвердите, что бак заправлен.",
  refuel_expired: "С отметки полного бака прошло больше 30 минут. Отмените эту запись.",
  invalid_litres: "Проверьте объём заправки по чеку.",
  invalid_capacity: "Проверьте объём бака по документации.",
  unauthorized: "Для записи требуется администратор Home Assistant.",
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const domainOf = (entityId) => String(entityId || "").split(".", 1)[0];

function canonicalBaseRoute(pathname) {
  if (pathname === "/home/overview") return "/home/overview";
  if (pathname === "/dashboard-house-v13" || pathname.startsWith("/dashboard-house-v13/")) {
    return "/dashboard-house-v13/home";
  }
  if (pathname === "/dashboard-rooms-v11" || pathname.startsWith("/dashboard-rooms-v11/")) {
    return "/dashboard-rooms-v11/rooms";
  }
  if (pathname === "/dashboard-actions" || pathname.startsWith("/dashboard-actions/")) {
    return "/dashboard-actions/home";
  }
  if (pathname === "/dashboard-infrastructure" || pathname.startsWith("/dashboard-infrastructure/")) {
    return "/dashboard-infrastructure/overview";
  }
  return null;
}

function safeBaseRoute(candidate) {
  if (!candidate) return null;
  try {
    const url = new URL(decodeURIComponent(String(candidate).trim()), window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return canonicalBaseRoute(url.pathname);
  } catch (_err) {
    return null;
  }
}

function captureReturnRoute() {
  return SAFE_DEFAULT_ROUTE;
}

function navigate(route) {
  const safe = safeBaseRoute(route) || SAFE_DEFAULT_ROUTE;
  history.pushState(null, "", safe);
  window.dispatchEvent(new Event("location-changed"));
}

function openHomeAssistantMenu(target) {
  target.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true }));
}

const NIKAS_SHELL_BOUNDARY_THRESHOLD_PX = 4;

function shouldBlockNikasShellBoundaryMove({
  deltaX,
  deltaY,
  inViewport,
  scrollTop,
  scrollHeight,
  clientHeight,
}) {
  if (!Number.isFinite(deltaY) || Math.abs(deltaY) <= Math.abs(Number(deltaX) || 0)) return false;
  if (!inViewport) return true;
  const maximumScroll = Math.max(0, (Number(scrollHeight) || 0) - (Number(clientHeight) || 0));
  if (maximumScroll <= 1) return true;
  const currentScroll = Math.max(0, Number(scrollTop) || 0);
  if (deltaY > 0 && currentScroll <= 1) return true;
  return deltaY < 0 && currentScroll >= maximumScroll - 1;
}

function createNikasShellScrollBoundaryGuard({ host, viewport }) {
  if (!host?.addEventListener || !viewport) return () => {};
  let touch = null;

  const eventStartedInViewport = (event) => {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    return path.includes(viewport) || Boolean(viewport.contains?.(event.target));
  };
  const rememberTouch = (event) => {
    if (event.touches.length !== 1) {
      touch = null;
      return;
    }
    const current = event.touches[0];
    touch = {
      x: current.clientX,
      y: current.clientY,
      startX: current.clientX,
      startY: current.clientY,
      inViewport: eventStartedInViewport(event),
      blocked: false,
    };
  };
  const moveTouch = (event) => {
    if (event.touches.length !== 1) {
      touch = null;
      return;
    }
    const current = event.touches[0];
    if (!touch) {
      rememberTouch(event);
      return;
    }
    const deltaX = current.clientX - touch.x;
    const deltaY = current.clientY - touch.y;
    const travelX = current.clientX - touch.startX;
    const travelY = current.clientY - touch.startY;
    touch.x = current.clientX;
    touch.y = current.clientY;
    const verticalIntent = Math.abs(travelY) > NIKAS_SHELL_BOUNDARY_THRESHOLD_PX
      && Math.abs(travelY) > Math.abs(travelX);
    if (!touch.blocked && verticalIntent) {
      touch.blocked = shouldBlockNikasShellBoundaryMove({
        deltaX,
        deltaY,
        inViewport: touch.inViewport,
        scrollTop: viewport.scrollTop,
        scrollHeight: viewport.scrollHeight,
        clientHeight: viewport.clientHeight,
      });
    }
    if (touch.blocked && event.cancelable) event.preventDefault();
  };
  const endTouch = (event) => {
    if (event.touches.length === 1) rememberTouch(event);
    else touch = null;
  };
  const cancelTouch = () => { touch = null; };

  host.addEventListener("touchstart", rememberTouch, { passive: false, capture: true });
  host.addEventListener("touchmove", moveTouch, { passive: false, capture: true });
  host.addEventListener("touchend", endTouch, { passive: true, capture: true });
  host.addEventListener("touchcancel", cancelTouch, { passive: true, capture: true });

  return () => {
    host.removeEventListener("touchstart", rememberTouch, true);
    host.removeEventListener("touchmove", moveTouch, true);
    host.removeEventListener("touchend", endTouch, true);
    host.removeEventListener("touchcancel", cancelTouch, true);
    touch = null;
  };
}


class ZoomController {
  constructor(viewport, canvas, storageKey) {
    this.viewport = viewport;
    this.canvas = canvas;
    this.storageKey = storageKey;
    this.state = { scale: 1, x: 0, y: 0 };
    this.pointers = new Map();
    this.gesture = null;
    this.lastTwoFingerTap = 0;
    this.suppressUntil = 0;
    this._restore();
    this._bind();
    this.apply(false);
  }

  _bounds(scale = this.state.scale) {
    if (scale <= 1) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    const width = Math.max(this.canvas.scrollWidth, this.canvas.offsetWidth) * scale;
    const height = Math.max(this.canvas.scrollHeight, this.canvas.offsetHeight) * scale;
    return {
      minX: Math.min(0, this.viewport.clientWidth - width),
      maxX: 0,
      minY: Math.min(0, this.viewport.clientHeight - height),
      maxY: 0,
    };
  }

  _normalized(next = this.state) {
    let scale = clamp(finite(next.scale, 1), 0.75, 2);
    if (scale >= 0.97 && scale <= 1.03) scale = 1;
    if (scale <= 1) return { scale, x: 0, y: 0 };
    const bounds = this._bounds(scale);
    return {
      scale,
      x: clamp(finite(next.x), bounds.minX, bounds.maxX),
      y: clamp(finite(next.y), bounds.minY, bounds.maxY),
    };
  }

  apply(persist = true) {
    this.state = this._normalized();
    const { scale, x, y } = this.state;
    this.canvas.style.transform = `translate3d(${x}px,${y}px,0) scale(${scale})`;
    this.canvas.style.marginBottom = scale < 1
      ? `${Math.round((scale - 1) * Math.max(this.canvas.scrollHeight, this.canvas.offsetHeight))}px`
      : "0px";
    this.viewport.classList.toggle("zoom-enlarged", scale > 1);
    if (scale > 1 && this.viewport.scrollTop) this.viewport.scrollTop = 0;
    if (persist) localStorage.setItem(this.storageKey, JSON.stringify(this.state));
  }

  reset(feedback = true) {
    this.state = { scale: 1, x: 0, y: 0 };
    this.viewport.scrollTop = 0;
    this.apply();
    if (feedback) {
      const toast = this.viewport.closest(".app")?.querySelector(".zoom-feedback");
      if (toast) {
        toast.hidden = false;
        clearTimeout(this.feedbackTimer);
        this.feedbackTimer = setTimeout(() => { toast.hidden = true; }, 1100);
      }
    }
  }

  useStorageKey(storageKey) {
    if (!storageKey || storageKey === this.storageKey) return;
    this.storageKey = storageKey;
    this.state = { scale: 1, x: 0, y: 0 };
    this._restore();
    this.viewport.scrollTop = 0;
    this.apply(false);
  }

  _restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(this.storageKey) || "null");
      if (saved) this.state = this._normalized(saved);
    } catch (_err) {
      this.state = { scale: 1, x: 0, y: 0 };
    }
  }

  _bind() {
    const point = (event) => {
      const rect = this.viewport.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    this.viewport.addEventListener("click", (event) => {
      if (performance.now() < this.suppressUntil) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
    this.viewport.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "touch") return;
      const current = point(event);
      this.pointers.set(event.pointerId, { ...current, startX: current.x, startY: current.y });
      this.viewport.setPointerCapture?.(event.pointerId);
      if (this.pointers.size === 1) {
        const bounds = this._bounds();
        this.gesture = {
          type: this.state.scale > 1 ? "pan" : "native",
          start: current,
          state: { ...this.state },
          startedAt: performance.now(),
          panX: bounds.minX < 0,
          panY: bounds.minY < 0,
          moved: false,
        };
      } else if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.gesture = {
          type: "pinch",
          state: { ...this.state },
          scrollTop: this.viewport.scrollTop,
          startDistance: Math.max(1, distance(a, b)),
          startMidpoint: midpoint(a, b),
          startedAt: performance.now(),
          moved: false,
        };
        event.preventDefault();
      }
    });
    this.viewport.addEventListener("pointermove", (event) => {
      const tracked = this.pointers.get(event.pointerId);
      if (!tracked || event.pointerType !== "touch") return;
      Object.assign(tracked, point(event));
      const gesture = this.gesture;
      if (!gesture || gesture.type === "native") return;
      if (gesture.type === "pan" && this.pointers.size === 1) {
        const dx = gesture.panX ? tracked.x - gesture.start.x : 0;
        const dy = gesture.panY ? tracked.y - gesture.start.y : 0;
        gesture.moved ||= Math.hypot(dx, dy) >= 7;
        if (!gesture.moved) return;
        event.preventDefault();
        this.state = { scale: gesture.state.scale, x: gesture.state.x + dx, y: gesture.state.y + dy };
        this.apply();
      } else if (gesture.type === "pinch" && this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()];
        const middle = midpoint(a, b);
        const scale = clamp(gesture.state.scale * distance(a, b) / gesture.startDistance, 0.75, 2);
        const focalX = (gesture.startMidpoint.x - gesture.state.x) / gesture.state.scale;
        const focalY = (gesture.startMidpoint.y + gesture.scrollTop - gesture.state.y) / gesture.state.scale;
        this.state = {
          scale,
          x: middle.x - focalX * scale,
          y: middle.y - focalY * scale,
        };
        gesture.moved ||= Math.abs(scale - gesture.state.scale) > 0.01 || distance(middle, gesture.startMidpoint) > 7;
        event.preventDefault();
        this.apply();
        if (scale <= 1) this.viewport.scrollTop = clamp(focalY * scale - middle.y, 0, this.viewport.scrollHeight - this.viewport.clientHeight);
      }
    });
    const finish = (event, cancelled = false) => {
      if (!this.pointers.delete(event.pointerId) || !this.gesture) return;
      const gesture = this.gesture;
      if (this.pointers.size) return;
      const now = performance.now();
      if (!cancelled && gesture.type === "pinch" && !gesture.moved && now - gesture.startedAt <= 280) {
        if (now - this.lastTwoFingerTap <= 360) {
          this.lastTwoFingerTap = 0;
          this.reset();
          this.suppressUntil = now + 420;
        } else this.lastTwoFingerTap = now;
      }
      if (gesture.moved) this.suppressUntil = now + 420;
      this.gesture = null;
      this.apply();
    };
    this.viewport.addEventListener("pointerup", (event) => finish(event));
    this.viewport.addEventListener("pointercancel", (event) => finish(event, true));
    new ResizeObserver(() => this.apply(false)).observe(this.viewport);
  }
}

class StarLineAppPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._panel = null;
    this._route = null;
    this._bootstrap = null;
    this._vehicleId = null;
    this._view = this._viewFromLocation();
    this._history = new Map();
    this._historyLoading = new Set();
    this._historyErrors = new Map();
    this._viewPanes = new Map();
    this._maps = new Map();
    this._patchQueued = false;
    this._loading = false;
    this._fuelSaving = new Set();
    this._fuelMessages = new Map();
    this._fuelRevision = 0;
    this._reports = {};
    this._reportLoading = false;
    this._freshnessTimer = null;
    this._returnRoute = null;
    this._scrollBoundaryCleanup = null;
    this._boundLocation = () => this._readLocation();
    this._mountShell();
  }

  set hass(value) {
    this._hass = value;
    for (const card of this._maps.values()) card.hass = value;
    if (this.isConnected && !this._bootstrap) this._loadBootstrap();
    this._queuePatch();
  }

  set panel(value) {
    this._panel = value;
    if (!this._returnRoute) this._returnRoute = captureReturnRoute(value?.config?.parent_route);
    if (this.isConnected && this._hass && !this._bootstrap) this._loadBootstrap();
  }

  set route(value) { this._route = value; }

  connectedCallback() {
    this._ensureScrollBoundaryGuard();
    this._freshnessTimer ??= setInterval(() => {
      this._loadReportTimes();
      this._queuePatch();
    }, 60_000);
    window.addEventListener("location-changed", this._boundLocation);
    window.addEventListener("popstate", this._boundLocation);
    if (!this._returnRoute) this._returnRoute = captureReturnRoute(this._panel?.config?.parent_route);
    if (this._hass && !this._bootstrap) this._loadBootstrap();
  }

  disconnectedCallback() {
    clearInterval(this._freshnessTimer);
    this._freshnessTimer = null;
    window.removeEventListener("location-changed", this._boundLocation);
    window.removeEventListener("popstate", this._boundLocation);
    this._scrollBoundaryCleanup?.();
    this._scrollBoundaryCleanup = null;
  }

  _ensureScrollBoundaryGuard() {
    if (this._scrollBoundaryCleanup || !this._viewport) return;
    this._scrollBoundaryCleanup = createNikasShellScrollBoundaryGuard({
      host: this,
      viewport: this._viewport,
    });
  }

  _mountShell() {
    this.shadowRoot.innerHTML = `<style>${this._styles()}</style>
      <div class="app">
        <header class="app-header">
          <button class="header-control menu" aria-label="Открыть меню"><ha-icon icon="mdi:menu"></ha-icon></button>
          <button class="title-button" aria-label="Вернуться на главную панель"><strong>StarLine</strong><span>UI v${UI_VERSION}</span></button>
          <button class="header-control refresh" aria-label="Обновить"><ha-icon icon="mdi:refresh"></ha-icon></button>
        </header>
        <div class="vehicle-selector" role="tablist" aria-label="Автомобили"></div>
        <main class="viewport"><div class="canvas"><div class="view-stack"></div></div></main>
        <nav class="bottom-nav" aria-label="Разделы">
          <button data-view="status"><ha-icon icon="mdi:car-multiple"></ha-icon><span>Сводка</span></button>
          <button data-view="history"><ha-icon icon="mdi:timeline-clock-outline"></ha-icon><span>История</span></button>
          <button data-view="trips"><ha-icon icon="mdi:map-marker-path"></ha-icon><span>Поездки</span></button>
          <button data-view="diagnostics"><ha-icon icon="mdi:stethoscope"></ha-icon><span>Диагностика</span></button>
        </nav>
        <div class="zoom-feedback" hidden>Масштаб 100%</div>
      </div>`;
    this.$ = (selector, root = this.shadowRoot) => root.querySelector(selector);
    this.$$ = (selector, root = this.shadowRoot) => [...root.querySelectorAll(selector)];
    this._viewport = this.$(".viewport");
    this._ensureScrollBoundaryGuard();
    this._canvas = this.$(".canvas");
    this._stack = this.$(".view-stack");
    this._zoom = new ZoomController(this._viewport, this._canvas, "starline.panel.canvas.v1.default");
    this.$(".menu").addEventListener("click", (event) => openHomeAssistantMenu(event.currentTarget));
    this.$(".title-button").addEventListener("click", () => navigate(SAFE_DEFAULT_ROUTE));
    this.$(".refresh").addEventListener("click", () => this._refresh());
    this.$(".vehicle-selector").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-vehicle]");
      if (button) this._selectVehicle(button.dataset.vehicle);
    });
    this.$(".bottom-nav").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-view]");
      if (button) this._setView(button.dataset.view);
    });
    this._stack.addEventListener("click", (event) => this._handleContentClick(event));
    this._stack.addEventListener("submit", (event) => {
      if (!event.target.matches("[data-fuel-finish]")) return;
      event.preventDefault();
      const action = event.target.dataset.phase === "finish" ? "finish" : "mark_full";
      this._saveFuel(action, event.target.closest(".vehicle-pane"), action === "mark_full" ? event.target : null);
    });
    this._stack.addEventListener("pointerdown", (event) => this._startHold(event));
    ["pointerup", "pointercancel", "pointermove"].forEach((type) => this._stack.addEventListener(type, (event) => this._finishHold(event)));
    this._setView(this._view, false);
  }

  _styles() {
    return `
      :host{position:relative;display:block;inline-size:100%;block-size:100%;min-block-size:0;overflow:hidden;color:var(--primary-text-color);background:var(--primary-background-color);font-family:var(--ha-card-header-font-family,var(--paper-font-body1_-_font-family,system-ui,sans-serif));--surface:var(--ha-card-background,var(--card-background-color,#fff));--border:color-mix(in srgb,var(--primary-text-color) 11%,transparent);--muted:var(--secondary-text-color,#686868);--accent:#079fc5;--blue:#0875b5;--ok:#43a047;--warn:#ef8b16;--danger:#df3434}
      *{box-sizing:border-box}button{font:inherit;-webkit-tap-highlight-color:transparent}.app{block-size:100%;min-block-size:0;display:grid;grid-template-rows:calc(60px + env(safe-area-inset-top,0px)) 52px minmax(0,1fr) calc(64px + env(safe-area-inset-bottom,0px));overflow:hidden;overscroll-behavior:none}
      .app.overview{grid-template-rows:calc(60px + env(safe-area-inset-top,0px)) minmax(0,1fr) calc(64px + env(safe-area-inset-bottom,0px))}.vehicle-selector[hidden],.vehicle-selector [hidden],.empty-state[hidden]{display:none}
      .app-header{z-index:10;height:100%;display:grid;grid-template-columns:52px minmax(0,1fr) 52px;align-items:center;padding:env(safe-area-inset-top,0px) max(12px,env(safe-area-inset-right,0px)) 0 max(12px,env(safe-area-inset-left,0px));background:var(--surface);border-bottom:1px solid var(--border)}
      .header-control{width:44px;height:44px;border:1px solid var(--border);border-radius:16px;background:var(--surface);color:var(--primary-text-color);display:grid;place-items:center;box-shadow:0 3px 12px #00000012}.header-control:last-child{justify-self:end;color:var(--accent)}.header-control ha-icon{--mdc-icon-size:25px}
      .title-button{justify-self:center;width:min(360px,100%);max-width:100%;height:52px;min-height:52px;border:1px solid color-mix(in srgb,var(--primary-color,#03a9d9) 24%,var(--divider-color,#dfe3e8));border-radius:16px;background:color-mix(in srgb,var(--primary-color,#03a9d9) 5%,var(--card-background-color,#fff));color:var(--primary-text-color);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:5px 14px;box-shadow:0 5px 16px rgba(23,45,76,.06);cursor:pointer}.title-button:focus-visible{outline:2px solid var(--primary-color,#03a9d9);outline-offset:2px}.title-button:active{transform:scale(.985);background:color-mix(in srgb,var(--primary-color,#03a9d9) 13%,var(--card-background-color,#fff));border-color:color-mix(in srgb,var(--primary-color,#03a9d9) 42%,var(--divider-color,#dfe3e8));box-shadow:0 2px 7px rgba(23,45,76,.05)}.title-button strong{font-size:23px;line-height:1.05;font-weight:800}.title-button span{margin-top:3px;color:var(--muted);font-size:14px;line-height:1.2;font-weight:560;letter-spacing:.01em}
      .vehicle-selector{z-index:9;height:52px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:4px max(12px,env(safe-area-inset-right,0px));background:var(--surface);border-bottom:1px solid var(--border)}
      .vehicle-selector button{height:44px;min-height:44px;border:1px solid var(--border);border-radius:15px;background:var(--surface);color:var(--primary-text-color);display:flex;align-items:center;gap:10px;padding:0 14px;text-align:left;font-size:14px;font-weight:800}.vehicle-selector button::before{content:"";width:9px;height:9px;border-radius:50%;background:var(--ok)}.vehicle-selector button.offline::before{background:var(--danger)}.vehicle-selector button.active{border-color:color-mix(in srgb,var(--accent) 65%,transparent);background:color-mix(in srgb,var(--accent) 10%,var(--surface));color:var(--accent)}
      .viewport{min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:none;touch-action:pan-y;background:var(--primary-background-color);scrollbar-width:none}.viewport::-webkit-scrollbar{display:none}.viewport.zoom-enlarged{overflow:hidden;touch-action:none}.canvas{width:100%;height:100%;min-height:100%;transform-origin:0 0;will-change:transform}.view-stack{width:100%;max-width:1280px;height:100%;min-height:100%;margin:0 auto;padding:9px max(10px,env(safe-area-inset-right)) 14px max(10px,env(safe-area-inset-left))}.view{display:none;height:100%}.view.active{display:block}.vehicle-pane{display:none;height:100%}.vehicle-pane.active{display:block}
      .bottom-nav{z-index:10;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));padding:6px max(6px,env(safe-area-inset-right,0px)) calc(6px + env(safe-area-inset-bottom,0px)) max(6px,env(safe-area-inset-left,0px));background:var(--surface);border-top:1px solid var(--border)}.bottom-nav button{min-width:0;height:52px;min-height:52px;border:0;border-radius:15px;background:transparent;color:var(--muted);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}.bottom-nav ha-icon{--mdc-icon-size:26px}.bottom-nav span{max-width:100%;overflow:hidden;text-overflow:ellipsis;font-size:12px;line-height:14px;font-weight:700;white-space:nowrap}.bottom-nav button.active{color:var(--accent);background:color-mix(in srgb,var(--accent) 11%,var(--surface))}
      .zoom-feedback{position:fixed;z-index:40;left:50%;bottom:calc(82px + env(safe-area-inset-bottom));transform:translateX(-50%);padding:9px 14px;border-radius:16px;background:#202124e8;color:white;font-size:13px;font-weight:750}
      .view[data-view-pane="status"].active{display:grid;align-content:start;gap:10px;height:auto}
      .view[data-view-pane="status"] .vehicle-pane{height:auto;min-width:0}
      .summary-card{min-width:0;padding:9px;border:1px solid var(--border);border-radius:18px;background:var(--surface)}
      .summary-hero{min-width:0;display:grid;grid-template-columns:minmax(116px,1fr) minmax(0,1.7fr);align-items:center;gap:5px;padding:4px 7px 4px 10px;border-radius:12px;background:linear-gradient(100deg,var(--surface),color-mix(in srgb,var(--accent) 11%,var(--surface)))}
      .summary-hero[data-portrait="683"]{background:linear-gradient(100deg,var(--surface),color-mix(in srgb,var(--secondary-text-color,#686868) 16%,var(--surface)))}
      .identity{min-width:0}.identity strong{display:block;overflow-wrap:anywhere;font-size:21px;font-weight:850;line-height:1.12}
      .identity small{display:block;margin-top:4px;color:var(--muted);font-size:12px;line-height:1.2}
      .summary-car{display:block;justify-self:end;width:100%;height:clamp(76px,24vw,104px);object-fit:contain;object-position:right center}
      .summary-car[hidden]{display:none}.summary-card.offline .summary-car{filter:grayscale(.55) saturate(.58)}
      .metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;margin-top:6px}
      .metric{min-width:0;min-height:49px;display:grid;grid-template-rows:auto auto;align-content:center;justify-items:stretch;gap:3px;padding:4px;border:1px solid var(--border);border-radius:11px;background:color-mix(in srgb,var(--accent) 4%,var(--surface));color:var(--primary-text-color);text-align:center}
      .metric>span{display:block;color:var(--primary-text-color);font-size:12px;line-height:1.15;font-weight:750;text-align:center;overflow-wrap:anywhere}
      .metric-reading{min-width:0;display:flex;align-items:center;justify-content:center;gap:5px}.metric ha-icon{flex:0 0 auto;color:var(--blue);--mdc-icon-size:19px}.metric strong{display:block;margin:0;font-size:16px;line-height:1.1;font-weight:820;overflow-wrap:anywhere}
      .metric.warn ha-icon{color:var(--warn)}.metric.danger ha-icon{color:var(--danger)}.metric.muted strong,.perimeter.muted{color:var(--muted)}
      .perimeter{min-height:26px;margin:5px 0 0;padding:4px 6px;border-radius:8px;background:color-mix(in srgb,var(--secondary-text-color,#686868) 8%,var(--surface));font-size:13px;font-weight:600;line-height:1.25;overflow-wrap:anywhere}
      .perimeter.warn{background:color-mix(in srgb,var(--warn) 17%,var(--surface))}
      .summary-details summary{min-height:44px;display:flex;align-items:center;justify-content:space-between;gap:8px;list-style:none;color:var(--accent);font-size:13px;font-weight:700;cursor:pointer}.summary-details summary::-webkit-details-marker{display:none}.summary-details summary ha-icon{--mdc-icon-size:18px}.summary-details[open] summary ha-icon{transform:rotate(180deg)}
      .extra-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;margin-bottom:6px}.fuel-source{color:var(--muted);font-size:12px;line-height:1.35;overflow-wrap:anywhere}
      .fuel-calibration{display:grid;gap:8px;margin:12px 0;padding:12px;border:1px solid var(--border);border-radius:16px;background:var(--surface)}
      .fuel-calibration p{margin:0;font-size:13px;line-height:1.35;overflow-wrap:anywhere}.fuel-calibration .fuel-message{color:var(--muted)}.fuel-calibration [hidden]{display:none}
      .fuel-calibration button,.fuel-link{min-height:44px;padding:5px 10px;border:1px solid var(--border);border-radius:9px;background:var(--surface);color:var(--primary-text-color);text-align:center}.fuel-calibration button:disabled{opacity:.65}.fuel-link{color:var(--accent);margin-top:4px}
      .fuel-form,.fuel-form fieldset{display:grid;gap:8px}.fuel-form fieldset{border:0;margin:0;padding:0;min-width:0}.fuel-form label{display:grid;gap:4px;color:var(--muted);font-size:13px}.fuel-form input{width:100%;min-height:44px;padding:6px 9px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--primary-text-color);font:inherit;font-size:16px}.fuel-form-actions{display:flex;flex-wrap:wrap;gap:6px}
      .view-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:4px 2px 12px}.view-head strong{display:block;font-size:21px;line-height:1.05}.view-head span{display:block;margin-top:5px;color:var(--muted);font-size:13px}.view-head button{width:44px;height:44px;border:1px solid var(--border);border-radius:15px;background:var(--surface);color:var(--accent);display:grid;place-items:center}.history-day{margin-bottom:14px}.day-chip{display:inline-flex;margin:0 0 7px 5px;padding:5px 9px;border-radius:10px;background:color-mix(in srgb,var(--accent) 11%,var(--surface));font-size:16px;font-weight:800}.history-row{width:100%;min-height:62px;border:0;border-bottom:1px solid var(--border);background:var(--surface);color:var(--primary-text-color);display:grid;grid-template-columns:76px minmax(0,1fr);align-items:center;padding:8px 13px;text-align:left}.history-row:first-of-type{border-radius:16px 16px 0 0}.history-row:last-child{border-bottom:0;border-radius:0 0 16px 16px}.history-row time{color:var(--muted);font-size:16px}.history-row strong{font-size:18px;line-height:1.15}.source-note{margin:0 0 10px;padding:9px 12px;border-radius:13px;background:color-mix(in srgb,var(--accent) 7%,var(--surface));color:var(--muted);font-size:12px}
      .trip-list{display:grid;gap:10px}.trip-card{overflow:hidden;border:1px solid var(--border);border-radius:18px;background:var(--surface)}.trip-meta{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px}.trip-meta strong{font-size:19px}.trip-meta span{display:block;margin-top:4px;color:var(--muted);font-size:12px}.trip-times{display:flex;align-items:center;gap:5px}.trip-times ha-icon{--mdc-icon-size:18px;color:var(--accent)}.route-svg{display:block;width:100%;height:128px;color:var(--accent);background:color-mix(in srgb,var(--accent) 4%,var(--surface))}.route-svg text{fill:white;font-size:5px;font-weight:800}.route-marker{fill:var(--accent)}.trip-foot{display:flex;justify-content:space-between;padding:8px 12px;color:var(--muted);font-size:12px}.map-host{min-height:230px;margin-bottom:12px;overflow:hidden;border:1px solid var(--border);border-radius:18px;background:var(--surface)}.map-host>*{display:block;width:100%;height:100%}
      .diagnostic-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.diag-tile{min-height:74px;padding:11px;border:1px solid var(--border);border-radius:16px;background:var(--surface)}.diag-tile span{display:block;color:var(--muted);font-size:12px}.diag-tile strong{display:block;margin-top:7px;font-size:15px;overflow-wrap:anywhere}.diag-tile.ok strong{color:var(--ok)}.diag-tile.warn strong{color:var(--warn)}.diag-tile.danger strong{color:var(--danger)}.read-only-banner{display:grid;grid-template-columns:30px minmax(0,1fr);gap:9px;margin-top:10px;padding:12px;border-radius:16px;background:color-mix(in srgb,var(--accent) 9%,var(--surface))}.read-only-banner ha-icon{color:var(--accent)}.read-only-banner strong{font-size:15px}.read-only-banner span{display:block;margin-top:4px;color:var(--muted);font-size:12px;line-height:1.3}.diag-list{margin-top:10px;overflow:hidden;border:1px solid var(--border);border-radius:16px}.diag-entity{min-height:58px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 11px;border-bottom:1px solid var(--border);background:var(--surface)}.diag-entity:last-child{border-bottom:0}.diag-entity strong{font-size:13px}.diag-entity span{display:block;margin-top:3px;color:var(--muted);font-size:12px;overflow-wrap:anywhere}.diag-state{text-align:right}.diag-state button{width:34px;height:34px;border:0;background:transparent;color:var(--accent)}
      .empty-state{min-height:260px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:24px;text-align:center;color:var(--muted)}.empty-state ha-icon{--mdc-icon-size:44px;color:var(--accent)}.empty-state strong{color:var(--primary-text-color);font-size:18px}.empty-state span{max-width:420px;font-size:13px;line-height:1.35}.empty-state button{min-height:44px;padding:0 16px;border:0;border-radius:14px;background:var(--accent);color:white;font-weight:800}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
      @media(width < 700px) and (orientation:portrait){
        .view.two-vehicles.active:not(:has(.vehicle-pane.active .summary-details[open])){min-height:100%;grid-auto-rows:minmax(min-content,1fr);align-content:stretch}
        .view.two-vehicles.active:not(:has(.vehicle-pane.active .summary-details[open])) .summary-card{display:flex;flex-direction:column;height:100%}
        .view.two-vehicles.active:not(:has(.vehicle-pane.active .summary-details[open])) :is(.summary-hero,.metrics){flex:1 0 auto}
      }
      @media(max-width:390px){.title-button{width:100%;padding-inline:8px}.title-button strong{font-size:21px}.title-button span{font-size:13px}.metric{gap:2px;padding:4px 3px}.metric-reading{gap:3px}.metric strong{font-size:14px}.identity strong{font-size:18px}}
      @media(min-width:700px){.vehicle-selector{max-width:1280px;width:100%;margin:auto;border:0}.view[data-view-pane="status"].active{grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}}
    `;
  }

  _viewFromLocation() {
    const hash = String(location.hash || "#status").slice(1).toLowerCase();
    return VIEWS.includes(hash) ? hash : "status";
  }

  _readLocation() { this._setView(this._viewFromLocation(), false); }

  _orderedVehicles() {
    const priority = (vehicle) => this._portrait(vehicle) === "130" ? 0 : this._portrait(vehicle) === "683" ? 1 : 10;
    return [...(this._bootstrap?.vehicles || [])].sort((a, b) => priority(a) - priority(b) || String(a.name).localeCompare(String(b.name), "ru"));
  }

  _vehicle(id = this._vehicleId) { return this._orderedVehicles().find((item) => String(item.device_id) === String(id)) || this._orderedVehicles()[0] || null; }
  _entity(vehicle, keys) {
    if (!vehicle || !this._hass) return null;
    for (const key of keys) {
      const entityId = vehicle.entities?.[key];
      const state = entityId ? this._hass.states?.[entityId] : null;
      if (entityId && state) return { key, entityId, state, source: vehicle.sources?.[key] };
    }
    return null;
  }

  _isOn(entity) {
    if (!entity?.state) return null;
    const raw = String(entity.state.state).toLowerCase();
    if (UNRELIABLE_STATES.has(raw)) return null;
    if (["on", "true", "open", "unlocked", "running"].includes(raw)) return true;
    if (["off", "false", "closed", "locked", "stopped"].includes(raw)) return false;
    return null;
  }

  _isLocked(entity) {
    if (!entity?.state) return null;
    const raw = String(entity.state.state).toLowerCase();
    if (UNRELIABLE_STATES.has(raw)) return null;
    if (["locked", "armed"].includes(raw)) return true;
    if (["unlocked", "disarmed"].includes(raw)) return false;
    return this._isOn(entity);
  }

  _reportedAt(state, entityId) {
    if (!state) return null;
    const timestamp = Date.parse(state?.last_reported || state?.last_updated || "");
    const report = this._reports?.[entityId];
    if (report && report.value === String(state.state)) {
      const reportedAt = Date.parse(report.reported_at);
      if (Number.isFinite(reportedAt) && (!Number.isFinite(timestamp) || reportedAt > timestamp)) return reportedAt;
    }
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  _latestUpdate(vehicle) {
    let latest = null;
    for (const entityId of Object.values(vehicle?.entities || {})) {
      const state = this._hass?.states?.[entityId];
      if (!state || UNRELIABLE_STATES.has(String(state.state).trim().toLowerCase())) continue;
      const timestamp = this._reportedAt(state, entityId);
      if (timestamp !== null && (latest === null || timestamp > latest)) latest = timestamp;
    }
    return latest;
  }

  _quality(timestamp) {
    if (this._hass?.connected === false || !Number.isFinite(timestamp)) return "unavailable";
    const age = Date.now() - timestamp;
    return age >= 0 && age <= HA_REPORT_MAX_AGE_MS ? "fresh" : "stale";
  }

  _online(vehicle) { return this._quality(this._latestUpdate(vehicle)) === "fresh"; }

  _formatReport(timestamp) {
    return Number.isFinite(timestamp) ? `${MOSCOW_TIME.format(timestamp)} МСК` : "Нет времени обновления";
  }

  _formatNumber(value, digits = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? new Intl.NumberFormat("ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(numeric) : String(value ?? "—");
  }

  _formatState(entity, digits = 0) {
    if (!entity?.state || UNRELIABLE_STATES.has(String(entity.state.state).trim().toLowerCase())) return "Нет данных";
    const raw = entity.state.state;
    const unit = entity.state.attributes?.unit_of_measurement || "";
    return `${this._formatNumber(raw, digits)}${unit ? ` ${unit}` : ""}`;
  }

  _security(vehicle) {
    const usable = (entity) => this._quality(this._reportedAt(entity?.state, entity?.entityId)) === "fresh";
    const alarmEntity = this._entity(vehicle, ["alarm"]);
    const alarm = usable(alarmEntity) ? this._isOn(alarmEntity) : null;
    if (alarm === true) return { key: "alarm", label: "Тревога", icon: "mdi:alarm-light" };
    const entityKeys = ["lock", "armed", "security", "arm", "guard"];
    const entityCandidates = entityKeys
      .map((key) => this._entity(vehicle, [key]))
      .filter(Boolean);
    const current = entityCandidates
      .filter(usable)
      .map((entity) => this._isLocked(entity))
      .find((value) => typeof value === "boolean");
    if (typeof current === "boolean") {
      return current
        ? { key: "armed", label: "Включена", icon: "mdi:shield-lock" }
        : { key: "disarmed", label: "Снята", icon: "mdi:shield-off-outline" };
    }
    if (entityCandidates.length) {
      const stale = entityCandidates.some((entity) => this._isLocked(entity) !== null &&
        this._quality(this._reportedAt(entity.state, entity.entityId)) === "stale");
      return { key: "unknown", label: stale ? "Устарело" : "Нет данных", icon: "mdi:shield-outline" };
    }

    const live = vehicle?.live_security;
    const fetchedAt = Date.parse(live?.fetched_at || "");
    const age = Date.now() - fetchedAt;
    const armed = this._hass?.connected !== false && typeof live?.arm === "boolean" && Number.isFinite(fetchedAt) &&
      age >= 0 && age <= SECURITY_BOOTSTRAP_MAX_AGE_MS ? live.arm : null;
    if (armed === true) return { key: "armed", label: "Включена", icon: "mdi:shield-lock" };
    if (armed === false) return { key: "disarmed", label: "Снята", icon: "mdi:shield-off-outline" };
    return { key: "unknown", label: "Нет данных", icon: "mdi:shield-outline" };
  }

  _portrait(vehicle) {
    const name = String(vehicle?.name || "").toLowerCase();
    if (/(^|\D)683(\D|$)|ч[её]рн/.test(name)) return "683";
    if (/(^|\D)130(\D|$)|син[иея]/.test(name)) return "130";
    return null;
  }

  _fuelMetric(vehicle) {
    const entity = this._entity(vehicle, FUEL_KEYS);
    const raw = this._formatState(entity);
    const unit = entity?.state?.attributes?.unit_of_measurement || "";
    const source = entity ? vehicle.sources?.[entity.key] : null;
    const timestamp = this._reportedAt(entity?.state, entity?.entityId);
    const numeric = Number(entity?.state?.state);
    const valid = raw !== "Нет данных" && Number.isFinite(numeric) && numeric >= 0 && (unit !== "%" || numeric <= 100);
    const quality = valid ? this._quality(timestamp) : "unavailable";
    const model = vehicle.fuel_calibration;
    const isEstimate = quality === "fresh" && unit === "%" && model?.unit === unit &&
      model?.status === "ready" && model?.entity_id === entity.entityId &&
      Number.isFinite(model.factor) && model.factor > 0;
    return {
      label: isEstimate ? "Топливо · оценка" : quality === "stale" ? "Топливо · устарело" : "Топливо",
      icon: "mdi:gas-station-outline",
      entityId: entity?.entityId || "",
      value: isEstimate ? `${this._formatNumber(clamp(numeric * model.factor, 0, 100))} %` : quality !== "unavailable" ? raw : "Нет данных",
      raw: valid ? raw : "Нет данных",
      timestamp, quality, source, unit,
      tone: quality === "stale" ? "warn" : quality === "unavailable" ? "muted" : "",
    };
  }

  _engineMetric(vehicle) {
    const core = this._entity(vehicle, ["ign"]);
    const engine = this._entity(vehicle, ["engine_running"]) ||
      (core?.source === "core_starline" && domainOf(core.entityId) === "switch" ? core : null);
    return this._stateSpec(engine, "Двигатель", "mdi:engine-outline", "Работает", "Остановлен", "active");
  }

  _ignitionMetric(vehicle) {
    const core = this._entity(vehicle, ["run"]);
    const ignition = this._entity(vehicle, ["ignition"]) ||
      (core?.source === "core_starline" && domainOf(core.entityId) === "binary_sensor" ? core : null);
    return this._stateSpec(ignition, "Зажигание", "mdi:car-key", "Включено", "Выключено");
  }

  _overviewPower(vehicle) {
    const engine = this._engineMetric(vehicle);
    const ignition = this._ignitionMetric(vehicle);
    const useIgnition = ["muted", "stale"].includes(engine.tone) && ["ok", "warn"].includes(ignition.tone);
    return useIgnition ? { primary: ignition, secondary: engine } : { primary: engine, secondary: ignition };
  }

  _perimeter(vehicle) {
    return [
      this._stateSpec(this._entity(vehicle, ["door", "doors"]), "Двери", "mdi:car-door", "Открыты", "Закрыты"),
      this._stateSpec(this._entity(vehicle, ["hood"]), "Капот", "mdi:car-lifted-pickup", "Открыт", "Закрыт"),
      this._stateSpec(this._entity(vehicle, ["trunk"]), "Багажник", "mdi:car-back", "Открыт", "Закрыт"),
    ];
  }

  _metricSpec(vehicle, keys, label, icon, digits = 0) {
    const entity = this._entity(vehicle, keys);
    const quality = this._quality(this._reportedAt(entity?.state, entity?.entityId));
    const raw = quality === "unavailable" ? "Нет данных" : this._formatState(entity, digits);
    return { label, icon, entityId: entity?.entityId || "", value: raw === "Нет данных" ? raw : quality === "stale" ? "Устарело" : raw, tone: quality === "stale" ? "warn" : quality === "unavailable" ? "muted" : "" };
  }

  _stateSpec(entity, label, icon, onText, offText, activeTone = "warn") {
    const value = this._isOn(entity);
    const quality = this._quality(this._reportedAt(entity?.state, entity?.entityId));
    const missing = value === null || quality === "unavailable";
    const stale = !missing && quality === "stale";
    return { label, icon, entityId: entity?.entityId || "", value: missing ? "Нет данных" : stale ? "Устарело" : value ? onText : offText, tone: missing ? "muted" : stale ? "stale" : value ? activeTone : "ok" };
  }

  _setText(root, selector, value) { const node = this.$(selector, root); if (node && node.textContent !== String(value)) node.textContent = String(value); }
  _setIcon(root, selector, value) { const node = this.$(selector, root); if (node && node.getAttribute("icon") !== value) node.setAttribute("icon", value); }
  _setClass(node, name, enabled) { if (node) node.classList.toggle(name, Boolean(enabled)); }

  async _loadReportTimes() {
    if (!this._bootstrap || !this._hass || this._hass.connected === false ||
        this._reportLoading || this._fuelSaving.size || document.visibilityState === "hidden") return;
    const revision = this._fuelRevision;
    this._reportLoading = true;
    try {
      const response = await this._hass.callWS({ type: "starline_telemetry/panel/report_times" });
      this._reports = response?.reports || {};
      if (response?.calibrations && revision === this._fuelRevision && !this._fuelSaving.size) {
        for (const vehicle of this._orderedVehicles()) {
          vehicle.fuel_calibration = response.calibrations[String(vehicle.device_id)] || null;
        }
      }
    } catch (_err) {
      // Keep the last report; its age remains visible until HA becomes available.
    } finally {
      this._reportLoading = false;
      this._queuePatch();
    }
  }

  async _loadBootstrap(force = false) {
    if (!this._hass || this._loading) return;
    this._loading = true;
    this._queuePatch();
    this.$(".refresh ha-icon")?.classList.add("spin");
    try {
      const entryId = this._panel?.config?.entry_id;
      this._bootstrap = await this._hass.callWS({ type: "starline_telemetry/panel/bootstrap", force: Boolean(force), ...(entryId ? { entry_id: entryId } : {}) });
      if (this._bootstrap.reports) this._reports = this._bootstrap.reports;
    } catch (_err) {
      this._bootstrap ??= this._panel?.config?.bootstrap_fallback || { vehicles: [] };
    } finally {
      this._loading = false;
      this.$(".refresh ha-icon")?.classList.remove("spin");
    }
    const vehicles = this._orderedVehicles();
    if (!vehicles.some((item) => String(item.device_id) === String(this._vehicleId))) this._vehicleId = vehicles[0]?.device_id || null;
    this._useWorkspaceZoom();
    this._mountVehicleSelector();
    this._ensureView(this._view);
    this._queuePatch();
    if (["history", "trips"].includes(this._view)) this._ensureHistory();
  }

  _mountVehicleSelector() {
    const selector = this.$(".vehicle-selector");
    const known = new Set(this.$$("button[data-vehicle]", selector).map((item) => item.dataset.vehicle));
    for (const vehicle of this._orderedVehicles()) {
      const id = String(vehicle.device_id);
      if (known.has(id)) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.vehicle = id;
      button.setAttribute("role", "tab");
      button.textContent = vehicle.name || `StarLine ${id}`;
      this._insertVehicleNode(selector, button);
    }
  }

  _insertVehicleNode(parent, node) {
    const order = this._orderedVehicles().map((vehicle) => String(vehicle.device_id));
    const index = order.indexOf(node.dataset.vehicle);
    const next = [...parent.children].find((child) => order.indexOf(child.dataset.vehicle) > index);
    parent.insertBefore(node, next || null);
  }

  _ensureView(view) {
    if (this._viewPanes.has(view)) return this._viewPanes.get(view);
    const section = document.createElement("section");
    section.className = "view";
    section.dataset.viewPane = view;
    if (view === "status") {
      section.innerHTML = `<div class="empty-state" role="status"><ha-icon icon="mdi:car-multiple"></ha-icon><strong></strong></div>`;
    }
    this._stack.append(section);
    this._viewPanes.set(view, section);
    for (const vehicle of this._orderedVehicles()) this._ensureVehiclePane(view, vehicle);
    return section;
  }

  _ensureVehiclePane(view, vehicle) {
    const section = this._viewPanes.get(view) || this._ensureView(view);
    const id = String(vehicle.device_id);
    let pane = this.$(`.vehicle-pane[data-vehicle="${CSS.escape(id)}"]`, section);
    if (pane) return pane;
    pane = document.createElement("div");
    pane.className = "vehicle-pane";
    pane.dataset.vehicle = id;
    if (view === "status") this._mountSummary(pane, vehicle);
    else if (view === "diagnostics") this._mountDiagnostics(pane, vehicle);
    else this._mountAsyncView(pane, view);
    this._insertVehicleNode(section, pane);
    return pane;
  }

  _metricTiles(count) {
    return Array.from({ length: count }, () => `<button class="metric" type="button"><span></span><div class="metric-reading"><ha-icon></ha-icon><strong></strong></div></button>`).join("");
  }

  _mountSummary(pane, vehicle) {
    const portrait = this._portrait(vehicle);
    const image = portrait ? `<img class="summary-car" src="${ASSET_BASE}/starline-car-${portrait}-v2.webp?v=${UI_VERSION}" alt="" width="1866" height="843">` : "";
    pane.innerHTML = `<article class="summary-card">
      <div class="summary-hero" data-portrait="${portrait || ""}">
        <div class="identity"><strong></strong><small class="connection-status"></small><small class="connection-time"></small></div>
        ${image}
      </div>
      <div class="metrics">${this._metricTiles(4)}</div>
      <p class="perimeter"></p>
      <details class="summary-details">
        <summary>Подробнее <ha-icon icon="mdi:chevron-down"></ha-icon></summary>
        <div class="extra-metrics">${this._metricTiles(8)}</div>
        <div class="fuel-source"></div>
        <button class="fuel-link" type="button" data-fuel-details>Калибровка топлива</button>
      </details>
    </article>`;
  }

  _mountAsyncView(pane, view) {
    const title = view === "history" ? "История" : "Поездки";
    const subtitle = view === "history" ? "События StarLine · 24 часа" : "Маршруты по GPS · 72 часа";
    pane.innerHTML = `<div class="view-head"><div><strong>${title}</strong><span>${subtitle}</span></div><button type="button" data-refresh-history="1" aria-label="Обновить"><ha-icon icon="mdi:refresh"></ha-icon></button></div><div class="async-content"><div class="empty-state"><ha-icon icon="mdi:cloud-download-outline"></ha-icon><strong>Данные ещё не загружены</strong></div></div>`;
  }

  _mountDiagnostics(pane, vehicle) {
    pane.innerHTML = `<div class="view-head"><div><strong>Диагностика</strong><span>Read-only состояние интеграции</span></div></div><div class="diagnostic-summary">${["Источник","Связь","Свежесть","Недоступно"].map((label) => `<div class="diag-tile"><span>${label}</span><strong></strong></div>`).join("")}</div><div class="read-only-banner"><ha-icon icon="mdi:shield-lock-outline"></ha-icon><div><strong>Read-only</strong><span>Панель не вызывает управляющие сервисы StarLine.</span></div></div><section class="fuel-calibration" aria-label="Калибровка топлива">
      <strong>Калибровка топлива</strong>
      <p class="fuel-source"></p>
      <p class="fuel-model"></p>
      <p class="fuel-latest"></p>
      <p class="fuel-pending" hidden></p>
      <p class="fuel-message" role="status" aria-live="polite"></p>
      <button type="button" data-fuel-action="start" hidden>Зафиксировать показание до заправки</button>
      <form class="fuel-form" data-fuel-finish hidden>
        <fieldset>
          <label>Литры по чеку<input name="litres" type="number" inputmode="decimal" min="0.01" step="any" max="200" required></label>
          <label>Подтверждённый объём бака, л (необязательно)<input name="capacity" type="number" inputmode="decimal" min="0.01" step="any" max="200"></label>
        </fieldset>
        <div class="fuel-form-actions">
          <button type="submit">Бак заправлен</button>
          <button type="button" data-fuel-action="cancel">Отменить запись</button>
        </div>
      </form>
    </section><div class="diag-list"></div>`;
    const list = this.$(".diag-list", pane);
    for (const [role, entityId] of Object.entries(vehicle.entities || {})) {
      const row = document.createElement("div");
      row.className = "diag-entity";
      row.dataset.entity = entityId;
      row.dataset.role = role;
      row.innerHTML = `<div><strong></strong><span></span></div><div class="diag-state"><span></span>${WRITABLE_DOMAINS.has(domainOf(entityId)) ? `<ha-icon title="Команды заблокированы" icon="mdi:lock-outline"></ha-icon>` : `<button type="button" data-entity="${entityId}" aria-label="Подробнее"><ha-icon icon="mdi:information-outline"></ha-icon></button>`}</div>`;
      this._setText(row, "div > strong", role);
      this._setText(row, "div > span", entityId);
      list.append(row);
    }
  }

  _queuePatch() {
    if (this._patchQueued || !this._bootstrap) return;
    this._patchQueued = true;
    requestAnimationFrame(() => {
      this._patchQueued = false;
      this._patchAll();
    });
  }

  _patchAll() {
    const overview = this._view === "status";
    this.$(".app").classList.toggle("overview", overview);
    this.$(".vehicle-selector").hidden = overview;
    const vehicles = this._orderedVehicles();
    const known = new Set(vehicles.map((vehicle) => String(vehicle.device_id)));
    for (const [view, section] of this._viewPanes) {
      for (const vehicle of vehicles) {
        const pane = this._ensureVehiclePane(view, vehicle);
        if (view === "status") this._patchSummary(pane, vehicle);
        if (view === "diagnostics") this._patchDiagnostics(pane, vehicle);
      }
      for (const pane of this.$$(".vehicle-pane", section)) {
        const id = pane.dataset.vehicle;
        pane.classList.toggle("active", known.has(id) && (view === "status" || id === String(this._vehicleId)));
      }
      if (view === "status") {
        this._setClass(section, "two-vehicles", vehicles.length === 2);
        this.$(".empty-state", section).hidden = vehicles.length > 0;
        this._setText(section, ".empty-state strong", this._bootstrap ? "Нет доступных автомобилей" : "Загружаем данные StarLine");
      }
      section.classList.toggle("active", view === this._view);
    }
    for (const button of this.$$(".vehicle-selector button")) {
      const id = button.dataset.vehicle;
      const vehicle = known.has(id) ? this._vehicle(id) : null;
      button.hidden = !vehicle;
      button.classList.toggle("active", id === String(this._vehicleId));
      button.classList.toggle("offline", vehicle ? !this._online(vehicle) : true);
      const selected = button.classList.contains("active") ? "true" : "false";
      if (button.getAttribute("aria-selected") !== selected) button.setAttribute("aria-selected", selected);
    }
    for (const button of this.$$(".bottom-nav button")) button.classList.toggle("active", button.dataset.view === this._view);
  }

  _patchSummary(pane, vehicle) {
    const latest = this._latestUpdate(vehicle);
    const quality = this._quality(latest);
    this._setClass(this.$(".summary-card", pane), "offline", quality !== "fresh");
    const portrait = this._portrait(vehicle);
    this._setText(pane, ".identity strong", portrait ? `Murano ${portrait}` : vehicle.name || `StarLine ${vehicle.device_id}`);
    this._setText(pane, ".connection-status", this._hass?.connected === false ? "Нет связи с HA" :
      quality === "fresh" ? "Данные HA" : quality === "stale" ? "Данные устарели" : "Данные недоступны");
    this._setText(pane, ".connection-time", this._formatReport(latest));

    const fuel = this._fuelMetric(vehicle);
    const security = this._security(vehicle);
    const power = this._overviewPower(vehicle);
    const metrics = [
      fuel,
      this._metricSpec(vehicle, ["battery"], "АКБ", "mdi:car-battery", 1),
      power.primary,
      { label: "Охрана", value: security.label, icon: security.icon, entityId: "",
        tone: security.key === "alarm" ? "danger" : security.key === "unknown" ? "muted" : "" },
    ];
    this.$$(".metrics .metric", pane).forEach((node, index) => this._patchMetric(node, metrics[index]));
    const perimeter = this._perimeter(vehicle);
    const perimeterNode = this.$(".perimeter", pane);
    this._setClass(perimeterNode, "warn", perimeter.some((item) => item.tone === "warn"));
    this._setClass(perimeterNode, "muted", perimeter.every((item) => item.tone !== "warn") && perimeter.some((item) => ["muted", "stale"].includes(item.tone)));
    this._setText(pane, ".perimeter", this._perimeterLabel(perimeter));

    const extra = [
      this._metricSpec(vehicle, ["etemp", "engine_temperature"], "Темп. двигателя", "mdi:thermometer", 0),
      this._metricSpec(vehicle, ["ctemp", "cabin_temperature"], "Темп. салона", "mdi:car-seat-heater", 0),
      power.secondary,
      this._stateSpec(this._entity(vehicle, ["hbrake", "hand_brake"]), "Ручник", "mdi:car-brake-hold", "Поднят", "Снят"),
      this._metricSpec(vehicle, ["odometer", "mileage"], "Пробег", "mdi:counter", 0),
      this._metricSpec(vehicle, ["obd_errors", "errors"], "Ошибки OBD", "mdi:car-wrench", 0),
      this._metricSpec(vehicle, ["gsm_lvl", "gsm_level", "gsm_signal"], "Сигнал GSM", "mdi:signal", 0),
      this._metricSpec(vehicle, ["gps_count", "gps_satellites"], "Спутники GPS", "mdi:satellite-variant", 0),
    ];
    this.$$(".extra-metrics .metric", pane).forEach((node, index) => this._patchMetric(node, extra[index]));
    this._setText(pane, ".fuel-source", this._fuelSourceText(fuel));
  }

  _fuelSourceText(fuel) {
    const source = fuel.source === "starline_telemetry" ? "StarLine Telemetry" : "StarLine в HA";
    const quality = fuel.quality === "stale" ? " · устарело" : fuel.quality === "unavailable" ? " · недоступно" : "";
    return `Топливо из ${source}: ${fuel.raw} · ${this._formatReport(fuel.timestamp)}${quality}`;
  }

  _patchMetric(node, spec) {
    if (node.dataset.entity !== spec.entityId) node.dataset.entity = spec.entityId;
    for (const tone of ["warn", "danger", "muted"]) this._setClass(node, tone, spec.tone === tone || (tone === "warn" && spec.tone === "stale"));
    const title = spec.quality === "stale" ? "Показание топлива устарело" : spec.quality === "unavailable" ? "Актуальность показания топлива не подтверждена" : "";
    if (node.title !== title) node.title = title;
    this._setIcon(node, "ha-icon", spec.icon);
    this._setText(node, "span", spec.label);
    this._setText(node, "strong", spec.value);
  }

  _perimeterLabel(items) {
    const opened = items.filter((item) => item.tone === "warn").map((item) => item.label.toLowerCase());
    const unknown = items.filter((item) => item.tone === "muted").map((item) => item.label.toLowerCase());
    const stale = items.filter((item) => item.tone === "stale").map((item) => item.label.toLowerCase());
    return [
      opened.length ? `Открыто: ${opened.join(", ")}` : "",
      unknown.length ? `Нет данных: ${unknown.join(", ")}` : "",
      stale.length ? `Данные устарели: ${stale.join(", ")}` : "",
    ].filter(Boolean).join(" · ") || "Двери, капот и багажник закрыты";
  }

  _patchDiagnostics(pane, vehicle) {
    this._patchFuelCalibration(pane, vehicle);
    const entries = Object.entries(vehicle.entities || {});
    const unavailable = entries.filter(([, id]) => !this._hass?.states?.[id] || UNRELIABLE_STATES.has(String(this._hass.states[id].state).toLowerCase())).length;
    const tiles = this.$$(".diag-tile", pane);
    const latest = this._latestUpdate(vehicle);
    const quality = this._quality(latest);
    const values = [
      this._bootstrap?.source?.primary === "starline_telemetry" ? "StarLine Telemetry" : "Home Assistant · StarLine",
      this._hass?.connected === false ? "Нет связи с HA" : quality === "fresh" ? "Данные HA" : quality === "stale" ? "Устарели" : "Недоступны",
      this._formatReport(latest),
      `${unavailable} / ${entries.length}`,
    ];
    tiles.forEach((tile, index) => this._setText(tile, "strong", values[index]));
    this.$$(".diag-entity", pane).forEach((row) => {
      const state = this._hass?.states?.[row.dataset.entity];
      const unavailableState = !state || UNRELIABLE_STATES.has(String(state.state).toLowerCase());
      row.classList.toggle("unavailable", unavailableState);
      this._setText(row, ".diag-state > span", state?.state ?? "missing");
    });
  }

  _patchFuelCalibration(pane, vehicle) {
    const id = String(vehicle.device_id);
    const model = vehicle.fuel_calibration;
    const pending = model?.pending;
    const fuel = this._fuelMetric(vehicle);
    const start = this.$("[data-fuel-action=start]", pane);
    const form = this.$("[data-fuel-finish]", pane);
    const editable = this._bootstrap?.panel?.fuel_calibration_can_edit === true;
    const busy = this._fuelSaving.has(id) || this._loading;
    start.hidden = !editable || Boolean(pending);
    start.disabled = busy || this._hass?.connected === false || fuel.raw === "Нет данных" || fuel.unit !== "%";
    form.hidden = !editable || !pending;
    const markedFull = Boolean(pending?.full_at);
    form.dataset.phase = markedFull ? "finish" : "mark_full";
    const fields = this.$("fieldset", form);
    fields.hidden = markedFull;
    fields.disabled = markedFull;
    this._setText(form, "button[type=submit]", markedFull ? "Записать полный бак" : "Бак заправлен");
    for (const button of this.$$("button", form)) button.disabled = busy;
    const capacity = form.elements.capacity;
    if (pending && form.dataset.capture !== pending.started_at) {
      form.dataset.capture = pending.started_at;
      form.elements.litres.value = "";
      capacity.value = Number.isFinite(model.capacity_l) ? model.capacity_l : "";
    }

    this._setText(pane, ".fuel-source", this._fuelSourceText(fuel));
    const count = model?.sample_count ?? model?.samples?.length ?? 0;
    const description = model?.status === "ready"
      ? `Коэффициент ×${this._formatNumber(model.factor, 2)} · заправок: ${count}`
      : model?.status === "inconsistent"
        ? "Замеры расходятся. Нужна проверка шкалы по чекам."
        : `Для оценки нужно 3 полных заправки · записано: ${count}`;
    this._setText(pane, ".fuel-model", description);
    const last = model?.samples?.at(-1);
    this._setText(pane, ".fuel-latest", last
      ? `Последняя запись: ${last.before.value}% → ${last.after.value}% · ${last.litres} л · ${this._formatReport(Date.parse(last.after.reported_at))}`
      : "");
    this.$(".fuel-pending", pane).hidden = !pending;
    const pendingLabel = markedFull
      ? `Бак заправлен · ${pending.litres} л · ${this._formatReport(Date.parse(pending.full_at))}. Дождитесь нового показания или нажмите «Обновить» в шапке, затем сохраните замер.`
      : pending
        ? `До заправки: ${pending.before.value}% · ${this._formatReport(Date.parse(pending.before.reported_at))}. После первой отсечки введите данные чека и нажмите «Бак заправлен».`
        : "";
    this._setText(pane, ".fuel-pending", pendingLabel);
    const message = this._fuelMessages.get(id) || (!editable ? "Записи доступны администратору HA." :
      fuel.unit && fuel.unit !== "%" ? "Для калибровки нужны показания в процентах." : "");
    this._setText(pane, ".fuel-message", message);
  }

  async _saveFuel(action, pane, form = null) {
    const id = pane?.dataset.vehicle;
    const vehicle = this._orderedVehicles().find((item) => String(item.device_id) === id);
    if (!vehicle || this._bootstrap?.panel?.fuel_calibration_can_edit !== true ||
        this._loading || this._fuelSaving.has(id)) return;
    const startedAt = vehicle.fuel_calibration?.pending?.started_at;
    const message = { type: "starline_telemetry/panel/fuel_calibration", action, device_id: id };
    if (action !== "start") message.started_at = startedAt;
    if (form) {
      if (!form.reportValidity()) return;
      message.litres = form.elements.litres.valueAsNumber;
      if (form.elements.capacity.value) message.capacity_l = form.elements.capacity.valueAsNumber;
    }

    this._fuelRevision++;
    this._fuelSaving.add(id);
    this._fuelMessages.set(id, "Сохраняю…");
    this._queuePatch();
    let resync = false;
    try {
      vehicle.fuel_calibration = await this._hass.callWS(message);
      this._fuelMessages.set(id, action === "start" ? "Показание до заправки сохранено." :
        action === "mark_full" ? "Полный бак отмечен." :
          action === "finish" ? "Заправка записана." : "Запись отменена.");
    } catch (error) {
      resync = ["refuel_in_progress", "refuel_conflict"].includes(error?.code);
      this._fuelMessages.set(id, FUEL_ERRORS[error?.code] || "Не удалось сохранить запись. Повторите после обновления панели.");
    } finally {
      this._fuelSaving.delete(id);
      this._queuePatch();
      if (resync) this._loadReportTimes();
    }
  }

  _useWorkspaceZoom() {
    const key = this._view === "status" ? "overview" : this._vehicleId || "default";
    this._zoom.useStorageKey(`starline.panel.canvas.v1.${key}`);
  }

  _setView(view, updateLocation = true) {
    if (!VIEWS.includes(view)) view = "status";
    const changed = view !== this._view;
    this._view = view;
    this._ensureView(view);
    if (updateLocation && location.hash !== `#${view}`) {
      history.replaceState(null, "", `${location.pathname}${location.search}#${view}`);
      window.dispatchEvent(new Event("location-changed"));
    }
    if (changed) this._viewport.scrollTop = 0;
    this._useWorkspaceZoom();
    this._patchAll();
    if (["history", "trips"].includes(view)) this._ensureHistory();
    if (view === "trips") this._ensureMap();
  }

  _selectVehicle(id) {
    if (String(id) === String(this._vehicleId)) return;
    this._vehicleId = id;
    this._useWorkspaceZoom();
    this._viewport.scrollTop = 0;
    this._patchAll();
    if (["history", "trips"].includes(this._view)) this._ensureHistory();
    if (this._view === "trips") this._ensureMap();
  }

  async _refresh() {
    if (this._fuelSaving.size) return;
    await this._loadBootstrap(true);
    if (["history", "trips"].includes(this._view)) await this._ensureHistory(true);
  }

  _handleContentClick(event) {
    const fuelAction = event.target.closest("[data-fuel-action]");
    if (fuelAction) return this._saveFuel(fuelAction.dataset.fuelAction, fuelAction.closest(".vehicle-pane"));
    const fuelDetails = event.target.closest("[data-fuel-details]");
    if (fuelDetails) {
      this._selectVehicle(fuelDetails.closest(".vehicle-pane").dataset.vehicle);
      return this._setView("diagnostics");
    }
    const refresh = event.target.closest("[data-refresh-history]");
    if (refresh) return this._ensureHistory(true);
    const entity = event.target.closest("[data-entity]")?.dataset.entity;
    if (entity) this._openMoreInfo(entity);
  }

  _startHold(event) {
    if (event.pointerType === "touch" && event.isPrimary === false) return this._finishHold();
    const target = event.target.closest("[data-entity]");
    if (!target?.dataset.entity) return;
    this._hold = { id: event.pointerId, x: event.clientX, y: event.clientY, entity: target.dataset.entity, timer: setTimeout(() => { this._openMoreInfo(target.dataset.entity); this._hold = null; }, 520) };
  }

  _finishHold(event) {
    if (!this._hold) return;
    if (event?.type === "pointermove" && Math.hypot(event.clientX - this._hold.x, event.clientY - this._hold.y) < 8) return;
    clearTimeout(this._hold.timer);
    this._hold = null;
  }

  _openMoreInfo(entityId) {
    if (!entityId || WRITABLE_DOMAINS.has(domainOf(entityId))) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }

  _historyEntityIds(vehicle) {
    const keys = ["lock", "armed", "alarm", "door", "hood", "trunk", "hbrake", "run", "engine_running", "ignition", "r_start", "service_mode"];
    return [...new Set(keys.map((key) => vehicle?.entities?.[key]).filter(Boolean))];
  }

  _historyPath(ids, hours, withAttributes = false) {
    const end = new Date();
    const start = new Date(end.getTime() - hours * 3600000);
    const params = new URLSearchParams({ filter_entity_id: ids.join(","), end_time: end.toISOString(), significant_changes_only: "1" });
    params.append("skip_initial_state", "");
    if (!withAttributes) params.append("no_attributes", "");
    return `history/period/${encodeURIComponent(start.toISOString())}?${params}`;
  }

  async _ensureHistory(force = false) {
    const vehicle = this._vehicle();
    if (!vehicle || !this._hass) return;
    const id = String(vehicle.device_id);
    if (!force && this._history.has(id)) { this._renderAsync(id); return; }
    if (this._historyLoading.has(id)) return;
    this._historyLoading.add(id);
    this._historyErrors.delete(id);
    this._renderAsync(id);
    try {
      let official = null;
      try {
        official = await this._hass.callWS({ type: "starline_telemetry/panel/history", device_id: id, hours: EVENT_WINDOW_HOURS, force: Boolean(force) });
      } catch (_err) { official = null; }
      const location = this._entity(vehicle, ["location", "vehicle_location"]);
      const locationPayload = location ? await this._hass.callApi("GET", this._historyPath([location.entityId], TRIP_WINDOW_HOURS, true)) : [];
      let events;
      let source;
      if (Array.isArray(official?.events) && official.events.length) {
        events = official.events.map((item) => {
          const numeric = Number(item.timestamp);
          const timestamp = Number.isFinite(numeric) ? (numeric > 1e12 ? numeric : numeric * 1000) : Date.parse(item.timestamp);
          return { timestamp, label: item.description || item.label || "Событие StarLine", category: "official" };
        }).filter((item) => Number.isFinite(item.timestamp)).sort((a, b) => b.timestamp - a.timestamp);
        source = "Журнал StarLine · исходное время события";
      } else {
        const ids = this._historyEntityIds(vehicle);
        const payload = ids.length ? await this._hass.callApi("GET", this._historyPath(ids, EVENT_WINDOW_HOURS, false)) : [];
        events = this._eventsFromRecorder(vehicle, payload);
        source = "Резерв HA Recorder · время обнаружения Home Assistant";
      }
      const points = this._pointsFromHistory(location?.entityId, locationPayload);
      this._history.set(id, { events: events.slice(0, 100), points, trips: this._buildTrips(points), source, loadedAt: Date.now() });
    } catch (err) {
      this._historyErrors.set(id, err?.message || String(err));
    } finally {
      this._historyLoading.delete(id);
      this._renderAsync(id);
      this._queuePatch();
    }
  }

  _flattenHistory(payload) { return Array.isArray(payload) ? payload.flatMap((series) => Array.isArray(series) ? series : []) : []; }

  _historyTimestamp(item) {
    const raw = item?.last_changed ?? item?.last_updated ?? item?.lc ?? item?.lu;
    if (raw === null || raw === undefined || raw === "") return Number.NaN;
    if (typeof raw === "number") return raw < 1e12 ? raw * 1000 : raw;
    if (/^\d+(?:\.\d+)?$/.test(String(raw))) {
      const numeric = Number(raw);
      return numeric < 1e12 ? numeric * 1000 : numeric;
    }
    return Date.parse(raw);
  }

  _eventDefinition(role, state) {
    const raw = String(state).toLowerCase();
    const on = ["on", "true", "open", "unlocked"].includes(raw);
    const locked = raw === "locked" || (role === "armed" && on);
    return ({
      lock: locked ? "Охрана включена" : "Охрана отключена",
      armed: locked ? "Охрана включена" : "Охрана отключена",
      alarm: on ? "Тревога" : "Тревога снята",
      door: on ? "Двери открыты" : "Двери закрыты",
      hood: on ? "Капот открыт" : "Капот закрыт",
      trunk: on ? "Багажник открыт" : "Багажник закрыт",
      hbrake: on ? "Ручник поднят" : "Ручник опущен",
      run: on ? "Зажигание включено" : "Зажигание отключено",
      ignition: on ? "Зажигание включено" : "Зажигание отключено",
      engine_running: on ? "Двигатель запущен" : "Двигатель остановлен",
      r_start: on ? "Автозапуск активирован" : "Автозапуск завершён",
      service_mode: on ? "Сервисный режим включён" : "Сервисный режим выключен",
    })[role] || null;
  }

  _eventsFromRecorder(vehicle, payload) {
    const reverse = new Map(Object.entries(vehicle.entities || {}).map(([role, id]) => [id, role]));
    const result = [];
    const seriesList = Array.isArray(payload) && payload.every(Array.isArray) ? payload : [Array.isArray(payload) ? payload : []];
    for (const rawSeries of seriesList) {
      const series = [...rawSeries].sort((a, b) => this._historyTimestamp(a) - this._historyTimestamp(b));
      const entityId = series.find((item) => item?.entity_id)?.entity_id;
      const role = reverse.get(entityId);
      if (!entityId || !role) continue;
      let previousState = null;
      let hasBaseline = false;
      let crossedUnavailableGap = false;
      for (const item of series) {
        const state = String(item?.state ?? item?.s ?? "").toLowerCase();
        if (UNRELIABLE_STATES.has(state)) {
          if (hasBaseline) crossedUnavailableGap = true;
          continue;
        }
        if (!hasBaseline || crossedUnavailableGap) {
          previousState = state;
          hasBaseline = true;
          crossedUnavailableGap = false;
          continue;
        }
        if (state === previousState) continue;
        previousState = state;
        const label = this._eventDefinition(role, state);
        const timestamp = this._historyTimestamp(item);
        if (label && Number.isFinite(timestamp)) result.push({ role, entityId, timestamp, label, category: "recorder" });
      }
    }
    return result.sort((a, b) => b.timestamp - a.timestamp).slice(0, 100);
  }

  _pointsFromHistory(entityId, payload) {
    const seriesList = Array.isArray(payload) && payload.every(Array.isArray) ? payload : [Array.isArray(payload) ? payload : []];
    const series = seriesList.find((items) => items.some((item) => item?.entity_id === entityId)) || [];
    return series.map((item) => {
      const attrs = item.attributes || item.a || {};
      const lat = Number(attrs.latitude); const lon = Number(attrs.longitude);
      const timestamp = this._historyTimestamp(item);
      return Number.isFinite(lat) && Number.isFinite(lon) && Number.isFinite(timestamp) ? { lat, lon, timestamp } : null;
    }).filter(Boolean).sort((a, b) => a.timestamp - b.timestamp);
  }

  _haversineKm(a, b) {
    const rad = (value) => value * Math.PI / 180;
    const dLat = rad(b.lat - a.lat); const dLon = rad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
  }

  _buildTrips(points) {
    const trips = []; let current = null;
    for (let index = 1; index < points.length; index += 1) {
      const a = points[index - 1]; const b = points[index];
      const km = this._haversineKm(a, b); const gap = (b.timestamp - a.timestamp) / 60000;
      if (km < 0.05 || gap > 45) { if (current?.distanceKm >= 0.2) trips.push(current); current = null; if (km < 0.05) continue; }
      if (!current) current = { points: [a, b], distanceKm: km };
      else { current.points.push(b); current.distanceKm += km; }
    }
    if (current?.distanceKm >= 0.2) trips.push(current);
    return trips.map((trip) => ({ ...trip, start: trip.points[0].timestamp, end: trip.points.at(-1).timestamp })).sort((a, b) => b.start - a.start).slice(0, 20);
  }

  _renderAsync(id) {
    for (const view of ["history", "trips"]) {
      const pane = this.$(`.view[data-view-pane="${view}"] .vehicle-pane[data-vehicle="${CSS.escape(id)}"]`);
      if (!pane) continue;
      const host = this.$(".async-content", pane);
      if (this._historyLoading.has(id) && !this._history.has(id)) {
        host.innerHTML = `<div class="empty-state"><ha-icon class="spin" icon="mdi:loading"></ha-icon><strong>Загружаю данные…</strong></div>`;
      } else if (this._historyErrors.has(id) && !this._history.has(id)) {
        host.innerHTML = `<div class="empty-state"><ha-icon icon="mdi:alert-circle-outline"></ha-icon><strong>Данные недоступны</strong><span></span><button type="button" data-refresh-history="1">Повторить</button></div>`;
        this._setText(host, ".empty-state span", this._historyErrors.get(id));
      } else if (view === "history") this._renderHistory(host, this._history.get(id));
      else this._renderTrips(host, this._history.get(id));
    }
  }

  _formatClock(timestamp, seconds = false) { return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", ...(seconds ? { second: "2-digit" } : {}) }).format(new Date(timestamp)); }
  _formatDay(timestamp) { return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(timestamp)); }

  _renderHistory(host, cache) {
    const events = cache?.events || [];
    if (!events.length) { host.innerHTML = `<div class="empty-state"><ha-icon icon="mdi:timeline-clock-outline"></ha-icon><strong>История пока пуста</strong><span>За последние 24 часа событий не найдено.</span></div>`; return; }
    const groups = new Map();
    for (const event of events) { const day = this._formatDay(event.timestamp); if (!groups.has(day)) groups.set(day, []); groups.get(day).push(event); }
    host.replaceChildren();
    const note = document.createElement("div"); note.className = "source-note"; note.textContent = cache.source; host.append(note);
    for (const [day, items] of groups) {
      const section = document.createElement("section"); section.className = "history-day";
      const chip = document.createElement("div"); chip.className = "day-chip"; chip.textContent = day; section.append(chip);
      for (const event of items) {
        const row = document.createElement("button"); row.type = "button"; row.className = "history-row";
        if (event.entityId) row.dataset.entity = event.entityId;
        const time = document.createElement("time"); time.textContent = this._formatClock(event.timestamp, true);
        const strong = document.createElement("strong"); strong.textContent = event.label;
        row.append(time, strong); section.append(row);
      }
      host.append(section);
    }
  }

  _routeSvg(points) {
    const lats = points.map((point) => point.lat); const lons = points.map((point) => point.lon);
    const minLat = Math.min(...lats); const spanLat = Math.max(.0001, Math.max(...lats) - minLat);
    const minLon = Math.min(...lons); const spanLon = Math.max(.0001, Math.max(...lons) - minLon);
    const mapped = points.map((point) => `${(8 + (point.lon - minLon) / spanLon * 84).toFixed(1)},${(48 - (point.lat - minLat) / spanLat * 40).toFixed(1)}`);
    const start = mapped[0].split(","); const end = mapped.at(-1).split(",");
    return `<svg class="route-svg" viewBox="0 0 100 56" role="img" aria-label="Схема маршрута"><polyline points="${mapped.join(" ")}" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${start[0]}" cy="${start[1]}" r="4" class="route-marker"/><text x="${start[0]}" y="${Number(start[1]) + 1.5}" text-anchor="middle">A</text><circle cx="${end[0]}" cy="${end[1]}" r="4" class="route-marker"/><text x="${end[0]}" y="${Number(end[1]) + 1.5}" text-anchor="middle">B</text></svg>`;
  }

  _renderTrips(host, cache) {
    const trips = cache?.trips || [];
    let map = this.$("[data-map-host]", host);
    let list = this.$(".trip-list", host);
    if (!map) {
      host.replaceChildren();
      map = document.createElement("div"); map.className = "map-host"; map.dataset.mapHost = "1";
      list = document.createElement("div"); list.className = "trip-list";
      host.append(map, list);
    } else {
      list.replaceChildren();
    }
    if (!trips.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = `<ha-icon icon="mdi:map-marker-path"></ha-icon><strong>Поездки не найдены</strong><span>За последние 72 часа недостаточно GPS-точек.</span>`;
      list.append(empty);
      this._ensureMap();
      return;
    }
    for (const trip of trips) {
      const card = document.createElement("article"); card.className = "trip-card";
      card.innerHTML = `<div class="trip-meta"><div><strong>${this._formatNumber(trip.distanceKm, 1)} км</strong><span>${this._formatDay(trip.start)}</span></div><div class="trip-times"><span>A ${this._formatClock(trip.start)}</span><ha-icon icon="mdi:arrow-right"></ha-icon><span>B ${this._formatClock(trip.end)}</span></div></div>${this._routeSvg(trip.points)}<div class="trip-foot"><span>≈ по GPS</span><span>${trip.points.length} точек</span></div>`;
      list.append(card);
    }
    this._ensureMap();
  }

  async _ensureMap() {
    const vehicle = this._vehicle();
    const id = String(vehicle?.device_id || "");
    const pane = this.$(`.view[data-view-pane="trips"] .vehicle-pane[data-vehicle="${CSS.escape(id)}"]`);
    const host = pane ? this.$("[data-map-host]", pane) : null;
    const location = this._entity(vehicle, ["location", "vehicle_location"]);
    if (!host || !location || this._maps.has(id) || typeof window.loadCardHelpers !== "function") return;
    try {
      const helpers = await window.loadCardHelpers();
      if (!host.isConnected) return;
      const card = await helpers.createCardElement({ type: "map", entities: [location.entityId], hours_to_show: TRIP_WINDOW_HOURS, default_zoom: 12 });
      card.hass = this._hass; host.replaceChildren(card); this._maps.set(id, card);
    } catch (_err) {
      host.textContent = "Карта Home Assistant недоступна";
    }
  }
}

if (!customElements.get("starline-app-panel")) customElements.define("starline-app-panel", StarLineAppPanel);
