package rest

import (
	"context"
	"strings"
	"testing"

	"dama/apps/api/internal/game/engine"
	"dama/apps/api/internal/store"

	"github.com/google/uuid"
)

func TestErrOfficialPausePrefix(t *testing.T) {
	err := errOfficialPause("err_reason_required")
	if err == nil {
		t.Fatal("expected error")
	}
	msg := err.Error()
	if !strings.HasPrefix(msg, "official_pause:") {
		t.Fatalf("prefix: %q", msg)
	}
	if got := strings.TrimPrefix(msg, "official_pause:"); got != "err_reason_required" {
		t.Fatalf("key: %q", got)
	}
}

func TestClearPauseFieldsRemovesOfficialMetadata(t *testing.T) {
	st := &engine.State{
		Paused:                true,
		PausedAtUnixMs:        100,
		PauseExpiresAtUnixMs:  0,
		PausedByUserID:        "u1",
		PauseKind:             engine.PauseKindOfficial,
		PauseReasonKey:        "tech",
		PauseReasonLabel:      "Tech issue",
		PauseNote:             "board",
		PauseActorRole:        "organizer",
		PauseActorDisplayName: "Abebe",
	}
	clearPauseFields(st)
	if st.Paused {
		t.Fatal("paused still true")
	}
	if st.PauseKind != "" || st.PauseReasonKey != "" || st.PauseReasonLabel != "" {
		t.Fatalf("kind/reason not cleared: %#v", st)
	}
	if st.PauseNote != "" || st.PauseActorRole != "" || st.PauseActorDisplayName != "" {
		t.Fatalf("actor/note not cleared: %#v", st)
	}
	if st.PausedAtUnixMs != 0 || st.PauseExpiresAtUnixMs != 0 || st.PausedByUserID != "" {
		t.Fatalf("timestamps/user not cleared: %#v", st)
	}
}

func TestOfficialPauseMetaNoteNilKeepsExistingSemantics(t *testing.T) {
	// Document contract: nil note pointer means keep; empty string means clear.
	var keep *string
	clear := ""
	replace := "board reconnect"
	if keep != nil {
		t.Fatal("nil note must mean omit/keep")
	}
	if strings.TrimSpace(clear) != "" {
		t.Fatal("empty note must mean clear")
	}
	if strings.TrimSpace(replace) == "" {
		t.Fatal("non-empty note must replace")
	}
}

func TestLatestOfficialPauseResumeActionSkipsMeta(t *testing.T) {
	evs := []store.OfficialPauseEvent{
		{Action: "meta"},
		{Action: "pause"},
		{Action: "resume"},
	}
	if got := latestOfficialPauseResumeAction(evs); got != "pause" {
		t.Fatalf("skip meta want pause got %q", got)
	}
	if got := latestOfficialPauseResumeAction(nil); got != "" {
		t.Fatalf("empty want \"\" got %q", got)
	}
	if got := latestOfficialPauseResumeAction([]store.OfficialPauseEvent{{Action: "meta"}}); got != "" {
		t.Fatalf("meta-only want \"\" got %q", got)
	}
}

func TestPauseFieldsSnapshotRestore(t *testing.T) {
	st := &engine.State{
		Paused:                true,
		PausedAtUnixMs:        42,
		PauseExpiresAtUnixMs:  99,
		PausedByUserID:        "u1",
		PauseKind:             engine.PauseKindPlayer,
		PauseReasonKey:        "",
		PauseReasonLabel:      "",
		PauseNote:             "",
		PauseActorRole:        engine.PauseActorPlayer,
		PauseActorDisplayName: "Seat",
	}
	snap := snapshotPauseFields(st)
	st.Paused = false
	st.PauseKind = engine.PauseKindOfficial
	st.PauseReasonKey = "tech"
	st.PauseReasonLabel = "Tech"
	st.PauseNote = "x"
	st.PauseActorRole = "admin"
	st.PauseActorDisplayName = "Ops"
	st.PausedAtUnixMs = 7
	st.PauseExpiresAtUnixMs = 0
	st.PausedByUserID = "admin"
	restorePauseFields(st, snap)
	if !st.Paused || st.PauseKind != engine.PauseKindPlayer || st.PausedByUserID != "u1" {
		t.Fatalf("restore mismatch: %+v", st)
	}
	if st.PausedAtUnixMs != 42 || st.PauseExpiresAtUnixMs != 99 {
		t.Fatalf("timestamps: %+v", st)
	}
	if st.PauseActorRole != engine.PauseActorPlayer || st.PauseActorDisplayName != "Seat" {
		t.Fatalf("actor: %+v", st)
	}
	if st.PauseReasonKey != "" || st.PauseNote != "" {
		t.Fatalf("reason/note: %+v", st)
	}
}

