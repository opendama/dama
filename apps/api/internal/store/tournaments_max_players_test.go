package store

import "testing"

func TestSeatCapRequiresArenaOnly(t *testing.T) {
	swiss := map[string]int{"8": 3, "16": 4, "32": 5, "64": 6}
	eight := 8
	one := 1
	atCeil := 64
	justAbove := 65
	high := 10000
	if !SeatCapRequiresArenaOnly(nil, swiss) {
		t.Fatal("null requires arena")
	}
	if SeatCapRequiresArenaOnly(&one, swiss) {
		t.Fatal("max 1 is invalid, not Unlimited arena-only")
	}
	if SeatCapRequiresArenaOnly(&eight, swiss) {
		t.Fatal("classic 8 must not require arena-only")
	}
	if SeatCapRequiresArenaOnly(&atCeil, swiss) {
		t.Fatal("at classic ceiling must not require arena-only")
	}
	if !SeatCapRequiresArenaOnly(&justAbove, swiss) {
		t.Fatal("ceiling+1 requires arena")
	}
	if !SeatCapRequiresArenaOnly(&high, swiss) {
		t.Fatal("high ceiling requires arena")
	}
	if ClassicSeatCeiling(swiss) != 64 {
		t.Fatalf("ceiling got %d", ClassicSeatCeiling(swiss))
	}
	if got := PlayerCapOrZero(&one); got != 1 {
		t.Fatalf("PlayerCapOrZero(1) got %d want 1 (fail-closed hard cap)", got)
	}
	if got := PlayerCapOrZero(nil); got != 0 {
		t.Fatalf("PlayerCapOrZero(nil) got %d want 0 uncapped", got)
	}
}

func TestValidateOfficialMaxPlayers(t *testing.T) {
	swiss := map[string]int{"8": 3, "16": 4, "32": 5, "64": 6}
	eight := 8
	one := 1
	atCeil := 64
	justAbove := 65
	high := 10000
	cases := []struct {
		name   string
		format string
		arena  string
		max    *int
		want   string
	}{
		{name: "arena null ok", format: "arena", arena: "arena", max: nil, want: ""},
		{name: "arena capped ok", format: "arena", arena: "arena", max: &eight, want: ""},
		{name: "arena at ceiling ok", format: "arena", arena: "arena", max: &atCeil, want: ""},
		{name: "arena ceiling+1 ok", format: "arena", arena: "arena", max: &justAbove, want: ""},
		{name: "arena high ok", format: "arena", arena: "arena", max: &high, want: ""},
		{name: "arena lt2 reject", format: "arena", arena: "arena", max: &one, want: "err_max_players_required"},
		{name: "classic capped ok", format: "knockout", arena: "arena", max: &eight, want: ""},
		{name: "classic at ceiling ok", format: "knockout", arena: "arena", max: &atCeil, want: ""},
		{name: "classic null reject", format: "knockout", arena: "arena", max: nil, want: "err_unlimited_arena_only"},
		{name: "classic ceiling+1 reject", format: "knockout", arena: "arena", max: &justAbove, want: "err_unlimited_arena_only"},
		{name: "classic high reject", format: "knockout", arena: "arena", max: &high, want: "err_unlimited_arena_only"},
		{name: "classic lt2 reject", format: "swiss", arena: "arena", max: &one, want: "err_max_players_required"},
		{name: "missing arena id null reject", format: "arena", arena: "", max: nil, want: "err_unlimited_arena_only"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := ValidateOfficialMaxPlayers(tc.format, tc.arena, tc.max, swiss)
			if got != tc.want {
				t.Fatalf("got %q want %q", got, tc.want)
			}
		})
	}
}
