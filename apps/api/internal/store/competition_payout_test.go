package store

import "testing"

func testPayoutEnums() ClientEnumsConfig {
	return ClientEnumsConfig{
		HostedEventKnockoutFormat:            "knockout",
		HostedEventRoundRobinFormat:          "round_robin",
		HostedEventSwissFormat:               "swiss",
		HostedEventGroupsKnockoutFormat:      "groups_knockout",
		HostedEventArenaFormat:               "arena",
		CompetitionPayoutModes:               []string{"places_percent", "score_share", "dual_purse"},
		CompetitionPayoutModePlacesPercent:   "places_percent",
		CompetitionPayoutModeScoreShare:      "score_share",
		CompetitionPayoutModeDualPurse:       "dual_purse",
		CompetitionDualPursePlacePercent:     "50",
		CompetitionDefaultPayoutModeKnockout: "places_percent",
		CompetitionDefaultPayoutModeArena:    "score_share",
	}
}

func TestValidatePayoutModeForFormatAllowsKOScoreShare(t *testing.T) {
	enums := testPayoutEnums()
	if err := ValidatePayoutModeForFormat(enums, "knockout", "score_share"); err != nil {
		t.Fatalf("KO score_share must be allowed: %v", err)
	}
	if err := ValidatePayoutModeForFormat(enums, "knockout", "places_percent"); err != nil {
		t.Fatalf("KO places_percent must remain allowed: %v", err)
	}
	if err := ValidatePayoutModeForFormat(enums, "knockout", "dual_purse"); err != nil {
		t.Fatalf("KO dual_purse must be allowed: %v", err)
	}
	for _, format := range []string{"round_robin", "swiss", "groups_knockout", "arena"} {
		if err := ValidatePayoutModeForFormat(enums, format, "score_share"); err != nil {
			t.Fatalf("%s score_share must be allowed: %v", format, err)
		}
		if err := ValidatePayoutModeForFormat(enums, format, "dual_purse"); err != nil {
			t.Fatalf("%s dual_purse must be allowed: %v", format, err)
		}
	}
	if err := ValidatePayoutModeForFormat(enums, "knockout", "not_a_mode"); err == nil {
		t.Fatal("unknown mode must fail closed")
	}
	if err := ValidatePayoutModeForFormat(enums, "knockout", ""); err == nil {
		t.Fatal("empty mode must fail closed")
	}
}

func TestBuildPayoutRowsScoreShareKOWinPoints(t *testing.T) {
	// 4-player KO shape: champion 2 wins, finalist 1 win, first-round losers 0.
	rows := BuildPayoutRowsScoreShare(180, []ScoreShareRow{
		{UserID: "champ", Points: 2},
		{UserID: "finalist", Points: 1},
		{UserID: "r1a", Points: 0},
		{UserID: "r1b", Points: 0},
	})
	if len(rows) != 2 {
		t.Fatalf("expected 2 paid scorers, got %+v", rows)
	}
	if rows[0].UserID != "champ" || rows[0].Amount != 120 || rows[0].Placement != 1 {
		t.Fatalf("champ share: %+v", rows[0])
	}
	if rows[1].UserID != "finalist" || rows[1].Amount != 60 || rows[1].Placement != 2 {
		t.Fatalf("finalist share: %+v", rows[1])
	}
}

func TestBuildPayoutRowsDualPurseMergesPlaceAndPerformance(t *testing.T) {
	// Frozen 200: 50% place purse (100) at 50/30/20 → 50/30/20; 50% perf (100) by 2+1 pts → ~66.67/33.33.
	// Champ (1st + 2 pts): 50+66.67; Finalist (2nd + 1 pt): 30+33.33; 3rd place only: 20.
	percents := map[int]float64{1: 50, 2: 30, 3: 20}
	placements := map[int]string{1: "champ", 2: "finalist", 3: "third"}
	scores := []ScoreShareRow{
		{UserID: "champ", Points: 2},
		{UserID: "finalist", Points: 1},
		{UserID: "r1a", Points: 0},
	}
	rows := BuildPayoutRowsDualPurse(200, 50, percents, placements, scores)
	if len(rows) != 3 {
		t.Fatalf("expected 3 payees, got %+v", rows)
	}
	byUser := map[string]PendingPayoutInput{}
	sum := 0.0
	for _, r := range rows {
		byUser[r.UserID] = r
		sum = roundMoney2(sum + r.Amount)
	}
	if sum != 200 {
		t.Fatalf("sum want 200 got %v rows=%+v", sum, rows)
	}
	champ := byUser["champ"]
	if champ.Amount != 116.67 { // 50 + 66.67
		t.Fatalf("champ dual want 116.67 got %+v", champ)
	}
	if champ.Placement != 1 {
		t.Fatalf("champ placement want 1 got %+v", champ)
	}
	finalist := byUser["finalist"]
	if finalist.Amount != 63.33 { // 30 + 33.33
		t.Fatalf("finalist dual want 63.33 got %+v", finalist)
	}
	third := byUser["third"]
	if third.Amount != 20 {
		t.Fatalf("third place-only want 20 got %+v", third)
	}
}

