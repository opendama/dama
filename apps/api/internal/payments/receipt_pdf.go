package payments

import (
	"bytes"
	"fmt"
	"image"
	_ "image/png"
	"strings"

	"dama/apps/api/internal/brandassets"
	xdraw "golang.org/x/image/draw"
)

// ReceiptPDFChrome is DB-backed copy for first-party payment receipt PDFs (Trim parity).
type ReceiptPDFChrome struct {
	DocumentTitle       string
	BrandName           string
	SectionBillTo       string
	SectionFrom         string
	SectionDetails      string
	SectionPayment      string
	SectionTransaction  string
	LabelReference      string
	LabelAmount         string
	LabelCurrency       string
	LabelStatus         string
	LabelChannel        string
	LabelDate           string
	LabelID             string // Trim "Transaction"
	LabelPaidAt         string
	LabelBillingPeriod  string // Trim "Billing period" - row omitted when BillingPeriodValue empty
	BillingPeriodValue  string // optional; wallet top-ups leave blank
	HeaderMetaSep       string // may be whitespace; Trim-style date - amount joiner
	LabelSubtotal       string
	LabelTax            string
	LabelTotal          string
	LabelAmountPaid     string
	ColDescription      string
	ColProduct          string
	ColAmount           string
	ColQty              string
	ColUnit             string
	ColTaxRate          string
	TaxRateDisplay      string
	SectionTaxBreakdown string
	LabelTaxPercent     string
	LabelTaxTotal       string
	LineDescription     string
	MerchantVia         string
	Footer              string
	SupportEmail        string
	AmountSep           string
	EmptyValue          string
	StatusLabel         string
	// StatusPaid paints the status badge green (settled paid) instead of brand maroon.
	StatusPaid  bool
	FilenameFmt string
}

// Layout constants mirror Trim server/internal/receipts/pdf.go + receipt-view.tsx
// (1 CSS px = 1 PDF pt). Letterhead mark = TrimWordmark lg (28); footer sm (18).
const (
	pdfMarginL   = 32.0
	pdfMarginR   = 32.0
	pdfPageW     = 612.0
	pdfPageH     = 792.0
	pdfContentR  = pdfPageW - pdfMarginR
	pdfContentW  = pdfContentR - pdfMarginL
	pdfStartY    = 760.0
	pdfPageFloor = 40.0 // Trim: keep content above MediaBox; break page instead of clipping

	pdfPtBody     = 13
	pdfPtTitle    = 24
	pdfPtBrand    = 15
	pdfPtAmount   = 15
	pdfPtVia      = 11
	pdfPtTableH   = 12
	pdfPtFooter   = 12
	pdfPtLocality = 11
	pdfPtBadge    = 10

	pdfMarkLG  = 48.0 // receipt letterhead (web xl) - Trim visual weight for sparse crown
	pdfMarkSM  = 28.0 // receipt footer (web md)
	pdfGap1    = 4.0
	pdfPadY7   = 28.0
	pdfTotalsW = 240.0
)

// Trim uses fixed 60pt numeric columns sized for "$x.xx". Dama amounts are
// "NN.NN ETB" - widen Amount/Unit and pull Tax left so columns never collide.
// Right edges (US Letter contentR=580): Qty 336 · Unit 424 · Tax 482 · Amount 580.
var tableColRight = [5]float64{
	0,
	336,
	424,
	482,
	pdfContentR,
}

type pdfMark struct {
	W, H int
	RGB  []byte
	Mask []byte
}

// Complete reports whether required PDF chrome fields are present (fail closed).
// AmountSep / HeaderMetaSep must not be TrimSpace'd - whitespace is intentional.
func (c ReceiptPDFChrome) Complete() bool {
	productCol := strings.TrimSpace(c.ColProduct)
	if productCol == "" {
		productCol = strings.TrimSpace(c.ColDescription)
	}
	return strings.TrimSpace(c.DocumentTitle) != "" &&
		strings.TrimSpace(c.BrandName) != "" &&
		c.AmountSep != "" &&
		c.HeaderMetaSep != "" &&
		strings.TrimSpace(c.EmptyValue) != "" &&
		strings.TrimSpace(c.FilenameFmt) != "" &&
		strings.TrimSpace(c.LabelSubtotal) != "" &&
		strings.TrimSpace(c.LabelTax) != "" &&
		strings.TrimSpace(c.LabelTotal) != "" &&
		strings.TrimSpace(c.LabelAmountPaid) != "" &&
		strings.TrimSpace(c.LabelCurrency) != "" &&
		productCol != "" &&
		strings.TrimSpace(c.ColAmount) != "" &&
		strings.TrimSpace(c.ColQty) != "" &&
		strings.TrimSpace(c.ColUnit) != "" &&
		strings.TrimSpace(c.ColTaxRate) != "" &&
		strings.TrimSpace(c.SectionTaxBreakdown) != "" &&
		strings.TrimSpace(c.LabelTaxPercent) != "" &&
		strings.TrimSpace(c.LabelTaxTotal) != "" &&
		strings.TrimSpace(c.TaxRateDisplay) != ""
}

