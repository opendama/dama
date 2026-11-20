package rest

import (
	"bytes"
	"context"
	"fmt"
	"image"
	"image/color"
	imagedraw "image/draw"
	"image/png"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/brandassets"
	"dama/apps/api/internal/gamestore"
	"dama/apps/api/internal/store"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	qrcode "github.com/skip2/go-qrcode"
)

// GameQRAPI serves join QR codes for games (origin from DB play_rail_chrome).
type GameQRAPI struct {
	Games       *gamestore.Store
	Matches     *store.MatchHistoryStore
	Settings    *store.SettingsStore
	CanSpectate func(ctx context.Context, userID, gameID string) bool
}

func (a *GameQRAPI) requireSpectateAllowed(w http.ResponseWriter, r *http.Request, gameID string) bool {
	if a == nil || a.CanSpectate == nil {
		return true
	}
	userID := auth.UserIDFromContext(r.Context())
	if a.CanSpectate(r.Context(), userID, gameID) {
		return true
	}
	writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
	return false
}

func (a *GameQRAPI) gameKnown(r *http.Request, gameID string) bool {
	if a.Games != nil {
		if _, ok := a.Games.Get(gameID); ok {
			return true
		}
	}
	if a.Matches != nil {
		if m, err := a.Matches.ByGameID(r.Context(), gameID); err == nil && m != nil {
			return true
		}
	}
	return false
}

func (a *GameQRAPI) joinURL(r *http.Request, gameID string) (string, error) {
	if a.Settings == nil {
		return "", fmt.Errorf("qr unavailable")
	}
	origin, err := a.Settings.PlayRailWebAppOrigin(r.Context())
	if err != nil || strings.TrimSpace(origin) == "" {
		return "", fmt.Errorf("qr unavailable")
	}
	origin = strings.TrimRight(strings.TrimSpace(origin), "/")
	return fmt.Sprintf("%s/?view=spectate&gameId=%s", origin, gameID), nil
}

var (
	brandLogoOnce sync.Once
	brandLogoImg  image.Image
	brandLogoErr  error

	// joinQRCache holds PNGs warmed at game create (and filled on first GET).
	// Key includes logo revision so logo/plate fixes are not served from stale PNGs.
	joinQRCache    sync.Map // joinQRCacheRev+":"+gameID -> []byte
	joinQRCacheRev = "v24"
)

// resolveBrandLogoPath finds the sample dama mark under assets/brand (deploy + monorepo cwd).
func resolveBrandLogoPath() string {
	candidates := []string{
		"assets/brand/dama-mark.png",
		filepath.Join("apps", "api", "assets", "brand", "dama-mark.png"),
	}
	if exe, err := os.Executable(); err == nil {
		dir := filepath.Dir(exe)
		candidates = append(candidates,
			filepath.Join(dir, "assets", "brand", "dama-mark.png"),
			filepath.Join(dir, "..", "assets", "brand", "dama-mark.png"),
		)
	}
	if wd, err := os.Getwd(); err == nil {
		candidates = append(candidates,
			filepath.Join(wd, "assets", "brand", "dama-mark.png"),
			filepath.Join(wd, "apps", "api", "assets", "brand", "dama-mark.png"),
		)
	}
	for _, p := range candidates {
		if st, err := os.Stat(p); err == nil && !st.IsDir() {
			return p
		}
	}
	return ""
}

func loadBrandLogo() (image.Image, error) {
	brandLogoOnce.Do(func() {
		// Prefer embedded mark (Docker single-binary). Fall back to filesystem for local/dev.
		if len(brandassets.DamaMarkPNG) > 0 {
			img, err := png.Decode(bytes.NewReader(brandassets.DamaMarkPNG))
			if err == nil && img != nil {
				brandLogoImg = img
				return
			}
			brandLogoErr = err
		}
		path := resolveBrandLogoPath()
		if path == "" {
			if brandLogoErr == nil {
				brandLogoErr = fmt.Errorf("brand logo missing")
			}
			return
		}
		f, err := os.Open(path)
		if err != nil {
			brandLogoErr = err
			return
		}
		defer f.Close()
		img, err := png.Decode(f)
		if err != nil {
			brandLogoErr = err
			return
		}
		brandLogoImg = img
		brandLogoErr = nil
	})
	return brandLogoImg, brandLogoErr
}

