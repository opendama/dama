package payments

import "testing"

func TestSplitEntryFeeCommission(t *testing.T) {
	c, net := SplitEntryFeeCommission(100, 10)
	if c != 10 || net != 90 {
		t.Fatalf("10%% of 100: got commission=%v net=%v", c, net)
	}
	c, net = SplitEntryFeeCommission(100, 0)
	if c != 0 || net != 100 {
		t.Fatalf("0%%: got commission=%v net=%v", c, net)
	}
	c, net = SplitEntryFeeCommission(100, 100)
	if c != 100 || net != 0 {
		t.Fatalf("100%%: got commission=%v net=%v", c, net)
	}
	c, net = SplitEntryFeeCommission(33.33, 15)
	if c+net != RoundMoney2(33.33) {
		t.Fatalf("parts must sum to fee: c=%v net=%v", c, net)
	}
}