// BuildPaymentReceiptPDF renders a first-party PDF mirroring PaymentReceiptDocument
// (header band + mark, bill-to / from, details, 5-col transaction, Subtotal/VAT/Total/Amount paid, footer).
func BuildPaymentReceiptPDF(rec *Receipt, billToName, billToEmail string, chrome ReceiptPDFChrome) ([]byte, error) {
	if rec == nil || !chrome.Complete() {
		return nil, fmt.Errorf("receipt pdf unavailable")
	}
	sep := chrome.AmountSep
	empty := chrome.EmptyValue
	// Trim formatMoney uses fixed 2 decimals; keep currency code for Dama branding.
	amountFmt := empty
	if rec.Amount >= 0 && strings.TrimSpace(rec.Currency) != "" {
		amountFmt = fmt.Sprintf("%.2f%s%s", rec.Amount, sep, strings.TrimSpace(rec.Currency))
	}
	taxFmt := empty
	if strings.TrimSpace(rec.Currency) != "" && sep != "" {
		taxFmt = fmt.Sprintf("%.2f%s%s", 0.0, sep, strings.TrimSpace(rec.Currency))
	}
	status := strings.TrimSpace(chrome.StatusLabel)
	if status == "" {
		status = strings.TrimSpace(rec.Status)
	}
	if status == "" {
		status = empty
	}
	name := strings.TrimSpace(billToName)
	email := strings.TrimSpace(billToEmail)
	ref := strings.TrimSpace(rec.Reference)
	if ref == "" {
		ref = empty
	}
	payMethod := PaymentMethodDisplay(rec.Provider)
	if payMethod == "" {
		payMethod = empty
	}
	// Trim / Paddle invoice day: "10th October 2026" (UTC, no clock time).
	created := formatReceiptDay(rec.CreatedAt)
	if created == "" {
		created = empty
	}
	reviewed := empty
	if rec.ReviewedAt != nil {
		if s := formatReceiptDay(*rec.ReviewedAt); s != "" {
			reviewed = s
		}
	}
	lineDesc := strings.TrimSpace(chrome.LineDescription)
	if lineDesc == "" {
		lineDesc = empty
	}
	brand := strings.TrimSpace(chrome.BrandName)
	title := strings.TrimSpace(chrome.DocumentTitle)
	taxRate := strings.TrimSpace(chrome.TaxRateDisplay)
	if taxRate == "" {
		taxRate = empty
	}
	mark := loadLetterheadMark()

	var stream bytes.Buffer
	pageStreams := make([][]byte, 0, 2)
	y := pdfStartY

	// Trim: never clip/drop invoice sections - start a new US Letter page instead.
	flushPage := func() {
		pageStreams = append(pageStreams, append([]byte(nil), stream.Bytes()...))
		stream.Reset()
		y = pdfStartY
	}
	ensureSpace := func(need float64) {
		if need < 1 {
			need = 1
		}
		if y-need >= pdfPageFloor {
			return
		}
		flushPage()
	}

	drawFill := func(r, g, b, x, bot, w, h float64) {
		fmt.Fprintf(&stream, "%.3f %.3f %.3f rg\n%.2f %.2f %.2f %.2f re f\n0 g\n", r, g, b, x, bot, w, h)
	}
	// Trim status badge uses Tailwind `rounded` (4px).
	drawRoundedFill := func(r, g, b, x, bot, w, h, rad float64) {
		if rad < 0.5 || rad*2 > w || rad*2 > h {
			drawFill(r, g, b, x, bot, w, h)
			return
		}
		top := bot + h
		fmt.Fprintf(&stream, "%.3f %.3f %.3f rg\n", r, g, b)
		fmt.Fprintf(&stream, "%.2f %.2f m\n", x+rad, bot)
		fmt.Fprintf(&stream, "%.2f %.2f l\n", x+w-rad, bot)
		fmt.Fprintf(&stream, "%.2f %.2f %.2f %.2f %.2f %.2f c\n", x+w, bot, x+w, bot, x+w, bot+rad)
		fmt.Fprintf(&stream, "%.2f %.2f l\n", x+w, top-rad)
		fmt.Fprintf(&stream, "%.2f %.2f %.2f %.2f %.2f %.2f c\n", x+w, top, x+w, top, x+w-rad, top)
		fmt.Fprintf(&stream, "%.2f %.2f l\n", x+rad, top)
		fmt.Fprintf(&stream, "%.2f %.2f %.2f %.2f %.2f %.2f c\n", x, top, x, top, x, top-rad)
		fmt.Fprintf(&stream, "%.2f %.2f l\n", x, bot+rad)
		fmt.Fprintf(&stream, "%.2f %.2f %.2f %.2f %.2f %.2f c\n", x, bot, x, bot, x+rad, bot)
		stream.WriteString("f\n0 g\n")
	}
	drawHairline := func(x1, y1, x2 float64) {
		fmt.Fprintf(&stream, "0.910 0.910 0.910 RG\n0.4 w\n%.2f %.2f m %.2f %.2f l S\n0 g\n", x1, y1, x2, y1)
	}
	textAt := func(x, ty float64, size int, bold bool, s, rgb string) {
		s = truncatePDF(s, 120)
		if strings.TrimSpace(s) == "" {
			return
		}
		font := "/F1"
		if bold {
			font = "/F2"
		}
		if rgb != "" {
			fmt.Fprintf(&stream, "%s rg\n", rgb)
		} else {
			stream.WriteString("0 g\n")
		}
		fmt.Fprintf(&stream, "BT %s %d Tf 1 0 0 1 %.2f %.2f Tm (%s) Tj ET\n", font, size, x, ty, pdfEscape(s))
		stream.WriteString("0 g\n")
	}
	textRight := func(rightX, ty float64, size int, bold bool, s, rgb string) {
		s = truncatePDF(s, 48)
		w := approxPDFWidth(s, size, bold)
		textAt(rightX-w, ty, size, bold, s, rgb)
	}
	textCentered := func(ty float64, size int, bold bool, s, rgb string) {
		s = truncatePDF(s, 140)
		w := approxPDFWidth(s, size, bold)
		x := (pdfPageW - w) / 2
		if x < pdfMarginL {
			x = pdfMarginL
		}
		textAt(x, ty, size, bold, s, rgb)
	}
	// Trim writeLabeled: sequential Tj so bold label never overlaps value.
	writeLabeled := func(x, ty float64, label, value string) {
		label = strings.TrimSpace(label)
		value = strings.TrimSpace(value)
		if label == "" || value == "" {
			return
		}
		prefix := label + ": "
		stream.WriteString("0 g\n")
		fmt.Fprintf(&stream, "BT /F2 %d Tf 1 0 0 1 %.2f %.2f Tm (%s) Tj /F1 %d Tf (%s) Tj ET\n",
			pdfPtBody, x, ty, pdfEscape(truncatePDF(prefix, 80)), pdfPtBody, pdfEscape(truncatePDF(value, 100)))
	}
	drawMark := func(m *pdfMark, x, topY, maxW, maxH float64) (dw, dh float64) {
		if m == nil {
			return 0, 0
		}
		dw, dh = fitMark(float64(m.W), float64(m.H), maxW, maxH)
		fmt.Fprintf(&stream, "q\n%.2f 0 0 %.2f %.2f %.2f cm\n/Im1 Do\nQ\n", dw, dh, x, topY-dh)
		return dw, dh
	}

	// --- Header band (Trim header_block) ---
	via := strings.TrimSpace(chrome.MerchantVia)
	logoH := 0.0
	var logoDW float64
	if mark != nil {
		logoDW, logoH = fitMark(float64(mark.W), float64(mark.H), pdfMarkLG, pdfMarkLG)
	}
	rightDepth := pdfPadY7
	if logoH > 0 {
		rightDepth += logoH
	}
	if brand != "" {
		if logoH > 0 {
			rightDepth += pdfGap1
		}
		rightDepth += float64(pdfPtBrand)
	}
	if via != "" {
		if brand != "" || logoH > 0 {
			rightDepth += pdfGap1
		}
		rightDepth += float64(pdfPtVia)
	}
	// Trim header meta: (reviewed || created) + HeaderMetaSep + bare amount.
	headerMetaDate := created
	if reviewed != empty && reviewed != "" {
		headerMetaDate = reviewed
	}
	metaSep := chrome.HeaderMetaSep
	if metaSep == "" {
		metaSep = " - "
	}
	hasMeta := (headerMetaDate != empty && headerMetaDate != "") || (amountFmt != empty && amountFmt != "")
	leftDepth := pdfPadY7 + float64(pdfPtTitle)
	if hasMeta {
		leftDepth += 18
	}
	inner := rightDepth
	if leftDepth > inner {
		inner = leftDepth
	}
	headerH := inner + pdfPadY7
	if headerH < 90 {
		headerH = 90
	}
	headerBot := y - headerH
	drawFill(0.957, 0.957, 0.961, 0, headerBot, pdfPageW, pdfPageH-headerBot)

	// Right stack: mark → brand → via (Trim items-end gap-1; full line-box under mark).
	stackY := y - pdfPadY7
	if mark != nil && logoH > 0 {
		drawMark(mark, pdfContentR-logoDW, stackY, pdfMarkLG, pdfMarkLG)
		stackY -= logoH
	}
	if brand != "" {
		if logoH > 0 {
			stackY -= pdfGap1
		}
		stackY -= float64(pdfPtBrand)
		textRight(pdfContentR, stackY, pdfPtBrand, true, brand, "")
	}
	if via != "" {
		if brand != "" || logoH > 0 {
			stackY -= pdfGap1
		}
		stackY -= float64(pdfPtVia)
		textRight(pdfContentR, stackY, pdfPtVia, false, via, "0.45 0.45 0.45")
	}

	// Title + badge share Trim baseline `ty` (not title-size offset).
	ty := y - pdfPadY7
	textAt(pdfMarginL, ty, pdfPtTitle, true, title, "")
	badge := strings.ToUpper(strings.TrimSpace(status))
	if badge != "" {
		bw := approxPDFWidth(badge, pdfPtBadge, true) + 16
		bx := pdfMarginL + approxPDFWidth(title, pdfPtTitle, true) + 10
		if chrome.StatusPaid {
			// Settled paid: green (#27a644)
			drawRoundedFill(0.153, 0.651, 0.267, bx, ty-3, bw, 14, 4)
		} else {
			drawRoundedFill(0.639, 0.114, 0.220, bx, ty-3, bw, 14, 4)
		}
		textAt(bx+8, ty, pdfPtBadge, true, badge, "1 1 1")
	}
	metaY := ty - 18
	if headerMetaDate != empty && headerMetaDate != "" {
		mx := pdfMarginL
		textAt(mx, metaY, pdfPtBody, false, headerMetaDate, "0.45 0.45 0.45")
		mx += approxPDFWidth(headerMetaDate, pdfPtBody, false)
		if amountFmt != empty && amountFmt != "" {
			textAt(mx, metaY, pdfPtBody, false, metaSep, "0.45 0.45 0.45")
			mx += approxPDFWidth(metaSep, pdfPtBody, false)
			textAt(mx, metaY, pdfPtBody, true, amountFmt, "0.15 0.15 0.15")
		}
	} else if amountFmt != empty && amountFmt != "" {
		textAt(pdfMarginL, metaY, pdfPtBody, true, amountFmt, "0.15 0.15 0.15")
	}
	y = headerBot - 28 // Trim blank(28) after header

	// --- Parties (md:grid-cols-2 gap-10) ---
	const gap10 = 40.0
	colR := pdfMarginL + (pdfContentW+gap10)/2
	leftY, rightY := y, y
	if sec := strings.TrimSpace(chrome.SectionBillTo); sec != "" {
		textAt(pdfMarginL, leftY, pdfPtBody, true, sec, "")
		leftY -= float64(pdfPtBody) + 8
		// Trim Invoice to: email (fallback name when email missing).
		if email != "" {
			textAt(pdfMarginL, leftY, pdfPtBody, false, email, "")
			leftY -= float64(pdfPtBody) + 4
		} else if name != "" {
			textAt(pdfMarginL, leftY, pdfPtBody, false, name, "")
			leftY -= float64(pdfPtBody) + 4
		}
		if pay := strings.TrimSpace(chrome.SectionPayment); pay != "" {
			// Payment method = gateway display label (never chrome merchant_via / channel slug).
			if payMethod != "" && payMethod != empty {
				leftY -= 8
				writeLabeled(pdfMarginL, leftY, pay, payMethod)
				leftY -= float64(pdfPtBody) + 4
			}
		}
	}
	if sec := strings.TrimSpace(chrome.SectionFrom); sec != "" {
		textAt(colR, rightY, pdfPtBody, true, sec, "")
		rightY -= float64(pdfPtBody) + 8
		// Trim Invoice from: brand only (support lives in footer copy).
		textAt(colR, rightY, pdfPtBody, false, brand, "")
		rightY -= float64(pdfPtBody) + 4
	}
	if leftY < rightY {
		y = leftY
	} else {
		y = rightY
	}
	y -= 28 // parties py-8 bottom

	// --- Details (Trim: Invoice reference, Billing period?, Transaction, Currency code) ---
	if sec := strings.TrimSpace(chrome.SectionDetails); sec != "" {
		currencyCode := strings.ToUpper(strings.TrimSpace(rec.Currency))
		if currencyCode == "" {
			currencyCode = empty
		}
		detailRows := make([][2]string, 0, 4)
		if lab := strings.TrimSpace(chrome.LabelReference); lab != "" {
			detailRows = append(detailRows, [2]string{lab, ref})
		}
		if lab := strings.TrimSpace(chrome.LabelBillingPeriod); lab != "" {
			if period := strings.TrimSpace(chrome.BillingPeriodValue); period != "" {
				detailRows = append(detailRows, [2]string{lab, period})
			}
		}
		if lab := strings.TrimSpace(chrome.LabelID); lab != "" {
			detailRows = append(detailRows, [2]string{lab, strings.TrimSpace(rec.ID)})
		}
		if lab := strings.TrimSpace(chrome.LabelCurrency); lab != "" {
			detailRows = append(detailRows, [2]string{lab, currencyCode})
		}
		ensureSpace(float64(pdfPtBody) + 12 + float64(len(detailRows))*(float64(pdfPtBody)+6) + 20)
		textAt(pdfMarginL, y, pdfPtBody, true, sec, "")
		y -= 12
		for _, row := range detailRows {
			y -= float64(pdfPtBody) + 6
			writeLabeled(pdfMarginL, y, row[0], row[1])
		}
		y -= 20
	}

	ensureSpace(8)
	drawHairline(pdfMarginL, y, pdfContentR)
	y -= 20

	// --- Transaction ---
	sec := strings.TrimSpace(chrome.SectionTransaction)
	if sec == "" {
		sec = empty
	}
	ensureSpace(float64(pdfPtBody) + 14 + float64(pdfPtTableH) + 12 + float64(pdfPtBody) + 14)
	textAt(pdfMarginL, y, pdfPtBody, true, sec, "")
	y -= float64(pdfPtBody) + 14

	colD := strings.TrimSpace(chrome.ColProduct)
	if colD == "" {
		colD = orEmpty(chrome.ColDescription, empty)
	}
	colQ := orEmpty(chrome.ColQty, empty)
	colU := orEmpty(chrome.ColUnit, empty)
	colT := orEmpty(chrome.ColTaxRate, empty)
	colA := orEmpty(chrome.ColAmount, empty)
	headers := [5]string{colD, colQ, colU, colT, colA}
	y -= float64(pdfPtTableH)
	for i, h := range headers {
		if i == 0 {
			textAt(pdfMarginL, y, pdfPtTableH, true, h, "")
		} else {
			textRight(tableColRight[i], y, pdfPtTableH, true, h, "")
		}
	}
	y -= 10
	drawHairline(pdfMarginL, y, pdfContentR)
	y -= 2

	// Product row py-3.5
	y -= 12
	y -= float64(pdfPtBody)
	textAt(pdfMarginL, y, pdfPtBody, true, lineDesc, "")
	textRight(tableColRight[1], y, pdfPtBody, false, "1", "0.35 0.35 0.35")
	textRight(tableColRight[2], y, pdfPtBody, false, amountFmt, "0.35 0.35 0.35")
	textRight(tableColRight[3], y, pdfPtBody, false, taxRate, "0.35 0.35 0.35")
	textRight(tableColRight[4], y, pdfPtBody, true, amountFmt, "")
	y -= 12
	drawHairline(pdfMarginL, y, pdfContentR)
	y -= 2
	y -= 8 // mt-2 before totals

	// Totals: max-w-[240px], py-2 + border-b (Trim right_pair).
	totalsL := pdfContentR - pdfTotalsW
	pair := func(label, value string, size int, bold, muted bool) {
		l := orEmpty(label, empty)
		v := orEmpty(value, empty)
		rgb := ""
		if muted {
			rgb = "0.35 0.35 0.35"
		}
		ensureSpace(7 + float64(size) + 7 + 2)
		y -= 7
		y -= float64(size)
		textAt(totalsL, y, size, bold, l, rgb)
		textRight(pdfContentR, y, size, bold, v, rgb)
		y -= 7
		drawHairline(totalsL, y, pdfContentR)
		y -= 2
	}
	pair(chrome.LabelSubtotal, amountFmt, pdfPtBody, false, true)
	pair(chrome.LabelTax, taxFmt, pdfPtBody, false, true)
	pair(chrome.LabelTotal, amountFmt, pdfPtBody, false, false)
	pair(chrome.LabelAmountPaid, amountFmt, pdfPtAmount, true, false)

	// Tax breakdown max-w-[240px] (Trim tax_table density).
	// Keep tax with totals when possible; only the footer should break to a new page.
	taxRight := pdfMarginL + pdfTotalsW
	taxNeed := float64(pdfPtBody) + 8 + float64(pdfPtTableH) + 8 +
		float64(pdfPtBody) + 8 + 10 + float64(pdfPtBody) + 4
	const mt8 = 24.0
	if room := y - taxNeed - pdfPageFloor; room >= mt8 {
		y -= mt8
	} else if room > 8 {
		y -= room // shrink mt-8 rather than orphaning tax on page 2
	}
	ensureSpace(taxNeed)
	textAt(pdfMarginL, y, pdfPtBody, true, orEmpty(chrome.SectionTaxBreakdown, empty), "")
	y -= float64(pdfPtBody) + 8
	y -= float64(pdfPtTableH)
	textAt(pdfMarginL, y, pdfPtTableH, true, orEmpty(chrome.LabelTaxPercent, empty), "")
	textRight(taxRight, y, pdfPtTableH, true, orEmpty(chrome.LabelTax, empty), "")
	y -= 8
	drawHairline(pdfMarginL, y, taxRight)
	y -= 8
	y -= float64(pdfPtBody)
	textAt(pdfMarginL, y, pdfPtBody, false, taxRate, "0.15 0.15 0.15")
	textRight(taxRight, y, pdfPtBody, false, taxFmt, "0.15 0.15 0.15")
	y -= 8
	drawHairline(pdfMarginL, y, taxRight)
	y -= 10
	y -= float64(pdfPtBody)
	textAt(pdfMarginL, y, pdfPtBody, true, orEmpty(chrome.LabelTaxTotal, empty), "")
	textRight(taxRight, y, pdfPtBody, true, taxFmt, "")
	y -= 8 // breathing room above footer / page floor (avoid flush against MediaBox)

	// --- Footer band (Trim footer_block) ---
	// Never compress/clip: ensureSpace → new page, then draw a full letterhead band
	// in document flow (same idea as the header band). Trim continues tax+footer on
	// page 2 from the top - do not pin to MediaBox bottom (that looked "cut out").
	if foot := strings.TrimSpace(chrome.Footer); foot != "" {
		if y-14 >= pdfPageFloor {
			y -= 14 // mt-4
		} else {
			flushPage()
		}
		footerParts := wrapPDFWords(foot, 78)
		// Trim PDF locality under the mark is brand-only (address lives in Invoice from).
		addrLines := wrapPDFWords(brand, 72)
		const padY = 28.0 // print:py-7 - match header letterhead padding
		const gap3 = 12.0 // gap-3
		markH := 0.0
		if mark != nil {
			_, markH = fitMark(float64(mark.W), float64(mark.H), pdfMarkSM, pdfMarkSM)
		}
		need := padY + float64(len(footerParts))*14 + gap3
		if mark != nil {
			need += markH + gap3
		}
		if len(addrLines) > 0 {
			need += float64(len(addrLines)) * 14
		}
		need += padY
		if need < 72 {
			need = 72
		}
		ensureSpace(need)
		contentBottom := y - need
		if contentBottom < 0 {
			// Defensive: should be unreachable after ensureSpace; never draw past MediaBox.
			flushPage()
			contentBottom = y - need
			if contentBottom < 0 {
				contentBottom = pdfPageFloor
				need = y - contentBottom
			}
		}
		drawFill(0.957, 0.957, 0.961, 0, contentBottom, pdfPageW, need)
		cy := y - padY
		for _, part := range footerParts {
			textCentered(cy, pdfPtFooter, false, part, "0.40 0.40 0.40")
			cy -= 14
		}
		cy -= gap3
		if mark != nil {
			dw, dh := fitMark(float64(mark.W), float64(mark.H), pdfMarkSM, pdfMarkSM)
			drawMark(mark, (pdfPageW-dw)/2, cy, pdfMarkSM, pdfMarkSM)
			cy -= dh + gap3
		}
		for _, part := range addrLines {
			textCentered(cy, pdfPtLocality, false, part, "0.45 0.45 0.45")
			cy -= 14
		}
		y = contentBottom
	}

	pageStreams = append(pageStreams, append([]byte(nil), stream.Bytes()...))
	return assembleReceiptPDF(pageStreams, mark)
}