// cropCenterSquare returns a centered square crop (fixes wide assets like 1280x720 marks).
func cropCenterSquare(src image.Image) image.Image {
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	side := w
	if h < side {
		side = h
	}
	x0 := b.Min.X + (w-side)/2
	y0 := b.Min.Y + (h-side)/2
	out := image.NewRGBA(image.Rect(0, 0, side, side))
	imagedraw.Draw(out, out.Bounds(), src, image.Pt(x0, y0), imagedraw.Src)
	return out
}

// isBrandMarkBackground reports baked checkerboard / near-white / transparent padding in brand assets.
func isBrandMarkBackground(c color.Color) bool {
	r16, g16, b16, a16 := c.RGBA()
	if a16 < 0xffff/2 {
		return true
	}
	r, g, b := int(r16>>8), int(g16>>8), int(b16>>8)
	if r >= 245 && g >= 245 && b >= 245 {
		return true
	}
	// Light gray checker cells (~221) used as fake transparency in some exports.
	if r >= 200 && g >= 200 && b >= 200 {
		dg := r - g
		if dg < 0 {
			dg = -dg
		}
		db := g - b
		if db < 0 {
			db = -db
		}
		if dg <= 24 && db <= 24 {
			return true
		}
	}
	return false
}

// extractBrandMarkSquare crops to the opaque brand artwork and paints only mark pixels
// onto pad (drops checkerboard padding AND checker corners inside the mark bbox).
func extractBrandMarkSquare(src image.Image) image.Image {
	return extractBrandMarkSquareOnto(src, color.White)
}

func extractBrandMarkSquareOnto(src image.Image, pad color.Color) image.Image {
	sq := cropCenterSquare(src)
	b := sq.Bounds()
	w, h := b.Dx(), b.Dy()
	// Flood-fill exterior light/transparent pad from the edges so interior white
	// brand icon pixels are kept (they are not edge-connected).
	exterior := markExteriorPad(sq)
	minX, minY := w, h
	maxX, maxY := -1, -1
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			if exterior[y*w+x] {
				continue
			}
			if x < minX {
				minX = x
			}
			if y < minY {
				minY = y
			}
			if x > maxX {
				maxX = x
			}
			if y > maxY {
				maxY = y
			}
		}
	}
	if maxX < 0 {
		out := image.NewRGBA(image.Rect(0, 0, w, h))
		imagedraw.Draw(out, out.Bounds(), &image.Uniform{C: pad}, image.Point{}, imagedraw.Src)
		return out
	}
	cw, ch := maxX-minX+1, maxY-minY+1
	side := cw
	if ch > side {
		side = ch
	}
	out := image.NewRGBA(image.Rect(0, 0, side, side))
	imagedraw.Draw(out, out.Bounds(), &image.Uniform{C: pad}, image.Point{}, imagedraw.Src)
	ox := (side - cw) / 2
	oy := (side - ch) / 2
	for y := 0; y < ch; y++ {
		for x := 0; x < cw; x++ {
			sx, sy := minX+x, minY+y
			if exterior[sy*w+sx] {
				continue
			}
			out.Set(ox+x, oy+y, sq.At(b.Min.X+sx, b.Min.Y+sy))
		}
	}
	return out
}

// markExteriorPad flood-fills light/transparent pixels reachable from the image border.
func markExteriorPad(src image.Image) []bool {
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	out := make([]bool, w*h)
	type pt struct{ x, y int }
	q := make([]pt, 0, w+h)
	push := func(x, y int) {
		if x < 0 || y < 0 || x >= w || y >= h {
			return
		}
		i := y*w + x
		if out[i] {
			return
		}
		if !isBrandMarkBackground(src.At(b.Min.X+x, b.Min.Y+y)) {
			return
		}
		out[i] = true
		q = append(q, pt{x, y})
	}
	for x := 0; x < w; x++ {
		push(x, 0)
		push(x, h-1)
	}
	for y := 0; y < h; y++ {
		push(0, y)
		push(w-1, y)
	}
	for len(q) > 0 {
		p := q[0]
		q = q[1:]
		push(p.x-1, p.y)
		push(p.x+1, p.y)
		push(p.x, p.y-1)
		push(p.x, p.y+1)
	}
	return out
}

