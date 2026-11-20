package store

import "testing"

func TestValidateHostTrustPolicyPatch(t *testing.T) {
	ok := HostTrustPolicyPatch{
		HostPaidCreateRequiresPhoneKyc:            true,
		HostGuaranteeRequiresDocumentKyc:          true,
		HostConcurrentOpenPaidCapPhoneVerified:    3,
		HostConcurrentOpenPaidCapDocumentVerified: 25,
		HostConcurrentOpenPaidCapNewHost:          1,
		HostNewHostSettledPaidThreshold:           3,
		HostReputationMaxOpenReports:              5,
		HostReputationCancelRateBps:               7000,
		HostReputationCancelRateMinSample:         5,
	}
	if err := validateHostTrustPolicyPatch(ok); err != nil {
		t.Fatalf("expected ok patch: %v", err)
	}

	badCap := ok
	badCap.HostConcurrentOpenPaidCapNewHost = 0
	if err := validateHostTrustPolicyPatch(badCap); err == nil {
		t.Fatal("expected invalid new-host cap")
	}

	badBps := ok
	badBps.HostReputationCancelRateBps = 10001
	if err := validateHostTrustPolicyPatch(badBps); err == nil {
		t.Fatal("expected invalid cancel bps")
	}

	zeroReports := ok
	zeroReports.HostReputationMaxOpenReports = 0
	if err := validateHostTrustPolicyPatch(zeroReports); err != nil {
		t.Fatalf("0 open-reports should disable gate: %v", err)
	}

	zeroBps := ok
	zeroBps.HostReputationCancelRateBps = 0
	if err := validateHostTrustPolicyPatch(zeroBps); err != nil {
		t.Fatalf("0 cancel bps should disable gate: %v", err)
	}
}
