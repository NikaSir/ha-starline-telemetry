# NikaS Specialized Panel UI Standard v1.6

**Status:** REQUIRED  
**Canonical source:** `NikaSir/ha-contract-generated-ui`  
**Applies to:** every integration-owned specialized Home Assistant panel  
**Primary acceptance viewport:** Home Assistant Companion App on iPhone Pro Max, portrait  
**Reference shell:** Stark SolarPower / UPS  
**Reference typography and status treatment:** LIDER

This document supersedes every earlier shell, Header/Back, zoom, scrolling, rendering, connection-indicator, typography and Bottom Tab Bar rule. Historical documents remain useful only where they do not conflict with this standard.

## 1. Ownership and topology

```text
HEADER                                      native scale, stationary
OPTIONAL PEER DEVICE SELECTOR               native scale, stationary
EXACTLY ONE WORK VIEWPORT                   sole scroll/zoom owner
BOTTOM TAB BAR                              native scale, stationary
```

- Only Work Viewport content scales or scrolls.
- Header, peer selector, Bottom Tab Bar and safe-area surfaces never scale or move with content.
- Exactly one active zoom viewport may exist per panel instance. Nested or repeatedly wrapped zoom containers are prohibited.
- The effective iOS safe area is consumed exactly once at each edge.
- The outer panel shell occupies the available visual viewport, does not page-scroll and does not shrink to short content.
- Work Viewport is the sole native scroll owner. Scroll chaining into Home Assistant's outer container must be prevented.
- Header and Bottom Tab Bar must be outside the scrolling and transformed subtree. `position: sticky` inside a Home Assistant scroller is not a sufficient fixation mechanism.
- A fixed-position shell or non-scrolling fixed-height grid is conforming only if phone acceptance proves that Header and Bottom Tab Bar retain the same screen coordinates during scroll, inertia and boundary pull.

## 2. Header — UPS reference geometry

- Grid: `52px minmax(0,1fr) 52px`; on very narrow phones: `48px minmax(0,1fr) 48px`.
- Minimum shell height: approximately `62px`, plus the effective top safe area.
- Title remains geometrically centered regardless of side actions.
- Primary title: `23px / 800` on wider surfaces and `21px / 800` on phones, one line.
- Secondary/version line: `14px / ~560` on wider surfaces and `13px / ~560` on phones, in `var(--secondary-text-color)`.
- The permanent left action is only Home Assistant system menu `mdi:menu`; it dispatches a bubbling and composed `hass-toggle-menu` event.
- At most one panel-global action occupies the right rail. Refresh uses `mdi:refresh`.
- Menu and Refresh are matching plaques: `44px × 44px`, `16px` radius, `1px` divider border, `var(--card-background-color)` background, subtle UPS-style shadow and `25px` `ha-icon` glyph.
- Menu glyph uses `var(--primary-text-color)`; Refresh uses `var(--primary-color)`.
- A transparent Refresh rail is non-conforming.
- Permanent Back, browser history, an integration drawer, a device command or a decorative brand icon is prohibited in the left rail. Parent navigation belongs inside Work Viewport.

## 3. Peer Device Selector

- Device Selector is used only for peer physical devices of the same integration, for example `UPS Интернет / UPS Котёл`.
- It remains directly below Header, outside Work Viewport and at native scale.
- Selected peer persists across tabs and has its own locally stored scale.
- A single system, functional zone or subsection is not a peer-device selector.

## 4. Work Viewport at 100%

At exactly `scale = 1`:

- `x = 0` and `y = 0` are invariant transform coordinates;
- one-finger transform panning is disabled;
- normal native vertical scrolling is enabled inside Work Viewport;
- horizontal scrolling and horizontal overscroll are disabled;
- the canvas cannot be pulled sideways, below the top origin or beyond its real lower edge;
- clicks, stationary hold-to-more-info and vertical scrolling start without a gesture delay;
- stored transforms are normalized to `{scale:1,x:0,y:0}` before display.

The retired always-transform-pan-at-100% model must not be restored.

## 5. Zoom and enlarged pan

- Pinch uses two fingers and preserves the focal midpoint.
- Scale range is `75–200%`.
- Permanent on-screen zoom controls are prohibited.
- Pinch ending within `97–103%` snaps to exactly 100% and origin.
- Two-finger double tap resets scale, transform and native scroll to 100%/origin and briefly shows `Масштаб 100%`.
- Scale persists locally per panel/client and per selected peer device where applicable.
- One-finger transform panning is enabled only when `scale > 1`.
- Each axis is enabled only when scaled content exceeds Work Viewport on that axis.
- Translation is clamped to factual content edges; exposing an empty field is prohibited.
- Resize, orientation change, content reflow, peer switch and tab change re-run bounds clamping.
- Tab change returns Work Viewport to the page start and removes invalid translation; stored scale may remain.