func assembleReceiptPDF(pageStreams [][]byte, mark *pdfMark) ([]byte, error) {
	if len(pageStreams) == 0 {
		return nil, fmt.Errorf("receipt pdf empty")
	}
	var out bytes.Buffer
	write := func(s string) { out.WriteString(s) }
	offsets := make([]int, 0, 32)
	offsets = append(offsets, 0) // unused index 0

	nPages := len(pageStreams)
	// Object map: 1=Catalog 2=Pages; then pairs (Page, Contents) per page; then fonts; then images.
	pageObjN := func(i int) int { return 3 + i*2 }
	contentObjN := func(i int) int { return 4 + i*2 }
	font1Obj := 3 + nPages*2
	font2Obj := font1Obj + 1
	maskObjN := font2Obj + 1
	imgObjN := maskObjN + 1

	kids := make([]string, 0, nPages)
	for i := 0; i < nPages; i++ {
		kids = append(kids, fmt.Sprintf("%d 0 R", pageObjN(i)))
	}

	var resources string
	if mark != nil {
		resources = fmt.Sprintf("<< /Font << /F1 %d 0 R /F2 %d 0 R >> /XObject << /Im1 %d 0 R >> >>", font1Obj, font2Obj, imgObjN)
	} else {
		resources = fmt.Sprintf("<< /Font << /F1 %d 0 R /F2 %d 0 R >> >>", font1Obj, font2Obj)
	}

	write("%PDF-1.4\n")
	offsets = append(offsets, out.Len())
	write("1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n")
	offsets = append(offsets, out.Len())
	write(fmt.Sprintf("2 0 obj<< /Type /Pages /Kids [%s] /Count %d >>endobj\n", strings.Join(kids, " "), nPages))

	for i := 0; i < nPages; i++ {
		offsets = append(offsets, out.Len())
		write(fmt.Sprintf(
			"%d 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.0f %.0f] /Contents %d 0 R /Resources %s >>endobj\n",
			pageObjN(i), pdfPageW, pdfPageH, contentObjN(i), resources,
		))
		stream := pageStreams[i]
		offsets = append(offsets, out.Len())
		write(fmt.Sprintf("%d 0 obj<< /Length %d >>stream\n", contentObjN(i), len(stream)))
		out.Write(stream)
		write("\nendstream\nendobj\n")
	}

	offsets = append(offsets, out.Len())
	write(fmt.Sprintf("%d 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n", font1Obj))
	offsets = append(offsets, out.Len())
	write(fmt.Sprintf("%d 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>endobj\n", font2Obj))

	if mark != nil {
		offsets = append(offsets, out.Len())
		write(fmt.Sprintf(
			"%d 0 obj<< /Type /XObject /Subtype /Image /Width %d /Height %d /ColorSpace /DeviceGray /BitsPerComponent 8 /Length %d >>stream\n",
			maskObjN, mark.W, mark.H, len(mark.Mask),
		))
		out.Write(mark.Mask)
		write("\nendstream\nendobj\n")

		offsets = append(offsets, out.Len())
		write(fmt.Sprintf(
			"%d 0 obj<< /Type /XObject /Subtype /Image /Width %d /Height %d /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length %d /SMask %d 0 R >>stream\n",
			imgObjN, mark.W, mark.H, len(mark.RGB), maskObjN,
		))
		out.Write(mark.RGB)
		write("\nendstream\nendobj\n")
	}

	xrefStart := out.Len()
	write(fmt.Sprintf("xref\n0 %d\n", len(offsets)))
	write("0000000000 65535 f \n")
	for i := 1; i < len(offsets); i++ {
		write(fmt.Sprintf("%010d 00000 n \n", offsets[i]))
	}
	write(fmt.Sprintf("trailer<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n", len(offsets), xrefStart))
	return out.Bytes(), nil
}

