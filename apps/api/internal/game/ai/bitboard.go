package ai

import (
	"math/bits"

	"dama/apps/api/internal/game/engine"
)

// Bitboards pack the 50 dark squares of the FMJD 10x10 board into uint64 lanes.
// Used by the VS-AI evaluator (material counts) alongside alpha-beta search.
type Bitboards struct {
	Men   uint64
	Kings uint64
}

func packPlayer(state *engine.State, player int) Bitboards {
	var bb Bitboards
	var bit uint
	for r := 0; r < engine.BoardSize; r++ {
		for c := 0; c < engine.BoardSize; c++ {
			if (r+c)%2 != 1 {
				continue
			}
			p := state.Board[r][c]
			if p != nil && p.P == player {
				mask := uint64(1) << bit
				if p.K {
					bb.Kings |= mask
				} else {
					bb.Men |= mask
				}
			}
			bit++
			if bit >= 64 {
				return bb
			}
		}
	}
	return bb
}

func materialFromBits(bb Bitboards) float64 {
	return float64(bits.OnesCount64(bb.Men))*manValue + float64(bits.OnesCount64(bb.Kings))*kingValue
}
