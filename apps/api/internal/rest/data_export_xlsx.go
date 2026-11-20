package rest

import (
	"bytes"
	"fmt"
	"time"

	"github.com/xuri/excelize/v2"
)

// buildAccountDataExportXLSX renders public-safe account fields as a single-sheet workbook.
func buildAccountDataExportXLSX(payload map[string]any) ([]byte, error) {
	f := excelize.NewFile()
	defer func() { _ = f.Close() }()
	const sheet = "Account"
	if err := f.SetSheetName("Sheet1", sheet); err != nil {
		return nil, err
	}
	headers := []string{"id", "username", "email", "rating", "xp", "role", "created_at"}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		if err := f.SetCellValue(sheet, cell, h); err != nil {
			return nil, err
		}
	}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 2)
		val := formatExportCell(payload[h])
		if err := f.SetCellValue(sheet, cell, val); err != nil {
			return nil, err
		}
	}
	_ = f.SetColWidth(sheet, "A", "G", 22)
	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func formatExportCell(v any) any {
	if v == nil {
		return ""
	}
	switch t := v.(type) {
	case time.Time:
		if t.IsZero() {
			return ""
		}
		return t.UTC().Format(time.RFC3339)
	case *time.Time:
		if t == nil || t.IsZero() {
			return ""
		}
		return t.UTC().Format(time.RFC3339)
	case string:
		return t
	case float64, float32, int, int64, int32, bool:
		return t
	default:
		return fmt.Sprint(t)
	}
}
