package engine

import "testing"

func TestClockFlagEndReasonForcedOutcome(t *testing.T) {
	st, err := InitialState("pvp", 0, 4, "fmjd_international")
	if err != nil {
		t.Fatal(err)
	}
	ArmMatchClock(st, 1, 0)
	st.Turn = PlayerOne
	st.ClockLastTickUnixMs = 1_000_000
	flagged, _ := DebitActiveClock(st, 1_000_000+1500)
	if !flagged {
		t.Fatal("expected flag")
	}
	w := FlaggedSeatWinner(st)
	st.ForcedOutcome = &w
	st.EndReason = "clock_flag"
	st.ClockActive = false
	out := GameOutcome(st)
	if out == nil || *out != PlayerTwo {
		t.Fatalf("outcome=%v", out)
	}
	if st.EndReason != "clock_flag" {
		t.Fatalf("end_reason=%q", st.EndReason)
	}
}
