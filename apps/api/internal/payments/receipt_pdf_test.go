package payments

import (
	"strings"
	"testing"
	"time"
)

func TestBuildPaymentReceiptPDF_mirrorsDocumentSections(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 10, 29, 12, 0, 0, 0, time.UTC)
	reviewed := now.Add(time.Hour)
	rec := &Receipt{
		ID:         "2d440c9f-d46a-4f68-a626-0d9db44b2816",
		UserID:     "user-1",
		Amount:     250,
		Currency:   "ETB",
		Provider:   "local_bank",
		Reference:  "REF-100",
		Status:     "approved",
		CreatedAt:  now,
		ReviewedAt: &reviewed,
	}
	chrome := ReceiptPDFChrome{
		DocumentTitle:       "Payment receipt",
		BrandName:           "dama",
		SectionBillTo:       "Bill to",
		SectionFrom:         "From",
		SectionDetails:      "Receipt details",
		SectionPayment:      "Payment",
		SectionTransaction:  "Transaction",
		LabelReference:      "Invoice reference",
		LabelAmount:         "Amount",
		LabelCurrency:       "Currency code",
		LabelStatus:         "Status",
		LabelChannel:        "Channel",
		LabelDate:           "Submitted",
		LabelID:             "Transaction",
		LabelPaidAt:         "Reviewed",
		HeaderMetaSep:       " - ",
		ColDescription:      "Product",
		ColProduct:          "Product",
		ColAmount:           "Amount",
		ColQty:              "Qty",
		ColUnit:             "Unit price",
		ColTaxRate:          "Tax rate",
		TaxRateDisplay:      "0%",
		LabelSubtotal:       "Subtotal",
		LabelTax:            "VAT",
		LabelTotal:          "Total",
		LabelAmountPaid:     "Amount paid",
		SectionTaxBreakdown: "Tax breakdown",
		LabelTaxPercent:     "Tax %",
		LabelTaxTotal:       "Tax total",
		LineDescription:     "Wallet top-up",
		MerchantVia:         "Manual bank transfer",
		Footer:              "Questions about this receipt? Contact support using the address on this document.",
		SupportEmail:        "support@dama.app",
		AmountSep:           " ",
		EmptyValue:          "-",
		StatusLabel:         "Approved",
		FilenameFmt:         "dama-receipt-{id}.pdf",
	}
	pdf, err := BuildPaymentReceiptPDF(rec, "player1", "p@example.com", chrome)
	if err != nil {
		t.Fatalf("BuildPaymentReceiptPDF: %v", err)
	}
	if len(pdf) < 80 || !strings.HasPrefix(string(pdf[:5]), "%PDF") {
		t.Fatalf("expected PDF bytes, got len=%d", len(pdf))
	}
	raw := string(pdf)
	for _, want := range []string{
		"Subtotal", "VAT", "Amount paid", "Tax breakdown", "Tax total",
		"250.00 ETB", "0.00 ETB", "/Im1", "Currency code", "ETB", "Product",
		"Questions about this receipt?",
		"Transaction", "Manual bank transfer", "p@example.com",
	} {
		if !strings.Contains(raw, want) {
			t.Fatalf("pdf missing %q", want)
		}
	}
	if strings.Contains(raw, "support@dama.app") {
		t.Fatal("Trim Invoice from is brand-only; support email must not appear in PDF body")
	}
	// Trim parity: never compress footer into a clipped MediaBox stub.
	if !strings.Contains(raw, "/Count ") {
		t.Fatal("pdf missing page count")
	}
	name := ReceiptPDFFilename(chrome.FilenameFmt, rec.ID)
	if name != "dama-receipt-2d440c9f-d46a-4f68-a626-0d9db44b2816.pdf" {
		t.Fatalf("filename = %q", name)
	}
}

func TestBuildPaymentReceiptPDF_footerNeverClipped(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 11, 1, 20, 56, 0, 0, time.UTC)
	rec := &Receipt{
		ID:        "e9c13cb2-7cd6-42f9-987d-dcebbfa3abd5",
		UserID:    "user-1",
		Amount:    5,
		Currency:  "ETB",
		Provider:  "manual_transfer",
		Reference: "e2e_rcpt_456c9929e8",
		Status:    "pending",
		CreatedAt: now,
	}
	chrome := ReceiptPDFChrome{
		DocumentTitle:       "Payment receipt",
		BrandName:           "dama",
		SectionBillTo:       "Bill to",
		SectionFrom:         "From",
		SectionDetails:      "Receipt details",
		SectionPayment:      "Payment",
		SectionTransaction:  "Transaction",
		LabelReference:      "Invoice reference",
		LabelAmount:         "Amount",
		LabelCurrency:       "Currency code",
		LabelStatus:         "Status",
		LabelChannel:        "Channel",
		LabelDate:           "Submitted",
		LabelID:             "Transaction",
		LabelPaidAt:         "Reviewed",
		HeaderMetaSep:       " - ",
		ColDescription:      "Product",
		ColProduct:          "Product",
		ColAmount:           "Amount",
		ColQty:              "Qty",
		ColUnit:             "Unit price",
		ColTaxRate:          "Tax rate",
		TaxRateDisplay:      "0%",
		LabelSubtotal:       "Subtotal",
		LabelTax:            "VAT",
		LabelTotal:          "Total",
		LabelAmountPaid:     "Amount paid",
		SectionTaxBreakdown: "Tax breakdown",
		LabelTaxPercent:     "Tax %",
		LabelTaxTotal:       "Tax total",
		LineDescription:     "Wallet top-up",
		MerchantVia:         "Manual bank transfer",
		Footer:              "Questions about this receipt? Contact support using the address on this document.",
		SupportEmail:        "support@dama.app",
		AmountSep:           " ",
		EmptyValue:          "-",
		StatusLabel:         "Pending",
		FilenameFmt:         "dama-receipt-{id}.pdf",
	}
	pdf, err := BuildPaymentReceiptPDF(rec, "rcpt_456c9929e8", "rcpt_456c9929e8@e2e.test", chrome)
	if err != nil {
		t.Fatalf("BuildPaymentReceiptPDF: %v", err)
	}
	raw := string(pdf)
	if !strings.Contains(raw, "Questions about this receipt?") {
		t.Fatal("footer copy missing")
	}
	// Trim locality under mark is brand-only; support email lives in Invoice from.
	if !strings.Contains(raw, "dama") {
		t.Fatal("footer brand missing - previously clipped below MediaBox")
	}
	// Amount column must not smash into Tax (ETB widths).
	if !strings.Contains(raw, "0%") || !strings.Contains(raw, "5.00 ETB") {
		t.Fatal("transaction amounts missing")
	}
}

func TestReceiptPDFChrome_Complete(t *testing.T) {
	t.Parallel()
	if (ReceiptPDFChrome{}).Complete() {
		t.Fatal("empty chrome must be incomplete")
	}
}
