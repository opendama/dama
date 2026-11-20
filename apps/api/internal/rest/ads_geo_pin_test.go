package rest

import "testing"

func TestExtractGeoTargetPinCoords(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name string
		raw  []any
		ok   bool
		lat  float64
		lng  float64
	}{
		{name: "empty", raw: nil, ok: false},
		{name: "country only", raw: []any{map[string]any{"country": "ET"}}, ok: false},
		{name: "null island", raw: []any{map[string]any{"lat": 0.0, "lng": 0.0}}, ok: false},
		{name: "missing lng", raw: []any{map[string]any{"lat": 9.03}}, ok: false},
		{name: "out of range", raw: []any{map[string]any{"lat": 99.0, "lng": 38.0}}, ok: false},
		{name: "valid pin", raw: []any{map[string]any{"lat": 1.25, "lng": 2.5, "country": "XX"}}, ok: true, lat: 1.25, lng: 2.5},
		{name: "int coords", raw: []any{map[string]any{"lat": 9, "lng": 38}}, ok: true, lat: 9, lng: 38},
	}
	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			lat, lng, ok := extractGeoTargetPinCoords(tc.raw)
			if ok != tc.ok {
				t.Fatalf("ok=%v want %v", ok, tc.ok)
			}
			if !tc.ok {
				return
			}
			if lat != tc.lat || lng != tc.lng {
				t.Fatalf("coords=%v,%v want %v,%v", lat, lng, tc.lat, tc.lng)
			}
		})
	}
}

func TestStampAdGeoTargetsCountryNoInvent(t *testing.T) {
	t.Parallel()
	if got := stampAdGeoTargetsCountry(nil, "ET"); got != nil {
		t.Fatalf("empty raw must not invent targets, got %#v", got)
	}
	// Neutral fixtures only - not product copy / geo fallbacks.
	raw := []any{map[string]any{
		"lat": 1.25, "lng": 2.5, "country": "XX",
		"region": "sample-region", "district": "sample-district",
		"extra_ignored": true,
	}}
	got := stampAdGeoTargetsCountry(raw, "ET")
	if len(got) != 1 {
		t.Fatalf("len=%d", len(got))
	}
	m := got[0].(map[string]any)
	if m["country"] != "ET" {
		t.Fatalf("country stamped=%v", m["country"])
	}
	if m["lat"] != 1.25 || m["lng"] != 2.5 {
		t.Fatalf("pin lost: %#v", m)
	}
	if m["region"] != "sample-region" || m["district"] != "sample-district" {
		t.Fatalf("region/district lost: %#v", m)
	}
	if _, ok := m["extra_ignored"]; ok {
		t.Fatalf("non-allowlisted keys must not be copied, got %#v", m)
	}
}
