package engine

import "testing"

func mustState(t *testing.T, mode string, depth int) *State {
	t.Helper()
	st, err := InitialState(mode, depth, 4, "fmjd_international")
	if err != nil {
		t.Fatalf("InitialState: %v", err)
	}
	return st
}

func TestInitialStateBoardSizeAndPieceCount(t *testing.T) {
	st := mustState(t, "ai", 2)
	if st.Size != BoardSize {
		t.Fatalf("size=%d want %d", st.Size, BoardSize)
	}
	p1, p2 := 0, 0
	for r := 0; r < BoardSize; r++ {
		for c := 0; c < BoardSize; c++ {
			cell := st.Board[r][c]
			if cell == nil {
				continue
			}
			if cell.P == PlayerOne {
				p1++
			}
			if cell.P == PlayerTwo {
				p2++
			}
		}
	}
	if p1 != 20 || p2 != 20 {
		t.Fatalf("piece counts p1=%d p2=%d want 20/20", p1, p2)
	}
}

func TestMandatoryCaptureForcesCaptureMove(t *testing.T) {
	st := mustState(t, "pvp", 0)
	// Clear board and set a forced capture for player 1.
	for r := 0; r < BoardSize; r++ {
		for c := 0; c < BoardSize; c++ {
			st.Board[r][c] = nil
		}
	}
	st.Turn = PlayerOne
	st.Board[6][3] = &Piece{P: PlayerOne, K: false}
	st.Board[5][4] = &Piece{P: PlayerTwo, K: false}

	moves := LegalMoves(st)
	if len(moves) == 0 {
		t.Fatal("expected at least one capture move")
	}
	for _, m := range moves {
		if m.CaptureCount() == 0 {
			t.Fatalf("non-capture move leaked despite available capture: %+v", m)
		}
	}
}

func TestMajorityCapturePrefersLongerSequence(t *testing.T) {
	st := mustState(t, "pvp", 0)
	for r := 0; r < BoardSize; r++ {
		for c := 0; c < BoardSize; c++ {
			st.Board[r][c] = nil
		}
	}
	st.Turn = PlayerOne
	// Man at 7,2 can capture one piece to 5,4 OR continue for two captures if path exists.
	st.Board[7][2] = &Piece{P: PlayerOne, K: false}
	st.Board[6][3] = &Piece{P: PlayerTwo, K: false}
	st.Board[4][5] = &Piece{P: PlayerTwo, K: false}

	moves := LegalMoves(st)
	if len(moves) == 0 {
		t.Fatal("expected capture moves")
	}
	maxCaps := 0
	for _, m := range moves {
		if m.CaptureCount() > maxCaps {
			maxCaps = m.CaptureCount()
		}
	}
	for _, m := range moves {
		if m.CaptureCount() < maxCaps {
			t.Fatalf("majority capture not enforced: move caps=%d max=%d", m.CaptureCount(), maxCaps)
		}
	}
	if maxCaps < 1 {
		t.Fatal("expected capture")
	}
}

func TestFlyingKingLongRangeCapture(t *testing.T) {
	st := mustState(t, "pvp", 0)
	for r := 0; r < BoardSize; r++ {
		for c := 0; c < BoardSize; c++ {
			st.Board[r][c] = nil
		}
	}
	st.Turn = PlayerOne
	st.Board[9][0] = &Piece{P: PlayerOne, K: true}
	st.Board[5][4] = &Piece{P: PlayerTwo, K: false}

	moves := LegalMoves(st)
	found := false
	for _, m := range moves {
		if m.FromRow == 9 && m.FromCol == 0 && m.CaptureCount() == 1 {
			found = true
			if m.ToRow >= 5 {
				t.Fatalf("flying king should land beyond captured piece, to=%v", m.To)
			}
		}
	}
	if !found {
		t.Fatal("expected flying king capture along diagonal")
	}
}
