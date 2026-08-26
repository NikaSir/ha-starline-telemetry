import "./starline-app-v013.js?v=0.4.2-core-bridge";

const BASE_COMPONENT = customElements.get("starline-app-panel-v013");
const UI_VERSION = "0.4.3";
const MIN_SCALE = 0.75;
const MAX_SCALE = 2;
const SNAP_MIN = 0.97;
const SNAP_MAX = 1.03;
const PAN_THRESHOLD = 7;
const TAP_DURATION = 280;
const DOUBLE_TAP_GAP = 360;
const CLICK_GUARD_MS = 420;
const STORAGE_PREFIX = "starline-panel-transform-v2";
const LEGACY_SCALE_KEY = "starline-panel-scale-v1";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

class StarLineAppPanelV014 extends BASE_COMPONENT {
  constructor() {
    super();
    this._canvasState = { scale: 1, x: 0, y: 0 };
    this._canvasStateKeyLoaded = null;
    this._canvasPointers = new Map();
    this._canvasGesture = null;
    this._lastTwoFingerTap = 0;
    this._suppressClicksUntil = 0;
    this._canvasResizeObserver = null;
    this._zoomToastTimer = null;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._canvasResizeObserver?.disconnect();
    this._canvasResizeObserver = null;
    if (this._zoomToastTimer) window.clearTimeout(this._zoomToastTimer);
  }

  _canvasStorageKey() {
    return `${STORAGE_PREFIX}:starline:${this._vehicleId || "all"}`;
  }

  _loadCanvasState() {
    const key = this._canvasStorageKey();
    if (this._canvasStateKeyLoaded === key) return;
    let state = null;
    try {
      state = JSON.parse(localStorage.getItem(key) || "null");
    } catch (_err) {}

    if (!state) {
      try {
        const legacyScale = Number(localStorage.getItem(LEGACY_SCALE_KEY));
        if (Number.isFinite(legacyScale)) state = { scale: legacyScale, x: 0, y: 0 };
      } catch (_err) {}
    }

    this._canvasState = {
      scale: clamp(finite(state?.scale, 1), MIN_SCALE, MAX_SCALE),
      x: finite(state?.x),
      y: finite(state?.y),
    };
    this._canvasStateKeyLoaded = key;
  }

  _saveCanvasState() {
    try {
      localStorage.setItem(this._canvasStorageKey(), JSON.stringify(this._canvasState));
    } catch (_err) {}
  }

  _canvasBounds(content, canvas, scale) {
    const viewportWidth = content.clientWidth;
    const viewportHeight = content.clientHeight;
    const scaledWidth = canvas.offsetWidth * scale;
    const scaledHeight = canvas.offsetHeight * scale;
    const baseLeft = canvas.offsetLeft;
    const baseTop = canvas.offsetTop;
    const x = scaledWidth <= viewportWidth
      ? [-baseLeft, viewportWidth - scaledWidth - baseLeft]
      : [viewportWidth - scaledWidth - baseLeft, -baseLeft];
    const y = scaledHeight <= viewportHeight
      ? [-baseTop, viewportHeight - scaledHeight - baseTop]
      : [viewportHeight - scaledHeight - baseTop, -baseTop];
    return { minX: x[0], maxX: x[1], minY: y[0], maxY: y[1] };
  }

  _clampCanvasState(content, canvas, state = this._canvasState) {
    const scale = clamp(finite(state.scale, 1), MIN_SCALE, MAX_SCALE);
    const bounds = this._canvasBounds(content, canvas, scale);
    return {
      scale,
      x: clamp(finite(state.x), bounds.minX, bounds.maxX),
      y: clamp(finite(state.y), bounds.minY, bounds.maxY),
    };
  }

  _applyCanvasState(content, canvas, state = this._canvasState, persist = true) {
    this._canvasState = this._clampCanvasState(content, canvas, state);
    const { scale, x, y } = this._canvasState;
    canvas.style.transform = `translate3d(${x}px,${y}px,0) scale(${scale})`;
    if (persist) this._saveCanvasState();
  }

  _showZoomReset() {
    const toast = this.shadowRoot?.querySelector(".zoom-toast");
    if (!toast) return;
    toast.textContent = "Масштаб 100%";
    toast.classList.add("visible");
    if (this._zoomToastTimer) window.clearTimeout(this._zoomToastTimer);
    this._zoomToastTimer = window.setTimeout(() => toast.classList.remove("visible"), 1200);
  }

