# iPhone summary target

Check `0.7.0-beta001` on the iPhone 15 Pro Max in portrait with the sidebar collapsed and both **Подробнее** sections closed.

1. At 100% scale, both cards fit in the initial workspace. Murano 130 is above Murano 683. Their blue and black portraits share the same proportions and camera angle.
2. The summary has no vehicle selector. The selector appears on History, Trips and Diagnostics.
3. Each card shows fuel, battery, engine and security. The bold centered label sits above the icon and value on one line. Check that **Двигатель** remains fully visible. Doors, hood and trunk are reported separately from the portrait.
4. Compare both vehicles with their Home Assistant entities, including the parked and disarmed case. Check the source and units for fuel, the battery voltage in volts, and the Moscow time of the last Home Assistant report. Check that a stale or missing entity has explicit text and that lost Home Assistant connectivity is visible.
5. Expand either card's details and scroll. Pinch to zoom and double-tap with two fingers to return to 100%. The header and bottom navigation stay fixed. Changing telemetry preserves the open details, scroll position and zoom, with no flashing or white frames.
6. Switch to a per-vehicle tab and back. The summary restores its own zoom independently.
