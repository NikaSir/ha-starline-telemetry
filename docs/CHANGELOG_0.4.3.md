# 0.4.3

- Replace CSS `zoom` and scroll-owned positioning with one transform-owned work canvas.
- Persist `{scale,x,y}` locally per panel client and selected vehicle.
- Support one-finger pan at every scale and focal-point two-finger pinch from 75% to 200%.
- Remove permanent `− / % / +` controls.
- Add two-finger double-tap reset and 97–103% snap with `Масштаб 100%` feedback.
- Suppress accidental more-info/clicks after pan, pinch and reset while preserving stationary taps/holds.
- Keep the Home Assistant Header and safe-area-aware Bottom Tab Bar outside the transformed workspace.