  _resetCanvas(content, canvas, announce = true) {
    this._applyCanvasState(content, canvas, { scale: 1, x: 0, y: 0 });
    if (announce) this._showZoomReset();
  }

  _cancelPendingAction(target, pointerId) {
    this._suppressClicksUntil = performance.now() + CLICK_GUARD_MS;
    try {
      target?.dispatchEvent(new CustomEvent("pointercancel", {
        bubbles: true,
        composed: true,
        detail: { starlineGestureCancel: true, pointerId },
      }));
    } catch (_err) {}
  }

  _installCanvasGestures(content, canvas) {
    const localPoint = (event) => {
      const rect = content.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    content.addEventListener("click", (event) => {
      if (performance.now() < this._suppressClicksUntil) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);

    content.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "touch") return;
      const point = localPoint(event);
      this._canvasPointers.set(event.pointerId, { ...point, startX: point.x, startY: point.y, target: event.target });
      content.setPointerCapture?.(event.pointerId);

      if (this._canvasPointers.size === 1) {
        this._canvasGesture = {
          type: "pan",
          startedAt: performance.now(),
          startState: { ...this._canvasState },
          startPoint: point,
          moved: false,
        };
        return;
      }

      if (this._canvasPointers.size === 2) {
        const [a, b] = [...this._canvasPointers.values()];
        this._canvasPointers.forEach((pointer, pointerId) => this._cancelPendingAction(pointer.target, pointerId));
        this._canvasGesture = {
          type: "pinch",
          startedAt: performance.now(),
          startState: { ...this._canvasState },
          startDistance: Math.max(distance(a, b), 1),
          startMidpoint: midpoint(a, b),
          moved: false,
        };
      }
    });

    content.addEventListener("pointermove", (event) => {
      const pointer = this._canvasPointers.get(event.pointerId);
      if (!pointer || event.pointerType !== "touch") return;
      const point = localPoint(event);
      pointer.x = point.x;
      pointer.y = point.y;
      const gesture = this._canvasGesture;
      if (!gesture) return;

      if (gesture.type === "pan" && this._canvasPointers.size === 1) {
        const deltaX = point.x - gesture.startPoint.x;
        const deltaY = point.y - gesture.startPoint.y;
        if (!gesture.moved && Math.hypot(deltaX, deltaY) >= PAN_THRESHOLD) {
          gesture.moved = true;
          this._cancelPendingAction(pointer.target, event.pointerId);
        }
        if (!gesture.moved) return;
        event.preventDefault();
        this._applyCanvasState(content, canvas, {
          scale: gesture.startState.scale,
          x: gesture.startState.x + deltaX,
          y: gesture.startState.y + deltaY,
        });
        return;
      }

      if (gesture.type === "pinch" && this._canvasPointers.size >= 2) {
        const [a, b] = [...this._canvasPointers.values()];
        const currentMidpoint = midpoint(a, b);
        const nextScale = clamp(
          gesture.startState.scale * (distance(a, b) / gesture.startDistance),
          MIN_SCALE,
          MAX_SCALE,
        );
        const canvasLeft = canvas.offsetLeft;
        const canvasTop = canvas.offsetTop;
        const focalX = (gesture.startMidpoint.x - canvasLeft - gesture.startState.x) / gesture.startState.scale;
        const focalY = (gesture.startMidpoint.y - canvasTop - gesture.startState.y) / gesture.startState.scale;
        gesture.moved = gesture.moved
          || Math.abs(nextScale - gesture.startState.scale) > 0.01
          || distance(currentMidpoint, gesture.startMidpoint) >= PAN_THRESHOLD;
        event.preventDefault();
        this._applyCanvasState(content, canvas, {
          scale: nextScale,
          x: currentMidpoint.x - canvasLeft - focalX * nextScale,
          y: currentMidpoint.y - canvasTop - focalY * nextScale,
        });
      }
    });

