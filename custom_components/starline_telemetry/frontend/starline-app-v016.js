import "./starline-app-v015.js?v=0.5.0-ui-standard";

const BASE_COMPONENT = customElements.get("starline-app-panel-v015");
const UI_VERSION = "0.5.1";
const EVENT_WINDOW_HOURS = 24;
const TRIP_WINDOW_HOURS = 72;
const UNRELIABLE_STATES = new Set(["", "none", "null", "unknown", "unavailable"]);
const MIN_SCALE = 0.75;
const MAX_SCALE = 2;
const SNAP_MIN = 0.97;
const SNAP_MAX = 1.03;
const PAN_THRESHOLD = 7;
const TAP_DURATION = 280;
const DOUBLE_TAP_GAP = 360;
const CLICK_GUARD_MS = 420;

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

class StarLineAppPanelV016 extends BASE_COMPONENT {
  _canvasBounds(content, canvas, scale) {
    if (scale <= 1) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    const scaledWidth = Math.max(canvas.scrollWidth, canvas.offsetWidth) * scale;
    const scaledHeight = Math.max(canvas.scrollHeight, canvas.offsetHeight) * scale;
    const scaledRight = canvas.offsetLeft + scaledWidth;
    const scaledBottom = canvas.offsetTop + scaledHeight;
    const minX = scaledRight > content.clientWidth
      ? Math.min(0, content.clientWidth - scaledRight)
      : 0;
    const minY = scaledBottom > content.clientHeight
      ? Math.min(0, content.clientHeight - scaledBottom)
      : 0;
    return { minX, maxX: 0, minY, maxY: 0 };
  }

  _clampCanvasState(content, canvas, state = this._canvasState) {
    const scale = clamp(finite(state.scale, 1), MIN_SCALE, MAX_SCALE);
    if (scale <= 1) return { scale, x: 0, y: 0 };
    const bounds = this._canvasBounds(content, canvas, scale);
    return {
      scale,
      x: clamp(finite(state.x), bounds.minX, bounds.maxX),
      y: clamp(finite(state.y), bounds.minY, bounds.maxY),
    };
  }

