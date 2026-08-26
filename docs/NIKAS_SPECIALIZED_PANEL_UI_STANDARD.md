# NikaS Specialized Panel UI Standard v1.6

**Status:** REQUIRED
**Canonical source:** `NikaSir/ha-contract-generated-ui`
**Applies to:** every integration-owned specialized Home Assistant panel
**Primary acceptance viewport:** iPhone Pro Max, portrait
**Reference visual implementation:** Stark SolarPower / UPS
**Reference typography and status treatment:** LIDER

This document supersedes every earlier shell, Header, zoom, scrolling and Bottom Tab Bar rule. Historical documents remain useful only where they do not conflict with this standard.

## 1. Ownership and topology

```text
HEADER                                      native scale
DEVICE SELECTOR (peer devices only)         native scale
ONE WORK VIEWPORT                           scroll/zoom owner
BOTTOM TAB BAR                              native scale
```

- Only the work area scales.
- Header, peer selector and Bottom Tab Bar never scale or move with content.
- Exactly one zoom viewport may exist per panel instance; nested wrappers are prohibited.
- Shell reconciliation is idempotent across redraws and Home Assistant state updates.
- The effective iOS safe area is consumed exactly once.
- On phones the panel owns a height-locked application shell. The outer Home Assistant page must not become the scrolling surface: only the work viewport scrolls, so Header and Bottom Tab Bar stay at fixed screen coordinates.
- Prevent scroll chaining from the work viewport into Home Assistant's outer document. A sticky element inside the scrolling/transformed subtree does not satisfy the fixed-chrome requirement.
- Short views fill the available work row rather than shrinking the application shell and pulling either menu toward their content.

## 2. Header — UPS reference geometry

- Grid: `52px minmax(0,1fr) 52px`; on very narrow screens: `48px minmax(0,1fr) 48px`.
- Minimum height: `62px`; phone target: `60px`, plus the effective top safe area.
- Title remains geometrically centered regardless of side actions.
- Primary title: `23px`, weight `800`, one line; `21px` on very narrow phones.
- Secondary/version line: `14px`, weight approximately `560`, `var(--secondary-text-color)`; `13px` on very narrow phones.
- The permanent left action is only Home Assistant system menu `mdi:menu`; it dispatches bubbling/composed `hass-toggle-menu`.
- At most one panel-global action occupies the right rail. Refresh uses `mdi:refresh`.
- Menu and refresh are visually identical plaques: `44px × 44px`, `16px` radius, `1px` divider border, `var(--card-background-color)` background, subtle `0 7px 20px rgba(23,45,76,.08)` shadow and a `25px` `ha-icon` glyph.
- Menu glyph uses `var(--primary-text-color)`; refresh uses `var(--primary-color)`.
- A transparent refresh rail is non-conforming.
- Back, an integration drawer, a device command or a decorative brand icon is prohibited in the permanent left rail. Parent navigation belongs inside the work area.

## 3. Peer-device selector

- Use a selector only for peer physical devices of the same integration, for example `UPS Интернет / UPS Котёл`; a zone, channel or functional subsection is not automatically a peer device.
- It remains directly below Header, outside the work viewport and at native scale.
- Selected peer persists across tabs and owns its own locally persisted scale/position state.
- Hiding a selector on an aggregate view is allowed when all peers are already visible, but the same selector subtree is retained for single-peer views.

## 4. Work viewport at 100%

At exactly `scale = 1`:

- `x = 0` and `y = 0` are invariant;
- one-finger transform panning is disabled;
- normal native vertical scrolling is enabled;
- horizontal scrolling is disabled;
- the canvas cannot be pulled sideways, below the top origin or beyond its real lower edge;
- clicks, hold-to-more-info and vertical scrolling start without a gesture delay;
- stored transforms are normalized to `{scale:1,x:0,y:0}` before display.

The former rule that one-finger transform panning also provides vertical movement at 100% is retired.

## 5. Zoom and enlarged pan

- Pinch uses two fingers and preserves the focal midpoint.
- Range is `75–200%`.
- Permanent zoom buttons are prohibited.
- Pinch ending within `97–103%` snaps to exactly 100% and origin.
- Two-finger double tap resets scale, transform and native scroll to 100%/origin and briefly shows `Масштаб 100%`.
- Scale persists locally per panel/client and per selected peer device where applicable.
- One-finger transform panning is enabled only when `scale > 1`.
- Each axis is enabled only when scaled content exceeds the viewport on that axis.
- Translation is clamped to factual content edges; exposing empty canvas is prohibited.
- Resize, orientation change, content reflow, peer switch and tab change re-run bounds clamping.
- A tab change returns native scroll to the top and removes invalid translation; stored scale may remain.
- A second finger cancels pending more-info; post-gesture synthetic clicks are briefly suppressed, while intentional stationary hold still opens native more-info.
- Pinch and two-finger reset must not open history, a graph or more-info.

