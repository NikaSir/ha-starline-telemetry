# NikaS Specialized Panel UI Standard v1.7

**Status:** REQUIRED

**Canonical source:** `NikaSir/ha-contract-generated-ui`

**Local owner:** `NikaSir/ha-starline-telemetry`

**Visual reference:** Stark SolarPower (UPS panel)

This synchronized implementation snapshot replaces every older local rule that permits one-finger canvas movement at 100%, uses CSS `zoom`, treats native overflow scrolling as the position engine of an enlarged canvas, remounts the panel on routine telemetry, or uses browser-history guessing for parent navigation. Domain UI must not be redesigned during a shell-only migration.

## Shell and safe areas

- Header, optional peer-device selector and Bottom Tab Bar are outside the zoom viewport and never scale or pan.
- Consume each effective iPhone safe area exactly once. Header content stays below the Dynamic Island/notch and the Bottom Tab Bar stays above the Home Indicator.
- Exactly one zoom viewport and one work canvas may exist per panel instance. Installation and telemetry rerendering are idempotent: no nested wrappers, duplicated handlers, abandoned blank space or progressive shrinking.
- Responsive layout is selected before scaling.

## Header — UPS reference geometry

- Header grid is `52px minmax(0,1fr) 52px`; `48px minmax(0,1fr) 48px` is allowed only when the viewport is too narrow for the title.
- Minimum Header height is `62px`, or `60px` on a phone, excluding the safe-area inset consumed above it.
- The title is a geometrically centered semantic two-line button. Main title: `23px`; version line: `14px` and exactly `UI vX.Y.Z`. On narrow phones `21px / 13px` is allowed.
- Pressing the title returns to a captured originating base panel. Resolve `return_to`, then `from`, saved session route, same-origin referrer, configured parent and safe fallback. Only `/dashboard-house`, `/dashboard-actions` and `/dashboard-infrastructure` roots are accepted.
- Parent navigation uses `history.pushState()` followed by `location-changed`; `history.back()` is forbidden.
- The permanent left control is only the Home Assistant system menu. It uses `<ha-icon icon="mdi:menu">` and dispatches `hass-toggle-menu` with bubbling and composed semantics. Back arrows, integration menus and device actions are forbidden in the left rail.
- At most one global action is allowed at right. If refresh is present, it uses `<ha-icon icon="mdi:refresh">`.
- Left and right controls use identical `44px × 44px` plaques: `16px` radius, `var(--card-background-color)` background, `1px solid var(--divider-color)` border and the subtle UPS shadow. Icon size is `25px`.
- Menu color is `var(--primary-text-color)`; refresh color is `var(--primary-color)`. Refresh must not be a transparent bare glyph.
- Keep left and right rails symmetrical even when the right action is absent. Parent navigation belongs inside work content.

## Scale and position

- Only work content scales. Use one transform layer (`translate3d(x,y,0) scale(s)` or an equivalent single transform-owned canvas); never CSS `zoom`.
- Pinch with two fingers scales around their midpoint. Permanent `− / % / +` controls are forbidden.
- Supported/recommended range is `75–200%`, default `100%`.
- At `100%`, transform coordinates are exactly `x = 0`, `y = 0`. One-finger pan is disabled, horizontal overflow is forbidden, and the work area uses ordinary native vertical scrolling.
- At `75–96%`, one-finger pan also remains disabled and transform offsets remain at origin; the reduced layout must not expose draggable empty space.
- One-finger pan is enabled only above `100%`, and independently per axis only when scaled content overflows that viewport axis.
- Clamp movement to the real scaled-content edges. If an axis fits, its offset is fixed at origin. Empty field outside the panel must never be pullable into view.
- Re-clamp after pinch completion, rerender, orientation/viewport resize and restored persisted state.
- Pinch completion in `97–103%` snaps to exact `{scale:1,x:0,y:0}`.
- A two-finger double tap resets scale and transform position to 100%/origin and briefly shows native-scale `Масштаб 100%`.
- Persist scale locally per panel/client and per selected peer device where applicable. Persist transform offsets only when valid above 100%; never restore invalid offsets.
- Switching a Bottom Tab returns native vertical scroll to the top, retains scale if desired, and re-clamps or clears invalid transform offsets.

## Gesture and interaction guard

