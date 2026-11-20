package rest

import (
	"context"
	"testing"
	"time"

	"dama/apps/api/internal/game/engine"
	"dama/apps/api/internal/store"

	"github.com/google/uuid"
)

// Guest VS-AI stop must succeed even when match_history cannot FK to users
// (guest JWTs have no users row). History finalize is best-effort async.
func TestAbandonGameCoreGuestAIDoesNotGateOnHistory(t *testing.T) {
	t.Setenv("DAMA_ALLOW_MEMORY", "1")
	st, err := engine.InitialState("ai", 2, 4, "fmjd_international")
	if err != nil {
		t.Fatalf("InitialState: %v", err)
	}
	guestID := uuid.NewString()
	st.Player1ID = &guestID
	gs := NewGameStore(nil)
	if _, err := gs.Create("guest-ai-1", st); err != nil {
		t.Fatalf("Create: %v", err)
	}
	api := &API{
		Store:   gs,
		Matches: store.NewMatchHistoryStore(nil), // Record fails (no DB) - must not fail abandon
	}
	payload, err := api.AbandonGameCore(context.Background(), "guest-ai-1", guestID)
	if err != nil {
		t.Fatalf("AbandonGameCore: %v", err)
	}
	if payload == nil {
		t.Fatal("expected payload")
	}
	if payload["end_reason"] != "resign" {
		t.Fatalf("end_reason=%v want resign", payload["end_reason"])
	}
	if payload["outcome"] == nil {
		t.Fatal("expected outcome after resign")
	}
	// Idempotent second stop (double-click / client retry).
	payload2, err := api.AbandonGameCore(context.Background(), "guest-ai-1", guestID)
	if err != nil {
		t.Fatalf("idempotent AbandonGameCore: %v", err)
	}
	if payload2["outcome"] == nil {
		t.Fatal("expected outcome on idempotent abandon")
	}
	// Allow async finalize goroutine to finish without panicking.
	time.Sleep(50 * time.Millisecond)
}