## 6. Bottom Tab Bar — UPS reference geometry

- One fixed, edge-attached, full-width bar; never a floating card or pill.
- It remains outside the work viewport and above the Home Indicator.
- Background: `var(--card-background-color)`; top divider and a subtle upward shadow.
- Insets: approximately `6px` top and `calc(6px + env(safe-area-inset-bottom))` bottom, with safe left/right padding.
- All destinations have equal-width columns; 3–5 primary tabs are supported.
- Tab touch target minimum height: `52px`.
- Tab radius: approximately `16px`; compact internal padding and approximately `3px` icon/label gap.
- Icons are MDI through `ha-icon`, never text characters; canonical glyph size is `28px`.
- Labels are one line, approximately `12px`, weight `700`, readable and ellipsized only when necessary.
- Inactive content uses `var(--secondary-text-color)`.
- Active icon/label use `var(--primary-color)` and an approximately 11% primary-color background, without a second shadow.
- Navigating between tabs restores the work area to the page start before interaction resumes.
- A short view must not move the bar. A long view must scroll its final control/card fully clear of the bar and Home Indicator.

## 7. Typography envelope

- Meaningful user-facing text stays within `12–25px` inclusive.
- `12px` is the minimum for captions, state freshness, navigation labels, chips and compact secondary values.
- `25px` is the maximum for a prominent live value or compact hero heading. Larger display typography is not part of the phone form baseline.
- The Header is governed by its explicit `23/14px` wide and `21/13px` narrow pairs above.
- `9–10px` is allowed only for redundant, non-interactive schematic annotations whose meaning is already conveyed elsewhere. It is prohibited for statuses, controls, navigation, entity names, measurements and required explanations.
- A layout that needs meaningful text below `12px` must be recomposed instead of shrinking the type.

## 8. Optional connection and freshness indicator

The two-level indicator is introduced only by an explicit product request. It is not a mandatory shell element. In particular, it is absent from `Дом сейчас` and StarLine until separately requested.

- The first line describes the actual data path: `Локально`, `Облако`, `Резерв`, `Нет связи` or `Нет данных`.
- `Онлайн` is not used: it duplicates `Локально`/`Облако` and hides the transport path.
- Tuya Local and Zigbee delivered through local MQTT are `Локально`; Tuya cloud and other remote cloud APIs are `Облако`.
- Local transport also includes a local LAN/API, local MQTT, Modbus and SNMP path that does not require an external vendor service.
- `Резерв` means a known fallback path is actively supplying data, not merely that fallback capability exists.
- The second line describes freshness only: `Данные актуальны`, `Данные устарели` or `Нет данных`.
- Transport and freshness are independent. For example, `Облако · Данные устарели` is valid; stale data must not be relabelled as a transport outage without evidence.
- A failed current poll makes preserved telemetry `Данные устарели`. Unless a domain documents another justified threshold, a sample also becomes stale after three normal polling intervals; it becomes current again only after a new successful sample is accepted.
- Main line: `16px/700`; freshness line: `13px/550–600`.
- The main status color drives the dot, main label, approximately `8–12%` tinted plaque background and approximately `30%` border. A current freshness line remains neutral; stale/no-data freshness uses the appropriate warning/unreliable color.
- `Локально`/`Облако` use the success color, `Резерв` warning, `Нет связи` error and `Нет данных` neutral. Color is always accompanied by text.
- The status lamp stays fully inside the plaque. Size the stable two-line surface for the longest allowed label; do not move a lamp outside its rounded background.
- Flashing, pulsing, saturated full fills and repeated entrance animations are prohibited.
- The indicator is a stable DOM subtree. State updates patch its text, classes and ARIA label; they never remount the panel or animate layout geometry.

## 9. Stable rendering and flicker prevention

