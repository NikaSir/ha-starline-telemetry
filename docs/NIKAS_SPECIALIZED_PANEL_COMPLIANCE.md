# StarLine specialized-panel compliance

Audit target: UI/integration 0.6.8 against NikaS Standard v2.2, Navigation Contract v1.2 and Shell Contract v2.1.

| Requirement | Status | Evidence / field acceptance |
|---|---|---|
| Integration-owned route and autonomous production entry | PASS | `panel.py`, `panel_manifest.json` and `.nikas-ui-standard.json` agree on `/starline`, `starline-app.js` and `starline-app-panel`. |
| Host-bounded shell | PASS | The component owns exactly the Home Assistant panel body: no viewport-sized shell and no duplicate fixed navigation. |
| Header / selector / Bottom Tab Bar geometry | PASS | 60 px header body, 52 px vehicle selector, 64 px bottom body, 52 px targets, 26 px icons and 12/700 labels. |
| Content width and viewport matrix | PASS / FIELD CHECK | Content is capped at 1280 px; verify the canonical phone, tablet and desktop matrix after HACS delivery. |
| Native internal scrolling | PASS / FIELD CHECK | The internal `.viewport` is the sole vertical scroller at 100%; verify long History, Trips and Diagnostics screens on iPhone. |
| Shell boundary guard | PASS / FIELD CHECK | Capturing non-passive single-touch guard blocks top/bottom scroll chaining, leaves multitouch to zoom and is removed on disconnect. |
| Stable shell and point patching | PASS | Header, selector, viewport/canvas and Bottom Tab Bar mount once; telemetry updates remain requestAnimationFrame point patches. |
| Vehicle selector status lamps | PASS | Existing 9 px online/offline lamps remain independent of selection styling and update without remounting. |
| Zoom contract | PASS / FIELD CHECK | 75–200%, native scroll through 100%, pan only above 100%, focal pinch, fit-axis locks, persistent per-vehicle state and two-finger reset are preserved. |
| Safe title navigation | PASS | Deterministic precedence and timestamped hand-off support House v13, Rooms v11, Actions and Infrastructure; `history.back()` is forbidden. |
| Data truth and commands | PASS | Registry/integration data only, explicit unknown/unavailable, and no Home Assistant service call. |
| Deterministic frontend delivery | PASS | The checked-in bundle is generated from one source by `scripts/build_frontend_bundle.py`; canonical CI checks source/bundle parity. |
| Canonical documentation | PASS | The repository vendors the exact v2.2 UI standard, v1.2 navigation contract, frontend release standard and canonical checker. |
| Packaged integration identity | PASS | The approved local integration icon and NikaS StarLine identity are unchanged. |

## Required field acceptance

1. Phone portrait and landscape: pull-down at the upper boundary must not refresh Home Assistant; upward drag at the lower boundary must not move the whole panel.
2. Tablet portrait and landscape plus desktop: header, selector and bottom navigation must stay inside the panel host with no clipping.
3. All four tabs: long content scrolls only inside the work area at 100%; tabs, title return and refresh remain responsive.
4. Both vehicles: 9 px status lamp semantics, selection styling, live telemetry, scene geometry and state imagery remain unchanged.
5. Zoom: one-finger native scroll at 100%, focal pinch, axis locking above 100% and two-finger reset.

This migration intentionally changes only the shared shell, canonical contracts and release metadata. StarLine telemetry, history, trips, vehicle scenes and read-only policy are preserved.