  _applyCanvasState(content, canvas, state = this._canvasState, persist = true) {
    const wasEnlarged = content.classList.contains("zoom-enlarged");
    const proposedY = finite(state.y);
    this._canvasState = this._clampCanvasState(content, canvas, state);
    const { scale, x, y } = this._canvasState;
    const enlarged = scale > 1;

    canvas.style.transform = `translate3d(${x}px,${y}px,0) scale(${scale})`;
    const unscaledHeight = Math.max(canvas.scrollHeight, canvas.offsetHeight);
    canvas.style.marginBottom = scale < 1
      ? `${Math.round((scale - 1) * unscaledHeight)}px`
      : "0px";
    content.classList.toggle("zoom-enlarged", enlarged);

    if (enlarged) {
      if (content.scrollTop) content.scrollTop = 0;
    } else if (wasEnlarged) {
      const maxScroll = Math.max(0, content.scrollHeight - content.clientHeight);
      content.scrollTop = clamp(-proposedY, 0, maxScroll);
    }
    if (persist) this._saveCanvasState();
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
      this._canvasPointers.set(event.pointerId, {
        ...point,
        startX: point.x,
        startY: point.y,
        target: event.target,
      });
      content.setPointerCapture?.(event.pointerId);

      if (this._canvasPointers.size === 1) {
        const bounds = this._canvasBounds(content, canvas, this._canvasState.scale);
        const enlarged = this._canvasState.scale > 1;
        this._canvasGesture = {
          type: enlarged ? "pan" : "native",
          startedAt: performance.now(),
          startState: { ...this._canvasState },
          startPoint: point,
          panX: enlarged && bounds.minX < bounds.maxX,
          panY: enlarged && bounds.minY < bounds.maxY,
          moved: false,
        };
        return;
      }

      if (this._canvasPointers.size === 2) {
        const [a, b] = [...this._canvasPointers.values()];
        this._canvasPointers.forEach((pointer, pointerId) => {
          this._cancelPendingAction(pointer.target, pointerId);
        });
        this._canvasGesture = {
          type: "pinch",
          startedAt: performance.now(),
          startState: { ...this._canvasState },
          startScrollTop: content.scrollTop,
          startDistance: Math.max(distance(a, b), 1),
          startMidpoint: midpoint(a, b),
          moved: false,
        };
        event.preventDefault();
      }
    });

    content.addEventListener("pointermove", (event) => {
      const pointer = this._canvasPointers.get(event.pointerId);
      if (!pointer || event.pointerType !== "touch") return;
      const point = localPoint(event);
      pointer.x = point.x;
      pointer.y = point.y;
      const gesture = this._canvasGesture;
      if (!gesture || gesture.type === "native") return;

      if (gesture.type === "pan" && this._canvasPointers.size === 1) {
        const deltaX = gesture.panX ? point.x - gesture.startPoint.x : 0;
        const deltaY = gesture.panY ? point.y - gesture.startPoint.y : 0;
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
        const focalX = (
          gesture.startMidpoint.x - canvasLeft - gesture.startState.x
        ) / gesture.startState.scale;
        const focalY = (
          gesture.startMidpoint.y
          - canvasTop
          + gesture.startScrollTop
          - gesture.startState.y
        ) / gesture.startState.scale;
        const proposedX = currentMidpoint.x - canvasLeft - focalX * nextScale;
        const proposedY = currentMidpoint.y - canvasTop - focalY * nextScale;
        gesture.moved = gesture.moved
          || Math.abs(nextScale - gesture.startState.scale) > 0.01
          || distance(currentMidpoint, gesture.startMidpoint) >= PAN_THRESHOLD;
        event.preventDefault();
        this._applyCanvasState(content, canvas, {
          scale: nextScale,
          x: proposedX,
          y: proposedY,
        });
        if (nextScale <= 1) {
          const maxScroll = Math.max(0, content.scrollHeight - content.clientHeight);
          content.scrollTop = clamp(
            canvasTop + focalY * nextScale - currentMidpoint.y,
            0,
            maxScroll,
          );
        }
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
    if (!this.shadowRoot || this.shadowRoot.querySelector("style[data-starline-canvas-v016]")) return;
    const style = document.createElement("style");
    style.dataset.starlineCanvasV016 = "true";
    style.textContent = `
      #content {
        position:relative !important;
        overflow-x:hidden !important;
        overflow-y:auto !important;
        overscroll-behavior-x:none !important;
        overscroll-behavior-y:contain !important;
        touch-action:pan-y !important;
        -webkit-overflow-scrolling:touch !important;
      }
      #content.zoom-enlarged {
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

  _setView(view) {
    super._setView(view);
    const content = this.shadowRoot?.getElementById("content");
    const canvas = content?.querySelector(":scope > .zoom-workspace");
    if (!content || !canvas) return;
    content.scrollTop = 0;
    content.scrollLeft = 0;
    this._applyCanvasState(content, canvas, {
      scale: this._canvasState.scale,
      x: this._canvasState.scale > 1 ? this._canvasState.x : 0,
      y: this._canvasState.scale > 1 ? this._canvasState.y : 0,
    });
  }

  _historyPath(entityIds, hours, withAttributes = false) {
    if (withAttributes) return super._historyPath(entityIds, hours, true);
    const end = new Date();
    const start = new Date(end.getTime() - hours * 3600000);
    const params = new URLSearchParams({
      filter_entity_id: entityIds.join(","),
      end_time: end.toISOString(),
      significant_changes_only: "1",
    });
    params.append("no_attributes", "");
    return `history/period/${encodeURIComponent(start.toISOString())}?${params.toString()}`;
  }

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

  _eventsFromHistory(vehicle, payload) {
    if (!Array.isArray(payload)) return [];
    const reverse = new Map(
      Object.entries(vehicle?.entities || {}).map(([role, entityId]) => [entityId, role]),
    );
    const events = [];

    for (const rawSeries of payload) {
      if (!Array.isArray(rawSeries) || !rawSeries.length) continue;
      const series = [...rawSeries].sort(
        (a, b) => this._historyTimestamp(a) - this._historyTimestamp(b),
      );
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

        const timestamp = this._historyTimestamp(item);
        const definition = this._eventDefinition(role, state);
        previousState = state;
        if (!definition || !Number.isFinite(timestamp)) continue;
        events.push({
          role,
          entityId,
          timestamp,
          label: definition[0],
          category: definition[1],
          icon: definition[2],
        });
      }
    }

    return events
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 100);
  }

  _starLineEventPresentation(description) {
    const label = String(description || "Событие StarLine").trim();
    const value = label.toLowerCase();
    if (/тревог|удар|наклон|движени/.test(value)) {
      return { label, category: "alarm", icon: "mdi:alarm-light" };
    }
    if (/охран|блокиров/.test(value)) {
      return { label, category: "security", icon: "mdi:shield-lock" };
    }
    if (/двер|капот|багаж|периметр/.test(value)) {
      return { label, category: "perimeter", icon: "mdi:car-door" };
    }
    if (/ручн|парков/.test(value)) {
      return { label, category: "parking", icon: "mdi:car-brake-hold" };
    }
    if (/зажиган|двигател|запуск|автозапуск/.test(value)) {
      return { label, category: "engine", icon: "mdi:engine" };
    }
    return { label, category: "service", icon: "mdi:car-connected" };
  }

  _starLineEvents(payload) {
    if (!Array.isArray(payload?.events)) return [];
    return payload.events
      .map((item) => {
        const rawTimestamp = Number(item?.timestamp);
        const timestamp = rawTimestamp < 1e12 ? rawTimestamp * 1000 : rawTimestamp;
        if (!Number.isFinite(timestamp)) return null;
        const presentation = this._starLineEventPresentation(item?.description);
        return {
          role: "starline_event",
          entityId: "",
          timestamp,
          label: presentation.label,
          category: presentation.category,
          icon: presentation.icon,
          eventId: item?.event_id,
          groupId: item?.group_id,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 200);
  }

  async _officialHistory(vehicle, force) {
    return this._hass.callWS({
      type: "starline_telemetry/panel/history",
      device_id: String(vehicle.device_id),
      hours: EVENT_WINDOW_HOURS,
      force,
    });
  }

  async _ensureHistory(force = false) {
    const vehicle = this._vehicle();
    if (!vehicle || !this._hass) return;
    const id = vehicle.device_id;
    if (!force && this._historyByVehicle.has(id)) return;
    if (this._historyLoading.has(id)) return;

    this._historyLoading.add(id);
    this._historyErrors.delete(id);
    this._render();
    try {
      const location = this._entity(vehicle, ["location", "vehicle_location"]);
      const locationPromise = location
        ? this._hass.callApi(
          "GET",
          this._historyPath([location.entityId], TRIP_WINDOW_HOURS, true),
        ).catch(() => [])
        : Promise.resolve([]);

      let events;
      let eventSource = "starline_open_api";
      try {
        events = this._starLineEvents(await this._officialHistory(vehicle, force));
      } catch (_err) {
        eventSource = "home_assistant_recorder";
        const eventIds = this._historyEntityIds(vehicle);
        const eventPayload = eventIds.length
          ? await this._hass.callApi(
            "GET",
            this._historyPath(eventIds, EVENT_WINDOW_HOURS, false),
          )
          : [];
        events = this._eventsFromHistory(vehicle, eventPayload);
      }

      const locationPayload = await locationPromise;
      const points = this._pointsFromHistory(location?.entityId, locationPayload);
      const trips = this._buildTrips(points);
      this._historyByVehicle.set(id, {
        events,
        points,
        trips,
        loadedAt: Date.now(),
        eventSource,
      });
    } catch (err) {
      this._historyErrors.set(id, err?.message || String(err));
    } finally {
      this._historyLoading.delete(id);
      this._render();
    }
  }

  _historyRow(event) {
    const time = new Intl.DateTimeFormat("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(event.timestamp));
    const content = `<time>${this._escape(time)}</time><strong>${this._escape(event.label)}</strong>`;
    if (event.entityId) {
      return `<button class="history-row ${event.category}" data-entity="${this._escape(event.entityId)}">${content}</button>`;
    }
    return `<div class="history-row ${event.category}">${content}</div>`;
  }

  _historyView(vehicle) {
    const cache = this._historyCache(vehicle);
    const loading = this._historyLoading.has(vehicle?.device_id);
    const error = this._historyErrors.get(vehicle?.device_id);
    if (loading && !cache) return this._loadingState("Читаю журнал StarLine…");
    if (error && !cache) return this._errorState("История недоступна", error);
    const events = cache?.events || [];
    const official = cache?.eventSource === "starline_open_api";
    if (!events.length) {
      const detail = official
        ? "Официальный журнал StarLine не вернул событий за последние 24 часа."
        : "HA Recorder не вернул подтверждённых смен состояний за последние 24 часа.";
      return this._emptyState("mdi:timeline-clock-outline", "История пока пуста", detail);
    }

    const subtitle = official
      ? "Оригинальный журнал StarLine · точное время события · 24 часа"
      : "Резерв HA Recorder · время фиксации Home Assistant · 24 часа";
    const groups = this._groupEventsByDate(events);
    return `<div class="view-head"><div><strong>История</strong><span>${this._escape(subtitle)}</span></div><button data-refresh-history="1"><ha-icon icon="mdi:refresh"></ha-icon></button></div>
      <div class="history-list">${groups.map((group) => `<section class="history-day"><div class="day-chip">${this._escape(group.key)}</div>${group.events.map((event) => this._historyRow(event)).join("")}</section>`).join("")}</div>`;
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
    if (this.shadowRoot.querySelector("style[data-starline-history-v016]")) return;

    const style = document.createElement("style");
    style.dataset.starlineHistoryV016 = "true";
    style.textContent = `
      header {
        grid-template-columns:52px minmax(0,1fr) 52px !important;
        min-height:calc(62px + env(safe-area-inset-top,0px)) !important;
        gap:4px !important;
        padding:max(8px,env(safe-area-inset-top,0px)) max(8px,env(safe-area-inset-right,0px)) 8px max(8px,env(safe-area-inset-left,0px)) !important;
      }
      header > #menu,
      .nika-refresh {
        width:44px !important;
        min-width:44px !important;
        height:44px !important;
        min-height:44px !important;
        padding:0 !important;
        border:1px solid var(--divider-color,var(--border)) !important;
        border-radius:16px !important;
        background:var(--card-background-color,var(--surface)) !important;
        box-shadow:0 2px 8px color-mix(in srgb,#000 11%,transparent) !important;
      }
      header > #menu { color:var(--primary-text-color) !important; }
      .nika-refresh { color:var(--primary-color,var(--accent)) !important; }
      header > #menu ha-icon,
      .nika-refresh ha-icon { --mdc-icon-size:25px !important; }
      .nika-title strong {
        font-size:21px !important;
        line-height:1.05 !important;
        font-weight:800 !important;
      }
      .nika-title span {
        margin-top:3px !important;
        font-size:12px !important;
        line-height:1.1 !important;
        font-weight:560 !important;
      }

      nav {
        background:var(--card-background-color,var(--surface)) !important;
        border-top:1px solid var(--divider-color,var(--border)) !important;
        box-shadow:0 -3px 14px color-mix(in srgb,#000 8%,transparent) !important;
      }
      nav button {
        min-height:56px !important;
        border-radius:14px !important;
      }
      nav button.active {
        color:var(--primary-color,var(--accent)) !important;
        background:color-mix(in srgb,var(--primary-color,var(--accent)) 11%,transparent) !important;
        box-shadow:none !important;
      }
      nav ha-icon { --mdc-icon-size:28px !important; }
      nav span {
        font-size:12px !important;
        line-height:1.1 !important;
        font-weight:700 !important;
      }

      .summary-identity strong { font-size:26px !important; }
      .summary-identity span { font-size:14px !important; }
      .summary-identity small { font-size:12px !important; }
      .summary-heading strong { font-size:21px !important; }
      .summary-heading span { font-size:13px !important; }
      .summary-security span,
      .summary-connection span,
      .summary-metric span,
      .target-state-row .summary-state span,
      .summary-event span { font-size:11px !important; }
      .summary-security strong { font-size:14px !important; }
      .summary-connection strong { font-size:13px !important; }
      .summary-metric strong { font-size:14px !important; }
      .target-state-row .summary-state strong,
      .summary-event strong { font-size:14px !important; }

      .vehicle-title span,
      .vehicle-menu span,
      .freshness,
      .vehicle-caption span,
      .last-event > span:not(.event-date),
      .last-event > strong,
      .status-pill,
      .section-title span,
      .map-fallback,
      .trip-meta > div:first-child span,
      .trip-times,
      .trip-foot,
      .diag-tile span,
      .read-only-banner span,
      .diag-entity > div:first-child span,
      .diag-state > span,
      .empty-state span,
      .empty-inline,
      .notice,
      .hero-copy span,
      .hero-copy p,
      .section p,
      .location-line,
      .m-freshness,
      .m-map-head span { font-size:12px !important; }
      .telemetry-chip span,
      .group-title,
      .metric-label,
      .source-card div span,
      .readonly,
      .last-event .event-date,
      .m-metric span,
      .m-state span,
      .m-event span { font-size:11px !important; }
      .vehicle-menu strong,
      .telemetry-chip strong,
      .vehicle-caption strong,
      .source-card div strong,
      .diag-entity strong,
      .read-only-banner strong,
      .m-state strong { font-size:14px !important; }
      .section-title strong,
      .empty-state strong,
      .m-section-label strong,
      .m-event strong,
      .m-map-head strong { font-size:16px !important; }

      .view-head strong { font-size:21px !important; }
      .view-head span { font-size:13px !important; line-height:1.3 !important; }
      .history-day { padding-top:27px !important; }
      .day-chip {
        min-height:34px !important;
        padding:7px 14px !important;
        font-size:16px !important;
        line-height:1.2 !important;
      }
      .history-row {
        min-height:58px !important;
        grid-template-columns:64px minmax(0,1fr) !important;
        gap:8px !important;
        padding:10px 12px 10px 14px !important;
      }
      .history-row time {
        font-size:16px !important;
        line-height:1.2 !important;
        white-space:nowrap;
      }
      .history-row strong {
        min-width:0;
        font-size:18px !important;
        line-height:1.2 !important;
        font-weight:500 !important;
        overflow-wrap:anywhere;
      }

      @media (max-width:390px) {
        .summary-identity strong { font-size:26px !important; }
        .summary-identity span { font-size:14px !important; }
        .summary-identity small { font-size:12px !important; }
        .summary-security strong { font-size:14px !important; }
        .summary-connection strong { font-size:13px !important; }
        .summary-metric strong { font-size:14px !important; }
        .target-state-row .summary-state strong { font-size:14px !important; }
      }

      @media (max-width:359px) {
        header { grid-template-columns:48px minmax(0,1fr) 48px !important; }
      }

      @media (max-width:699px) {
        header { min-height:calc(60px + env(safe-area-inset-top,0px)) !important; }
      }
    `;
    this.shadowRoot.append(style);
  }
}

if (!customElements.get("starline-app-panel-v016")) {
  customElements.define("starline-app-panel-v016", StarLineAppPanelV016);
}

if (!customElements.get("starline-app-panel")) {
  customElements.define("starline-app-panel", class extends StarLineAppPanelV016 {});
}