// fillRoundedRect draws an opaque rounded rectangle (square plate for QR logo).
func fillRoundedRect(dst *image.RGBA, x0, y0, w, h, rad int, c color.Color) {
	if w <= 0 || h <= 0 {
		return
	}
	if rad < 0 {
		rad = 0
	}
	maxRad := w / 2
	if h/2 < maxRad {
		maxRad = h / 2
	}
	if rad > maxRad {
		rad = maxRad
	}
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			inside := true
			if x < rad && y < rad {
				dx, dy := rad-x, rad-y
				inside = dx*dx+dy*dy <= rad*rad
			} else if x >= w-rad && y < rad {
				dx, dy := x-(w-rad-1), rad-y
				inside = dx*dx+dy*dy <= rad*rad
			} else if x < rad && y >= h-rad {
				dx, dy := rad-x, y-(h-rad-1)
				inside = dx*dx+dy*dy <= rad*rad
			} else if x >= w-rad && y >= h-rad {
				dx, dy := x-(w-rad-1), y-(h-rad-1)
				inside = dx*dx+dy*dy <= rad*rad
			}
			if inside {
				dst.Set(x0+x, y0+y, c)
			}
		}
	}
}

// encodeJoinQRPNG builds a High-ECC QR with a single rounded-square brand badge.
// Uses transparent burgundy assets/brand/dama-mark.png (no baked disc). White
// plate provides scan contrast; burgundy mark sits on top (interchangeable with
// dama-mark-white.png for dark surfaces elsewhere).
func encodeJoinQRPNG(joinURL string, size int) ([]byte, error) {
	if size < 128 {
		size = 512
	}
	q, err := qrcode.New(joinURL, qrcode.High)
	if err != nil {
		return nil, err
	}
	q.DisableBorder = false
	qrImg := q.Image(size)

	logo, err := loadBrandLogo()
	if err != nil || logo == nil {
		return nil, fmt.Errorf("brand logo unavailable")
	}

	out := image.NewRGBA(image.Rect(0, 0, size, size))
	imagedraw.Draw(out, out.Bounds(), qrImg, image.Point{}, imagedraw.Src)

	// Industry High-ECC logo budget: ~18% of QR edge (smaller plate, still scannable).
	box := size * 18 / 100
	if box < 56 {
		box = 56
	}
	cx, cy := size/2, size/2
	x0, y0 := cx-box/2, cy-box/2
	corner := box * 22 / 100
	if corner < 8 {
		corner = 8
	}

	// White plate so transparent burgundy mark stays crisp on QR modules.
	plate := color.RGBA{R: 0xFF, G: 0xFF, B: 0xFF, A: 0xFF}
	fillRoundedRect(out, x0, y0, box, box, corner, plate)
	mark := extractBrandMarkSquareOnto(logo, color.Alpha{A: 0})
	zoom := box * 78 / 100
	if zoom < 1 {
		zoom = box
	}
	scaled := scaleImageNearest(mark, zoom, zoom)
	ox := x0 + (box-zoom)/2
	oy := y0 + (box-zoom)/2
	drawImageAlpha(out, ox, oy, scaled)

	var buf bytes.Buffer
	if err := png.Encode(&buf, out); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// drawImageAlpha composites src over dst at (x0,y0) honoring per-pixel alpha.
func drawImageAlpha(dst *image.RGBA, x0, y0 int, src image.Image) {
	if dst == nil || src == nil {
		return
	}
	sb := src.Bounds()
	for y := sb.Min.Y; y < sb.Max.Y; y++ {
		for x := sb.Min.X; x < sb.Max.X; x++ {
			sr, sg, sb16, sa := src.At(x, y).RGBA()
			if sa == 0 {
				continue
			}
			dx, dy := x0+(x-sb.Min.X), y0+(y-sb.Min.Y)
			if dx < dst.Rect.Min.X || dy < dst.Rect.Min.Y || dx >= dst.Rect.Max.X || dy >= dst.Rect.Max.Y {
				continue
			}
			dr, dg, db, da := dst.At(dx, dy).RGBA()
			// Standard over: out = src + dst*(1-srcA)
			inv := 0xffff - sa
			outR := (sr*sa + dr*inv) / 0xffff
			outG := (sg*sa + dg*inv) / 0xffff
			outB := (sb16*sa + db*inv) / 0xffff
			outA := sa + (da*inv)/0xffff
			dst.Set(dx, dy, color.RGBA{
				R: uint8(outR >> 8),
				G: uint8(outG >> 8),
				B: uint8(outB >> 8),
				A: uint8(outA >> 8),
			})
		}
	}
}

// scaleImageNearest resizes src to dw×dh with nearest-neighbor sampling (1:1 aspect).
func scaleImageNearest(src image.Image, dw, dh int) *image.RGBA {
	out := image.NewRGBA(image.Rect(0, 0, dw, dh))
	if src == nil || dw <= 0 || dh <= 0 {
		return out
	}
	sb := src.Bounds()
	sw, sh := sb.Dx(), sb.Dy()
	if sw <= 0 || sh <= 0 {
		return out
	}
	for y := 0; y < dh; y++ {
		sy := sb.Min.Y + y*sh/dh
		for x := 0; x < dw; x++ {
			sx := sb.Min.X + x*sw/dw
			out.Set(x, y, src.At(sx, sy))
		}
	}
	return out
}

// cropCenterSquareSize returns a side×side crop from the center of src.
func cropCenterSquareSize(src image.Image, side int) *image.RGBA {
	out := image.NewRGBA(image.Rect(0, 0, side, side))
	if src == nil || side <= 0 {
		return out
	}
	sb := src.Bounds()
	sw, sh := sb.Dx(), sb.Dy()
	ox := sb.Min.X + (sw-side)/2
	oy := sb.Min.Y + (sh-side)/2
	for y := 0; y < side; y++ {
		for x := 0; x < side; x++ {
			sx, sy := ox+x, oy+y
			if sx < sb.Min.X || sy < sb.Min.Y || sx >= sb.Max.X || sy >= sb.Max.Y {
				continue
			}
			out.Set(x, y, src.At(sx, sy))
		}
	}
	return out
}

// drawDamaPieceIcon paints the brand draughts-piece mark from assets/brand/dama-mark.svg
// proportions (viewBox 0..128) into a square plate - solid crown + base only.
// No outer circular disc and no head hole (avoids circle-on-square “two plates” look).
// Fits entirely inside the plate with padding so the head stays circular (no clip→oval).
func drawDamaPieceIcon(dst *image.RGBA, x0, y0, box int, ink, hole color.Color) {
	_ = hole // plate color unused: solid white piece (no nested burgundy disc).
	if box <= 0 {
		return
	}
	// SVG piece bounds (no outer disc): x 34..94 (60), y 28..96 (68). Fit with ~5% pad (large mark).
	const (
		svgMinX = 34.0
		svgMinY = 28.0
		svgW    = 60.0
		svgH    = 68.0
		padFrac = 0.05
	)
	pad := float64(box) * padFrac
	inner := float64(box) - 2*pad
	s := inner / svgH
	if svgW*s > inner {
		s = inner / svgW
	}
	// Center the SVG piece bbox in the plate.
	ox := float64(x0) + pad + (inner-svgW*s)/2 - svgMinX*s
	oy := float64(y0) + pad + (inner-svgH*s)/2 - svgMinY*s
	fillEllipse := func(cx, cy, rx, ry float64, c color.Color) {
		cx = ox + cx*s
		cy = oy + cy*s
		rx *= s
		ry *= s
		minX := int(cx - rx - 1)
		maxX := int(cx + rx + 1)
		minY := int(cy - ry - 1)
		maxY := int(cy + ry + 1)
		rx2, ry2 := rx*rx, ry*ry
		if rx2 <= 0 || ry2 <= 0 {
			return
		}
		for y := minY; y <= maxY; y++ {
			for x := minX; x <= maxX; x++ {
				dx, dy := float64(x)-cx, float64(y)-cy
				if (dx*dx)/rx2+(dy*dy)/ry2 <= 1 {
					if x >= x0 && y >= y0 && x < x0+box && y < y0+box {
						dst.Set(x, y, c)
					}
				}
			}
		}
	}
	fillCircle := func(cx, cy, r float64, c color.Color) {
		fillEllipse(cx, cy, r, r, c)
	}
	// SVG piece geometry; thicken bases so the mark stays bold at QR scale. Solid head (no hole).
	fillEllipse(64, 86, 30*1.25, 12*1.35, ink)
	fillEllipse(64, 78, 26*1.25, 11*1.35, ink)
	fillCircle(64, 52, 25, ink)
}

// drawRoundedImage copies src into dst at (x0,y0) masked to a rounded rectangle.
func drawRoundedImage(dst *image.RGBA, x0, y0, w, h, rad int, src image.Image) {
	if w <= 0 || h <= 0 || src == nil {
		return
	}
	if rad < 0 {
		rad = 0
	}
	maxRad := w / 2
	if h/2 < maxRad {
		maxRad = h / 2
	}
	if rad > maxRad {
		rad = maxRad
	}
	sb := src.Bounds()
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			inside := true
			if x < rad && y < rad {
				dx, dy := rad-x, rad-y
				inside = dx*dx+dy*dy <= rad*rad
			} else if x >= w-rad && y < rad {
				dx, dy := x-(w-rad-1), rad-y
				inside = dx*dx+dy*dy <= rad*rad
			} else if x < rad && y >= h-rad {
				dx, dy := rad-x, y-(h-rad-1)
				inside = dx*dx+dy*dy <= rad*rad
			} else if x >= w-rad && y >= h-rad {
				dx, dy := x-(w-rad-1), y-(h-rad-1)
				inside = dx*dx+dy*dy <= rad*rad
			}
			if !inside {
				continue
			}
			dst.Set(x0+x, y0+y, src.At(sb.Min.X+x, sb.Min.Y+y))
		}
	}
}

