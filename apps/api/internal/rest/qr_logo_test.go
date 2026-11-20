package rest

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"sync"
	"testing"
)

func TestEncodeJoinQRPNG_RoundedSquarePlateNoOval(t *testing.T) {
	// resolveBrandLogoPath walks cwd + apps/api/assets; tests run from package dir.
	wd, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	apiRoot := filepath.Clean(filepath.Join(wd, "..", ".."))
	if err := os.Chdir(apiRoot); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chdir(wd) })
	// Reset sync.Once so logo reloads from the new cwd.
	brandLogoOnce = sync.Once{}
	brandLogoImg = nil
	brandLogoErr = nil

	pngBytes, err := encodeJoinQRPNG("https://example.test/?view=spectate&gameId=test", 512)
	if err != nil {
		t.Fatalf("encodeJoinQRPNG: %v (cwd=%s path=%s)", err, apiRoot, resolveBrandLogoPath())
	}
	if len(pngBytes) < 1000 {
		t.Fatalf("png too small: %d", len(pngBytes))
	}
	img, err := png.Decode(bytes.NewReader(pngBytes))
	if err != nil {
		t.Fatalf("decode: %v", err)
	}
	b := img.Bounds()
	if b.Dx() != 512 || b.Dy() != 512 {
		t.Fatalf("size=%dx%d want 512x512", b.Dx(), b.Dy())
	}

	// Center pixel of plate must be opaque (logo or white pad) - not transparent QR yield.
	cx, cy := 256, 256
	_, _, _, a := img.At(cx, cy).RGBA()
	if a < 0xffff/2 {
		t.Fatalf("center alpha too low (logo/plate missing)")
	}

	// Plate is ~18% of edge (~92px); sample just inside the plate mid-top.
	px, py := 256, 256-40
	r, g, bl, _ := img.At(px, py).RGBA()
	// White plate or dark logo mark both OK; fully transparent would fail.
	lum := (r + g + bl) / 3
	if lum == 0 {
		t.Fatalf("plate sample unexpectedly empty at mid-top")
	}

	out := filepath.Join(t.TempDir(), "join-qr-sample.png")
	if err := os.WriteFile(out, pngBytes, 0o644); err != nil {
		t.Fatalf("write sample: %v", err)
	}
	// Also copy beside test for manual visual check when -v.
	_ = os.WriteFile(filepath.Join(".", "testdata_join_qr_sample.png"), pngBytes, 0o644)
	t.Logf("wrote sample %s", out)
}

func TestCropCenterSquare(t *testing.T) {
	wide := image.NewRGBA(image.Rect(0, 0, 1280, 720))
	for y := 0; y < 720; y++ {
		for x := 0; x < 1280; x++ {
			wide.Set(x, y, color.RGBA{R: 128, A: 255})
		}
	}
	sq := cropCenterSquare(wide)
	sb := sq.Bounds()
	if sb.Dx() != 720 || sb.Dy() != 720 {
		t.Fatalf("crop=%dx%d want 720x720", sb.Dx(), sb.Dy())
	}
}

func TestExtractBrandMarkSquareDropsCheckerPad(t *testing.T) {
	// Fake 200x200: gray checker padding + maroon disc with white interior icon.
	src := image.NewRGBA(image.Rect(0, 0, 200, 200))
	for y := 0; y < 200; y++ {
		for x := 0; x < 200; x++ {
			if (x/8+y/8)%2 == 0 {
				src.Set(x, y, color.RGBA{R: 221, G: 221, B: 221, A: 255})
			} else {
				src.Set(x, y, color.White)
			}
		}
	}
	for y := 60; y < 140; y++ {
		for x := 60; x < 140; x++ {
			dx, dy := x-100, y-100
			if dx*dx+dy*dy <= 35*35 {
				src.Set(x, y, color.RGBA{R: 121, G: 26, B: 48, A: 255})
			}
			if dx*dx+dy*dy <= 12*12 {
				src.Set(x, y, color.White) // interior icon must survive extract
			}
		}
	}
	out := extractBrandMarkSquare(src)
	ob := out.Bounds()
	if ob.Dx() < 60 || ob.Dx() > 90 || ob.Dx() != ob.Dy() {
		t.Fatalf("extract side=%d want ~70 square", ob.Dx())
	}
	// Center should be white icon, not checker gray / not stripped.
	r, g, b, _ := out.At(ob.Dx()/2, ob.Dy()/2).RGBA()
	if int(r>>8) < 240 || int(g>>8) < 240 || int(b>>8) < 240 {
		t.Fatalf("center icon lost (rgba=%d,%d,%d)", r>>8, g>>8, b>>8)
	}
	// Corner pad must be white (default pad), not checker gray.
	cr, cg, cb, ca := out.At(0, 0).RGBA()
	if ca < 0xffff/2 || int(cr>>8) < 245 || int(cg>>8) < 245 || int(cb>>8) < 245 {
		t.Fatalf("corner still checker/non-white rgba=%d,%d,%d,%d", cr>>8, cg>>8, cb>>8, ca>>8)
	}
}

