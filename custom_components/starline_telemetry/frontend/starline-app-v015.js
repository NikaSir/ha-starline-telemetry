import "./starline-app-v014.js?v=0.4.3-core-bridge";

const BASE_COMPONENT = customElements.get("starline-app-panel-v014");
const UI_VERSION = "0.5.0";
const FINAL_MIN_SCALE = 0.75;
const FINAL_MAX_SCALE = 2;
const FINAL_SNAP_MIN = 0.97;
const FINAL_SNAP_MAX = 1.03;
const FINAL_PAN_THRESHOLD = 7;
const FINAL_TAP_DURATION = 280;
const FINAL_DOUBLE_TAP_GAP = 360;
const FINAL_CLICK_GUARD_MS = 420;

const finalClamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finalFinite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const finalDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const finalMidpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

class StarLineAppPanelV015 extends BASE_COMPONENT {
  _canvasBounds(content, canvas, scale) {
    if (scale <= 1) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    const scaledWidth = canvas.offsetWidth * scale;
    const scaledHeight = canvas.offsetHeight * scale;
    const overflowX = Math.max(0, scaledWidth - content.clientWidth);
    const overflowY = Math.max(0, scaledHeight - content.clientHeight);
    return {
      minX: overflowX > 0 ? -overflowX : 0,
      maxX: 0,
      minY: overflowY > 0 ? -overflowY : 0,
      maxY: 0,
    };
  }

  _clampCanvasState(content, canvas, state = this._canvasState) {
    const scale = finalClamp(finalFinite(state?.scale, 1), FINAL_MIN_SCALE, FINAL_MAX_SCALE);
    if (scale <= 1) return { scale, x: 0, y: 0 };
    const bounds = this._canvasBounds(content, canvas, scale);
    return {
      scale,
      x: finalClamp(finalFinite(state?.x), bounds.minX, bounds.maxX),
      y: finalClamp(finalFinite(state?.y), bounds.minY, bounds.maxY),
    };
  }

  _applyCanvasState(content, canvas, state = this._canvasState, persist = true) {
    this._canvasState = this._clampCanvasState(content, canvas, state);
    const { scale, x, y } = this._canvasState;
    const enlarged = scale > 1;
    content.classList.toggle("canvas-zoomed", enlarged);
    if (enlarged) content.scrollTop = 0;
    canvas.style.transform = `translate3d(${x}px,${y}px,0) scale(${scale})`;
    if (persist) this._saveCanvasState();
  }

