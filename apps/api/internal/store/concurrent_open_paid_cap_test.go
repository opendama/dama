package store

import "testing"

func TestConcurrentOpenPaidCap(t *testing.T) {
	p := CashRmgPolicy{
		HostConcurrentOpenPaidCapPhoneVerified:    3,
		HostConcurrentOpenPaidCapDocumentVerified: 25,
		HostConcurrentOpenPaidCapNewHost:          1,
		HostNewHostSettledPaidThreshold:           3,
	}
	// Document-verified: doc cap immediately (mig 524), even before settled threshold.
	if got := p.ConcurrentOpenPaidCap(true, 0); got != 25 {
		t.Fatalf("doc verified new host: got %d want 25", got)
	}
	if got := p.ConcurrentOpenPaidCap(true, 10); got != 25 {
		t.Fatalf("doc verified settled: got %d want 25", got)
	}
	// Phone-only below threshold: new-host cap.
	if got := p.ConcurrentOpenPaidCap(false, 0); got != 1 {
		t.Fatalf("phone new host: got %d want 1", got)
	}
	if got := p.ConcurrentOpenPaidCap(false, 2); got != 1 {
		t.Fatalf("phone under threshold: got %d want 1", got)
	}
	// Phone-only at/above threshold: phone cap.
	if got := p.ConcurrentOpenPaidCap(false, 3); got != 3 {
		t.Fatalf("phone at threshold: got %d want 3", got)
	}
}
