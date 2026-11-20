package rest

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"dama/apps/api/internal/store"
)

func resolveArenaDurationMinutes(stored *int, enums store.ClientEnumsConfig) (int, error) {
	if stored != nil && *stored >= 1 {
		return *stored, nil
	}
	raw := strings.TrimSpace(enums.CompetitionArenaDefaultDurationMinutes)
	if raw == "" {
		return 0, store.ErrHostedEventInvalidInput
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n < 1 {
		return 0, store.ErrHostedEventInvalidInput
	}
	return n, nil
}

func competitionArenaAutoStartEnabled(enums store.ClientEnumsConfig) bool {
	v := strings.ToLower(strings.TrimSpace(enums.CompetitionArenaAutoStart))
	return v == "true" || v == "1" || v == "yes" || v == "on"
}

func competitionArenaPairInterval(settings *store.SettingsStore) (int, bool) {
	if settings == nil {
		return 0, false
	}
	enums := settings.ClientEnums()
	if enums.Source != "database" {
		return 0, false
	}
	raw := strings.TrimSpace(enums.CompetitionArenaPairIntervalSeconds)
	if raw == "" {
		return 0, false
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		return 0, false
	}
	return n, true
}

func competitionArenaPairingMode(enums store.ClientEnumsConfig) (string, error) {
	mode := strings.TrimSpace(enums.CompetitionArenaDefaultPairingMode)
	if mode == "" {
		return "", errors.New("competition_arena_default_pairing_mode empty")
	}
	for _, m := range enums.CompetitionArenaPairingModes {
		if strings.TrimSpace(m) == mode {
			return mode, nil
		}
	}
	return "", fmt.Errorf("competition_arena_default_pairing_mode invalid: %q", mode)
}

func competitionArenaAllowJoinWhileLive(enums store.ClientEnumsConfig) bool {
	v := strings.ToLower(strings.TrimSpace(enums.CompetitionArenaAllowJoinWhileLive))
	return v == "true"
}

func hostedEventArenaLiveJoinAllowed(ev *store.HostedEvent, enums store.ClientEnumsConfig, now time.Time) bool {
	if ev == nil {
		return false
	}
	if strings.TrimSpace(ev.FormatID) != strings.TrimSpace(enums.HostedEventArenaFormat) {
		return false
	}
	if ev.Status != enums.HostedEventLiveStatus {
		return false
	}
	if ev.FinishedAt != nil {
		return false
	}
	if ev.ArenaEndsAt == nil || !ev.ArenaEndsAt.After(now) {
		return false
	}
	return competitionArenaAllowJoinWhileLive(enums)
}

// tournamentArenaLiveJoinAllowed: late enroll after start is Arena-only when the
// admin DB flag is on and the arena clock is still running (parity with hosted events).
func tournamentArenaLiveJoinAllowed(t *store.Tournament, enums store.ClientEnumsConfig, now time.Time) bool {
	if t == nil {
		return false
	}
	if strings.TrimSpace(t.FormatID) != strings.TrimSpace(enums.HostedEventArenaFormat) {
		return false
	}
	if t.StartedAt == nil || t.FinishedAt != nil {
		return false
	}
	if t.ArenaEndsAt == nil || !t.ArenaEndsAt.After(now) {
		return false
	}
	return competitionArenaAllowJoinWhileLive(enums)
}