// wrapPDFWords mirrors Trim wrapWords - footer/address lines stay inside the band.
func wrapPDFWords(s string, maxChars int) []string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	if maxChars < 8 {
		maxChars = 8
	}
	words := strings.Fields(s)
	if len(words) == 0 {
		return nil
	}
	var lines []string
	var cur strings.Builder
	for _, w := range words {
		if cur.Len() == 0 {
			cur.WriteString(w)
			continue
		}
		if cur.Len()+1+len(w) > maxChars {
			lines = append(lines, cur.String())
			cur.Reset()
			cur.WriteString(w)
			continue
		}
		cur.WriteByte(' ')
		cur.WriteString(w)
	}
	if cur.Len() > 0 {
		lines = append(lines, cur.String())
	}
	return lines
}

// ReceiptPDFFilename builds Content-Disposition filename from chrome fmt + id.
func ReceiptPDFFilename(fmtTpl, id string) string {
	tpl := strings.TrimSpace(fmtTpl)
	id = strings.TrimSpace(id)
	if tpl == "" {
		tpl = "dama-receipt-{id}.pdf"
	}
	out := strings.ReplaceAll(tpl, "{id}", id)
	out = strings.Map(func(r rune) rune {
		switch r {
		case '/', '\\', ':', '*', '?', '"', '<', '>', '|':
			return '-'
		default:
			return r
		}
	}, out)
	if !strings.HasSuffix(strings.ToLower(out), ".pdf") {
		out += ".pdf"
	}
	return out
}

