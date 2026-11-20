package engine

// ArmMatchClockFromDB applies platform_settings.match_clock policy (DB-only, fail-closed).
// preferredTCSeconds: invite/challenge preset; 0 → initialSeconds when enabled.
// presetSeconds must contain the chosen TC (seconds > 0).
func ArmMatchClockFromDB(
	state *State,
	source string,
	enabled bool,
	initialSeconds, incrementSeconds, preferredTCSeconds int,
	presetSeconds []int,
) {
	if state == nil || source != "database" {
		return
	}
	if !enabled {
		if preferredTCSeconds > 0 {
			state.TimeControlSeconds = preferredTCSeconds
		}
		return
	}
	tc := preferredTCSeconds
	if tc <= 0 {
		tc = initialSeconds
	}
	if tc <= 0 || incrementSeconds < 0 || len(presetSeconds) == 0 {
		return
	}
	ok := false
	for _, s := range presetSeconds {
		if s == tc && s > 0 {
			ok = true
			break
		}
	}
	if !ok {
		return
	}
	ArmMatchClock(state, tc, incrementSeconds)
}
