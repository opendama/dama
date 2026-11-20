package rest

import (
	"context"
	"testing"
	"time"

	"dama/apps/api/internal/game/engine"
	"dama/apps/api/internal/store"
	"dama/apps/api/internal/ws"

	"github.com/google/uuid"
)

func TestPauseGameCoreFreezesClockAndBlocksMoves(t *testing.T) {
	t.Setenv("DAMA_ALLOW_MEMORY", "1")
	st, err := engine.InitialState("pvp", 0, 4, "fmjd_international")
	if err != nil {
		t.Fatal(err)
	}
	engine.ArmMatchClock(st, 60, 0)
	p1 := uuid.NewString()
	p2 := uuid.NewString()
	st.Player1ID = &p1
	st.Player2ID = &p2
	st.ClockLastTickUnixMs = time.Now().UnixMilli() - 2_000
	before := st.ClockP1RemainingMs

	gs := NewGameStore(nil)
	if _, err := gs.Create("pause-1", st); err != nil {
		t.Fatal(err)
	}
	settings := store.NewSettingsStore(nil)
	settings.SetMatchClockCacheForTest(store.MatchClockConfig{
		Enabled:              true,
		PauseEnabled:         true,
		PauseDurationSeconds: 300,
	})
	api := &API{Store: gs, Settings: settings, Hub: ws.NewHub(nil, nil)}
	ctx := context.Background()

	payload, err := api.PauseGameCore(ctx, "pause-1", p1)
	if err != nil {
		t.Fatalf("PauseGameCore: %v", err)
	}
	rec, ok := gs.Get("pause-1")
	if !ok || rec.State == nil || !rec.State.Paused {
		t.Fatal("expected paused state")
	}
	dropped := before - rec.State.ClockP1RemainingMs
	if dropped < 1_500 || dropped > 4_000 {
		t.Fatalf("pause debit dropped %d ms (before %d now %d)", dropped, before, rec.State.ClockP1RemainingMs)
	}
	if rec.State.PausedByUserID != p1 {
		t.Fatalf("paused_by=%s", rec.State.PausedByUserID)
	}
	now := time.Now().UnixMilli()
	if rec.State.PauseExpiresAtUnixMs < now+299_000 || rec.State.PauseExpiresAtUnixMs > now+301_000 {
		t.Fatalf("expiry=%d now=%d", rec.State.PauseExpiresAtUnixMs, now)
	}
	for _, key := range []string{
		"paused", "paused_at_unix_ms", "pause_expires_at_unix_ms", "paused_by_user_id", "pause_remaining_ms",
	} {
		if _, ok := payload[key]; !ok {
			t.Fatalf("payload missing %s", key)
		}
	}
	if payload["paused"] != true {
		t.Fatalf("paused=%v", payload["paused"])
	}
	if payload["paused_by_user_id"] != p1 {
		t.Fatalf("paused_by payload=%v", payload["paused_by_user_id"])
	}
	remain, _ := payload["pause_remaining_ms"].(int64)
	if remain <= 0 || remain > 300_000 {
		t.Fatalf("pause_remaining_ms=%d", remain)
	}
	frozenRemain := rec.State.ClockP1RemainingMs
	frozenTick := rec.State.ClockLastTickUnixMs
	expires := rec.State.PauseExpiresAtUnixMs

	payload2, err := api.PauseGameCore(ctx, "pause-1", p2)
	if err != nil {
		t.Fatalf("idempotent pause: %v", err)
	}
	if !rec.State.Paused || rec.State.PauseExpiresAtUnixMs != expires {
		t.Fatal("idempotent pause changed the deadline")
	}
	if rec.State.ClockP1RemainingMs != frozenRemain || rec.State.PausedByUserID != p1 {
		t.Fatal("idempotent pause re-debited or replaced the pauser")
	}
	if payload2["paused"] != true {
		t.Fatal("idempotent payload not paused")
	}

	flagged, advanced := engine.DebitActiveClock(rec.State, time.Now().UnixMilli()+30_000)
	if flagged || advanced || rec.State.ClockP1RemainingMs != frozenRemain || rec.State.ClockLastTickUnixMs != frozenTick {
		t.Fatal("debit while paused changed the clock")
	}
	if _, err := api.ApplyMoveCore(ctx, "pause-1", p1, [2]int{6, 1}, [2]int{5, 0}); err == nil || err.Error() != "game is paused" {
		t.Fatalf("move while paused: %v", err)
	}
	if _, err := api.PauseGameCore(ctx, "pause-1", uuid.NewString()); err == nil || err.Error() != "not a seat in this game" {
		t.Fatalf("non-seat pause: %v", err)
	}

	resumed, err := api.ResumeGameCore(ctx, "pause-1", p2)
	if err != nil {
		t.Fatalf("ResumeGameCore: %v", err)
	}
	if rec.State.Paused || rec.State.PausedAtUnixMs != 0 || rec.State.PauseExpiresAtUnixMs != 0 || rec.State.PausedByUserID != "" {
		t.Fatalf("pause fields not cleared: %+v", rec.State)
	}
	if rec.State.ClockP1RemainingMs != frozenRemain {
		t.Fatalf("resume charged pause time: %d -> %d", frozenRemain, rec.State.ClockP1RemainingMs)
	}
	if delta := time.Now().UnixMilli() - rec.State.ClockLastTickUnixMs; delta < 0 || delta > 2_000 {
		t.Fatalf("clock tick not restarted at resume: delta=%d", delta)
	}
	if resumed["paused"] != false || resumed["pause_remaining_ms"] != int64(0) {
		t.Fatalf("resume payload paused=%v remaining=%v", resumed["paused"], resumed["pause_remaining_ms"])
	}
	if _, err := api.ResumeGameCore(ctx, "pause-1", p1); err != nil {
		t.Fatalf("idempotent resume: %v", err)
	}
	if rec.State.Paused {
		t.Fatal("idempotent resume paused the game")
	}
}