// WarmJoinQRPNG pre-builds the High-ECC join QR when a game is created (async).
// Safe to call from matchmaking / StartGame; no-ops when settings/origin/logo unavailable.
func WarmJoinQRPNG(settings *store.SettingsStore, gameID string) {
	gameID = strings.TrimSpace(gameID)
	if settings == nil || gameID == "" {
		return
	}
	if _, err := uuid.Parse(gameID); err != nil {
		return
	}
	go func() {
		origin, err := settings.PlayRailWebAppOrigin(context.Background())
		if err != nil || strings.TrimSpace(origin) == "" {
			return
		}
		origin = strings.TrimRight(strings.TrimSpace(origin), "/")
		joinURL := fmt.Sprintf("%s/?view=spectate&gameId=%s", origin, gameID)
		pngBytes, err := encodeJoinQRPNG(joinURL, 512)
		if err != nil || len(pngBytes) == 0 {
			return
		}
		joinQRCache.Store(joinQRCacheRev+":"+gameID, pngBytes)
	}()
}

func (a *GameQRAPI) qrContentDisposition(r *http.Request, gameID string) (string, error) {
	if a.Settings == nil {
		return "", fmt.Errorf("qr unavailable")
	}
	prefix, err := a.Settings.PlayRailQRFilenamePrefix(r.Context())
	if err != nil || prefix == "" {
		return "", fmt.Errorf("qr unavailable")
	}
	return fmt.Sprintf(`inline; filename="%s%s.png"`, prefix, gameID), nil
}