func pdfEscape(s string) string {
	s = strings.ReplaceAll(s, "\\", "\\\\")
	s = strings.ReplaceAll(s, "(", "\\(")
	s = strings.ReplaceAll(s, ")", "\\)")
	return s
}

func truncatePDF(s string, max int) string {
	r := []rune(s)
	if len(r) <= max {
		return s
	}
	return string(r[:max])
}

func orEmpty(v, empty string) string {
	v = strings.TrimSpace(v)
	if v == "" {
		return empty
	}
	return v
}

// helveticaWidths / helveticaBoldWidths - Adobe AFM WinAnsi advances (Trim pdf.go).
// Accurate widths prevent badge/column collisions (esp. long "NN.NN ETB" amounts).
var helveticaWidths = [256]int{
	250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250,
	250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250,
	278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
	556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
	1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
	667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
	333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
	556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, 250,
	250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250,
	250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250,
	250, 333, 556, 556, 167, 556, 556, 556, 556, 191, 333, 556, 333, 333, 500, 500,
	250, 556, 556, 556, 278, 250, 537, 350, 222, 333, 333, 556, 1000, 1000, 250, 611,
	250, 333, 333, 333, 333, 333, 333, 333, 333, 250, 333, 333, 250, 333, 333, 333,
	250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250,
	250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250,
	250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250,
}