## 6. Gesture and native-interaction protection

- Appearance of a second pointer immediately cancels pending more-info/long-press handling.
- Movement beyond the tap tolerance sends or emulates `pointercancel` for the pending hold.
- Synthetic clicks produced after pinch or pan are briefly suppressed.
- Intentional stationary long press continues to open native Home Assistant more-info.
- Pinch and two-finger reset must never open a chart, history or more-info card.
- At 100%, ordinary one-finger scrolling and taps must not be delayed by pan arbitration.

## 7. Bottom Tab Bar and short views — UPS reference geometry

- Use one fixed, edge-attached, full-width Bottom Tab Bar, never a floating card or pill.
- It remains outside Work Viewport, outside the transform and above the Home Indicator.
- Background is `var(--card-background-color)` with a top divider and subtle upward shadow.
- Insets are approximately `4px` top and `calc(4px + env(safe-area-inset-bottom))` bottom, with safe left/right padding.
- Use 3–5 equal-width primary destinations.
- Minimum tab touch-target height is `52px`; radius is `13–14px`.
- Icons are MDI through `ha-icon`, never text characters; canonical glyph size is `28px`.
- Labels are one line, `12px / 700`, readable and ellipsized only when necessary.
- Inactive icon/label use `var(--secondary-text-color)`.
- Active icon/label use `var(--primary-color)` with an approximately 11% primary-color background and no second shadow.
- A short view fills the shell's available work height and must not pull either menu toward its content.
- A long view scrolls only inside Work Viewport; its final control/card must be fully reachable above Bottom Tab Bar.
- Controls must never be hidden beneath Bottom Tab Bar or its safe area.

## 8. Stable DOM and flicker-free live updates

- The shell and active view structure are mounted once. `shadowRoot.innerHTML` or whole-tree `replaceChildren()` is allowed only for initial mount.
- Home Assistant `hass` updates must normalize state, compare with the previous view model and patch only changed text nodes, classes, attributes, styles and accessibility values.
- Header, selector, Work Viewport, canvas, images, tabs and Bottom Tab Bar retain DOM identity across normal polling.
- `requestAnimationFrame` may batch point updates; wrapping a full redraw in `requestAnimationFrame` is still non-conforming.
- Delaying a full redraw until 180 ms after scroll or gesture completion is not a flicker fix.
- Event listeners, styles and gesture engines are installed once and are not duplicated on telemetry updates.
- Exact telemetry age or an unchanged poll result must not be a structural-render key.
- Images are preloaded/decoded where practical. An unchanged image must not receive the same `src` again.
- A full-screen loading state is allowed only during initial mount. Later loss, stale data or recovery updates existing content in place.
- Tabs are mounted once, or lazily once on first use, then preserved and switched through state/classes, `hidden` and `inert`; a blank intermediate frame is prohibited.
- Telemetry updates during upward/downward scroll, inertia, pinch or enlarged pan must not interrupt the gesture, jump the scroll position, reload imagery or move either menu.
- A semantic indicator change updates only the indicator nodes; it never redraws the surrounding card or panel.

## 9. Optional connection and data-freshness indicator

### 9.1 Application policy

- The two-level indicator is opt-in and is introduced only by an explicit panel requirement.
- Its absence is not a compliance gap unless the repository-specific compliance record explicitly enables it.
- It is explicitly not introduced in `Дом сейчас` or StarLine.
- An indicator approved for one integration must not be copied automatically to other panels.

### 9.2 Connection channel — primary line

Allowed Russian labels:

- `Локально` — the device-to-Home-Assistant path does not require an external cloud;
- `Облако` — the data path depends on an external cloud service;
- `Резерв` — the primary channel has failed and the configured fallback is actually carrying data;
- `Нет связи` — the active device/channel is not responding;
- `Нет данных` — channel state cannot be determined.

`Онлайн` is prohibited because it hides the actual path.

Local includes Tuya Local/Tuya LAN, Zigbee2MQTT through a local MQTT broker, local MQTT, LAN/API, Modbus and SNMP. Tuya Cloud and other required external vendor services are Cloud. Merely having a configured standby path does not justify `Резерв`.

Primary channel colors:

- `Локально`, `Облако` — success green;
- `Резерв` — warning orange;
- `Нет связи` — error red;
- `Нет данных` — neutral gray.

### 9.3 Data freshness — secondary line

Allowed Russian labels:

- `Данные актуальны` — a successful current sample was accepted;
- `Данные устарели` — a cached prior sample is shown;
- `Нет данных` — no trustworthy sample exists.

A failed current poll immediately makes preserved telemetry `Данные устарели`; cached values must never remain visually current. Unless an integration defines a justified threshold, data also become stale after three normal polling intervals. Recovery becomes current only after a new successful sample is accepted.

The indicator describes transport and freshness, not device operating mode. For example, a vacuum may be `Локально · Данные актуальны` while docked, charging or cleaning.