    const finishPointer = (event, cancelled = false) => {
      if (event.detail?.starlineGestureCancel) return;
      const gesture = this._canvasGesture;
      const wasTracked = this._canvasPointers.has(event.pointerId);
      this._canvasPointers.delete(event.pointerId);
      if (!wasTracked || !gesture) return;

      if (gesture.type === "pinch" && gesture.moved && this._canvasPointers.size === 0) {
        if (this._canvasState.scale >= SNAP_MIN && this._canvasState.scale <= SNAP_MAX) {
          this._resetCanvas(content, canvas);
        }
      }

      if (this._canvasPointers.size > 0) return;
      const elapsed = performance.now() - gesture.startedAt;
      if (!cancelled && gesture.type === "pinch" && !gesture.moved && elapsed <= TAP_DURATION) {
        const now = performance.now();
        if (now - this._lastTwoFingerTap <= DOUBLE_TAP_GAP) {
          this._lastTwoFingerTap = 0;
          this._resetCanvas(content, canvas);
          this._suppressClicksUntil = now + CLICK_GUARD_MS;
        } else {
          this._lastTwoFingerTap = now;
        }
      }
      if (gesture.moved) this._suppressClicksUntil = performance.now() + CLICK_GUARD_MS;
      this._canvasGesture = null;
    };

    content.addEventListener("pointerup", (event) => finishPointer(event));
    content.addEventListener("pointercancel", (event) => finishPointer(event, true));
  }

  _installZoomStyles() {
    if (!this.shadowRoot || this.shadowRoot.querySelector("style[data-starline-canvas-v014]")) return;
    const style = document.createElement("style");
    style.dataset.starlineCanvasV014 = "true";
    style.textContent = `
      #content {
        position:relative !important;
        overflow:hidden !important;
        overscroll-behavior:none !important;
        touch-action:none !important;
        -webkit-overflow-scrolling:auto !important;
      }
      .zoom-workspace {
        display:block;
        width:min(100%,980px);
        margin:0 auto;
        transform-origin:0 0;
        will-change:transform;
        contain:layout style;
      }
      .zoom-toast {
        position:absolute;
        z-index:30;
        left:50%;
        bottom:12px;
        min-height:38px;
        display:grid;
        place-items:center;
        padding:8px 14px;
        border:1px solid var(--border);
        border-radius:14px;
        background:color-mix(in srgb,var(--surface) 94%,transparent);
        color:var(--primary-text-color);
        box-shadow:0 4px 16px color-mix(in srgb,#000 14%,transparent);
        backdrop-filter:blur(8px);
        -webkit-backdrop-filter:blur(8px);
        font-size:12px;
        font-weight:750;
        opacity:0;
        pointer-events:none;
        transform:translate(-50%,8px);
        transition:opacity .16s ease,transform .16s ease;
      }
      .zoom-toast.visible { opacity:1; transform:translate(-50%,0); }
      .zoom-controls { display:none !important; }
    `;
    this.shadowRoot.append(style);
  }

  _installZoomLayer() {
    const content = this.shadowRoot?.getElementById("content");
    if (!content || content.dataset.canvasInstalled === "true") return;
    const shell = content.querySelector(":scope > .shell");
    if (!shell) return;

    this._loadCanvasState();
    const canvas = document.createElement("div");
    canvas.className = "zoom-workspace";
    shell.replaceWith(canvas);
    canvas.append(shell);
    shell.style.width = "100%";
    shell.style.margin = "0";

    const toast = document.createElement("div");
    toast.className = "zoom-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    content.append(toast);

    this._applyCanvasState(content, canvas, this._canvasState, false);
    this._installCanvasGestures(content, canvas);

    this._canvasResizeObserver?.disconnect();
    this._canvasResizeObserver = new ResizeObserver(() => {
      this._applyCanvasState(content, canvas, this._canvasState);
    });
    this._canvasResizeObserver.observe(content);
    this._canvasResizeObserver.observe(canvas);
    content.dataset.canvasInstalled = "true";
  }

  _installCommonHeader() {
    super._installCommonHeader();
    if (!this._mobileOnly() || !this.shadowRoot) return;
    const title = this.shadowRoot.querySelector(".nika-title span");
    if (title) title.textContent = `Автомобили · UI v${UI_VERSION}`;
  }
}

if (!customElements.get("starline-app-panel-v014")) {
  customElements.define("starline-app-panel-v014", StarLineAppPanelV014);
}