func TestSyncMatchClockAutoResumeDoesNotChargePause(t *testing.T) {
	t.Setenv("DAMA_ALLOW_MEMORY", "1")
	st, err := engine.InitialState("pvp", 0, 4, "fmjd_international")
	if err != nil {
		t.Fatal(err)
	}
	engine.ArmMatchClock(st, 60, 0)
	p1 := uuid.NewString()
	st.Player1ID = &p1
	p2 := uuid.NewString()
	st.Player2ID = &p2
	gs := NewGameStore(nil)
	if _, err := gs.Create("pause-expire", st); err != nil {
		t.Fatal(err)
	}
	settings := store.NewSettingsStore(nil)
	settings.SetMatchClockCacheForTest(store.MatchClockConfig{PauseEnabled: true, PauseDurationSeconds: 300})
	api := &API{Store: gs, Settings: settings}
	if _, err := api.PauseGameCore(context.Background(), "pause-expire", p1); err != nil {
		t.Fatal(err)
	}
	rec, _ := gs.Get("pause-expire")
	rec.State.ClockLastTickUnixMs = time.Now().UnixMilli() - 30_000
	remain := rec.State.ClockP1RemainingMs
	rec.State.PauseExpiresAtUnixMs = time.Now().UnixMilli() - 1

	if _, flagged, err := api.syncMatchClock(context.Background(), "pause-expire", rec.State); err != nil || flagged {
		t.Fatalf("syncMatchClock flagged=%v err=%v", flagged, err)
	}
	if rec.State.Paused {
		t.Fatal("expired pause should auto-resume")
	}
	if rec.State.ClockP1RemainingMs != remain {
		t.Fatalf("auto-resume charged %d ms", remain-rec.State.ClockP1RemainingMs)
	}
	if delta := time.Now().UnixMilli() - rec.State.ClockLastTickUnixMs; delta < 0 || delta > 2_000 {
		t.Fatalf("tick after auto-resume delta=%d", delta)
	}

	// Still inside the window: sync must not debit.
	if _, err := api.PauseGameCore(context.Background(), "pause-expire", p2); err != nil {
		t.Fatal(err)
	}
	rec.State.ClockLastTickUnixMs = time.Now().UnixMilli() - 20_000
	remain = rec.State.ClockP1RemainingMs
	if _, flagged, err := api.syncMatchClock(context.Background(), "pause-expire", rec.State); err != nil || flagged {
		t.Fatalf("paused sync flagged=%v err=%v", flagged, err)
	}
	if !rec.State.Paused || rec.State.ClockP1RemainingMs != remain {
		t.Fatal("sync debited or cleared an unexpired pause")
	}
}

