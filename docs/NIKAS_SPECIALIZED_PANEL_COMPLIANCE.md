# StarLine specialized-panel compliance

Audit target: `main` at the parent commit of this document. Runtime was inspected but intentionally not changed.

| Requirement | Status | Evidence / required follow-up |
|---|---|---|
| Integration-owned route and declared production entry | PASS | `panel.py` and `frontend/panel_manifest.json` agree on `/starline`, `starline-app-v015.js` and `starline-app-panel-v015`. |
| Exactly one work canvas; focal pinch; 75–200%; persistence; reset/snap | PASS | Active v015 imports v014, whose `.zoom-workspace`, focal transform, per-vehicle state, two-finger reset, 97–103% snap and toast implement these parts. |
| 100% native vertical scroll; `x=y=0`; no one-finger pan | GAP / CONTRADICTION | `frontend/starline-app-v014.js` starts a pan for one pointer at every scale. `_installZoomStyles()` sets `#content { overflow:hidden; touch-action:none }`, disabling native scrolling. Its bounds may also retain nonzero offsets at 100%. This is the superseded architecture. |
| Pan only above 100% and only on overflowing axes | GAP | v014 always starts pan. `_canvasBounds()` creates a movable interval even when content fits instead of locking that axis to origin. |
| Real-edge clamp and resize re-clamp | PARTIAL | v014 clamps and observes viewport/canvas resize, but its fit-axis bounds conflict with the new origin lock and it does not force 100% origin. |
| Tab change returns native work scroll to top and revalidates offsets | GAP | The active inherited `_setView()` in `starline-app-v003.js` rerenders but does not call `scrollTo(0)` or explicitly re-clamp. |
| Interaction guard for pinch/pan | PASS (enlarged mode), GAP (100%) | v014 cancels pending holds and suppresses synthetic clicks, but the same interception applies at 100%, conflicting with immediate native scroll/tap behavior. |
| Menu and refresh use `ha-icon`; menu emits `hass-toggle-menu` | PASS | Base panel uses `mdi:menu`/`mdi:refresh`; menu dispatch is bubbling/composed. v008 installs the common mobile Header. |
| Header UPS geometry and matching plaques | GAP | Active mobile CSS in `frontend/starline-app-v008.js` has 52px rails and 44px targets but Header min-height 56, radius 14, transparent/no-border buttons, icons 24, title 17/750 and subtitle 9/600. Required: 60 phone height, radius 16 card plaques with border/shadow, icons 25, title 21/800 and subtitle 12/560. |
| Refresh on a matching right plaque | GAP | `.nika-refresh` is a transparent glyph in v008, not the same bordered card plaque required for both rails. |
| Fixed full-width safe-area Bottom Tab Bar using `ha-icon` | PASS | Base `nav` is edge-attached, outside `#content`, includes safe-area bottom padding, divider/shadow and uses MDI `ha-icon`. |
| Bottom target/icon/label/active geometry | PARTIAL | Active cascade provides ≥56px targets, one-line weight-700 labels and ~11% active fill. v012/v008 leave icons at 23px and labels at 10px; required sizes are 28px and 12px. |
| Packaged integration icon | PASS | Approved local asset exists at `custom_components/starline_telemetry/brand/icon.png` (256×256 PNG); package domain is `starline_telemetry`. |
| README installation/domain identity | PARTIAL | README consistently names StarLine Telemetry and documents copying `custom_components/starline_telemetry`, but does not display the packaged icon. HACS installation as a custom Integration should be stated explicitly alongside manual installation. |
| Repository visual identity | GAP | Add the approved packaged icon to README. GitHub avatar/social preview is not represented in the checkout and needs a manual repository-settings check. |
| Optional logo/light/dark variants | GAP (non-blocking) | Only `brand/icon.png` exists. Add variants only from an approved StarLine source if contrast testing proves they are needed; do not generate replacements. |
| Stable production module | GAP | Registration selects v015, but v015 imports a runtime chain through v014 → … → v003. The existing standard requires one deterministic production entry rather than historical source modules as a runtime chain. |

## Runtime conflicts requiring a later implementation PR

1. v014 explicitly embodies the retired transform-only 100% model: `overflow:hidden`, `touch-action:none`, one-finger pan at all scales.
2. Fit-axis bounds permit movement instead of locking a non-overflowing axis to origin.
3. Header and Bottom Tab sizes are inherited through several historical modules and end below the UPS reference values.
4. Active tab switching does not restore native work scroll to top.
5. Historical runtime imports make the effective CSS/behavior difficult to audit and contradict the stable-entry delivery rule.

These gaps are documentation findings, not claims of runtime conformance.
