package store

import (
	"context"
	"testing"
)

func TestUpdateLocation_MemRejectsInvalid(t *testing.T) {
	s := NewUserStore(nil)
	u, err := s.SeedMemUser("geo_player", "player")
	if err != nil {
		t.Fatal(err)
	}
	if err := s.UpdateLocation(context.Background(), u.ID, "e", ""); err == nil {
		t.Fatal("expected reject short code")
	}
	if err := s.UpdateLocation(context.Background(), u.ID, "12", ""); err == nil {
		t.Fatal("expected reject non-alpha")
	}
	if err := s.UpdateLocation(context.Background(), u.ID, "et", "Addis"); err != nil {
		t.Fatal(err)
	}
	got, err := s.GetByID(context.Background(), u.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.CountryCode == nil || *got.CountryCode != "ET" {
		t.Fatalf("country=%v want ET", got.CountryCode)
	}
	if got.Region == nil || *got.Region != "Addis" {
		t.Fatalf("region=%v want Addis", got.Region)
	}
}
