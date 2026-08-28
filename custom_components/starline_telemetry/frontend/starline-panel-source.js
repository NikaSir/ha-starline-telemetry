const UI_VERSION = "0.6.5";
const ASSET_BASE = "/starline_telemetry_static/assets";
const EVENT_WINDOW_HOURS = 24;
const TRIP_WINDOW_HOURS = 72;
const VIEWS = ["status", "history", "trips", "diagnostics"];
const WRITABLE_DOMAINS = new Set(["lock", "switch", "button"]);
const UNRELIABLE_STATES = new Set(["", "none", "null", "unknown", "unavailable"]);
const SOURCE_ROUTE_KEY = "nikas.specialized.source_route.v1";
const SOURCE_ROUTE_AT_KEY = "nikas.specialized.source_route_at.v1";
const RETURN_ROUTE_KEY = "nikas.starline.return_route.v1";
const SAFE_DEFAULT_ROUTE = "/dashboard-house-v11/home";
const SOURCE_ROUTE_TTL_MS = 30_000;
const CAR_VISIBLE_WIDTH_PERCENT = 72;
const CAR_WHEEL_LINE_BOTTOM_PX = 167;
const CAR_REFERENCE_VISIBLE_SIZE = Object.freeze({
  default: Object.freeze([1824, 793]),
  engine: Object.freeze([1866, 843]),
  "door-open": Object.freeze([1862, 840]),
  "hood-open": Object.freeze([1692, 825]),
  "trunk-open": Object.freeze([1599, 820]),
});
const CAR_LANDMARK_HEIGHT_SCALE = Object.freeze({ "130": 1.04, "683": 1 });
const CAR_ASSET_GEOMETRY = Object.freeze({
  "130": Object.freeze({
    default: [1774, 887, 48, 100, 1702, 785],
    engine: [1774, 887, 50, 101, 1703, 788],
    "door-open": [1759, 894, 48, 94, 1727, 795],
    "hood-open": [1772, 887, 0, 83, 1715, 848],
    "trunk-open": [1765, 891, 27, 52, 1750, 844],
  }),
  "683": Object.freeze({
    default: [1866, 843, 26, 19, 1850, 812],
    engine: [1866, 843, 0, 0, 1866, 843],
    "door-open": [1872, 840, 10, 0, 1872, 840],
    "hood-open": [1871, 841, 116, 0, 1808, 825],
    "trunk-open": [1683, 935, 37, 51, 1636, 871],
  }),
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const domainOf = (entityId) => String(entityId || "").split(".", 1)[0];

function canonicalBaseRoute(pathname) {
  if (pathname === "/dashboard-house-v11" || pathname.startsWith("/dashboard-house-v11/")) {
    return "/dashboard-house-v11/home";
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

function captureReturnRoute(configured) {
  const params = new URLSearchParams(window.location.search);
  const explicit = safeBaseRoute(params.get("return_to")) || safeBaseRoute(params.get("from"));
  let handedOff = null;
  let saved = null;
  try {
    const handedOffRaw = sessionStorage.getItem(SOURCE_ROUTE_KEY);
    const handedOffAtRaw = sessionStorage.getItem(SOURCE_ROUTE_AT_KEY);
    const handedOffAt = Number(handedOffAtRaw);
    const handedOffAge = Date.now() - handedOffAt;
    const fresh = handedOffRaw !== null
      && handedOffAtRaw !== null
      && Number.isFinite(handedOffAt)
      && handedOffAge >= 0
      && handedOffAge <= SOURCE_ROUTE_TTL_MS;
    handedOff = fresh ? safeBaseRoute(handedOffRaw) : null;
    sessionStorage.removeItem(SOURCE_ROUTE_KEY);
    sessionStorage.removeItem(SOURCE_ROUTE_AT_KEY);
    saved = safeBaseRoute(sessionStorage.getItem(RETURN_ROUTE_KEY));
  } catch (_err) {}
  const route = explicit
    || handedOff
    || saved
    || safeBaseRoute(document.referrer)
    || safeBaseRoute(configured)
    || SAFE_DEFAULT_ROUTE;
  try { sessionStorage.setItem(RETURN_ROUTE_KEY, route); } catch (_err) {}
  return route;
}

function navigate(route) {
  const safe = safeBaseRoute(route) || SAFE_DEFAULT_ROUTE;
  history.pushState(null, "", safe);
  window.dispatchEvent(new Event("location-changed"));
}

function openHomeAssistantMenu(target) {
  target.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true }));
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
    this._returnRoute = null;
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
    window.addEventListener("location-changed", this._boundLocation);
    window.addEventListener("popstate", this._boundLocation);
    if (!this._returnRoute) this._returnRoute = captureReturnRoute(this._panel?.config?.parent_route);
    if (this._hass && !this._bootstrap) this._loadBootstrap();
  }

  disconnectedCallback() {
    window.removeEventListener("location-changed", this._boundLocation);
    window.removeEventListener("popstate", this._boundLocation);
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
    this._canvas = this.$(".canvas");
    this._stack = this.$(".view-stack");
    this._zoom = new ZoomController(this._viewport, this._canvas, "starline.panel.canvas.v1.default");
    this.$(".menu").addEventListener("click", (event) => openHomeAssistantMenu(event.currentTarget));
    this.$(".title-button").addEventListener("click", () => navigate(this._returnRoute));
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
    this._stack.addEventListener("pointerdown", (event) => this._startHold(event));
    ["pointerup", "pointercancel", "pointermove"].forEach((type) => this._stack.addEventListener(type, (event) => this._finishHold(event)));
    this._setView(this._view, false);
  }

  _styles() {
    return `
      :host{display:block;width:100%;height:100dvh;overflow:hidden;color:var(--primary-text-color);background:var(--primary-background-color);font-family:var(--ha-card-header-font-family,var(--paper-font-body1_-_font-family,system-ui,sans-serif));--surface:var(--ha-card-background,var(--card-background-color,#fff));--border:color-mix(in srgb,var(--primary-text-color) 11%,transparent);--muted:var(--secondary-text-color,#686868);--accent:#079fc5;--blue:#0875b5;--ok:#43a047;--warn:#ef8b16;--danger:#df3434}
      *{box-sizing:border-box}button{font:inherit;-webkit-tap-highlight-color:transparent}.app{height:100%;min-height:0;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;overflow:hidden;overscroll-behavior:none}
      .app-header{z-index:10;min-height:calc(60px + env(safe-area-inset-top,0px));display:grid;grid-template-columns:52px minmax(0,1fr) 52px;align-items:center;padding:max(8px,env(safe-area-inset-top,0px)) max(10px,env(safe-area-inset-right)) 8px max(10px,env(safe-area-inset-left));background:var(--surface);border-bottom:1px solid var(--border)}
      .header-control{width:44px;height:44px;border:1px solid var(--border);border-radius:16px;background:var(--surface);color:var(--primary-text-color);display:grid;place-items:center;box-shadow:0 3px 12px #00000012}.header-control:last-child{justify-self:end;color:var(--accent)}.header-control ha-icon{--mdc-icon-size:25px}
      .title-button{justify-self:center;min-width:min(290px,100%);max-width:100%;min-height:44px;border:1px solid color-mix(in srgb,var(--primary-color,#03a9d9) 24%,var(--divider-color,#dfe3e8));border-radius:16px;background:color-mix(in srgb,var(--primary-color,#03a9d9) 5%,var(--card-background-color,#fff));color:var(--primary-text-color);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:5px 14px;box-shadow:0 5px 16px rgba(23,45,76,.06);cursor:pointer}.title-button:focus-visible{outline:2px solid var(--primary-color,#03a9d9);outline-offset:2px}.title-button:active{transform:scale(.985);background:color-mix(in srgb,var(--primary-color,#03a9d9) 13%,var(--card-background-color,#fff));border-color:color-mix(in srgb,var(--primary-color,#03a9d9) 42%,var(--divider-color,#dfe3e8));box-shadow:0 2px 7px rgba(23,45,76,.05)}.title-button strong{font-size:23px;line-height:1.05;font-weight:800}.title-button span{margin-top:3px;color:var(--muted);font-size:14px;line-height:1.2;font-weight:560;letter-spacing:.01em}
      .vehicle-selector{z-index:9;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:8px max(10px,env(safe-area-inset-right)) 8px max(10px,env(safe-area-inset-left));background:var(--surface);border-bottom:1px solid var(--border)}
      .vehicle-selector button{min-height:44px;border:1px solid var(--border);border-radius:15px;background:var(--surface);color:var(--primary-text-color);display:flex;align-items:center;gap:10px;padding:0 14px;text-align:left;font-size:14px;font-weight:800}.vehicle-selector button::before{content:"";width:9px;height:9px;border-radius:50%;background:var(--ok)}.vehicle-selector button.offline::before{background:var(--danger)}.vehicle-selector button.active{border-color:color-mix(in srgb,var(--accent) 65%,transparent);background:color-mix(in srgb,var(--accent) 10%,var(--surface));color:var(--accent)}
      .viewport{min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;touch-action:pan-y;background:var(--primary-background-color);scrollbar-width:none}.viewport::-webkit-scrollbar{display:none}.viewport.zoom-enlarged{overflow:hidden;touch-action:none}.canvas{width:100%;height:100%;min-height:100%;transform-origin:0 0;will-change:transform}.view-stack{height:100%;min-height:100%;padding:9px max(10px,env(safe-area-inset-right)) 14px max(10px,env(safe-area-inset-left))}.view{display:none;height:100%}.view.active{display:block}.vehicle-pane{display:none;height:100%}.vehicle-pane.active{display:block}
      .bottom-nav{z-index:10;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));padding:5px max(6px,env(safe-area-inset-right)) max(6px,env(safe-area-inset-bottom)) max(6px,env(safe-area-inset-left));background:var(--surface);border-top:1px solid var(--border)}.bottom-nav button{min-width:0;min-height:58px;border:0;border-radius:15px;background:transparent;color:var(--muted);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}.bottom-nav ha-icon{--mdc-icon-size:28px}.bottom-nav span{font-size:12px;font-weight:750;white-space:nowrap}.bottom-nav button.active{color:var(--accent);background:color-mix(in srgb,var(--accent) 11%,var(--surface))}
      .zoom-feedback{position:fixed;z-index:40;left:50%;bottom:calc(82px + env(safe-area-inset-bottom));transform:translateX(-50%);padding:9px 14px;border-radius:16px;background:#202124e8;color:white;font-size:13px;font-weight:750}
      .summary-card{height:100%;min-height:588px;overflow:hidden;display:grid;grid-template-rows:minmax(440px,1fr) 74px 74px;border:1px solid var(--border);border-radius:22px;background:var(--surface);box-shadow:0 4px 18px #00000010}.summary-hero{position:relative;min-height:0;overflow:hidden;background:#dcecf3}.summary-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:saturate(.96) contrast(.98)}.summary-bg.id-130{object-position:center 53%}.summary-bg.id-683{object-position:center 52%}.summary-overlay{position:absolute;inset:0;background:linear-gradient(90deg,#ffffffd8 0%,#ffffff73 31%,#ffffff0f 57%,transparent 76%)}
      .identity{position:absolute;z-index:5;left:14px;top:13px;max-width:58%}.identity strong{display:block;color:var(--blue);font-size:29px;line-height:1;font-weight:850}.identity span{display:block;margin-top:6px;font-size:16px;line-height:1.08;font-weight:800}.identity small{display:flex;align-items:center;gap:6px;margin-top:7px;color:var(--muted);font-size:12px;line-height:1.1;font-weight:700}.status-dot{width:9px;height:9px;border-radius:50%;background:var(--ok);flex:0 0 auto}.status-dot.offline{background:var(--danger)}
      .security-chip{position:absolute;z-index:7;right:10px;top:10px;min-width:120px;min-height:54px;display:grid;grid-template-columns:27px minmax(0,1fr);align-items:center;gap:7px;padding:8px 10px;border:1px solid #ffffffed;border-radius:17px;background:#ffffffde;backdrop-filter:blur(8px);box-shadow:0 3px 13px #0000001c}.security-chip ha-icon{color:var(--muted);--mdc-icon-size:24px}.security-chip span,.metric span,.connection span,.state span,.event span{display:block;color:var(--muted);font-size:12px;line-height:1.05}.security-chip strong{display:block;margin-top:3px;font-size:16px;line-height:1.05}.security-chip.armed{background:#e9f7ffeb}.security-chip.armed ha-icon,.security-chip.armed strong{color:var(--blue)}.security-chip.alarm{background:#fff0f0ed}.security-chip.alarm ha-icon,.security-chip.alarm strong{color:var(--danger)}
      .security-field{position:absolute;z-index:2;left:50%;bottom:160px;width:84%;height:230px;transform:translateX(-50%);border:3px solid color-mix(in srgb,var(--accent) 58%,transparent);border-bottom-color:transparent;border-radius:50% 50% 0 0/100% 100% 0 0;background:radial-gradient(ellipse at 50% 100%,color-mix(in srgb,var(--accent) 11%,transparent) 0 56%,transparent 72%);-webkit-mask-image:linear-gradient(to bottom,#000 0 80%,transparent 100%);mask-image:linear-gradient(to bottom,#000 0 80%,transparent 100%);opacity:0;pointer-events:none}.security-field.armed,.security-field.alarm{opacity:1}.security-field.alarm{border-color:color-mix(in srgb,var(--danger) 68%,transparent);border-bottom-color:transparent;background:radial-gradient(ellipse at 50% 100%,color-mix(in srgb,var(--danger) 15%,transparent),transparent 72%)}
      .summary-car-frame{position:absolute;z-index:3;left:50%;bottom:${CAR_WHEEL_LINE_BOTTOM_PX}px;width:${CAR_VISIBLE_WIDTH_PERCENT}%;aspect-ratio:var(--car-visible-aspect);transform:translateX(-50%);visibility:hidden;pointer-events:none}.summary-car-frame.geometry-ready{visibility:visible}.summary-car{position:absolute;left:var(--car-image-left);top:var(--car-image-top);width:var(--car-image-width);height:var(--car-image-height);filter:drop-shadow(0 14px 11px #0000003b);pointer-events:none}.summary-card.offline .summary-bg,.summary-card.offline .summary-car{filter:grayscale(.55) saturate(.58)}
      .connection{position:absolute;z-index:7;left:10px;bottom:86px;min-height:56px;max-width:47%;display:grid;grid-template-columns:27px minmax(0,1fr);align-items:center;gap:7px;padding:7px 10px;border:1px solid #ffffffef;border-radius:16px;background:#ffffffea;backdrop-filter:blur(8px);box-shadow:0 2px 10px #00000018;text-align:left}.connection ha-icon,.metric ha-icon{color:var(--blue);--mdc-icon-size:24px}.connection strong{display:block;margin-top:4px;font-size:15px;line-height:1.05;white-space:nowrap}
      .metrics{position:absolute;z-index:7;left:10px;right:10px;bottom:9px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.metric{min-width:0;min-height:67px;display:grid;grid-template-columns:22px minmax(0,1fr);align-items:center;gap:4px;padding:7px 5px;border:1px solid #ffffffef;border-radius:15px;background:#fffffff0;backdrop-filter:blur(8px);color:var(--primary-text-color);text-align:left}.metric ha-icon{--mdc-icon-size:22px}.metric strong{display:block;margin-top:4px;font-size:16px;line-height:1.05;font-weight:820;letter-spacing:-.15px;white-space:nowrap;overflow:visible;text-overflow:clip}
      .state-row{height:74px;display:grid;align-items:center;background:var(--surface)}.state-row+.state-row{border-top:1px solid var(--border)}.perimeter-row{grid-template-columns:repeat(3,minmax(0,1fr))}.operational-row{grid-template-columns:minmax(0,40fr) minmax(0,38fr) minmax(0,22fr)}.state,.event{min-width:0;height:74px;border:0;border-right:1px solid var(--border);background:transparent;color:var(--primary-text-color);display:grid;grid-template-columns:24px minmax(0,1fr);align-items:center;gap:5px;padding:6px 8px;text-align:left}.operational-row .state,.operational-row .event{gap:3px;padding-inline:5px}.operational-row .state>div,.operational-row .event>div{min-width:0;overflow:visible}.operational-row .state span,.operational-row .event span{white-space:nowrap;overflow:visible;text-overflow:clip}.state:last-child,.event:last-child{border-right:0}.state ha-icon,.event ha-icon{color:var(--muted);--mdc-icon-size:23px}.state strong,.event strong{display:-webkit-box;margin-top:4px;font-size:16px;line-height:1.05;font-weight:800;white-space:normal;overflow:hidden;text-overflow:clip;-webkit-box-orient:vertical;-webkit-line-clamp:2}.operational-row .engine strong,.operational-row .brake strong{display:block;white-space:nowrap;overflow:visible;-webkit-line-clamp:unset}.state.ok ha-icon,.state.ok strong{color:var(--ok)}.state.warn ha-icon,.state.warn strong{color:var(--warn)}.state.active ha-icon,.state.active strong,.event ha-icon{color:var(--accent)}.state.danger ha-icon,.state.danger strong{color:var(--danger)}
      .view-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:4px 2px 12px}.view-head strong{display:block;font-size:21px;line-height:1.05}.view-head span{display:block;margin-top:5px;color:var(--muted);font-size:13px}.view-head button{width:44px;height:44px;border:1px solid var(--border);border-radius:15px;background:var(--surface);color:var(--accent);display:grid;place-items:center}.history-day{margin-bottom:14px}.day-chip{display:inline-flex;margin:0 0 7px 5px;padding:5px 9px;border-radius:10px;background:color-mix(in srgb,var(--accent) 11%,var(--surface));font-size:16px;font-weight:800}.history-row{width:100%;min-height:62px;border:0;border-bottom:1px solid var(--border);background:var(--surface);color:var(--primary-text-color);display:grid;grid-template-columns:76px minmax(0,1fr);align-items:center;padding:8px 13px;text-align:left}.history-row:first-of-type{border-radius:16px 16px 0 0}.history-row:last-child{border-bottom:0;border-radius:0 0 16px 16px}.history-row time{color:var(--muted);font-size:16px}.history-row strong{font-size:18px;line-height:1.15}.source-note{margin:0 0 10px;padding:9px 12px;border-radius:13px;background:color-mix(in srgb,var(--accent) 7%,var(--surface));color:var(--muted);font-size:12px}
      .trip-list{display:grid;gap:10px}.trip-card{overflow:hidden;border:1px solid var(--border);border-radius:18px;background:var(--surface)}.trip-meta{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px}.trip-meta strong{font-size:19px}.trip-meta span{display:block;margin-top:4px;color:var(--muted);font-size:12px}.trip-times{display:flex;align-items:center;gap:5px}.trip-times ha-icon{--mdc-icon-size:18px;color:var(--accent)}.route-svg{display:block;width:100%;height:128px;color:var(--accent);background:color-mix(in srgb,var(--accent) 4%,var(--surface))}.route-svg text{fill:white;font-size:5px;font-weight:800}.route-marker{fill:var(--accent)}.trip-foot{display:flex;justify-content:space-between;padding:8px 12px;color:var(--muted);font-size:12px}.map-host{min-height:230px;margin-bottom:12px;overflow:hidden;border:1px solid var(--border);border-radius:18px;background:var(--surface)}.map-host>*{display:block;width:100%;height:100%}
      .diagnostic-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.diag-tile{min-height:74px;padding:11px;border:1px solid var(--border);border-radius:16px;background:var(--surface)}.diag-tile span{display:block;color:var(--muted);font-size:12px}.diag-tile strong{display:block;margin-top:7px;font-size:15px;overflow-wrap:anywhere}.diag-tile.ok strong{color:var(--ok)}.diag-tile.warn strong{color:var(--warn)}.diag-tile.danger strong{color:var(--danger)}.read-only-banner{display:grid;grid-template-columns:30px minmax(0,1fr);gap:9px;margin-top:10px;padding:12px;border-radius:16px;background:color-mix(in srgb,var(--accent) 9%,var(--surface))}.read-only-banner ha-icon{color:var(--accent)}.read-only-banner strong{font-size:15px}.read-only-banner span{display:block;margin-top:4px;color:var(--muted);font-size:12px;line-height:1.3}.diag-list{margin-top:10px;overflow:hidden;border:1px solid var(--border);border-radius:16px}.diag-entity{min-height:58px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 11px;border-bottom:1px solid var(--border);background:var(--surface)}.diag-entity:last-child{border-bottom:0}.diag-entity strong{font-size:13px}.diag-entity span{display:block;margin-top:3px;color:var(--muted);font-size:12px;overflow-wrap:anywhere}.diag-state{text-align:right}.diag-state button{width:34px;height:34px;border:0;background:transparent;color:var(--accent)}
      .empty-state{min-height:260px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:24px;text-align:center;color:var(--muted)}.empty-state ha-icon{--mdc-icon-size:44px;color:var(--accent)}.empty-state strong{color:var(--primary-text-color);font-size:18px}.empty-state span{max-width:420px;font-size:13px;line-height:1.35}.empty-state button{min-height:44px;padding:0 16px;border:0;border-radius:14px;background:var(--accent);color:white;font-weight:800}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
      @media(max-width:390px){.title-button{min-width:0;width:100%;padding-inline:8px}.title-button strong{font-size:21px}.title-button span{font-size:13px}.summary-card{grid-template-rows:minmax(420px,1fr) 74px 74px;min-height:568px}.identity strong{font-size:27px}.identity span{font-size:15px}.summary-car-frame{bottom:161px}.security-field{bottom:154px;width:86%;height:220px}.metric{grid-template-columns:20px minmax(0,1fr);gap:3px;padding:6px 4px}.metric ha-icon{--mdc-icon-size:20px}.metric strong{font-size:14px}.state,.event{padding:6px 6px;grid-template-columns:22px minmax(0,1fr);gap:4px}.state ha-icon,.event ha-icon{--mdc-icon-size:22px}.state strong,.event strong{font-size:14px}.connection{max-width:52%}}
      @media(min-width:700px){.view-stack{max-width:900px;margin:auto}.summary-hero{height:650px}.vehicle-selector{max-width:900px;width:100%;margin:auto;border:0}.bottom-nav{padding-left:calc((100% - 700px)/2);padding-right:calc((100% - 700px)/2)}}
    `;
  }

  _viewFromLocation() {
    const hash = String(location.hash || "#status").slice(1).toLowerCase();
    return VIEWS.includes(hash) ? hash : "status";
  }

  _readLocation() { this._setView(this._viewFromLocation(), false); }

  _orderedVehicles() {
    const priority = (vehicle) => String(vehicle?.name || "").includes("130") ? 0 : String(vehicle?.name || "").includes("683") ? 1 : 10;
    return [...(this._bootstrap?.vehicles || [])].sort((a, b) => priority(a) - priority(b) || String(a.name).localeCompare(String(b.name), "ru"));
  }

  _vehicle(id = this._vehicleId) { return this._orderedVehicles().find((item) => String(item.device_id) === String(id)) || this._orderedVehicles()[0] || null; }
  _entity(vehicle, keys) {
    if (!vehicle || !this._hass) return null;
    for (const key of keys) {
      const entityId = vehicle.entities?.[key];
      const state = entityId ? this._hass.states?.[entityId] : null;
      if (entityId && state) return { key, entityId, state };
    }
    return null;
  }

  _isOn(entity) {
    if (!entity?.state) return null;
    const raw = String(entity.state.state).toLowerCase();
    if (UNRELIABLE_STATES.has(raw)) return null;
    return ["on", "true", "open", "unlocked", "running"].includes(raw);
  }

  _isLocked(entity) {
    if (!entity?.state) return null;
    const raw = String(entity.state.state).toLowerCase();
    if (UNRELIABLE_STATES.has(raw)) return null;
    if (["locked", "armed"].includes(raw)) return true;
    if (["unlocked", "disarmed"].includes(raw)) return false;
    return this._isOn(entity);
  }

  _online(vehicle) {
    const states = Object.values(vehicle?.entities || {}).map((id) => this._hass?.states?.[id]).filter(Boolean);
    return states.some((state) => !UNRELIABLE_STATES.has(String(state.state).toLowerCase()));
  }

  _latestUpdate(vehicle) {
    const values = Object.values(vehicle?.entities || {}).map((id) => Date.parse(this._hass?.states?.[id]?.last_updated || "")).filter(Number.isFinite);
    return values.length ? Math.max(...values) : null;
  }

  _relativeTime(timestamp) {
    if (!timestamp) return "Нет данных";
    const minutes = Math.max(0, Math.floor((Date.now() - Number(timestamp)) / 60000));
    if (minutes < 1) return "только что";
    if (minutes < 60) return `${minutes} мин назад`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ч назад`;
    return `${Math.floor(hours / 24)} дн назад`;
  }

  _formatNumber(value, digits = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? new Intl.NumberFormat("ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(numeric) : String(value ?? "—");
  }

  _formatState(entity, digits = 0) {
    if (!entity?.state || UNRELIABLE_STATES.has(String(entity.state.state).toLowerCase())) return "Нет данных";
    const raw = entity.state.state;
    const unit = entity.state.attributes?.unit_of_measurement || "";
    return `${this._formatNumber(raw, digits)}${unit ? ` ${unit}` : ""}`;
  }

  _security(vehicle) {
    const alarm = this._isOn(this._entity(vehicle, ["alarm"]));
    const live = vehicle?.live_security?.arm;
    const candidates = [live, ...["lock", "armed", "security", "arm", "guard"].map((key) => this._isLocked(this._entity(vehicle, [key])))];
    const known = candidates.filter((value) => typeof value === "boolean");
    const armed = known.includes(true) ? true : known.includes(false) ? false : null;
    if (alarm === true) return { key: "alarm", label: "Тревога", icon: "mdi:alarm-light" };
    if (armed === true) return { key: "armed", label: "Включена", icon: "mdi:shield-lock" };
    if (armed === false) return { key: "disarmed", label: "Снята", icon: "mdi:shield-off-outline" };
    return { key: "unknown", label: "Нет данных", icon: "mdi:shield-outline" };
  }

  _scene(vehicle) {
    const id = String(vehicle?.name || "").includes("683") ? "683" : "130";
    const states = {
      hood: this._isOn(this._entity(vehicle, ["hood"])),
      trunk: this._isOn(this._entity(vehicle, ["trunk"])),
      door: this._isOn(this._entity(vehicle, ["door"])),
      engine: this._isOn(this._entity(vehicle, ["engine_running", "run", "ignition", "ign"])),
    };
    const state = states.hood ? "hood-open" : states.trunk ? "trunk-open" : states.door ? "door-open" : states.engine ? "engine" : "default";
    const suffix = state === "default" ? "v2" : `${state}-v1`;
    return { id, state, geometry: CAR_ASSET_GEOMETRY[id][state], referenceSize: CAR_REFERENCE_VISIBLE_SIZE[state], landmarkHeightScale: CAR_LANDMARK_HEIGHT_SCALE[id], src: `${ASSET_BASE}/starline-car-${id}-${suffix}.webp?v=${UI_VERSION}` };
  }

  _applyCarGeometry(frame, geometry, referenceSize, landmarkHeightScale = 1) {
    if (!frame || !geometry) return;
    const [canvasWidth, canvasHeight, alphaLeft, alphaTop, alphaRight, alphaBottom] = geometry;
    const visibleWidth = alphaRight - alphaLeft;
    const visibleHeight = alphaBottom - alphaTop;
    const [referenceWidth, referenceHeight] = referenceSize || [visibleWidth, visibleHeight];
    const correctedReferenceHeight = referenceHeight * landmarkHeightScale;
    const key = `${geometry.join(":")}:${referenceWidth}:${correctedReferenceHeight}`;
    if (frame.dataset.geometry === key) return;
    frame.style.setProperty("--car-visible-aspect", `${referenceWidth} / ${correctedReferenceHeight}`);
    frame.style.setProperty("--car-image-width", `${canvasWidth / visibleWidth * 100}%`);
    frame.style.setProperty("--car-image-height", `${canvasHeight / visibleHeight * 100}%`);
    frame.style.setProperty("--car-image-left", `${-alphaLeft / visibleWidth * 100}%`);
    frame.style.setProperty("--car-image-top", `${-alphaTop / visibleHeight * 100}%`);
    frame.dataset.geometry = key;
    frame.classList.add("geometry-ready");
  }

  _metricSpec(vehicle, keys, label, icon, digits = 0) {
    const entity = this._entity(vehicle, keys);
    return { label, icon, entityId: entity?.entityId || "", value: entity ? this._formatState(entity, digits) : "—" };
  }

  _stateSpec(vehicle, keys, label, icon, onText, offText, activeTone = "warn") {
    const entity = this._entity(vehicle, keys);
    const value = this._isOn(entity);
    return { label, icon, entityId: entity?.entityId || "", value: value === null ? "Нет данных" : value ? onText : offText, tone: value === null ? "muted" : value ? activeTone : "ok" };
  }

  _setText(root, selector, value) { const node = this.$(selector, root); if (node && node.textContent !== String(value)) node.textContent = String(value); }
  _setIcon(root, selector, value) { const node = this.$(selector, root); if (node && node.getAttribute("icon") !== value) node.setAttribute("icon", value); }
  _setClass(node, name, enabled) { if (node) node.classList.toggle(name, Boolean(enabled)); }

  async _loadBootstrap(force = false) {
    if (!this._hass || this._loading) return;
    this._loading = true;
    this.$(".refresh ha-icon")?.classList.add("spin");
    try {
      const entryId = this._panel?.config?.entry_id;
      this._bootstrap = await this._hass.callWS({ type: "starline_telemetry/panel/bootstrap", force: Boolean(force), ...(entryId ? { entry_id: entryId } : {}) });
    } catch (_err) {
      this._bootstrap = this._panel?.config?.bootstrap_fallback || { vehicles: [] };
    } finally {
      this._loading = false;
      this.$(".refresh ha-icon")?.classList.remove("spin");
    }
    const vehicles = this._orderedVehicles();
    if (!vehicles.some((item) => String(item.device_id) === String(this._vehicleId))) this._vehicleId = vehicles[0]?.device_id || null;
    this._zoom.useStorageKey(`starline.panel.canvas.v1.${this._vehicleId || "default"}`);
    this._mountVehicleSelector();
    this._ensureView(this._view);
    this._queuePatch();
    this._ensureHistory();
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
      selector.append(button);
    }
  }

  _ensureView(view) {
    if (this._viewPanes.has(view)) return this._viewPanes.get(view);
    const section = document.createElement("section");
    section.className = "view";
    section.dataset.viewPane = view;
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
    section.append(pane);
    return pane;
  }

  _mountSummary(pane, vehicle) {
    const scene = this._scene(vehicle);
    const bg = `${ASSET_BASE}/starline-bg-${scene.id}-v2.webp?v=${UI_VERSION}`;
    pane.innerHTML = `<article class="summary-card">
      <div class="summary-hero">
        <img class="summary-bg id-${scene.id}" src="${bg}" alt="" aria-hidden="true">
        <div class="summary-overlay"></div>
        <div class="identity"><strong></strong><span>Nissan MURANO Z52</span><small><i class="status-dot"></i><b></b></small></div>
        <div class="security-chip"><ha-icon></ha-icon><div><span>Охрана</span><strong></strong></div></div>
        <div class="security-field"></div>
        <div class="summary-car-frame"><img class="summary-car" src="${scene.src}" alt="Nissan Murano Z52"></div>
        <button class="connection" type="button"><ha-icon icon="mdi:access-point-network"></ha-icon><div><span>Связь</span><strong></strong></div></button>
        <div class="metrics">${[0,1,2,3].map(() => `<button class="metric" type="button"><ha-icon></ha-icon><div><span></span><strong></strong></div></button>`).join("")}</div>
      </div>
      <div class="state-row perimeter-row">${[0,1,2].map(() => `<button class="state" type="button"><ha-icon></ha-icon><div><span></span><strong></strong></div></button>`).join("")}</div>
      <div class="state-row operational-row"><button class="state engine" type="button"><ha-icon></ha-icon><div><span>Двигатель</span><strong></strong></div></button><button class="event" type="button" data-view-target="history"><ha-icon icon="mdi:car-info"></ha-icon><div><span></span><strong></strong></div></button><button class="state brake" type="button"><ha-icon icon="mdi:car-brake-hold"></ha-icon><div><span>Ручник</span><strong></strong></div></button></div>
    </article>`;
    this._applyCarGeometry(this.$(".summary-car-frame", pane), scene.geometry, scene.referenceSize, scene.landmarkHeightScale);
  }

  _mountAsyncView(pane, view) {
    const title = view === "history" ? "История" : "Поездки";
    const subtitle = view === "history" ? "События StarLine · 24 часа" : "Маршруты по GPS · 72 часа";
    pane.innerHTML = `<div class="view-head"><div><strong>${title}</strong><span>${subtitle}</span></div><button type="button" data-refresh-history="1" aria-label="Обновить"><ha-icon icon="mdi:refresh"></ha-icon></button></div><div class="async-content"><div class="empty-state"><ha-icon icon="mdi:cloud-download-outline"></ha-icon><strong>Данные ещё не загружены</strong></div></div>`;
  }

  _mountDiagnostics(pane, vehicle) {
    pane.innerHTML = `<div class="view-head"><div><strong>Диагностика</strong><span>Read-only состояние интеграции</span></div></div><div class="diagnostic-summary">${["Источник","Связь","Свежесть","Недоступно"].map((label) => `<div class="diag-tile"><span>${label}</span><strong></strong></div>`).join("")}</div><div class="read-only-banner"><ha-icon icon="mdi:shield-lock-outline"></ha-icon><div><strong>Read-only</strong><span>Панель не вызывает управляющие сервисы StarLine.</span></div></div><div class="diag-list"></div>`;
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
    for (const vehicle of this._orderedVehicles()) {
      for (const [view, section] of this._viewPanes) {
        const pane = this._ensureVehiclePane(view, vehicle);
        if (view === "status") this._patchSummary(pane, vehicle);
        if (view === "diagnostics") this._patchDiagnostics(pane, vehicle);
        pane.classList.toggle("active", String(vehicle.device_id) === String(this._vehicleId));
      }
    }
    for (const button of this.$$(".vehicle-selector button")) {
      const vehicle = this._vehicle(button.dataset.vehicle);
      button.classList.toggle("active", String(button.dataset.vehicle) === String(this._vehicleId));
      button.classList.toggle("offline", vehicle ? !this._online(vehicle) : true);
      button.setAttribute("aria-selected", button.classList.contains("active") ? "true" : "false");
    }
    for (const section of this._viewPanes.values()) section.classList.toggle("active", section.dataset.viewPane === this._view);
    for (const button of this.$$(".bottom-nav button")) button.classList.toggle("active", button.dataset.view === this._view);
  }

  _patchSummary(pane, vehicle) {
    const card = this.$(".summary-card", pane);
    const online = this._online(vehicle);
    card.classList.toggle("offline", !online);
    this._setText(pane, ".identity strong", vehicle.name || `StarLine ${vehicle.device_id}`);
    this._setText(pane, ".identity b", `${online ? "В сети" : "Недоступен"} · ${this._relativeTime(this._latestUpdate(vehicle))}`);
    this._setClass(this.$(".status-dot", pane), "offline", !online);

    const security = this._security(vehicle);
    const securityChip = this.$(".security-chip", pane);
    ["armed", "alarm", "disarmed", "unknown"].forEach((name) => securityChip.classList.toggle(name, security.key === name));
    this._setIcon(securityChip, "ha-icon", security.icon);
    this._setText(securityChip, "strong", security.label);
    const field = this.$(".security-field", pane);
    field.classList.toggle("armed", security.key === "armed");
    field.classList.toggle("alarm", security.key === "alarm");

    const scene = this._scene(vehicle);
    const car = this.$(".summary-car", pane);
    this._applyCarGeometry(this.$(".summary-car-frame", pane), scene.geometry, scene.referenceSize, scene.landmarkHeightScale);
    if (car.getAttribute("src") !== scene.src) car.setAttribute("src", scene.src);

    const gsm = this._entity(vehicle, ["gsm_lvl", "gsm_level"]);
    const gps = this._entity(vehicle, ["gps_count", "gps_satellites"]);
    const connection = this.$(".connection", pane);
    connection.dataset.entity = gsm?.entityId || gps?.entityId || "";
    const gsmText = gsm ? this._formatState(gsm, 0).replace(/\s+/g, " ") : "—";
    const gpsText = gps ? this._formatState(gps, 0).replace(/\s*(satellites|спутников|спутника|спутник)\s*/gi, "").trim() : "—";
    this._setText(connection, "strong", `GSM ${gsmText} · GPS ${gpsText}`);

    const metrics = [
      this._metricSpec(vehicle, ["battery"], "АКБ", "mdi:car-battery", 1),
      this._metricSpec(vehicle, ["fuel", "fuel_percent", "fuel_litres"], "Топливо", "mdi:gas-station-outline", 0),
      this._metricSpec(vehicle, ["etemp", "engine_temperature"], "Двигатель", "mdi:thermometer", 0),
      this._metricSpec(vehicle, ["ctemp", "cabin_temperature"], "Салон", "mdi:car-seat-heater", 0),
    ];
    this.$$(".metric", pane).forEach((node, index) => this._patchMetric(node, metrics[index]));
    const perimeter = [
      this._stateSpec(vehicle, ["hood"], "Капот", "mdi:car-lifted-pickup", "Открыт", "Закрыт"),
      this._stateSpec(vehicle, ["door"], "Двери", "mdi:car-door", "Открыты", "Закрыты"),
      this._stateSpec(vehicle, ["trunk"], "Багажник", "mdi:car-back", "Открыт", "Закрыт"),
    ];
    this.$$(".perimeter-row .state", pane).forEach((node, index) => this._patchState(node, perimeter[index]));
    const engine = this._stateSpec(vehicle, ["engine_running", "run", "ignition", "ign"], "Двигатель", "mdi:engine", "Работает", "Остановлен", "active");
    engine.icon = engine.tone === "active" ? "mdi:engine" : "mdi:engine-off-outline";
    this._patchState(this.$(".engine", pane), engine);
    const brake = this._stateSpec(vehicle, ["hbrake"], "Ручник", "mdi:car-brake-hold", "Поднят", "Снят", "active");
    this._patchState(this.$(".brake", pane), brake);
    const event = this._history.get(String(vehicle.device_id))?.events?.[0];
    this._setText(pane, ".event span", event ? `Событие · ${this._formatClock(event.timestamp)}` : "Последнее событие");
    this._setText(pane, ".event strong", event?.label || this._perimeterLabel(perimeter));
  }

  _patchMetric(node, spec) {
    node.dataset.entity = spec.entityId;
    this._setIcon(node, "ha-icon", spec.icon);
    this._setText(node, "span", spec.label);
    this._setText(node, "strong", spec.value);
  }

  _patchState(node, spec) {
    node.dataset.entity = spec.entityId;
    ["ok", "warn", "active", "danger", "muted"].forEach((tone) => node.classList.toggle(tone, tone === spec.tone));
    this._setIcon(node, "ha-icon", spec.icon);
    this._setText(node, "span", spec.label);
    this._setText(node, "strong", spec.value);
  }

  _perimeterLabel(items) {
    const opened = items.filter((item) => item.tone === "warn").map((item) => item.label.toLowerCase());
    return opened.length ? `Открыто: ${opened.join(", ")}` : "Периметр закрыт";
  }

  _patchDiagnostics(pane, vehicle) {
    const entries = Object.entries(vehicle.entities || {});
    const unavailable = entries.filter(([, id]) => !this._hass?.states?.[id] || UNRELIABLE_STATES.has(String(this._hass.states[id].state).toLowerCase())).length;
    const tiles = this.$$(".diag-tile", pane);
    const values = [this._bootstrap?.source?.primary === "starline_telemetry" ? "StarLine Telemetry" : "Home Assistant · StarLine", this._online(vehicle) ? "В сети" : "Недоступен", this._relativeTime(this._latestUpdate(vehicle)), `${unavailable} / ${entries.length}`];
    tiles.forEach((tile, index) => this._setText(tile, "strong", values[index]));
    this.$$(".diag-entity", pane).forEach((row) => {
      const state = this._hass?.states?.[row.dataset.entity];
      const unavailableState = !state || UNRELIABLE_STATES.has(String(state.state).toLowerCase());
      row.classList.toggle("unavailable", unavailableState);
      this._setText(row, ".diag-state > span", state?.state ?? "missing");
    });
  }

  _setView(view, updateLocation = true) {
    if (!VIEWS.includes(view)) view = "status";
    this._view = view;
    this._ensureView(view);
    if (updateLocation && location.hash !== `#${view}`) {
      history.replaceState(null, "", `${location.pathname}${location.search}#${view}`);
      window.dispatchEvent(new Event("location-changed"));
    }
    this._viewport.scrollTop = 0;
    this._patchAll();
    if (["history", "trips"].includes(view)) this._ensureHistory();
    if (view === "trips") this._ensureMap();
  }

  _selectVehicle(id) {
    if (String(id) === String(this._vehicleId)) return;
    this._vehicleId = id;
    this._zoom.useStorageKey(`starline.panel.canvas.v1.${id}`);
    this._viewport.scrollTop = 0;
    this._patchAll();
    this._ensureHistory();
    if (this._view === "trips") this._ensureMap();
  }

  async _refresh() {
    await this._loadBootstrap(true);
    if (["history", "trips"].includes(this._view)) await this._ensureHistory(true);
  }

  _handleContentClick(event) {
    const viewTarget = event.target.closest("[data-view-target]");
    if (viewTarget) return this._setView(viewTarget.dataset.viewTarget);
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
