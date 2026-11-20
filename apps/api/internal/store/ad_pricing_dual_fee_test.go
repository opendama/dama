package store

import "testing"

func TestCampaignCreateFeeForCountry_EthiopiaVsGlobal(t *testing.T) {
	s := &SettingsStore{
		ads: AdPricingConfig{
			Source:                            "database",
			CampaignCreateFeeEthiopiaAmount:   25,
			CampaignCreateFeeEthiopiaCurrency: "ETB",
			CampaignCreateFeeGlobalAmount:     5,
			CampaignCreateFeeGlobalCurrency:   "USD",
		},
		geo: GeoPaymentConfig{
			Source:             "database",
			EthiopiaCountry:    "ET",
			PrivateDefaultCity: "Addis Ababa",
		},
	}

	amt, cur, ok := s.CampaignCreateFeeForCountry("ET")
	if !ok || amt != 25 || cur != "ETB" {
		t.Fatalf("Ethiopia fee: got ok=%v amt=%v cur=%q want 25 ETB", ok, amt, cur)
	}

	amt, cur, ok = s.CampaignCreateFeeForCountry("et")
	if !ok || amt != 25 || cur != "ETB" {
		t.Fatalf("Ethiopia fee case-insensitive: got ok=%v amt=%v cur=%q", ok, amt, cur)
	}

	amt, cur, ok = s.CampaignCreateFeeForCountry("US")
	if !ok || amt != 5 || cur != "USD" {
		t.Fatalf("global fee: got ok=%v amt=%v cur=%q want 5 USD", ok, amt, cur)
	}

	amt, cur, ok = s.CampaignCreateFeeForCountry("GB")
	if !ok || amt != 5 || cur != "USD" {
		t.Fatalf("global fee GB: got ok=%v amt=%v cur=%q want 5 USD", ok, amt, cur)
	}

	_, _, ok = s.CampaignCreateFeeForCountry("")
	if ok {
		t.Fatal("empty country must fail closed")
	}

	_, _, ok = s.CampaignCreateFeeForCountry("X")
	if ok {
		t.Fatal("invalid country must fail closed")
	}
}

func TestCampaignCreateFeeForCountry_UnavailableSource(t *testing.T) {
	s := &SettingsStore{
		ads: AdPricingConfig{Source: "unavailable"},
		geo: GeoPaymentConfig{Source: "database", EthiopiaCountry: "ET", PrivateDefaultCity: "Addis Ababa"},
	}
	if _, _, ok := s.CampaignCreateFeeForCountry("ET"); ok {
		t.Fatal("unavailable ad_pricing must fail closed")
	}
}
