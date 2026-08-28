# StarLine specialized-panel compliance

Audit target: UI/integration 0.6.1 against NikaS specialized-panel standard v1.7. Static bundle checks pass; final iPhone field acceptance remains required.

| Requirement | Status | Evidence / required follow-up |
|---|---|---|
| Integration-owned route and declared production entry | PASS | `panel.py` and `frontend/panel_manifest.json` agree on `/starline`, autonomous `starline-app.js` and stable `starline-app-panel`. |
| Exactly one work canvas; focal pinch; 75–200%; persistence; reset/snap | PASS | Final component owns one `.viewport > .canvas`, persists per vehicle and implements focal pinch, 97–103% snap, two-finger reset and toast. |
| 100% native vertical scroll; `x=y=0`; no one-finger pan | PASS | `ZoomController._normalized()` forces origin through 100%; `.viewport` uses `overflow-y:auto`, `overflow-x:hidden`, `touch-action:pan-y`; one-pointer pan is not created below enlargement. |
| Pan only above 100% and only on overflowing axes | PASS | `ZoomController._bounds()` locks fitting axes to zero; pan starts only when the saved scale is greater than 1. |
| Real-edge clamp and resize re-clamp | PASS | Bounds use actual scaled canvas/viewport dimensions and the owned `ResizeObserver` reapplies the clamp. |
| Tab change returns native work scroll to top and revalidates offsets | PASS | `_setView()` resets native work scroll; the transform state remains normalized and is re-clamped by the controller. |
| Interaction guard for pinch/pan | PASS | 100% leaves native pan/taps alone; two-finger pinch and enlarged pan retain pointer-cancel and post-gesture click guards. |
| Menu and refresh use `ha-icon`; menu emits `hass-toggle-menu` | PASS | The stable shell uses `mdi:menu`/`mdi:refresh`; menu dispatch is bubbling/composed. |
| Header UPS geometry and matching plaques | PASS | The shell sets 52px rails, 44px bordered plaques, radius 16, icons 25 and 23/14 title typography with a 21/13 narrow-phone floor. |
| iPhone top safe area counted exactly once | PASS / FIELD CHECK | Header height and top padding consume `env(safe-area-inset-top)`; the Summary card fills the remaining fixed-shell grid viewport rather than subtracting guessed `100dvh` constants. |
| Refresh on a matching right plaque | PASS | `.header-control.refresh` shares the menu plaque geometry and uses the accent color. |
| Fixed full-width safe-area Bottom Tab Bar using `ha-icon` | PASS | `.bottom-nav` is edge-attached outside `.viewport`, includes safe-area bottom padding and uses MDI `ha-icon`. |
| Bottom target/icon/label/active geometry | PASS | Final cascade enforces ≥52px targets, 28px icons, 12px/700 labels and 11% active fill. |
| Packaged integration icon | PASS | Approved local asset exists at `custom_components/starline_telemetry/brand/icon.png` (256×256 PNG); package domain is `starline_telemetry`. |
| README installation/domain identity | PASS | README shows the approved icon and documents both HACS Integration installation and the `custom_components/starline_telemetry` manual path. |
| Repository visual identity | PASS / MANUAL | README surfaces the approved packaged icon. GitHub avatar/social preview still needs a manual repository-settings check. |
| Optional logo/light/dark variants | GAP (non-blocking) | Only `brand/icon.png` exists. Add variants only from an approved StarLine source if contrast testing proves they are needed; do not generate replacements. |
| Stable production module | PASS | `scripts/build_frontend_bundle.py` deterministically copies one `starline-panel-source.js` runtime into autonomous `frontend/starline-app.js`; production registration loads only that import-free module. |
| Stable shell and point patching | PASS | The constructor mounts Header, selector, viewport/canvas and navigation once; routine `hass` changes coalesce into `_patchAll()` without assigning `shadowRoot.innerHTML`. |
| Lazy cached views and stable images/maps | PASS | Views and per-vehicle panes are created once and reused; car `src` changes only when the scene asset changes and map cards are cached per vehicle. |
| Safe title navigation | PASS | The title resolves an allowed originating base route and uses `history.pushState()` plus `location-changed`; it never calls `history.back()`. |

