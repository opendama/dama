package media

import (
	"bytes"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"strings"

	"dama/apps/api/internal/store"

	_ "golang.org/x/image/webp"
)

// ValidateViewportImageAspect decodes image bounds and checks slot aspect within tolerance.
// ratioLabel is the DB chrome label for the slot (e.g. "16:9"); fail closed if unparsable.
func ValidateViewportImageAspect(data []byte, slot, ratioLabel string, tolerance float64) error {
	aspect, ok := store.ViewportAspectForLabel(slot, ratioLabel)
	if !ok {
		return fmt.Errorf("invalid viewport slot or ratio label")
	}
	if tolerance <= 0 {
		return fmt.Errorf("aspect tolerance unavailable")
	}
	cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("unable to decode image")
	}
	if !store.AspectMatches(cfg.Width, cfg.Height, aspect.W, aspect.H, tolerance) {
		return fmt.Errorf("aspect ratio mismatch")
	}
	return nil
}

// IsAllowedAdVideoContentType reports MP4/MOV/WebM.
func IsAllowedAdVideoContentType(contentType, filename string) bool {
	ct := strings.ToLower(strings.TrimSpace(contentType))
	name := strings.ToLower(strings.TrimSpace(filename))
	switch {
	case strings.Contains(ct, "mp4"), strings.HasSuffix(name, ".mp4"):
		return true
	case strings.Contains(ct, "quicktime"), strings.HasSuffix(name, ".mov"):
		return true
	case strings.Contains(ct, "webm"), strings.HasSuffix(name, ".webm"):
		return true
	default:
		return false
	}
}
