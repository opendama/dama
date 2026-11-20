package rest

import (
	"bytes"
	"testing"
	"time"

	"github.com/xuri/excelize/v2"
)

func TestBuildAccountDataExportXLSX(t *testing.T) {
	created := time.Date(2024, 6, 15, 12, 0, 0, 0, time.UTC)
	raw, err := buildAccountDataExportXLSX(map[string]any{
		"id":         "u1",
		"username":   "alice",
		"email":      "alice@example.com",
		"rating":     1200,
		"xp":         50,
		"role":       "player",
		"created_at": created,
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(raw) < 64 {
		t.Fatalf("xlsx too small: %d", len(raw))
	}
	// ZIP/XLSX magic
	if !bytes.HasPrefix(raw, []byte("PK")) {
		t.Fatalf("not a zip/xlsx payload")
	}
	f, err := excelize.OpenReader(bytes.NewReader(raw))
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = f.Close() }()
	got, err := f.GetCellValue("Account", "A1")
	if err != nil || got != "id" {
		t.Fatalf("header A1=%q err=%v", got, err)
	}
	user, err := f.GetCellValue("Account", "B2")
	if err != nil || user != "alice" {
		t.Fatalf("username B2=%q err=%v", user, err)
	}
	ts, err := f.GetCellValue("Account", "G2")
	if err != nil || ts != created.Format(time.RFC3339) {
		t.Fatalf("created_at G2=%q err=%v", ts, err)
	}
}