- At 100%, native vertical scroll, taps, `more-info` and intentional stationary long press work without gesture delay or conflict.
- A second finger immediately cancels pending `more-info`. Crossing the pan threshold above 100% cancels a pending hold through `pointercancel` semantics.
- Synthetic clicks immediately after a pinch/pan/reset are briefly suppressed. Gestures never execute device actions.

## Bottom Tab Bar — UPS reference geometry

- Use one fixed, full-width, edge-attached bar outside the zoom viewport; it is not a floating card.
- Background is `var(--card-background-color)`, with a top divider and the subtle UPS upper shadow. Bottom padding includes `env(safe-area-inset-bottom)` exactly once.
- All tabs have equal width and a minimum target height of `52px`.
- Icons are MDI icons rendered by `<ha-icon>`, size `28px`; text/emoji glyphs are forbidden as navigation icons.
- Labels are one-line, readable, `12px`, weight `700`; shorten a long label rather than shrinking it below the standard.
- Active tab uses `var(--primary-color)` for icon and label plus an approximately 11% primary-color background with `13–14px` radius and no extra active shadow. Inactive tabs use the secondary text color.
- Final content must be able to scroll fully clear of the fixed bar.

## Branding and repository identity

- Every integration repository ships an approved square integration icon at `custom_components/<domain>/brand/icon.png`; do not synthesize or reinterpret a trademark without an approved source.
- Add light/dark variants or a separate logo only when an approved source exists and contrast requires them. Missing optional artwork must never be replaced by generated branding.
- The README must display the approved local icon/logo and use the same integration name as `manifest.json` and `hacs.json`.
- Verify the actual HACS/HA installation path and domain in README, manifest and package tree. If Home Assistant requires centralized brand publication for a particular surface, track that submission separately; the local asset remains the repository source.
- Configure the GitHub repository avatar/social preview from the same approved identity where repository settings permit it; this setting requires a manual GitHub check.

## Reference-app typography

- The official StarLine mobile application is the minimum typography reference for corresponding panel content.
- A panel label, value, timestamp or action name must never render smaller than its corresponding StarLine reference text.
- Responsive breakpoints may reflow or truncate content, but must not reduce text below that reference floor.
- History action names use the original StarLine event-description library when the read-only journal is available.
- History timestamps state their semantics: StarLine source time is preferred; Home Assistant detection time is labelled when Recorder is the fallback.

## Stable rendering

- Mount the application shell once. Routine `hass` and telemetry updates must not replace `shadowRoot.innerHTML` or remount the active subtree.
- Apply state, text, class, attribute and CSS-variable changes as point patches, coalesced to at most one animation frame.
- Create each view lazily and cache its visited subtree. Switching tabs or peer devices reuses those nodes.
- Do not assign the same `src` to an unchanged image. Embedded maps and other expensive children remain mounted while their state is updated.
- Initial loading may use a stable skeleton. Refresh patches the mounted content without a blank intermediate frame.
- The production browser loads one autonomous module and one final component. Historical implementation layers belong in Git history, not in an import or inheritance chain.

## Delivery and acceptance

- Keep one stable, cache-busted production entry module; registration, manifest, route, component name and shipped assets must agree.
- Required phone checks: native scrolling on long diagnostics; no horizontal or vertical transform movement at 100%; no pullable blank field; axis-specific pan only above 100%; clamp after release and resize; stable focal pinch; taps do not become pans; tab change returns to top; Header and Bottom Tab Bar stay fixed; `hass-toggle-menu`, refresh plaque, safe areas, integration icon and README identity are correct.

> Newer canonical standards in `ha-contract-generated-ui` override this synchronized local snapshot.

## LIDER central title plaque reference

The centered two-line Header title plaque uses the LIDER reference geometry and tone:

- `justify-self:center`; `min-width:min(290px,100%)`; `max-width:100%`; `min-height:44px`; `padding:5px 14px`;
- on narrow phones: `min-width:0; width:100%; padding-inline:8px`;
- `1px` border with primary-color mix `24%`; `16px` radius; primary-color background mix `5%`; `0 5px 16px rgba(23,45,76,.06)` shadow;
- pressed: background mix `13%`, border mix `42%`, `0 2px 7px rgba(23,45,76,.05)`; focus-visible: `2px` primary outline and `2px` offset.
- The focus state and pressed response are mandatory and remain visibly distinct from the default state.

A transparent/plain-text title, a white-only local variant, or an integration-specific color is not conforming.