// GetQRPNG returns a PNG QR for the spectate/join URL of a game.
func (a *GameQRAPI) GetQRPNG(w http.ResponseWriter, r *http.Request) {
	gameID := strings.TrimSpace(chi.URLParam(r, "id"))
	if gameID == "" || !a.gameKnown(r, gameID) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "game not found"})
		return
	}
	if !a.requireSpectateAllowed(w, r, gameID) {
		return
	}
	cd, err := a.qrContentDisposition(r, gameID)
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "qr unavailable"})
		return
	}
	cacheKey := joinQRCacheRev + ":" + gameID
	if cached, ok := joinQRCache.Load(cacheKey); ok {
		if pngBytes, ok := cached.([]byte); ok && len(pngBytes) > 0 {
			w.Header().Set("Content-Type", "image/png")
			w.Header().Set("Cache-Control", "public, max-age=60")
			w.Header().Set("Content-Disposition", cd)
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(pngBytes)
			return
		}
	}
	joinURL, err := a.joinURL(r, gameID)
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "qr unavailable"})
		return
	}
	pngBytes, err := encodeJoinQRPNG(joinURL, 512)
	if err != nil {
		writeClientError(w, http.StatusInternalServerError, "unable to generate qr")
		return
	}
	joinQRCache.Store(cacheKey, pngBytes)
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "public, max-age=60")
	w.Header().Set("Content-Disposition", cd)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(pngBytes)
}

// GetJoinURL returns the DB-origin join URL JSON (for clients that render QR themselves).
func (a *GameQRAPI) GetJoinURL(w http.ResponseWriter, r *http.Request) {
	gameID := strings.TrimSpace(chi.URLParam(r, "id"))
	if gameID == "" || !a.gameKnown(r, gameID) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "game not found"})
		return
	}
	if !a.requireSpectateAllowed(w, r, gameID) {
		return
	}
	joinURL, err := a.joinURL(r, gameID)
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "qr unavailable"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"game_id":  gameID,
		"join_url": joinURL,
	})
}