func TestPauseDisabledAndPracticeSeat(t *testing.T) {
	t.Setenv("DAMA_ALLOW_MEMORY", "1")
	st, err := engine.InitialState("ai", 2, 4, "fmjd_international")
	if err != nil {
		t.Fatal(err)
	}
	gs := NewGameStore(nil)
	if _, err := gs.Create("pause-ai", st); err != nil {
		t.Fatal(err)
	}
	settings := store.NewSettingsStore(nil)
	settings.SetMatchClockCacheForTest(store.MatchClockConfig{PauseEnabled: false, PauseDurationSeconds: 300})
	api := &API{Store: gs, Settings: settings}
	guest := uuid.NewString()
	if _, err := api.PauseGameCore(context.Background(), "pause-ai", guest); err == nil || err.Error() != "pause disabled" {
		t.Fatalf("disabled pause: %v", err)
	}
	rec, _ := gs.Get("pause-ai")
	if rec.State.Paused || rec.State.Player1ID != nil {
		t.Fatal("disabled pause mutated state")
	}

	settings.SetMatchClockCacheForTest(store.MatchClockConfig{PauseEnabled: true, PauseDurationSeconds: 120})
	payload, err := api.PauseGameCore(context.Background(), "pause-ai", guest)
	if err != nil {
		t.Fatalf("practice pause: %v", err)
	}
	if rec.State.Player1ID == nil || *rec.State.Player1ID != guest {
		t.Fatal("practice human was not seated")
	}
	if payload["paused"] != true || rec.State.PauseExpiresAtUnixMs <= rec.State.PausedAtUnixMs {
		t.Fatal("practice pause did not arm expiry")
	}
	if _, err := api.ResumeGameCore(context.Background(), "pause-ai", uuid.NewString()); err == nil || err.Error() != "not a seat in this game" {
		t.Fatalf("non-seat resume: %v", err)
	}
	if !rec.State.Paused {
		t.Fatal("rejected resume cleared pause")
	}
}

func TestAbandonWhilePausedClearsPauseFields(t *testing.T) {
	t.Setenv("DAMA_ALLOW_MEMORY", "1")
	st, err := engine.InitialState("pvp", 0, 4, "fmjd_international")
	if err != nil {
		t.Fatal(err)
	}
	engine.ArmMatchClock(st, 60, 0)
	p1 := uuid.NewString()
	st.Player1ID = &p1
	p2 := uuid.NewString()
	st.Player2ID = &p2
	gs := NewGameStore(nil)
	if _, err := gs.Create("pause-abandon", st); err != nil {
		t.Fatal(err)
	}
	settings := store.NewSettingsStore(nil)
	settings.SetMatchClockCacheForTest(store.MatchClockConfig{PauseEnabled: true, PauseDurationSeconds: 300})
	api := &API{Store: gs, Settings: settings}
	ctx := context.Background()
	if _, err := api.PauseGameCore(ctx, "pause-abandon", p1); err != nil {
		t.Fatal(err)
	}
	payload, err := api.AbandonGameCore(ctx, "pause-abandon", p1)
	if err != nil {
		t.Fatalf("AbandonGameCore: %v", err)
	}
	rec, _ := gs.Get("pause-abandon")
	if rec.State.Paused || rec.State.PausedAtUnixMs != 0 || rec.State.PauseExpiresAtUnixMs != 0 || rec.State.PausedByUserID != "" {
		t.Fatalf("abandon left pause fields: %+v", rec.State)
	}
	if payload["paused"] != false {
		t.Fatalf("abandon payload still paused: %v", payload["paused"])
	}
}

