package store

import "testing"

func TestHostReputationBlocksPaidCreate(t *testing.T) {
	p := CashRmgPolicy{
		HostReputationMaxOpenReports:      5,
		HostReputationCancelRateBps:       7000,
		HostReputationCancelRateMinSample: 5,
	}
	if p.HostReputationBlocksPaidCreate(10, 0, 4) {
		t.Fatal("open reports below max should allow")
	}
	if !p.HostReputationBlocksPaidCreate(10, 0, 5) {
		t.Fatal("open reports at max should block")
	}
	if p.HostReputationBlocksPaidCreate(3, 3, 0) {
		t.Fatal("sample below min should allow")
	}
	// 7 cancelled / 10 sample = 7000 bps exactly -> block
	if !p.HostReputationBlocksPaidCreate(3, 7, 0) {
		t.Fatal("cancel rate at threshold should block")
	}
	if p.HostReputationBlocksPaidCreate(4, 6, 0) {
		t.Fatal("cancel rate below threshold should allow")
	}
}