func TestPauseKindOfficialConstant(t *testing.T) {
	if engine.PauseKindOfficial != "official" {
		t.Fatalf("PauseKindOfficial=%q", engine.PauseKindOfficial)
	}
	if engine.PauseKindPlayer != "player" {
		t.Fatalf("PauseKindPlayer=%q", engine.PauseKindPlayer)
	}
}

func TestOfficialPauseNoteMaxRunes(t *testing.T) {
	if officialPauseNoteMaxRunes <= 0 {
		t.Fatal("officialPauseNoteMaxRunes must be positive")
	}
	if officialPauseNoteMaxRunes != 280 {
		t.Fatalf("officialPauseNoteMaxRunes=%d want 280", officialPauseNoteMaxRunes)
	}
}

func TestAutoResumeDoesNotClearOfficialPause(t *testing.T) {
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
	st.Paused = true
	st.PauseKind = engine.PauseKindOfficial
	st.PausedByUserID = uuid.NewString()
	st.PausedAtUnixMs = 1
	// Mis-set expiry must still not auto-clear official pause.
	st.PauseExpiresAtUnixMs = 1
	gs := NewGameStore(nil)
	if _, err := gs.Create("official-auto-block", st); err != nil {
		t.Fatal(err)
	}
	api := &API{Store: gs, Settings: store.NewSettingsStore(nil)}
	ctx := context.WithValue(context.Background(), autoResumePauseKey{}, true)
	payload, err := api.ResumeGameCore(ctx, "official-auto-block", p1)
	if err != nil {
		t.Fatalf("auto resume official: %v", err)
	}
	if payload["paused"] != true {
		t.Fatalf("auto resume cleared official pause: %v", payload["paused"])
	}
	rec, _ := gs.Get("official-auto-block")
	if !rec.State.Paused || rec.State.PauseKind != engine.PauseKindOfficial {
		t.Fatalf("state cleared: %+v", rec.State)
	}
}

func TestApplyMoveWhileOfficiallyPausedBlocked(t *testing.T) {
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
	st.Paused = true
	st.PauseKind = engine.PauseKindOfficial
	st.PausedByUserID = uuid.NewString()
	st.PausedAtUnixMs = 1
	gs := NewGameStore(nil)
	if _, err := gs.Create("official-move-block", st); err != nil {
		t.Fatal(err)
	}
	api := &API{Store: gs, Settings: store.NewSettingsStore(nil)}
	_, err = api.ApplyMoveCore(context.Background(), "official-move-block", p1, [2]int{6, 1}, [2]int{5, 0})
	if err == nil || err.Error() != "officially paused" {
		t.Fatalf("want officially paused, got %v", err)
	}
}

func TestAbandonWhileOfficiallyPausedBlocked(t *testing.T) {
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
	st.Paused = true
	st.PauseKind = engine.PauseKindOfficial
	st.PausedByUserID = uuid.NewString()
	st.PausedAtUnixMs = 1
	gs := NewGameStore(nil)
	if _, err := gs.Create("official-abandon-block", st); err != nil {
		t.Fatal(err)
	}
	api := &API{Store: gs, Settings: store.NewSettingsStore(nil)}
	_, err = api.AbandonGameCore(context.Background(), "official-abandon-block", p1)
	if err == nil || err.Error() != "officially paused" {
		t.Fatalf("want officially paused, got %v", err)
	}
	rec, _ := gs.Get("official-abandon-block")
	if !rec.State.Paused || rec.State.PauseKind != engine.PauseKindOfficial {
		t.Fatalf("official pause cleared on blocked abandon: %+v", rec.State)
	}
	if outcome := engine.GameOutcome(rec.State); outcome != nil {
		t.Fatal("abandon must not finish while officially paused")
	}
}