// PKO product claim: performance purse still pays a player who never finishes in the money.
func TestBuildPayoutRowsDualPursePerformanceOnlyPayee(t *testing.T) {
	// Frozen 200: place purse 100 → 1st 50 / 2nd 30 / 3rd 20; perf purse 100 → bounty hunter 1 pt → 100.
	percents := map[int]float64{1: 50, 2: 30, 3: 20}
	placements := map[int]string{1: "champ", 2: "finalist", 3: "third"}
	scores := []ScoreShareRow{
		{UserID: "bounty", Points: 1}, // eliminated early, still earns performance purse
		{UserID: "champ", Points: 0},
		{UserID: "finalist", Points: 0},
		{UserID: "third", Points: 0},
	}
	rows := BuildPayoutRowsDualPurse(200, 50, percents, placements, scores)
	byUser := map[string]PendingPayoutInput{}
	sum := 0.0
	for _, r := range rows {
		byUser[r.UserID] = r
		sum = roundMoney2(sum + r.Amount)
	}
	if sum != 200 {
		t.Fatalf("sum want 200 got %v rows=%+v", sum, rows)
	}
	if len(byUser) != 4 {
		t.Fatalf("want 4 payees (3 places + bounty), got %+v", rows)
	}
	if byUser["champ"].Amount != 50 || byUser["finalist"].Amount != 30 || byUser["third"].Amount != 20 {
		t.Fatalf("place purse rows want 50/30/20 got %+v", rows)
	}
	bounty := byUser["bounty"]
	if bounty.Amount != 100 {
		t.Fatalf("bounty performance-only want 100 got %+v", bounty)
	}
	if bounty.Placement < 1 {
		t.Fatalf("bounty must keep a valid escrow placement got %+v", bounty)
	}
}

func TestDualPursePlacePercentRejectsBounds(t *testing.T) {
	if _, err := DualPursePlacePercentFromRaw("0"); err == nil {
		t.Fatal("0 must fail")
	}
	if _, err := DualPursePlacePercentFromRaw("100"); err == nil {
		t.Fatal("100 must fail")
	}
	v, err := DualPursePlacePercentFromRaw("50")
	if err != nil || v != 50 {
		t.Fatalf("50 want ok got %v %v", v, err)
	}
}

// When nobody scored points, performance purse is empty - fail-closed to full-pot places%
// (not place-purse slice only, not empty/div0).
func TestBuildPayoutRowsDualPurseZeroPointsFallsBackToFullPotPlaces(t *testing.T) {
	percents := map[int]float64{1: 50, 2: 30, 3: 20}
	placements := map[int]string{1: "champ", 2: "finalist", 3: "third"}
	scores := []ScoreShareRow{
		{UserID: "champ", Points: 0},
		{UserID: "finalist", Points: 0},
		{UserID: "third", Points: 0},
	}
	rows := BuildPayoutRowsDualPurse(200, 50, percents, placements, scores)
	byUser := map[string]PendingPayoutInput{}
	sum := 0.0
	for _, r := range rows {
		byUser[r.UserID] = r
		sum = roundMoney2(sum + r.Amount)
	}
	if sum != 200 {
		t.Fatalf("sum want 200 got %v rows=%+v", sum, rows)
	}
	if byUser["champ"].Amount != 100 || byUser["finalist"].Amount != 60 || byUser["third"].Amount != 40 {
		t.Fatalf("zero-pts dual want full-pot places 100/60/40 got %+v", rows)
	}
	emptyScores := BuildPayoutRowsDualPurse(200, 50, percents, placements, nil)
	if len(emptyScores) != 3 {
		t.Fatalf("nil scores dual want 3 place payees got %+v", emptyScores)
	}
}

func TestDefaultPayoutModeForFormatKOPlacesAlternate(t *testing.T) {
	enums := testPayoutEnums()
	if got := DefaultPayoutModeForFormat(enums, "knockout"); got != "places_percent" {
		t.Fatalf("KO default want places_percent got %q", got)
	}
	if got := DefaultPayoutModeForFormat(enums, "arena"); got != "score_share" {
		t.Fatalf("Arena default want score_share got %q", got)
	}
}