## Remaining field checks

1. Confirm native scrolling on long History/Trips/Diagnostics views at 100% in the iPhone Companion App.
2. Confirm the fixed `130 / 683` selector on all four views and the Header and Bottom Tab Bar at every scale.
3. Confirm focal pinch, axis locks, long press, `more-info`, reset toast and safe areas on device.
4. Confirm all state-scene variants on both cars: their visible alpha frames must retain the common 72% width, horizontal centre and wheel line.

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

## v0.5.4 split Summary pages

- The combined two-card Summary is split into separate initial pages for 130 and 683.
- The fixed vehicle selector changes the active initial page without changing the Bottom Tab Bar.
- One selected vehicle card receives the full available Summary height; approved metrics, status rows, connection and security states remain unchanged.
- History and statistics behavior remain unchanged.

## v0.5.5 state-aware scene delta

- Each car has packaged engine-running, doors-open, hood-open and trunk-open image variants.
- Image selection follows a deterministic priority: hood, trunk, doors, engine, default.
- Armed and alarm fields are independent static overlays; unavailable state desaturates the scene without hiding it.
- Security no longer reports the ambiguous fallback `Норма`; missing armed-state telemetry is shown as `Нет данных`.
- Operational values may use two lines without reducing the approved typography floor.
- History and statistics behavior remain unchanged.

## v0.5.6 security and geometry delta

- Armed state uses the dedicated StarLine security entity; central locking cannot report security state.
- Alarm still overrides the ordinary armed field and missing security telemetry remains explicit.
- Per-vehicle geometry enlarges and lowers every state image while retaining a stable wheel line.
- Header, fixed vehicle selector, Bottom Tab Bar, typography floors, zoom, history and statistics remain unchanged.

## v0.5.7 armed state and scene-height correction

- Home Assistant core StarLine `lock` is restored as an official security-mode source because the core entity maps directly to the StarLine `arm` state.
- All explicit StarLine security signals are evaluated; an active source wins over a conflicting inactive source so the panel cannot falsely claim that protection is removed.
- Both vehicles and their security field move substantially upward while retaining the approved per-vehicle size and horizontal geometry.
- Header, selector, Bottom Tab Bar, typography, zoom, history and statistics remain unchanged.

## v0.5.8 centred live-security correction

- Each transparent vehicle asset is centred on the photo scene with a common 50% horizontal anchor; right-edge offsets and clipping are removed.
- Per-vehicle vertical offsets compensate for different source-image aspect ratios so default and state variants retain one visual centre.
- Summary bootstrap reads the current `arm` value from the official read-only StarLine device-data endpoint and caches it for 60 seconds.
- The Header refresh button forces a current read-only vehicle-state refresh instead of only reloading panel configuration.
- The security field shares the vehicle centre; metric labels may wrap without reducing their approved font size.
- History, statistics, navigation and zoom behavior remain unchanged.

## v0.5.9 grounded security-dome correction

- Both centred vehicle layers move 70 px downward so their wheels sit in the visual centre of the free photo scene instead of floating above it.
- The armed/alarm field is a grounded half-dome with a flat baseline aligned to the wheel line; the former closed oval is removed.
- Vehicle scale and the common horizontal centre remain unchanged for every state asset.
- The engine-temperature metric receives internal width from icon gap and padding, without reducing its text-size floor or badge size.
- Live security, refresh, history, statistics, navigation and zoom behavior remain unchanged.

## v0.5.10 open-base security-dome correction

- The security dome retains its upper arc and soft translucent fill but no longer draws a horizontal baseline beneath the vehicle.
- The approved vehicle size, horizontal centre, vertical grounding and metric layout remain unchanged.
- Live security state, typography, history, statistics, navigation and zoom behavior remain unchanged.
