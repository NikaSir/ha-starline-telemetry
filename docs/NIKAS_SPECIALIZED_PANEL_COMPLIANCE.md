# StarLine specialized-panel compliance

Audit target: UI/integration 0.5.3. Static bundle checks pass; final iPhone field acceptance remains required.

| Requirement | Status | Evidence / required follow-up |
|---|---|---|
| Integration-owned route and declared production entry | PASS | `panel.py` and `frontend/panel_manifest.json` agree on `/starline`, autonomous `starline-app.js` and stable `starline-app-panel`. |
| Exactly one work canvas; focal pinch; 75–200%; persistence; reset/snap | PASS | Final component owns one `.zoom-workspace`, persists per vehicle and implements focal pinch, 97–103% snap, two-finger reset and toast. |
| 100% native vertical scroll; `x=y=0`; no one-finger pan | PASS | Final overrides force origin through 100%; `#content` uses `overflow-y:auto`, `overflow-x:hidden`, `touch-action:pan-y`; one-pointer pan is not created below enlargement. |
| Pan only above 100% and only on overflowing axes | PASS | Final `_canvasBounds()` locks fitting axes to zero; pan starts only when the saved scale is greater than 1. |
| Real-edge clamp and resize re-clamp | PASS | Bounds use actual scaled canvas/viewport dimensions and inherited `ResizeObserver` reapplies the final clamp. |
| Tab change returns native work scroll to top and revalidates offsets | PASS | Final `_setView()` resets offsets, native scroll and reapplies bounds while retaining scale. |
| Interaction guard for pinch/pan | PASS | 100% leaves native pan/taps alone; two-finger pinch and enlarged pan retain pointer-cancel and post-gesture click guards. |
| Menu and refresh use `ha-icon`; menu emits `hass-toggle-menu` | PASS | Base panel uses `mdi:menu`/`mdi:refresh`; menu dispatch is bubbling/composed. v008 installs the common mobile Header. |
| Header UPS geometry and matching plaques | PASS | Final cascade sets 52/48 rails, 62/60 height, 44px bordered card plaques, radius 16, icons 25 and 21/12 title typography. |
| Refresh on a matching right plaque | PASS | `.nika-refresh` uses the same card plaque as menu and `var(--primary-color)`. |
| Fixed full-width safe-area Bottom Tab Bar using `ha-icon` | PASS | Base `nav` is edge-attached, outside `#content`, includes safe-area bottom padding, divider/shadow and uses MDI `ha-icon`. |
| Bottom target/icon/label/active geometry | PASS | Final cascade enforces ≥52px targets, 28px icons, 12px/700 labels and 11% active fill. |
| Packaged integration icon | PASS | Approved local asset exists at `custom_components/starline_telemetry/brand/icon.png` (256×256 PNG); package domain is `starline_telemetry`. |
| README installation/domain identity | PASS | README shows the approved icon and documents both HACS Integration installation and the `custom_components/starline_telemetry` manual path. |
| Repository visual identity | PASS / MANUAL | README surfaces the approved packaged icon. GitHub avatar/social preview still needs a manual repository-settings check. |
| Optional logo/light/dark variants | GAP (non-blocking) | Only `brand/icon.png` exists. Add variants only from an approved StarLine source if contrast testing proves they are needed; do not generate replacements. |
| Stable production module | PASS | `scripts/build_frontend_bundle.py` deterministically produces autonomous `frontend/starline-app.js`; production registration loads only that import-free module. |

## Remaining field checks

1. Confirm native scrolling on long History/Trips/Diagnostics views at 100% in the iPhone Companion App.
2. Confirm the vehicle selector on History/Trips/Diagnostics, its absence on Summary, and the Header and Bottom Tab Bar at every scale.
3. Confirm focal pinch, axis locks, long press, `more-info`, reset toast and safe areas on device.

## v0.5.1 history and typography delta

- The autonomous production bundle now ends with v016, while `panel.py` and the manifest retain the stable `starline-app.js` / `starline-app-panel` entry.
- History prefers StarLine's read-only journal timestamp and official event-description library; Recorder is an explicitly labelled fallback limited to confirmed state transitions.
- History rows use the reference-app hierarchy of time plus action without a competing icon. Time is 16px, actions are 18px and responsive rules do not reduce them.
- Summary labels and values retain their reference-app typography floors without enlarging their plaques.
- The v016 clamp additionally accounts for a centered canvas offset, keeps fit axes at origin and preserves native vertical scrolling through 100%.

## v0.5.2 Summary visual delta

- The Summary screen no longer renders the redundant two-vehicle selector because both vehicle cards are already visible together.
- History, Trips and Diagnostics retain the selector so their single-vehicle content remains addressable.
- The operational row is visually ordered as engine, latest event and handbrake. The event receives the width released from the handbrake column.
- Plaque heights and the v0.5.1 typography floors are unchanged; responsive rules do not reduce corresponding text below the official StarLine reference.
- Event sources, timestamps, labels and all other history/statistics behavior remain unchanged in this visual-only pass.

## v0.5.3 scene and security visual delta

- The connection chip is moved to the free left side of each photo scene and no longer covers the vehicle layer.
- Remaining Summary viewport height is measured at runtime and divided evenly between the two photo scenes; state rows, metric plaques and typography remain unchanged.
- Armed state reads `Охрана / Включена` on a blue-tinted shield plaque. Disarmed remains neutral and alarm remains red.
- The fit is recalculated when the content viewport changes and does not alter the transform-owned scaling model.
- History sources, event timestamps, action labels and statistics remain unchanged.