var helveticaBoldWidths = [256]int{
	250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250,
	250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250,
	278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
	556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
	975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
	667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
	333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
	611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584, 250,
	250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250,
	250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250,
	250, 333, 556, 556, 167, 556, 556, 556, 556, 238, 500, 556, 333, 333, 611, 611,
	250, 556, 556, 556, 278, 250, 556, 350, 278, 500, 500, 556, 1000, 1000, 250, 611,
	250, 333, 333, 333, 333, 333, 333, 333, 333, 250, 333, 333, 250, 333, 333, 333,
	250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250,
	250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250,
	250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250,
}

func approxPDFWidth(s string, size int, bold bool) float64 {
	if size < 1 {
		size = 10
	}
	table := helveticaWidths
	if bold {
		table = helveticaBoldWidths
	}
	sum := 0
	for _, r := range s {
		if r < 0 || r > 255 {
			sum += 600
			continue
		}
		w := table[r]
		if w <= 0 {
			w = 556
		}
		sum += w
	}
	return float64(sum) * float64(size) / 1000.0
}

func fitMark(srcW, srcH, maxW, maxH float64) (float64, float64) {
	if srcW < 1 {
		srcW = 1
	}
	if srcH < 1 {
		srcH = 1
	}
	scale := maxW / srcW
	if srcH*scale > maxH {
		scale = maxH / srcH
	}
	return srcW * scale, srcH * scale
}

