# StarLine Telemetry 0.6.10

- Makes the first reliable Home Assistant security entity authoritative according
  to the documented source priority instead of allowing any old `arm=true` value
  to override a current disarmed state.
- Uses the read-only bootstrap security snapshot only before a reliable Home
  Assistant state is available and only while its source timestamp is at most
  60 seconds old.
- Preserves explicit `true`, explicit `false` and unknown in binary sensors;
  missing, null and unrecognized fields no longer become `false`.
- Covers armed, disarmed, unavailable and recovery transitions, stale bootstrap
  rejection, source conflicts and partial successful payloads.
- Raises the panel UI to 0.6.9 without changing the approved layout or adding
  vehicle commands.
