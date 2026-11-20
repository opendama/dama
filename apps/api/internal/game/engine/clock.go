package engine

import "time"

// ArmMatchClock stamps authoritative dual clocks from DB match_clock (fail-closed: tcSeconds > 0).
func ArmMatchClock(state *State, tcSeconds, incrementSeconds int) {
	if state == nil || tcSeconds <= 0 {
		return
	}
	if incrementSeconds < 0 {
		incrementSeconds = 0
	}
	ms := int64(tcSeconds) * 1000
	state.TimeControlSeconds = tcSeconds
	state.ClockIncrementSeconds = incrementSeconds
	state.ClockP1RemainingMs = ms
	state.ClockP2RemainingMs = ms
	state.ClockLastTickUnixMs = time.Now().UnixMilli()
	state.ClockActive = true
}

// ClockSnapshot returns live remaining ms for both seats at nowMs without mutating state.
func ClockSnapshot(state *State, nowMs int64) (p1, p2 int64) {
	if state == nil {
		return 0, 0
	}
	p1, p2 = state.ClockP1RemainingMs, state.ClockP2RemainingMs
	if !state.ClockActive || state.TimeControlSeconds <= 0 {
		return p1, p2
	}
	// Frozen while paused: do not subtract wall time that elapsed during the pause.
	if state.Paused {
		return p1, p2
	}
	if GameOutcome(state) != nil {
		return p1, p2
	}
	if state.ClockLastTickUnixMs <= 0 || nowMs <= state.ClockLastTickUnixMs {
		return p1, p2
	}
	elapsed := nowMs - state.ClockLastTickUnixMs
	if state.Turn == PlayerOne {
		p1 -= elapsed
		if p1 < 0 {
			p1 = 0
		}
	} else if state.Turn == PlayerTwo {
		p2 -= elapsed
		if p2 < 0 {
			p2 = 0
		}
	}
	return p1, p2
}

// DebitActiveClock subtracts elapsed time from the side to move.
// flagged: remaining hit 0 (including already-zero seats). advanced: state changed (persist when true).
func DebitActiveClock(state *State, nowMs int64) (flagged bool, advanced bool) {
	if state == nil || !state.ClockActive || state.TimeControlSeconds <= 0 {
		return false, false
	}
	// Pause freezes the side to move. Callers debit once before setting Paused.
	if state.Paused {
		return false, false
	}
	if GameOutcome(state) != nil {
		return false, false
	}
	if state.ClockLastTickUnixMs <= 0 {
		state.ClockLastTickUnixMs = nowMs
		return false, true
	}
	// Already expired (lab expire / prior tick) must flag even when wall-clock has not advanced.
	switch state.Turn {
	case PlayerOne:
		if state.ClockP1RemainingMs <= 0 {
			state.ClockP1RemainingMs = 0
			state.ClockLastTickUnixMs = nowMs
			return true, true
		}
	case PlayerTwo:
		if state.ClockP2RemainingMs <= 0 {
			state.ClockP2RemainingMs = 0
			state.ClockLastTickUnixMs = nowMs
			return true, true
		}
	}
	elapsed := nowMs - state.ClockLastTickUnixMs
	if elapsed <= 0 {
		return false, false
	}
	state.ClockLastTickUnixMs = nowMs
	switch state.Turn {
	case PlayerOne:
		state.ClockP1RemainingMs -= elapsed
		if state.ClockP1RemainingMs <= 0 {
			state.ClockP1RemainingMs = 0
			return true, true
		}
	case PlayerTwo:
		state.ClockP2RemainingMs -= elapsed
		if state.ClockP2RemainingMs <= 0 {
			state.ClockP2RemainingMs = 0
			return true, true
		}
	}
	return false, true
}

// GrantClockIncrement adds match_clock.increment_seconds to mover after a completed turn.
func GrantClockIncrement(state *State, mover int) {
	if state == nil || !state.ClockActive || state.ClockIncrementSeconds <= 0 {
		return
	}
	inc := int64(state.ClockIncrementSeconds) * 1000
	switch mover {
	case PlayerOne:
		state.ClockP1RemainingMs += inc
	case PlayerTwo:
		state.ClockP2RemainingMs += inc
	}
}

// FlaggedSeatWinner returns the opponent of the side whose clock flagged (turn seat).
func FlaggedSeatWinner(state *State) int {
	if state == nil {
		return 0
	}
	if state.Turn == PlayerOne {
		return PlayerTwo
	}
	return PlayerOne
}

func countKingsMen(board *Board, player int) (kings, men int) {
	if board == nil {
		return 0, 0
	}
	for row := 0; row < BoardSize; row++ {
		for col := 0; col < BoardSize; col++ {
			cell := board[row][col]
			if cell == nil || cell.P != player {
				continue
			}
			if cell.K {
				kings++
			} else {
				men++
			}
		}
	}
	return kings, men
}

// InsufficientMaterialDrawOnTime is the FIDE 6.9 analogue for draughts flag-fall:
// if the side that would win on time cannot force a decisive material win, the
// game is drawn instead of awarding a hollow flag-fall. Narrow, industry-safe
// cases only: winner has no pieces, or bare king vs bare king (no men).
func InsufficientMaterialDrawOnTime(state *State, winnerCandidate int) bool {
	if state == nil {
		return false
	}
	if winnerCandidate != PlayerOne && winnerCandidate != PlayerTwo {
		return false
	}
	if CountPieces(&state.Board, winnerCandidate) == 0 {
		return true
	}
	opp := PlayerTwo
	if winnerCandidate == PlayerTwo {
		opp = PlayerOne
	}
	wK, wM := countKingsMen(&state.Board, winnerCandidate)
	oK, oM := countKingsMen(&state.Board, opp)
	return wK == 1 && wM == 0 && oK == 1 && oM == 0
}