  _installZoomStyles() {
    if (!this.shadowRoot || this.shadowRoot.querySelector("style[data-starline-canvas-v015]")) return;
    const style = document.createElement("style");
    style.dataset.starlineCanvasV015 = "true";
    style.textContent = `
      #content {
        position:relative !important;
        min-height:0 !important;
        overflow-x:hidden !important;
        overflow-y:auto !important;
        overscroll-behavior-x:none !important;
        overscroll-behavior-y:contain !important;
        touch-action:pan-y !important;
        -webkit-overflow-scrolling:touch !important;
      }
      #content.canvas-zoomed {
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
        position:absolute; z-index:30; left:50%; bottom:12px; min-height:38px;
        display:grid; place-items:center; padding:8px 14px;
        border:1px solid var(--border); border-radius:14px;
        background:color-mix(in srgb,var(--surface) 94%,transparent);
        color:var(--primary-text-color); box-shadow:0 4px 16px color-mix(in srgb,#000 14%,transparent);
        backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px);
        font-size:12px; font-weight:750; opacity:0; pointer-events:none;
        transform:translate(-50%,8px); transition:opacity .16s ease,transform .16s ease;
      }
      .zoom-toast.visible { opacity:1; transform:translate(-50%,0); }
      .zoom-controls { display:none !important; }
    `;
    this.shadowRoot.append(style);
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
      this._canvasPointers.set(event.pointerId, { ...point, target: event.target });

      if (this._canvasPointers.size === 1) {
        this._canvasGesture = this._canvasState.scale > 1 ? {
          type: "pan",
          startedAt: performance.now(),
          startState: { ...this._canvasState },
          startPoint: point,
          moved: false,
        } : null;
        return;
      }

      if (this._canvasPointers.size === 2) {
        const [a, b] = [...this._canvasPointers.values()];
        this._canvasPointers.forEach((pointer, pointerId) => this._cancelPendingAction(pointer.target, pointerId));
        this._canvasGesture = {
          type: "pinch",
          startedAt: performance.now(),
          startState: { ...this._canvasState },
          startScrollTop: content.scrollTop,
          startDistance: Math.max(finalDistance(a, b), 1),
          startMidpoint: finalMidpoint(a, b),
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

      if (gesture.type === "pan" && this._canvasPointers.size === 1 && gesture.startState.scale > 1) {
        const deltaX = point.x - gesture.startPoint.x;
        const deltaY = point.y - gesture.startPoint.y;
        if (!gesture.moved && Math.hypot(deltaX, deltaY) >= FINAL_PAN_THRESHOLD) {
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
        const currentMidpoint = finalMidpoint(a, b);
        const nextScale = finalClamp(
          gesture.startState.scale * (finalDistance(a, b) / gesture.startDistance),
          FINAL_MIN_SCALE,
          FINAL_MAX_SCALE,
        );
        const focalX = (gesture.startMidpoint.x - gesture.startState.x) / gesture.startState.scale;
        const focalY = (gesture.startMidpoint.y + gesture.startScrollTop - gesture.startState.y) / gesture.startState.scale;
        gesture.moved = gesture.moved
          || Math.abs(nextScale - gesture.startState.scale) > 0.01
          || finalDistance(currentMidpoint, gesture.startMidpoint) >= FINAL_PAN_THRESHOLD;
        event.preventDefault();
        this._applyCanvasState(content, canvas, {
          scale: nextScale,
          x: currentMidpoint.x - focalX * nextScale,
          y: currentMidpoint.y - focalY * nextScale,
        });
      }
    });

    const finishPointer = (event, cancelled = false) => {
      if (event.detail?.starlineGestureCancel) return;
      const gesture = this._canvasGesture;
      const wasTracked = this._canvasPointers.has(event.pointerId);
      this._canvasPointers.delete(event.pointerId);
      if (!wasTracked || !gesture) return;

      if (gesture.type === "pinch" && gesture.moved && this._canvasPointers.size === 0
          && this._canvasState.scale >= FINAL_SNAP_MIN && this._canvasState.scale <= FINAL_SNAP_MAX) {
        this._resetCanvas(content, canvas);
      }
      if (this._canvasPointers.size > 0) return;
      const elapsed = performance.now() - gesture.startedAt;
      if (!cancelled && gesture.type === "pinch" && !gesture.moved && elapsed <= FINAL_TAP_DURATION) {
        const now = performance.now();
        if (now - this._lastTwoFingerTap <= FINAL_DOUBLE_TAP_GAP) {
          this._lastTwoFingerTap = 0;
          content.scrollTop = 0;
          this._resetCanvas(content, canvas);
          this._suppressClicksUntil = now + FINAL_CLICK_GUARD_MS;
        } else {
          this._lastTwoFingerTap = now;
        }
      }
      if (gesture.moved) this._suppressClicksUntil = performance.now() + FINAL_CLICK_GUARD_MS;
      this._canvasGesture = null;
    };

    content.addEventListener("pointerup", (event) => finishPointer(event));
    content.addEventListener("pointercancel", (event) => finishPointer(event, true));
  }

  _setView(view) {
    this._canvasState = { ...this._canvasState, x: 0, y: 0 };
    super._setView(view);
    const content = this.shadowRoot?.getElementById("content");
    const canvas = content?.querySelector(":scope > .zoom-workspace");
    content?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    if (content && canvas) this._applyCanvasState(content, canvas, this._canvasState);
  }

  _installFixedVehicleSwitcher() {
    if (!this.shadowRoot) return;
    const app = this.shadowRoot.querySelector(".app");
    const header = app?.querySelector(":scope > header");
    const vehicles = this._orderedVehicles();
    if (!app || !header || vehicles.length < 2) return;
    const selector = document.createElement("div");
    selector.className = "fixed-vehicle-switcher";
    selector.setAttribute("aria-label", "Автомобили");
    selector.innerHTML = vehicles.map((vehicle) => `<button type="button" data-fixed-vehicle="${this._escape(vehicle.device_id)}" class="${vehicle.device_id === this._vehicleId ? "active" : ""}"><i class="${this._online(vehicle) ? "online" : "offline"}"></i><span>${this._escape(vehicle.name)}</span></button>`).join("");
    header.after(selector);
    app.classList.add("has-fixed-vehicle-switcher");
    selector.querySelectorAll("[data-fixed-vehicle]").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.fixedVehicle === this._vehicleId) return;
      this._vehicleId = button.dataset.fixedVehicle;
      this._canvasStateKeyLoaded = null;
      this._pickerOpen = false;
      this._lastStateSignature = this._stateSignature();
      this._render();
      this._ensureHistory();
    }));
  }
  _compactEventLabel(timestamp) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "Событие";
    const time = new Intl.DateTimeFormat("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
    const today = new Date();
    const sameDay = date.getFullYear() === today.getFullYear()
      && date.getMonth() === today.getMonth()
      && date.getDate() === today.getDate();
    if (sameDay) return `Событие · ${time}`;
    const day = new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
    }).format(date);
    return `${day} · ${time}`;
  }

  _compactSummaryEvent(vehicle) {
    const event = this._lastEvent(vehicle);
    if (!event) {
      return `<div class="summary-state event-state">
        <ha-icon icon="mdi:information-outline"></ha-icon>
        <div><span>Событие</span><strong>${this._escape(this._perimeter(vehicle).label)}</strong></div>
      </div>`;
    }
    const fullDate = this._formatDateTime(event.timestamp);
    return `<button
      type="button"
      class="summary-state event-state"
      data-view-target="history"
      aria-label="${this._escape(`${fullDate}: ${event.label}`)}"
    >
      <ha-icon icon="${event.icon}"></ha-icon>
      <div><span>${this._escape(this._compactEventLabel(event.timestamp))}</span><strong>${this._escape(event.label)}</strong></div>
    </button>`;
  }

  _vehicleSummaryCard(vehicle) {
    const online = this._online(vehicle);
    const freshness = this._relativeTime(this._latestUpdate(vehicle));
    const metrics = [
      this._summaryMetric(vehicle, ["battery"], "АКБ", "mdi:car-battery", { digits: 1 }),
      this._summaryMetric(vehicle, ["fuel", "fuel_percent", "fuel_litres"], "Топливо", "mdi:gas-station-outline", { digits: 0 }),
      this._summaryMetric(vehicle, ["etemp", "engine_temperature"], "Двигатель", "mdi:thermometer", { digits: 0 }),
      this._summaryMetric(vehicle, ["ctemp", "cabin_temperature"], "Салон", "mdi:car-seat-heater", { digits: 0 }),
    ].join("");

    return `<article class="vehicle-summary-card target-card">
      <div class="summary-hero target-hero">
        <img class="summary-bg" src="${this._assetFor(vehicle, "bg")}" alt="" aria-hidden="true">
        <div class="summary-overlay"></div>
        <div class="summary-identity"><strong>${this._escape(vehicle.name)}</strong><span>Nissan MURANO Z52</span><small><i class="status-dot ${online ? "online" : "offline"}"></i>${online ? "В сети" : "Недоступен"} · ${this._escape(freshness)}</small></div>
        ${this._summarySecurity(vehicle)}
        <img class="summary-car" src="${this._assetFor(vehicle, "car")}" alt="Nissan Murano Z52 ${this._escape(vehicle.name)}">
        ${this._summaryConnection(vehicle)}
        <div class="summary-metrics target-metrics">${metrics}</div>
      </div>
      <div class="target-state-row perimeter-row">${this._summaryPerimeter(vehicle)}</div>
      <div class="target-state-row operational-row">${this._summaryOperational(vehicle)}${this._compactSummaryEvent(vehicle)}</div>
    </article>`;
  }

  _statusView(vehicle) {
    if (!this._mobileOnly()) return super._statusView(vehicle);
    return `<div class="dual-summary">${this._orderedVehicles().map((item) => this._vehicleSummaryCard(item)).join("")}</div>`;
  }

  _installCommonHeader() {
    super._installCommonHeader();
    if (!this.shadowRoot) return;
    const title = this.shadowRoot.querySelector(".nika-title span");
    if (title) title.textContent = `Автомобили · UI v${UI_VERSION}`;
  }

  _render() {
    super._render();
    if (!this.shadowRoot) return;
    this._installCommonHeader();
    this._installFixedVehicleSwitcher();
    if (!this.shadowRoot.querySelector("style[data-starline-shell-v015]")) {
      const shellStyle = document.createElement("style");
      shellStyle.dataset.starlineShellV015 = "true";
      shellStyle.textContent = `
        .app.has-fixed-vehicle-switcher { grid-template-rows:auto auto minmax(0,1fr) auto !important; }
        header {
          grid-template-columns:52px minmax(0,1fr) 52px !important;
          min-height:62px !important;
          padding:max(5px,env(safe-area-inset-top)) max(8px,env(safe-area-inset-right)) 5px max(8px,env(safe-area-inset-left)) !important;
        }
        header > #menu, .nika-refresh {
          width:44px !important; min-width:44px !important; height:44px !important; min-height:44px !important;
          border:1px solid var(--divider-color,var(--border)) !important;
          border-radius:16px !important;
          background:var(--card-background-color,var(--surface)) !important;
          box-shadow:0 3px 12px color-mix(in srgb,#000 7%,transparent) !important;
          display:grid !important; place-items:center !important; padding:0 !important;
        }
        header > #menu { color:var(--primary-text-color) !important; }
        .nika-refresh { color:var(--primary-color,var(--accent)) !important; }
        header > #menu ha-icon, .nika-refresh ha-icon { --mdc-icon-size:25px !important; }
        .nika-title strong { font-size:21px !important; font-weight:800 !important; }
        .nika-title span { font-size:12px !important; font-weight:560 !important; color:var(--secondary-text-color,var(--muted)) !important; }
        .fixed-vehicle-switcher {
          display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; padding:7px max(10px,env(safe-area-inset-right)) 7px max(10px,env(safe-area-inset-left));
          background:var(--surface); border-bottom:1px solid var(--border); z-index:7;
        }
        .fixed-vehicle-switcher button { min-width:0; min-height:44px; border:1px solid var(--border); border-radius:14px; background:var(--surface); color:var(--primary-text-color); display:grid; grid-template-columns:10px minmax(0,1fr); align-items:center; gap:8px; padding:6px 10px; }
        .fixed-vehicle-switcher button.active { color:var(--primary-color,var(--accent)); border-color:color-mix(in srgb,var(--primary-color,var(--accent)) 45%,var(--border)); background:color-mix(in srgb,var(--primary-color,var(--accent)) 9%,var(--surface)); }
        .fixed-vehicle-switcher i { width:9px; height:9px; border-radius:50%; background:var(--secondary-text-color,var(--muted)); }
        .fixed-vehicle-switcher i.online { background:var(--ok); }
        .fixed-vehicle-switcher i.offline { background:var(--danger); }
        .fixed-vehicle-switcher span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; font-weight:700; text-align:left; }
        .m-vehicle-switcher { display:none !important; }
        nav button { min-height:52px !important; border-radius:14px !important; }
        nav ha-icon { --mdc-icon-size:28px !important; }
        nav span { font-size:12px !important; font-weight:700 !important; }
        nav button.active { color:var(--primary-color,var(--accent)) !important; background:color-mix(in srgb,var(--primary-color,var(--accent)) 11%,transparent) !important; box-shadow:none !important; }
        @media(max-width:420px) {
          header { grid-template-columns:48px minmax(0,1fr) 48px !important; min-height:60px !important; }
        }
      `;
      this.shadowRoot.append(shellStyle);
    }
    if (!this._mobileOnly()) return;
    if (this.shadowRoot.querySelector("style[data-starline-summary-v015]")) return;

    const style = document.createElement("style");
    style.dataset.starlineSummaryV015 = "true";
    style.textContent = `
      .summary-identity strong { font-size:26px !important; }
      .summary-identity span { font-size:13px !important; }
      .summary-identity small { font-size:11px !important; }

      .summary-security span { font-size:9px !important; }
      .summary-security strong { font-size:14px !important; }
      .summary-connection span { font-size:9px !important; }
      .summary-connection strong { font-size:12px !important; }

      .summary-metric span { font-size:9px !important; }
      .summary-metric strong { font-size:13px !important; }

      .target-state-row .summary-state span { font-size:9px !important; }
      .target-state-row .summary-state strong { font-size:13px !important; }
      .operational-row {
        grid-template-columns:repeat(3,minmax(0,1fr)) !important;
        padding-left:11px !important;
        padding-right:11px !important;
      }
      .event-state {
        width:100%;
        min-width:0;
        border-top:0;
        border-bottom:0;
        border-left:0;
        background:transparent;
        color:var(--primary-text-color);
        font:inherit;
        text-align:left;
      }
      .event-state ha-icon { color:var(--accent) !important; }
      .event-state > div { min-width:0; }
      .event-state span,
      .event-state strong {
        display:block;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }

      @media (max-width:390px) {
        .summary-identity strong { font-size:24px !important; }
        .summary-identity span { font-size:12px !important; }
        .summary-security strong { font-size:13px !important; }
        .summary-connection strong { font-size:11px !important; }
        .summary-metric strong { font-size:12px !important; }
        .target-state-row .summary-state strong { font-size:12px !important; }
        .operational-row { padding-left:8px !important; padding-right:8px !important; }
      }
    `;
    this.shadowRoot.append(style);
  }
}

if (!customElements.get("starline-app-panel-v015")) {
  customElements.define("starline-app-panel-v015", StarLineAppPanelV015);
}
