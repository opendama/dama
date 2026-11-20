package engine

import "testing"

func TestArmAndDebitFlag(t *testing.T) {
	st, err := InitialState("pvp", 0, 4, "fmjd_international")
	if err != nil {
		t.Fatal(err)
	}
	ArmMatchClock(st, 1, 0) // 1 second
	if !st.ClockActive || st.ClockP1RemainingMs != 1000 {
		t.Fatalf("arm: %+v", st)
	}
	st.ClockLastTickUnixMs = 1_000_000
	flagged, advanced := DebitActiveClock(st, 1_000_000+1500)
	if !flagged || !advanced {
		t.Fatal("expected flag")
	}
	if st.ClockP1RemainingMs != 0 {
		t.Fatalf("remaining=%d", st.ClockP1RemainingMs)
	}
	if FlaggedSeatWinner(st) != PlayerTwo {
		t.Fatalf("winner=%d", FlaggedSeatWinner(st))
	}
}

func TestClockSnapshotDoesNotMutate(t *testing.T) {
	st, err := InitialState("pvp", 0, 4, "fmjd_international")
	if err != nil {
		t.Fatal(err)
	}
	ArmMatchClock(st, 10, 0)
	st.ClockLastTickUnixMs = 5_000
	before := st.ClockP1RemainingMs
	p1, _ := ClockSnapshot(st, 5_000+2_000)
	if p1 != before-2_000 {
		t.Fatalf("snap=%d want %d", p1, before-2_000)
	}
	if st.ClockP1RemainingMs != before {
		t.Fatal("snapshot mutated state")
	}
}

func TestArmMatchClockFromDBDefaultInitial(t *testing.T) {
	st, err := InitialState("pvp", 0, 4, "fmjd_international")
	if err != nil {
		t.Fatal(err)
	}
	ArmMatchClockFromDB(st, "database", true, 600, 0, 0, []int{60, 180, 600, 1800})
	if !st.ClockActive || st.TimeControlSeconds != 600 || st.ClockP1RemainingMs != 600_000 {
		t.Fatalf("default arm: tc=%d active=%v p1=%d", st.TimeControlSeconds, st.ClockActive, st.ClockP1RemainingMs)
	}
	st2, err := InitialState("pvp", 0, 4, "fmjd_international")
	if err != nil {
		t.Fatal(err)
	}
	ArmMatchClockFromDB(st2, "database", true, 600, 0, 60, []int{60, 180, 600, 1800})
	if st2.TimeControlSeconds != 60 || st2.ClockP1RemainingMs != 60_000 {
		t.Fatalf("preset arm: tc=%d p1=%d", st2.TimeControlSeconds, st2.ClockP1RemainingMs)
	}
	st3, err := InitialState("pvp", 0, 4, "fmjd_international")
	if err != nil {
		t.Fatal(err)
	}
	ArmMatchClockFromDB(st3, "memory", true, 600, 0, 0, []int{600})
	if st3.ClockActive {
		t.Fatal("non-database source must fail closed")
	}
}

func TestDebitAlreadyZeroFlags(t *testing.T) {
	st, err := InitialState("pvp", 0, 4, "fmjd_international")
	if err != nil {
		t.Fatal(err)
	}
	ArmMatchClock(st, 60, 0)
	st.ClockP1RemainingMs = 0
	st.ClockLastTickUnixMs = 1_000_000
	flagged, advanced := DebitActiveClock(st, 1_000_000) // same wall ms as last tick
	if !flagged || !advanced {
		t.Fatal("already-zero seat must flag without waiting for elapsed")
	}
}

func TestDebitActiveClockPausedDoesNotDebit(t *testing.T) {
	st, err := InitialState("pvp", 0, 4, "fmjd_international")
	if err != nil {
		t.Fatal(err)
	}
	ArmMatchClock(st, 60, 0)
	st.ClockLastTickUnixMs = 1_000_000
	before := st.ClockP1RemainingMs
	st.Paused = true
	flagged, advanced := DebitActiveClock(st, 1_000_000+30_000)
	if flagged || advanced {
		t.Fatal("paused debit must be a no-op")
	}
	if st.ClockP1RemainingMs != before {
		t.Fatalf("remaining=%d want %d", st.ClockP1RemainingMs, before)
	}
	if st.ClockLastTickUnixMs != 1_000_000 {
		t.Fatalf("tick moved to %d", st.ClockLastTickUnixMs)
	}
	// Already-zero seats must not flag while the pause freeze is on.
	st.ClockP1RemainingMs = 0
	flagged, advanced = DebitActiveClock(st, 1_000_000+30_000)
	if flagged || advanced {
		t.Fatal("paused zero clock must not flag")
	}
	st.Paused = false
	st.ClockP1RemainingMs = before
	st.ClockLastTickUnixMs = 1_000_000
	flagged, advanced = DebitActiveClock(st, 1_000_000+1_500)
	if flagged || !advanced {
		t.Fatal("expected debit after resume")
	}
	if st.ClockP1RemainingMs != before-1_500 {
		t.Fatalf("remaining=%d want %d", st.ClockP1RemainingMs, before-1_500)
	}
}

func TestClockSnapshotPausedDoesNotSubtract(t *testing.T) {
	st, err := InitialState("pvp", 0, 4, "fmjd_international")
	if err != nil {
		t.Fatal(err)
	}
	ArmMatchClock(st, 60, 0)
	st.ClockLastTickUnixMs = 5_000
	before := st.ClockP1RemainingMs
	st.Paused = true
	p1, p2 := ClockSnapshot(st, 5_000+20_000)
	if p1 != before || p2 != st.ClockP2RemainingMs {
		t.Fatalf("snap p1=%d p2=%d want frozen %d", p1, p2, before)
	}
	if st.ClockP1RemainingMs != before || st.ClockLastTickUnixMs != 5_000 {
		t.Fatal("snapshot mutated paused state")
	}
}

func TestGrantIncrement(t *testing.T) {
	st, err := InitialState("pvp", 0, 4, "fmjd_international")
	if err != nil {
		t.Fatal(err)
	}
	ArmMatchClock(st, 60, 2)
	before := st.ClockP1RemainingMs
	GrantClockIncrement(st, PlayerOne)
	if st.ClockP1RemainingMs != before+2000 {
		t.Fatalf("got %d", st.ClockP1RemainingMs)
	}
}

func TestInsufficientMaterialDrawOnTimeKingVsKing(t *testing.T) {
	st, err := InitialState("pvp", 0, 4, "fmjd_international")
	if err != nil {
		t.Fatal(err)
	}
	var empty Board
	st.Board = empty
	st.Board[0][1] = &Piece{P: PlayerOne, K: true}
	st.Board[9][0] = &Piece{P: PlayerTwo, K: true}
	if !InsufficientMaterialDrawOnTime(st, PlayerTwo) {
		t.Fatal("bare king vs bare king must draw on time")
	}
	st.Board[5][0] = &Piece{P: PlayerTwo, K: false}
	if InsufficientMaterialDrawOnTime(st, PlayerTwo) {
		t.Fatal("king+man vs king must still be a decisive flag-fall")
	}
}

func TestInsufficientMaterialDrawOnTimeNoPieces(t *testing.T) {
	st, err := InitialState("pvp", 0, 4, "fmjd_international")
	if err != nil {
		t.Fatal(err)
	}
	var empty Board
	st.Board = empty
	st.Board[0][1] = &Piece{P: PlayerOne, K: false}
	if !InsufficientMaterialDrawOnTime(st, PlayerTwo) {
		t.Fatal("zero pieces for winner candidate must draw on time")
	}
}