func TestApplyStorePauseOntoPreservesFrozenClock(t *testing.T) {
	t.Setenv("DAMA_ALLOW_MEMORY", "1")
	st, err := engine.InitialState("ai", 2, 2, "fmjd_international")
	if err != nil {
		t.Fatal(err)
	}
	engine.ArmMatchClock(st, 60, 0)
	p1 := uuid.NewString()
	st.Player1ID = &p1
	st.ClockLastTickUnixMs = time.Now().UnixMilli()
	gs := NewGameStore(nil)
	if _, err := gs.Create("pause-merge", st); err != nil {
		t.Fatal(err)
	}
	settings := store.NewSettingsStore(nil)
	settings.SetMatchClockCacheForTest(store.MatchClockConfig{PauseEnabled: true, PauseDurationSeconds: 300})
	api := &API{Store: gs, Settings: settings}
	if _, err := api.PauseGameCore(context.Background(), "pause-merge", p1); err != nil {
		t.Fatal(err)
	}
	rec, _ := gs.Get("pause-merge")
	frozenP1 := rec.State.ClockP1RemainingMs
	frozenP2 := rec.State.ClockP2RemainingMs
	frozenTick := rec.State.ClockLastTickUnixMs

	// In-flight AI/move clone already debited past the pause snapshot.
	clone := *rec.State
	clone.Paused = false
	clone.PausedAtUnixMs = 0
	clone.PauseExpiresAtUnixMs = 0
	clone.PausedByUserID = ""
	clone.ClockP1RemainingMs = frozenP1 - 5_000
	clone.ClockLastTickUnixMs = frozenTick + 5_000

	if !api.applyStorePauseOnto("pause-merge", &clone) {
		t.Fatal("expected pause merge")
	}
	if !clone.Paused || clone.PausedByUserID != p1 {
		t.Fatal("pause flags not merged")
	}
	if clone.ClockP1RemainingMs != frozenP1 || clone.ClockP2RemainingMs != frozenP2 || clone.ClockLastTickUnixMs != frozenTick {
		t.Fatalf("frozen clock not restored: p1=%d p2=%d tick=%d", clone.ClockP1RemainingMs, clone.ClockP2RemainingMs, clone.ClockLastTickUnixMs)
	}
}

func TestIdempotentPauseAutoResumesWhenExpired(t *testing.T) {
	t.Setenv("DAMA_ALLOW_MEMORY", "1")
	st, err := engine.InitialState("pvp", 0, 4, "fmjd_international")
	if err != nil {
		t.Fatal(err)
	}
	engine.ArmMatchClock(st, 60, 0)
	p1 := uuid.NewString()
	p2 := uuid.NewString()
	st.Player1ID = &p1
	st.Player2ID = &p2
	gs := NewGameStore(nil)
	if _, err := gs.Create("pause-expired", st); err != nil {
		t.Fatal(err)
	}
	settings := store.NewSettingsStore(nil)
	settings.SetMatchClockCacheForTest(store.MatchClockConfig{PauseEnabled: true, PauseDurationSeconds: 300})
	api := &API{Store: gs, Settings: settings}
	if _, err := api.PauseGameCore(context.Background(), "pause-expired", p1); err != nil {
		t.Fatal(err)
	}
	rec, _ := gs.Get("pause-expired")
	rec.State.PauseExpiresAtUnixMs = time.Now().UnixMilli() - 1
	if err := gs.Update("pause-expired", rec.State); err != nil {
		t.Fatal(err)
	}
	payload, err := api.PauseGameCore(context.Background(), "pause-expired", p1)
	if err != nil {
		t.Fatalf("expired idempotent pause: %v", err)
	}
	if payload["paused"] != false || rec.State.Paused {
		t.Fatal("expected auto-resume on expired pause")
	}
}

func TestApplyMoveAutoResumesExpiredPause(t *testing.T) {
	t.Setenv("DAMA_ALLOW_MEMORY", "1")
	st, err := engine.InitialState("pvp", 0, 4, "fmjd_international")
	if err != nil {
		t.Fatal(err)
	}
	engine.ArmMatchClock(st, 60, 0)
	p1 := uuid.NewString()
	p2 := uuid.NewString()
	st.Player1ID = &p1
	st.Player2ID = &p2
	gs := NewGameStore(nil)
	if _, err := gs.Create("pause-move-expire", st); err != nil {
		t.Fatal(err)
	}
	settings := store.NewSettingsStore(nil)
	settings.SetMatchClockCacheForTest(store.MatchClockConfig{PauseEnabled: true, PauseDurationSeconds: 300})
	api := &API{Store: gs, Settings: settings}
	ctx := context.Background()
	if _, err := api.PauseGameCore(ctx, "pause-move-expire", p1); err != nil {
		t.Fatal(err)
	}
	rec, _ := gs.Get("pause-move-expire")
	rec.State.PauseExpiresAtUnixMs = time.Now().UnixMilli() - 1
	if err := gs.Update("pause-move-expire", rec.State); err != nil {
		t.Fatal(err)
	}
	if _, err := api.ApplyMoveCore(ctx, "pause-move-expire", p1, [2]int{6, 1}, [2]int{5, 0}); err != nil {
		t.Fatalf("move after expired pause: %v", err)
	}
	rec, _ = gs.Get("pause-move-expire")
	if rec.State.Paused {
		t.Fatal("expired pause should clear on move")
	}
}
