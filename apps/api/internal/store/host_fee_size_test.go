package store

import "testing"

func TestNormalizeAndValidateSizeHostFeesMirrorsEthiopia(t *testing.T) {
	sz := EventsCatalogSize{
		ID:                      "size_test",
		HostFeeEthiopiaAmount:   50,
		HostFeeEthiopiaCurrency: "ETB",
		HostFeeGlobalAmount:     5,
		HostFeeGlobalCurrency:   "USD",
	}
	if err := normalizeAndValidateSizeHostFees(&sz); err != nil {
		t.Fatalf("normalize: %v", err)
	}
	if sz.HostFeeAmount != 50 || sz.HostFeeCurrency != "ETB" {
		t.Fatalf("legacy mirror got amount=%v currency=%q", sz.HostFeeAmount, sz.HostFeeCurrency)
	}
}

func TestNormalizeSizeHostFeesFromLegacyEthiopiaOnly(t *testing.T) {
	sz := EventsCatalogSize{
		ID:                    "size_legacy",
		HostFeeAmount:         100,
		HostFeeCurrency:       "ETB",
		HostFeeGlobalAmount:   10,
		HostFeeGlobalCurrency: "USD",
	}
	if err := normalizeAndValidateSizeHostFees(&sz); err != nil {
		t.Fatalf("normalize legacy: %v", err)
	}
	if sz.HostFeeEthiopiaAmount != 100 || sz.HostFeeEthiopiaCurrency != "ETB" {
		t.Fatalf("ethiopia fill got %v %q", sz.HostFeeEthiopiaAmount, sz.HostFeeEthiopiaCurrency)
	}
}

func TestHostFeeForSizeCountry(t *testing.T) {
	s := &SettingsStore{}
	s.mu.Lock()
	s.cur = CurrencyConfig{Ethiopia: "ETB", Global: "USD", Source: "database"}
	s.geo = GeoPaymentConfig{EthiopiaCountry: "ET", Source: "database"}
	s.mu.Unlock()

	sz := EventsCatalogSize{
		ID:                      "size_8",
		HostFeeEthiopiaAmount:   50,
		HostFeeEthiopiaCurrency: "ETB",
		HostFeeGlobalAmount:     5,
		HostFeeGlobalCurrency:   "USD",
	}
	amt, cur, ok := s.HostFeeForSizeCountry(sz, "ET")
	if !ok || amt != 50 || cur != "ETB" {
		t.Fatalf("ethiopia got ok=%v amt=%v cur=%q", ok, amt, cur)
	}
	amt, cur, ok = s.HostFeeForSizeCountry(sz, "US")
	if !ok || amt != 5 || cur != "USD" {
		t.Fatalf("global got ok=%v amt=%v cur=%q", ok, amt, cur)
	}
}
