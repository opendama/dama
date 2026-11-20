package rest

import (
	"testing"

	"dama/apps/api/internal/game/engine"
	"dama/apps/api/internal/store"
)

// Tournament / hosted / arena / StartGame all call stampMatchClockFromSettings.
// Prove preferred=0 arms initial_seconds and invite preferred stamps preset TC.
func TestStampMatchClockFromSettingsArmsDualClocks(t *testing.T) {
	settings := &store.SettingsStore{}
	settings.SetMatchClockCacheForTest(store.MatchClockConfig{
		Enabled:          true,
		InitialSeconds:   600,
		IncrementSeconds: 2,
		Presets: []store.MatchClockPreset{
			{Seconds: 60, Label: "1 min"},
			{Seconds: 180, Label: "3 min"},
			{Seconds: 600, Label: "10 min"},
			{Seconds: 1800, Label: "30 min"},
		},
		InviteTTLSeconds: 120,
		Source:           "database",
	})

	st, err := engine.InitialState("pvp", 0, 4, "fmjd_international")
	if err != nil {
		t.Fatal(err)
	}
	// Queue / tournament / hosted / VS-AI path: preferred 0 → initial_seconds.
	stampMatchClockFromSettings(settings, st, 0)
	if !st.ClockActive || st.TimeControlSeconds != 600 {
		t.Fatalf("default stamp: active=%v tc=%d", st.ClockActive, st.TimeControlSeconds)
	}
	if st.ClockP1RemainingMs != 600_000 || st.ClockP2RemainingMs != 600_000 {
		t.Fatalf("dual clocks not armed: p1=%d p2=%d", st.ClockP1RemainingMs, st.ClockP2RemainingMs)
	}
	if st.ClockIncrementSeconds != 2 {
		t.Fatalf("increment=%d want 2", st.ClockIncrementSeconds)
	}

	st2, err := engine.InitialState("pvp", 0, 4, "fmjd_international")
	if err != nil {
		t.Fatal(err)
	}
	// Invite / challenge path: preferred preset.
	stampMatchClockFromSettings(settings, st2, 60)
	if !st2.ClockActive || st2.TimeControlSeconds != 60 || st2.ClockP1RemainingMs != 60_000 {
		t.Fatalf("invite stamp: active=%v tc=%d p1=%d", st2.ClockActive, st2.TimeControlSeconds, st2.ClockP1RemainingMs)
	}
}

func TestStampMatchClockFromSettingsFailClosed(t *testing.T) {
	st, err := engine.InitialState("pvp", 0, 4, "fmjd_international")
	if err != nil {
		t.Fatal(err)
	}
	stampMatchClockFromSettings(nil, st, 0)
	if st.ClockActive {
		t.Fatal("nil settings must not arm")
	}

	settings := &store.SettingsStore{}
	settings.SetMatchClockCacheForTest(store.MatchClockConfig{
		Enabled:        true,
		InitialSeconds: 600,
		Presets:        []store.MatchClockPreset{{Seconds: 600, Label: "10 min"}},
		Source:         "memory", // not database
	})
	stampMatchClockFromSettings(settings, st, 0)
	if st.ClockActive {
		t.Fatal("non-database source must fail closed")
	}
}
