// Package ai provides a non-monetary VS-AI practice engine (minimax + alpha-beta).
package ai

import (
	"math"
	"time"

	"dama/apps/api/internal/game/engine"
)

// Depth tier labels for time budgets. Allowed depths come only from DB feature flags.
const (
	DepthNovice      = 2
	DepthBeginner    = 4
	DepthClub        = 6
	DepthExpert      = 8
	DepthMaster      = 10
	DepthGrandmaster = 10 // PRD Grandmaster Bot = Depth-10; API allow-list is authoritative
)

const (
	manValue  = 1.0
	kingValue = 3.25
)

// ChooseMove selects an AI move within a time budget for practice play only.
// Depth must already be allow-listed by the API (no silent remap invent).
func ChooseMove(state *engine.State, depth int) *engine.Move {
	if state == nil {
		return nil
	}
	if depth < 1 || depth > DepthGrandmaster {
		return nil
	}

	moves := engine.LegalMoves(state)
	if len(moves) == 0 {
		return nil
	}
	if len(moves) == 1 {
		cp := moves[0]
		return &cp
	}

	budgetMS := 900
	if depth <= DepthBeginner {
		budgetMS = 600
	} else if depth >= DepthGrandmaster {
		budgetMS = 1200
	}
	deadline := time.Now().Add(time.Duration(budgetMS) * time.Millisecond)
	aiPlayer := state.Turn

	best := moves[0]
	for d := 1; d <= depth; d++ {
		if time.Now().After(deadline) {
			break
		}
		localBest := moves[0]
		localScore := math.Inf(-1)
		alpha := math.Inf(-1)
		beta := math.Inf(1)
		for i := range moves {
			if time.Now().After(deadline) {
				break
			}
			child, err := engine.ApplyMove(state, moves[i])
			if err != nil {
				continue
			}
			score := -negamax(child, d-1, -beta, -alpha, aiPlayer, deadline)
			if score > localScore {
				localScore = score
				localBest = moves[i]
			}
			if score > alpha {
				alpha = score
			}
		}
		best = localBest
	}
	cp := best
	return &cp
}

func negamax(state *engine.State, depth int, alpha, beta float64, aiPlayer int, deadline time.Time) float64 {
	if time.Now().After(deadline) {
		return evaluate(state, aiPlayer)
	}
	if outcome := engine.GameOutcome(state); outcome != nil {
		if *outcome == engine.Draw {
			return 0
		}
		if *outcome == aiPlayer {
			return 10000 + float64(depth)
		}
		return -10000 - float64(depth)
	}
	if depth <= 0 {
		return evaluate(state, aiPlayer)
	}

	moves := engine.LegalMoves(state)
	if len(moves) == 0 {
		return evaluate(state, aiPlayer)
	}

	best := math.Inf(-1)
	for i := range moves {
		if time.Now().After(deadline) {
			break
		}
		child, err := engine.ApplyMove(state, moves[i])
		if err != nil {
			continue
		}
		score := -negamax(child, depth-1, -beta, -alpha, aiPlayer, deadline)
		if score > best {
			best = score
		}
		if score > alpha {
			alpha = score
		}
		if alpha >= beta {
			break
		}
	}
	if math.IsInf(best, -1) {
		return evaluate(state, aiPlayer)
	}
	return best
}

func evaluate(state *engine.State, aiPlayer int) float64 {
	opp := 3 - aiPlayer
	mine := packPlayer(state, aiPlayer)
	theirs := packPlayer(state, opp)
	score := materialFromBits(mine) - materialFromBits(theirs)

	// Positional center bonus still walks dark squares (men only).
	for r := 0; r < engine.BoardSize; r++ {
		for c := 0; c < engine.BoardSize; c++ {
			p := state.Board[r][c]
			if p == nil || p.K {
				continue
			}
			dr := math.Abs(float64(r) - 4.5)
			dc := math.Abs(float64(c) - 4.5)
			centerBonus := (4.5 - dr + 4.5 - dc) * 0.02
			if p.P == aiPlayer {
				score += centerBonus
			} else {
				score -= centerBonus
			}
		}
	}
	return score
}