func loadLetterheadMark() *pdfMark {
	raw := brandassets.DamaMarkPNG
	if len(raw) == 0 {
		return nil
	}
	src, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return nil
	}
	b := src.Bounds()
	sw, sh := b.Dx(), b.Dy()
	if sw < 1 || sh < 1 {
		return nil
	}
	// Downsample large brand PNG (often 1024²) to ~4× letterhead mark (28pt → 112px).
	const maxEdge = 112
	dw, dh := sw, sh
	if sw > maxEdge || sh > maxEdge {
		scale := float64(maxEdge) / float64(sw)
		if sh > sw {
			scale = float64(maxEdge) / float64(sh)
		}
		dw = int(float64(sw)*scale + 0.5)
		dh = int(float64(sh)*scale + 0.5)
		if dw < 1 {
			dw = 1
		}
		if dh < 1 {
			dh = 1
		}
		dst := image.NewRGBA(image.Rect(0, 0, dw, dh))
		xdraw.ApproxBiLinear.Scale(dst, dst.Bounds(), src, b, xdraw.Over, nil)
		src = dst
		b = dst.Bounds()
	}
	w, h := b.Dx(), b.Dy()
	rgb := make([]byte, w*h*3)
	mask := make([]byte, w*h)
	i := 0
	for y := b.Min.Y; y < b.Max.Y; y++ {
		for x := b.Min.X; x < b.Max.X; x++ {
			r16, g16, b16, a16 := src.At(x, y).RGBA()
			rgb[i*3+0] = uint8(r16 >> 8)
			rgb[i*3+1] = uint8(g16 >> 8)
			rgb[i*3+2] = uint8(b16 >> 8)
			mask[i] = uint8(a16 >> 8)
			i++
		}
	}
	return &pdfMark{W: w, H: h, RGB: rgb, Mask: mask}
}
