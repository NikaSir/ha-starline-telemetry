# StarLine specialized-panel compliance

Audit target: UI/integration 0.5.4, NikaS UI standard v1.8 and navigation contract v1.0. Automated checks pass; final iPhone field acceptance remains required.

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
| Header UPS geometry and matching plaques | PASS | Final cascade sets 52/48 rails, 62/60 height, 44px bordered card plaques, radius 16, icons 25 and 23/14 title typography (21/13 narrow). |
| Refresh on a matching right plaque | PASS | `.nika-refresh` uses the same card plaque as menu and `var(--primary-color)`. |
| Fixed full-width safe-area Bottom Tab Bar using `ha-icon` | PASS | Base `nav` is edge-attached, outside `#content`, includes safe-area bottom padding, divider/shadow and uses MDI `ha-icon`. |
| Bottom target/icon/label/active geometry | PASS | Final cascade enforces ≥52px targets, 28px icons, 12px/700 labels and 11% active fill. |
| Packaged integration icon | PASS | Approved local asset exists at `custom_components/starline_telemetry/brand/icon.png` (256×256 PNG); package domain is `starline_telemetry`. |
| README installation/domain identity | PASS | README shows the approved icon and documents both HACS Integration installation and the `custom_components/starline_telemetry` manual path. |
| Repository visual identity | PASS / MANUAL | README surfaces the approved packaged icon. GitHub avatar/social preview still needs a manual repository-settings check. |
| Optional logo/light/dark variants | GAP (non-blocking) | Only `brand/icon.png` exists. Add variants only from an approved StarLine source if contrast testing proves they are needed; do not generate replacements. |
| Stable production module | PASS | `scripts/build_frontend_bundle.py` deterministically produces autonomous `frontend/starline-app.js`; production registration loads only that import-free module. |
| Stable shell and telemetry patching | PASS | v019 mounts the shell once, coalesces `hass` changes to one animation frame and morphs only the active `.shell`; it never reassigns `shadowRoot.innerHTML` during routine telemetry. |
| Lazy tab/vehicle cache | PASS | v019 caches the actual work subtree per tab/vehicle, restores the same subtree on return and preserves embedded HA map cards. |
| Fixed Header/selector/Bottom Bar | PASS / FIELD | The phone host is height-locked and only `#content` owns scrolling. Confirm stationary coordinates during iPhone upward/downward scroll. |
| Meaningful typography 12–25px | PASS | v019 overrides meaningful captions/statuses to at least 12px and the summary identity to 25px; 9px remains only on redundant route-schematic labels. |
| Optional connection/freshness indicator | NOT REQUESTED / PASS | StarLine does not instantiate the canonical two-level transport/freshness indicator. Its domain-specific GSM/GPS telemetry remains a separate factual metric. |

## Remaining field checks

1. Confirm native scrolling on long History/Trips/Diagnostics views at 100% in the iPhone Companion App.
2. Confirm the persistent vehicle selector on History/Trips/Diagnostics, its hidden state on Summary, and the stationary Header and Bottom Tab Bar at every scale.
3. Confirm focal pinch, axis locks, long press, `more-info`, reset toast and safe areas on device.
4. Leave the panel open through repeated telemetry polls and move between cached tabs; confirm there is no white flash, image remount or map reload.

## v0.5.4 UI standard v1.7 delta

- v019 extends the current v0.5.3 Summary/scene/security implementation; none of those visual or alarm-state fixes are reverted.
- Header, optional vehicle selector, one viewport/canvas and Bottom Tab Bar remain mounted while routine telemetry patches the existing active work subtree.
- Work views are lazily cached by tab and selected vehicle. A cached embedded map is detached and restored around state patching instead of being recreated on every poll.
- `hass` updates are coalesced to at most one animation frame. Unchanged state signatures do not write the DOM.
- Tab changes return native scroll and transform offsets to the page start while retaining the selected scale; vehicle changes restore that vehicle's locally persisted transform before its work view is shown.
- The phone application shell is height-locked so the outer Home Assistant document cannot become the scrolling surface.
- Meaningful text follows the 12–25px envelope, with a 9px exception only for redundant route-schematic labels.
- The optional two-level connection/freshness indicator remains absent from StarLine until explicitly requested.

## UI standard v1.8 navigation delta

- `/starline` remains the sole registered public route; `/dashboard-starline` is invalid.
- House return is normalized to `/dashboard-house-v11/home`.
- The one-shot source handoff consumes both route and timestamp and never uses browser-history back navigation.

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
