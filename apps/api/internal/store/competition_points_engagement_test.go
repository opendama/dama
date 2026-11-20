package store

import "testing"

func TestClassicCupEngagementAwards(t *testing.T) {
	ids := HostedFormatIDs{
		Knockout:       "knockout",
		RoundRobin:     "round_robin",
		Swiss:          "swiss",
		GroupsKnockout: "groups_knockout",
		Arena:          "arena",
	}
	winner := "user-1"

	got := ClassicCupEngagementAwards(ids.Knockout, ids, winner, 7)
	if len(got) != 1 || got[0].UserID != winner || got[0].Points != 7 {
		t.Fatalf("knockout awards: %+v", got)
	}

	got = ClassicCupEngagementAwards(ids.Arena, ids, winner, 7)
	if got != nil {
		t.Fatalf("arena must not use classic engagement awards: %+v", got)
	}

	got = ClassicCupEngagementAwards(ids.Knockout, ids, winner, 0)
	if got != nil {
		t.Fatalf("zero win points must award nothing: %+v", got)
	}

	got = ClassicCupEngagementAwards(ids.GroupsKnockout, ids, winner, 3)
	if len(got) != 1 || got[0].Points != 3 {
		t.Fatalf("groups_knockout awards: %+v", got)
	}
}
