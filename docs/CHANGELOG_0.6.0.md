# 0.6.0

- Rebuilt the panel as one autonomous `starline-app-panel` runtime without the historical v003–v025 inheritance chain.
- Adopted NikaS specialized-panel UI standard v1.7: fixed shell, safe title navigation, one viewport/canvas and stable cached views.
- Mounted the shell once and changed Home Assistant state updates to requestAnimationFrame-coalesced point patches.
- Preserved separate 130/683 Summary pages, accepted scene geometry, state-specific vehicle images and the open-base security dome.
- Preserved read-only StarLine history with official timestamps/descriptions, confirmed-transition Recorder fallback, trips and diagnostics.
- Kept Header, selector and Bottom Tab Bar outside the 75–200% transform canvas; native scrolling remains active through 100%.
- No vehicle-control endpoint, service call or writable more-info path was added.
