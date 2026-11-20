package store

import "time"

// SeedBracketCheckedInOnly: at cup start, only checked-in entrants enter the bracket (industry no-show gate).
// After start / after a close deadline, the same rule keeps late seeds honest.
// Players may check in anytime before start when check_in_opens_at is null (CheckIn allows it).
func SeedBracketCheckedInOnly(t *Tournament, atCupStart bool, now time.Time) bool {
	if t == nil {
		return false
	}
	if atCupStart {
		return true
	}
	if t.CheckInOpensAt == nil {
		return false
	}
	if t.CheckInClosesAt != nil && !now.Before(*t.CheckInClosesAt) {
		return true
	}
	if t.StartedAt != nil {
		return true
	}
	return false
}
