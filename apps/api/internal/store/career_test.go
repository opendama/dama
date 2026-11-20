package store

import (
	"context"
	"testing"
)

func TestApplyCareerResultPvPMem(t *testing.T) {
	s := NewUserStore(nil)
	u, err := s.SeedMemUser("career_pvp", "player")
	if err != nil {
		t.Fatalf("seed: %v", err)
	}
	rewards := MatchRewardsConfig{
		WinXP: 25, DrawXP: 10, LossXP: 5,
		WinRating: 16, DrawRating: 0, LossRating: -16,
		RatingFloor: 0, StartingRating: 1200,
		Source: "database",
	}
	if err := s.ApplyCareerResult(context.Background(), u.ID, "win", rewards); err != nil {
		t.Fatalf("apply: %v", err)
	}
	got, err := s.GetByID(context.Background(), u.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Wins != 1 || got.XP != 25 || got.Rating != u.Rating+16 {
		t.Fatalf("wins=%d xp=%d rating=%d", got.Wins, got.XP, got.Rating)
	}
}

func TestApplyCareerResultRespectsRatingFloor(t *testing.T) {
	s := NewUserStore(nil)
	u, err := s.SeedMemUser("career_floor", "player")
	if err != nil {
		t.Fatalf("seed: %v", err)
	}
	// Force a low rating then apply a large loss against floor 50.
	s.mu.Lock()
	s.mem[u.ID].Rating = 60
	s.mu.Unlock()
	rewards := MatchRewardsConfig{
		LossXP: 0, LossRating: -40, RatingFloor: 50, StartingRating: 1200, Source: "database",
	}
	if err := s.ApplyCareerResult(context.Background(), u.ID, "loss", rewards); err != nil {
		t.Fatalf("apply: %v", err)
	}
	got, err := s.GetByID(context.Background(), u.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Rating != 50 {
		t.Fatalf("rating=%d want floor 50", got.Rating)
	}
}

func TestApplyCareerResultRequiresDBSource(t *testing.T) {
	s := NewUserStore(nil)
	u, err := s.SeedMemUser("career_src", "player")
	if err != nil {
		t.Fatalf("seed: %v", err)
	}
	err = s.ApplyCareerResult(context.Background(), u.ID, "win", MatchRewardsConfig{WinXP: 1, Source: "unavailable"})
	if err == nil {
		t.Fatal("expected fail-closed without database source")
	}
}