- Header, peer selector, one viewport, one work canvas, persistent background and Bottom Tab Bar are mounted once per panel instance.
- A `hass` setter or telemetry timer must patch existing text, attributes, classes and CSS variables. Reassigning the panel or card `shadowRoot.innerHTML` for routine telemetry is prohibited.
- Tabs and peer-device views use lazy DOM caching. Returning to a visited view reattaches the same view subtree; it must not rebuild the application shell.
- A structural configuration change may replace only the affected work-view subtree. It must not create a second viewport or discard the fixed chrome.
- The stored transform is applied before a newly selected work view becomes visible. Background images and large compositor layers are not recreated during scroll, telemetry refresh or indicator updates.
- Rendering is coalesced to at most one animation frame, and unchanged values do not write the DOM.
- Wrapping a full redraw in `requestAnimationFrame`, or delaying it until after scrolling, is still a full redraw and is non-conforming.
- Keys, element order and child topology remain stable for state-only changes. Conditional status copy uses stable placeholders or targeted insertion rather than whole-tree replacement.
- Exact changing telemetry age is not a structural key. An unchanged image does not receive the same `src` again.
- `backdrop-filter`, masks, `will-change` and containment may be used only on persistent layers; toggling or remounting them during scroll is prohibited because it can flash in iOS WebView.
- No polling loop may rebuild the active tab. Time-only displays patch their own text nodes.
- A full-screen loading frame is allowed only during initial mount. Later loss, staleness and recovery patch the mounted content in place.

## 10. Brand and repository identity

- Every integration repository ships a recognizable integration brand asset.
- A packaged `custom_components/<domain>/brand/icon.png` is mandatory; it is the minimum HACS brand asset and must not be an empty placeholder.
- `brand/logo.png`, `brand/dark_icon.png` and `brand/dark_logo.png` are required when the mark or wordmark is not legible in both themes.
- Brand files use the integration package layout expected by Home Assistant/HACS and are included in distribution checks.
- README starts with the same recognizable project/integration identity; repository and installed integration must not present unrelated marks.
- Header does not display the brand icon; it is for repository/HACS/HA identity, sidebar/launcher and suitable domain cards.
- Changed raster assets use deterministic cache/version handling where served by the panel.

## 11. Required automated guards

Repository tests or static checks must verify:

1. exactly one work/zoom viewport;
2. no permanent scale controls;
3. `hass-toggle-menu` and `mdi:menu` in the left rail;
4. both Header actions use the standard plaque geometry;
5. Bottom Tab icons use `ha-icon` and canonical size;
6. no horizontal movement and no transform pan at 100%;
7. axis-aware overflow bounds above 100%;
8. clamp after resize/tab/peer changes;
9. brand `icon.png` exists in the shipped integration package;
10. meaningful typography stays within `12–25px`, subject only to the documented schematic exception;
11. routine telemetry cannot replace the shell, viewport, canvas, background or Bottom Tab Bar;
12. an optional connection indicator, when requested, uses the canonical transport/freshness vocabulary and status-tinted plaque;
13. JavaScript syntax, package validation, HACS and Hassfest pass.

Each repository also maintains `docs/NIKAS_SPECIALIZED_PANEL_COMPLIANCE.md` (or an equivalent explicit record). Unimplemented runtime behavior is recorded as `GAP`, never assumed to pass from documentation alone.

## 12. Mandatory phone acceptance

- long diagnostics pages scroll vertically at 100%;
- 100% cannot move horizontally or be pulled away from the top origin;
- enlarged content pans only on necessary axes and never exposes empty field;
- release preserves clamped position without rebound;
- pinch never causes content snap-back;
- card activation does not become accidental pan;
- Header, selector and Bottom Tab Bar remain stationary at every scale;
- both Header buttons are visible matching plaques below Dynamic Island;
- Bottom icons and labels match the Stark SolarPower visual scale;
- integration/repository icon is present and recognizable in installed/distribution surfaces.
- repeated telemetry, indicator transitions, tab changes and upward/downward scroll produce no full-screen flash or white frame;
- scrolling the work area never moves Header, peer selector or Bottom Tab Bar;
- short views do not pull either menu inward, and long views expose their last control above the Bottom Tab Bar;
- at least ten consecutive tab switches produce no blank frame, lost map/image or duplicated viewport;
- loss/recovery changes telemetry and any enabled indicator in place; preserved samples are visibly stale;
- `Дом сейчас` and StarLine contain no unrequested two-level connection indicator.

## 13. Publication

- NikaS panel and integration work is published through traceable commits, branches and pull requests.
- GitHub Releases are not used.
- A pull request remains draft until automated checks pass and the real-phone acceptance items above are ready for user verification.