### 9.4 Indicator geometry and status-colored surface

- Use one compact two-line plaque with stable dimensions sized for the longest allowed label.
- The status lamp is fully inside the plaque: `8–10px` diameter with `10–12px` gap to text.
- Minimum inner padding is approximately `12px` vertical and `14px` horizontal; radius is approximately `18px`.
- Primary line is `15px / 700`; secondary line is `12px / 550–600`.
- The primary status color controls the primary text, lamp, border and a light plaque tint, following LIDER.
- Recommended tint: mix the primary status color at approximately `8–12%` into `var(--card-background-color)`.
- Recommended border: approximately `28–32%` of the same status color.
- `Локально`/`Облако`: approximately 11% green tint; `Резерв`: approximately 12% orange; `Нет связи`: approximately 10% red; `Нет данных`: approximately 8% neutral gray.
- The freshness line keeps its own semantic color independently of the plaque: current uses secondary/neutral text, stale uses warning orange, no data uses disabled/neutral text.
- Color is always accompanied by text. Solid saturated fills, flashing, pulsing and repeated entrance animation are prohibited.

## 10. Typography — LIDER reference scale

Font sizes are defined at Work Viewport scale 100%.

- Absolute range: `9–25px`.
- Normal readable interface range: `12–25px`.
- `9–10px`: redundant, non-interactive annotations inside a visual schematic only.
- `11px`: short technical schematic designations only.
- `12px`: minimum for navigation, buttons, units, auxiliary states and the indicator secondary line.
- `13–15px`: body copy, card labels and ordinary states.
- `17–18px`: section headings.
- `18–20px`: primary measurements and values.
- `22–25px`: primary Work Viewport heading/hero title.

Sizes `9–11px` are prohibited for actions, navigation, alarms, connection states, essential telemetry or decision-making text. When content does not fit, change layout, wrapping, spacing or card dimensions; do not shrink meaningful text below its role minimum. Responsive `clamp()` rules must preserve these floors.

## 11. Brand, repository and integration identity

- Every project repository contains a recognizable repository identity asset used in README/project surfaces, normally `assets/icon.png` or the documented equivalent.
- Every shipped integration contains a non-empty packaged `custom_components/<domain>/brand/icon.png`; this is the minimum integration/HACS brand asset.
- `brand/logo.png`, `brand/dark_icon.png` and `brand/dark_logo.png` are added when the mark or wordmark is not legible in both themes.
- README, repository identity and installed integration use the same recognizable visual identity.
- A bootstrap repository without an integration keeps its repository icon now and adds the packaged integration brand when `custom_components/<domain>` is introduced.
- Brand art is not placed beside the centered Header title.
- Changed raster assets use deterministic cache/version handling when served by the panel.

## 12. Required repository guards and compliance record

Every repository maintains `docs/NIKAS_SPECIALIZED_PANEL_COMPLIANCE.md` or an equivalent explicit record covering:

1. fixed shell and sole scroll-owner topology;
2. exactly one work/zoom viewport;
3. no permanent zoom controls;
4. `hass-toggle-menu`, `mdi:menu` and matching Header plaques;
5. 100% native vertical scroll with origin lock;
6. axis-aware enlarged pan and resize/tab/peer re-clamp;
7. two-finger reset and interaction guards;
8. stationary Header/selector/Bottom Tab Bar, including short views;
9. stable DOM and point-only telemetry/indicator updates;
10. optional-indicator policy and the panel's explicit local decision;
11. LIDER typography limits;
12. repository and packaged integration icons;
13. JavaScript syntax, package validation, HACS and Hassfest where applicable.

Unimplemented runtime behavior is recorded as `GAP`, never as an assumed `PASS`.

## 13. Mandatory iPhone acceptance

- Header and Bottom Tab Bar keep identical screen coordinates during upward/downward scroll, inertia, boundary pull, pinch and enlarged pan.
- Short views do not move either menu; their controls remain above Bottom Tab Bar.
- Long diagnostics views scroll vertically at 100% and their final content is reachable.
- 100% cannot move horizontally or be pulled away from the top origin.
- Enlarged content pans only on necessary axes and never exposes empty field.
- Release preserves clamped position without rebound or snap-back.
- Two-finger reset works and never opens history/more-info.
- Card activation does not become accidental pan; intentional stationary hold still opens more-info.
- Several live polling cycles during upward scroll produce no white flash, loading screen, image reload, scroll jump or menu movement.
- At least ten consecutive tab switches produce no blank frame or duplicated viewport.
- Loss/recovery changes indicator and telemetry in place; cached values are visibly stale.
- Meaningful text is never below `12px`; indicator is `15px/12px` with LIDER-style tinted surface.
- `Дом сейчас` and StarLine contain no optional connection/freshness indicator.
- Repository and installed integration identity icons are present and recognizable.
