# iPhone summary target

Check `0.7.0-beta008` on the iPhone 15 Pro Max in portrait with the sidebar collapsed and both **Подробнее** sections closed.

1. At 100% scale, both cards fit in the initial workspace. Murano 130 is above Murano 683. Their blue and black portraits share the same proportions and camera angle.
2. The summary has no vehicle selector. The selector appears on History, Trips and Diagnostics.
3. Each card shows fuel, battery, average consumption, engine and security. The bold centered label sits above the icon and value on one line. Check that **Средний расход** and **Двигатель** remain fully visible. Verify the receipt period, litres and distance under **Подробнее**. Verify the dash when a vehicle lacks enough data. Doors, hood and trunk are reported separately from the portrait.
4. Compare both vehicles with their Home Assistant entities, including the parked and disarmed case. Check the source and units for fuel, the battery voltage in volts, and the Moscow time of the last Home Assistant report. The cloud shows the Home Assistant connection. The second icon shows the freshness of fuel and battery for that vehicle and is orange when the oldest valid reading is over 30 minutes old. Missing readings show a gray clock with a question mark. Both statuses are available as text in Diagnostics.
5. Expand either card's details and scroll. Pinch to zoom and double-tap with two fingers to return to 100%. The header and bottom navigation stay fixed. Changing telemetry preserves the open details, scroll position and zoom, with no flashing or white frames.
6. Switch to a per-vehicle tab and back. The summary restores its own zoom independently.
7. Check the complete UI and integration versions under StarLine. Check the white refresh arrow in the dark theme and the black arrow on white in the light theme. Tap refresh and confirm the button reports the request result while retaining its position.
