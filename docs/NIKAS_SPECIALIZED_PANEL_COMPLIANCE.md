# StarLine specialized-panel compliance

Audit target: UI/integration 0.5.0. Static bundle checks pass; final iPhone field acceptance remains required.

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
2. Confirm the fixed two-vehicle selector, Header and Bottom Tab Bar at every scale.
3. Confirm focal pinch, axis locks, long press, `more-info`, reset toast and safe areas on device.
