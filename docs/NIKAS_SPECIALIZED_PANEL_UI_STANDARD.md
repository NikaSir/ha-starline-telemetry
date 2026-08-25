# NikaS Specialized Panel UI Standard v1.1

**Status:** REQUIRED  
**Canonical source:** `NikaSir/ha-contract-generated-ui`  
**Canonical documents:** `docs/SPECIALIZED_PANEL_SHELL_STANDARD.md`, `docs/SPECIALIZED_PANEL_ZOOM_STANDARD.md`  
**Local role:** synchronized implementation snapshot; do not create repository-specific variants.

## Ownership boundary

This repository owns domain/integration UI: entities, telemetry, commands, cards, device/domain semantics and diagnostics. The shared shell owns safe areas, Header, Home Assistant main-menu button, zoom controls, zoomable work viewport and Bottom Tab Bar.

**Migration rule:** do not refactor domain UI while adopting the shell. First migrate only Safe Area / Header / HA main-menu button / Zoom / Bottom Tab Bar. Domain behavior must remain functionally unchanged.

## Header and safe area

- Respect all `env(safe-area-inset-*, 0px)` values.
- No title or control may render under a notch or Dynamic Island.
- Do not use device-specific offsets such as `top: 47px`.
- **The permanent left Header control is always the Home Assistant main-system menu button (`☰`), never Back.**
- The menu button opens/toggles the standard Home Assistant main navigation/sidebar/drawer.
- A specialized panel must not replace the left rail with browser Back, a parent-route Back button, an integration menu or a device action.
- Title is geometrically centered; at most one shell-level action is placed on the right.
- Left/right rails should be symmetric; touch targets approximately 44×44 pt or larger.
- Header remains at native scale and does not participate in user zoom.

Logical parent/drill-down navigation may exist elsewhere in the panel when required, but it is not the permanent left shell control.

## Bottom Tab Bar

- Primary in-app navigation with 3–5 sections uses one full-width fixed Bottom Tab Bar.
- It is edge-attached, not a floating card/pill.
- It respects `env(safe-area-inset-bottom, 0px)` and the iOS Home Indicator.
- Active tab is unambiguous; items use icon + short label.
- Final work content scrolls fully above the bar.
- Bottom Tab Bar remains at native scale.

## Zoom

Every specialized panel supports pinch-to-zoom and on-screen `− / percentage / +` controls.

Defaults: **75–200%**, step **10%**, tap percentage → **100%**.

Pinch scales around the point between the fingers; enlarged content can pan/scroll; only the work viewport scales. Home Assistant chrome, Header, permanent HA main-menu button, zoom controls and Bottom Tab Bar remain native-sized. Scale persists locally per panel/client; responsive layout is selected before zoom; zoom must not alter entity semantics, thresholds, `unknown/unavailable`, routes, confirmations or commands.

## Prohibited patterns

Do not introduce repository-specific Header/Bottom Tab Bar geometry, permanent Back in the left Header rail, independent incompatible zoom, whole-page zoom, hard-coded notch/Home Indicator offsets, or simultaneous domain refactor during shell migration.

## Acceptance

A migration is accepted only when existing domain behavior is preserved and the panel additionally has: safe Header below the notch/Dynamic Island, **HA main-system menu permanently on the left**, fixed full-width bottom navigation above the Home Indicator, pinch + `−/%/+`, focal-point zoom, pan/scroll when enlarged, 100% reset, per-panel persistence, and native-sized shell navigation.

> Canonical policy remains in `ha-contract-generated-ui`. If this snapshot conflicts with a newer canonical standard, the canonical standard wins and this local copy must be synchronized.