func TestEncodeJoinQRPNG_NoCheckerInLogoPlate(t *testing.T) {
	wd, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	apiRoot := filepath.Clean(filepath.Join(wd, "..", ".."))
	if err := os.Chdir(apiRoot); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chdir(wd) })
	brandLogoOnce = sync.Once{}
	brandLogoImg = nil
	brandLogoErr = nil

	pngBytes, err := encodeJoinQRPNG("https://example.test/?view=spectate&gameId=test", 512)
	if err != nil {
		t.Fatalf("encode: %v", err)
	}
	img, err := png.Decode(bytes.NewReader(pngBytes))
	if err != nil {
		t.Fatalf("decode: %v", err)
	}
	// Plate ~18% of 512 (~92px). White rounded plate + burgundy mark (not white piece).
	foundWhite := false
	for _, dy := range []int{-50, -48, 48, 50} {
		r, g, b, _ := img.At(256, 256+dy).RGBA()
		if int(r>>8) >= 200 && int(g>>8) >= 200 && int(b>>8) >= 200 {
			foundWhite = true
			break
		}
	}
	if !foundWhite {
		t.Fatalf("white plate pad not found")
	}
	// Burgundy mark near plate center.
	foundMark := false
	for _, dy := range []int{-8, 0, 8, 16} {
		r, g, b, _ := img.At(256, 256+dy).RGBA()
		rr, gg, bb := int(r>>8), int(g>>8), int(b>>8)
		if rr >= 100 && rr <= 200 && gg <= 90 && bb <= 110 {
			foundMark = true
			break
		}
	}
	if !foundMark {
		t.Fatalf("burgundy mark not found on plate")
	}
	// Inside plate corner (white pad), never checker gray.
	pr, pg, pb, _ := img.At(256-48, 256-48).RGBA()
	rr, gg, bb := int(pr>>8), int(pg>>8), int(pb>>8)
	isChecker := rr >= 200 && rr <= 235 && gg >= 200 && gg <= 235 && bb >= 200 && bb <= 235
	if isChecker {
		t.Fatalf("checker gray at plate corner rgba=%d,%d,%d", rr, gg, bb)
	}
	_ = os.WriteFile(filepath.Join(".", "testdata_join_qr_sample.png"), pngBytes, 0o644)
}

func TestDrawDamaPieceIcon_WhiteOnBurgundySquare(t *testing.T) {
	brand := color.RGBA{R: 0xA3, G: 0x1D, B: 0x38, A: 0xFF}
	dst := image.NewRGBA(image.Rect(0, 0, 128, 128))
	for y := 0; y < 128; y++ {
		for x := 0; x < 128; x++ {
			dst.Set(x, y, brand)
		}
	}
	drawDamaPieceIcon(dst, 0, 0, 128, color.White, brand)
	// Head mass should be white (avoid the brand hole at head center).
	found := false
	for _, y := range []int{28, 32, 36, 70, 78, 86} {
		r, g, b, _ := dst.At(64, y).RGBA()
		if int(r>>8) >= 200 && int(g>>8) >= 200 && int(b>>8) >= 200 {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("piece icon missing white mass")
	}
	// Corner of plate stays burgundy (no circular white ring).
	cr, cg, cb, _ := dst.At(8, 8).RGBA()
	if int(cr>>8) < 120 || int(cg>>8) > 80 {
		t.Fatalf("corner not burgundy rgba=%d,%d,%d", cr>>8, cg>>8, cb>>8)
	}
}
