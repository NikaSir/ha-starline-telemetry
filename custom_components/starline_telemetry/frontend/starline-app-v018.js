import "./starline-app-v017.js?v=0.5.2-summary-event-layout";

const BASE_COMPONENT = customElements.get("starline-app-panel-v017");
const UI_VERSION = "0.5.3";

class StarLineAppPanelV018 extends BASE_COMPONENT {
  _summarySecurity(vehicle) {
    const alarm = this._entity(vehicle, ["alarm"]);
    if (alarm && this._isOn(alarm) === true) {
      return '<div class="summary-security danger alarm"><ha-icon icon="mdi:shield-alert"></ha-icon><div><span>Охрана</span><strong>Тревога</strong></div></div>';
    }

    const entity = this._entity(vehicle, ["lock", "armed", "security"]);
    if (entity) {
      const locked = this._isLocked(entity);
      const text = locked === null ? "Нет данных" : locked ? "Включена" : "Снята";
      const tone = locked === null ? "muted" : locked ? "ok armed" : "warn disarmed";
      const icon = locked === true ? "mdi:shield-lock" : "mdi:shield-car";
      return `<div class="summary-security ${tone}"><ha-icon icon="${icon}"></ha-icon><div><span>Охрана</span><strong>${this._escape(text)}</strong></div></div>`;
    }
    return super._summarySecurity(vehicle);
  }

  _summarySceneGrowth(viewportHeight, canvasHeight, sceneCount) {
    const viewport = Number(viewportHeight);
    const canvas = Number(canvasHeight);
    const count = Number(sceneCount);
    if (!Number.isFinite(viewport) || !Number.isFinite(canvas) || !Number.isFinite(count) || count <= 0) return 0;
    return Math.max(0, Math.floor((viewport - canvas) / count));
  }

  _fitSummaryScenes() {
    if (!this.shadowRoot || this._view !== "status") return;
    const content = this.shadowRoot.getElementById("content");
    const canvas = content?.querySelector(":scope > .zoom-workspace");
    const heroes = [...(canvas?.querySelectorAll(".dual-summary > .target-card > .target-hero") || [])];
    if (!content || !canvas || !heroes.length || content.clientHeight <= 0) return;

    heroes.forEach((hero) => hero.style.removeProperty("min-height"));
    const baseHeights = heroes.map((hero) => Number.parseFloat(getComputedStyle(hero).minHeight));
    const canvasHeight = Math.max(canvas.scrollHeight, canvas.offsetHeight);
    const growth = this._summarySceneGrowth(content.clientHeight, canvasHeight, heroes.length);
    if (!growth) return;

    heroes.forEach((hero, index) => {
      const baseHeight = Number.isFinite(baseHeights[index]) ? baseHeights[index] : hero.offsetHeight;
      hero.style.setProperty("min-height", `${Math.floor(baseHeight + growth)}px`, "important");
    });
  }

  _installSummarySceneFit() {
    this._summarySceneResizeObserver?.disconnect();
    this._summarySceneResizeObserver = null;
    if (!this.shadowRoot || !this._mobileOnly() || this._view !== "status") return;

    const content = this.shadowRoot.getElementById("content");
    if (!content) return;
    this._fitSummaryScenes();
    window.requestAnimationFrame?.(() => this._fitSummaryScenes());
    this._summarySceneResizeObserver = new ResizeObserver(() => this._fitSummaryScenes());
    this._summarySceneResizeObserver.observe(content);
  }

  _installCommonHeader() {
    super._installCommonHeader();
    if (!this.shadowRoot) return;
    const title = this.shadowRoot.querySelector(".nika-title span");
    if (title) title.textContent = `Автомобили · UI v${UI_VERSION}`;
  }

  _render() {
    super._render();
    if (!this.shadowRoot || !this._mobileOnly()) {
      this._summarySceneResizeObserver?.disconnect();
      this._summarySceneResizeObserver = null;
      return;
    }

    if (!this.shadowRoot.querySelector("style[data-starline-summary-v018]")) {
      const style = document.createElement("style");
      style.dataset.starlineSummaryV018 = "true";
      style.textContent = `
        .summary-connection {
          left:8px !important;
          right:auto !important;
        }
        .summary-security.armed {
          border-color:color-mix(in srgb,#0b67b2 34%,rgba(255,255,255,.9)) !important;
          background:color-mix(in srgb,#e7f5ff 92%,transparent) !important;
          box-shadow:0 3px 12px rgba(11,103,178,.18) !important;
        }
        .summary-security.armed ha-icon,
        .summary-security.armed strong {
          color:#0b67b2 !important;
        }
        .summary-security.alarm {
          border-color:color-mix(in srgb,var(--danger) 36%,rgba(255,255,255,.9)) !important;
          background:color-mix(in srgb,var(--danger) 10%,rgba(255,255,255,.94)) !important;
          box-shadow:0 3px 12px color-mix(in srgb,var(--danger) 18%,transparent) !important;
        }
        .summary-security.alarm ha-icon,
        .summary-security.alarm strong {
          color:var(--danger) !important;
        }
        .summary-security.disarmed {
          border-color:rgba(255,255,255,.9) !important;
          background:rgba(255,255,255,.88) !important;
        }
        .summary-security.disarmed ha-icon {
          color:var(--secondary-text-color,var(--muted)) !important;
        }
        .summary-security.disarmed strong {
          color:var(--primary-text-color) !important;
        }
      `;
      this.shadowRoot.append(style);
    }
    this._installSummarySceneFit();
  }
}

if (!customElements.get("starline-app-panel-v018")) {
  customElements.define("starline-app-panel-v018", StarLineAppPanelV018);
}

if (!customElements.get("starline-app-panel")) {
  customElements.define("starline-app-panel", class extends StarLineAppPanelV018 {});
}
