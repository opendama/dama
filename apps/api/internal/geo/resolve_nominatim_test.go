package geo

import "testing"

func TestNominatimCityAndSubCity_AddisPin(t *testing.T) {
	// Zoom-18 English Nominatim shape for pin near Lafto / Nefas Silk.
	a := nominatimAddress{
		CountryCode:   "et",
		State:         "Addis Ababa",
		StateDistrict: "Addis Ababa",
		Suburb:        "Lafto",
		County:        "Nefas Silk",
	}
	city, sub := nominatimCityAndSubCity(a)
	if city != "Addis Ababa" {
		t.Fatalf("city=%q want Addis Ababa", city)
	}
	if sub != "Lafto" {
		t.Fatalf("subCity=%q want Lafto (suburb before county)", sub)
	}
}

func TestNominatimCityAndSubCity_NoDuplicate(t *testing.T) {
	a := nominatimAddress{
		StateDistrict: "Bole",
		Suburb:        "Bole",
		County:        "Bole Subcity",
	}
	city, sub := nominatimCityAndSubCity(a)
	if city != "Bole" {
		t.Fatalf("city=%q", city)
	}
	if sub != "Bole Subcity" {
		t.Fatalf("subCity=%q want Bole Subcity when suburb equals city", sub)
	}
}
