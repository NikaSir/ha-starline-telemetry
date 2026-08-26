# 0.5.1

- Prefer the official read-only StarLine event journal so History uses the source event timestamp instead of the delayed Home Assistant polling timestamp.
- Use StarLine's official event-description library for action names and action-source qualifiers when supplied.
- Keep Home Assistant Recorder as a transparent fallback and emit only confirmed state transitions; repeated same-state updates and recovery from unavailable are not rendered as vehicle actions.
- Label timestamp semantics in the History header so StarLine source time and Home Assistant detection time cannot be confused.
- Match the original StarLine History hierarchy: time plus action, without a competing row icon.
- Raise History timestamps, dates, action names and summary content to the official StarLine typography floor; responsive layouts may not shrink corresponding text below the reference application.
- Cache cloud history, throttle forced refresh, and cap journal requests at 150 per day to preserve the public API quota.
- Preserve the autonomous v0.5 shell and refine its v1.5 scaling behavior: native scrolling and origin-locked offsets through 100%, axis-specific pan above 100%, centered-canvas edge clamping and scroll-to-top on tab changes.
