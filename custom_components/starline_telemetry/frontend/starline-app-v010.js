import "./starline-app-v009.js?v=0.3.2-core-bridge";

const BASE_COMPONENT = customElements.get("starline-app-panel-v009");
const UI_VERSION = "0.3.3";
const MIN_SCALE = 0.8;
const MAX_SCALE = 2.0;
const SCALE_STEP = 0.1;
const STORAGE_KEY = "starline-panel-scale-v1";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

class StarLineAppPanelV010 extends BASE_COMPONENT {
  constructor() {
    super();
    this._panelScale = this._loadScale();
    this._pinch = null;
  }

  _loadScale() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const value = Number(raw);
      return Number.isFinite(value) ? clamp(value, MIN_SCALE, MAX_SCALE) : 1;
    } catch (_err) {
      return 1;
    }
  }

  _saveScale() {
    try {
      localStorage.setItem(STORAGE_KEY, String(this._panelScale));
    } catch (_err) {}
  }

  _scalePercent() {
    return `${Math.round(this._panelScale * 100)}%`;
  }

  _setScale(nextScale, focal = null) {
    const content = this.shadowRoot?.getElementById("content");
    const workspace = this.shadowRoot?.querySelector(".zoom-workspace");
    if (!content || !workspace) return;

    const oldScale = this._panelScale;
    const newScale = clamp(Math.round(nextScale * 100) / 100, MIN_SCALE, MAX_SCALE);
    if (Math.abs(newScale - oldScale) < 0.001) return;

    const rect = content.getBoundingClientRect();
    const clientX = focal?.x ?? rect.left + rect.width / 2;
    const clientY = focal?.y ?? rect.top + rect.height / 2;
    const localX = clientX - rect.left + content.scrollLeft;
    const localY = clientY - rect.top + content.scrollTop;
    const ratio = newScale / oldScale;

    this._panelScale = newScale;
    workspace.style.zoom = String(newScale);
    this._saveScale();
    this._updateZoomLabel();

    requestAnimationFrame(() => {
      content.scrollLeft = localX * ratio - (clientX - rect.left);
      content.scrollTop = localY * ratio - (clientY - rect.top);
    });
  }

  _resetScale() {
    this._setScale(1);
  }

  _updateZoomLabel() {
    const label = this.shadowRoot?.querySelector("#zoomReset");
    if (label) label.textContent = this._scalePercent();
  }

  _installZoomLayer() {
    const content = this.shadowRoot?.getElementById("content");
    if (!content || content.dataset.zoomInstalled === "true") return;
    const shell = content.querySelector(":scope > .shell");
    if (!shell) return;

    const workspace = document.createElement("div");
    workspace.className = "zoom-workspace";
    workspace.style.zoom = String(this._panelScale);
    shell.replaceWith(workspace);
    workspace.append(shell);

    const controls = document.createElement("div");
    controls.className = "zoom-controls";
    controls.setAttribute("aria-label", "Масштаб панели");
    controls.innerHTML = `
      <button type="button" id="zoomOut" aria-label="Уменьшить масштаб"><ha-icon icon="mdi:minus"></ha-icon></button>
      <button type="button" id="zoomReset" class="zoom-value" aria-label="Вернуть масштаб 100%">${this._scalePercent()}</button>
      <button type="button" id="zoomIn" aria-label="Увеличить масштаб"><ha-icon icon="mdi:plus"></ha-icon></button>
    `;
    content.append(controls);

    controls.querySelector("#zoomOut")?.addEventListener("click", () => this._setScale(this._panelScale - SCALE_STEP));
    controls.querySelector("#zoomIn")?.addEventListener("click", () => this._setScale(this._panelScale + SCALE_STEP));
    controls.querySelector("#zoomReset")?.addEventListener("click", () => this._resetScale());

    const distance = (touches) => Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY,
    );
    const midpoint = (touches) => ({
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    });

    content.addEventListener("touchstart", (event) => {
      if (event.touches.length !== 2) return;
      this._pinch = { distance: distance(event.touches), scale: this._panelScale };
    }, { passive: true });

    content.addEventListener("touchmove", (event) => {
      if (!this._pinch || event.touches.length !== 2) return;
      event.preventDefault();
      const currentDistance = distance(event.touches);
      if (!this._pinch.distance) return;
      this._setScale(this._pinch.scale * (currentDistance / this._pinch.distance), midpoint(event.touches));
    }, { passive: false });

    content.addEventListener("touchend", (event) => {
      if (event.touches.length < 2) this._pinch = null;
    }, { passive: true });
    content.addEventListener("touchcancel", () => { this._pinch = null; }, { passive: true });

    content.dataset.zoomInstalled = "true";
  }

  _installZoomStyles() {
    if (!this.shadowRoot || this.shadowRoot.querySelector("style[data-starline-zoom-v010]")) return;
    const style = document.createElement("style");
    style.dataset.starlineZoomV010 = "true";
    style.textContent = `
      #content { position:relative !important; overflow:auto !important; }
      .zoom-workspace { display:block; width:100%; transform-origin:0 0; }
      .zoom-controls {
        position:sticky; z-index:20; left:50%; bottom:10px; width:max-content; margin:10px auto 2px;
        display:grid; grid-template-columns:38px 58px 38px; align-items:center;
        border:1px solid var(--border); border-radius:16px; overflow:hidden;
        background:color-mix(in srgb,var(--surface) 94%,transparent);
        box-shadow:0 4px 16px color-mix(in srgb,#000 12%,transparent);
        backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px);
      }
      .zoom-controls button {
        min-width:0; width:auto; height:38px; border:0; border-right:1px solid var(--border);
        background:transparent; color:var(--primary-text-color); font:inherit; font-size:13px; font-weight:750;
        display:grid; place-items:center; padding:0;
      }
      .zoom-controls button:last-child { border-right:0; }
      .zoom-controls .zoom-value { color:var(--accent); }
      .zoom-controls ha-icon { --mdc-icon-size:19px; }
      @media (max-width:699px) { .zoom-controls { bottom:8px; margin-top:12px; } }
    `;
    this.shadowRoot.append(style);
  }

  _installCommonHeader() {
    super._installCommonHeader();
    if (!this._mobileOnly() || !this.shadowRoot) return;
    const title = this.shadowRoot.querySelector(".nika-title span");
    if (title) title.textContent = `Автомобили · UI v${UI_VERSION}`;
  }

  _render() {
    super._render();
    if (!this.shadowRoot) return;
    this._installZoomStyles();
    this._installZoomLayer();
  }
}

if (!customElements.get("starline-app-panel-v010")) {
  customElements.define("starline-app-panel-v010", StarLineAppPanelV010);
}
