package payments_test

import (
	"strings"
	"testing"
	"time"

	"dama/apps/api/internal/payments"
)

// Ensures first-party PDF bytes stay valid for Download mutation (%PDF check).
func TestBuildPaymentReceiptPDF_spaceSeparatorAndMagic(t *testing.T) {
	t.Parallel()
	now := time.Now().UTC()
	rec := &payments.Receipt{
		ID:        "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
		UserID:    "u1",
		Amount:    100.5,
		Currency:  "ETB",
		Provider:  "manual",
		Reference: "REF",
		Status:    "pending",
		CreatedAt: now,
	}
	chrome := payments.ReceiptPDFChrome{
		DocumentTitle:       "Payment receipt",
		BrandName:           "dama",
		AmountSep:           " ", // single space must remain valid
		HeaderMetaSep:       " - ",
		EmptyValue:          "-",
		FilenameFmt:         "dama-receipt-{id}.pdf",
		StatusLabel:         "Pending",
		LabelCurrency:       "Currency code",
		LabelSubtotal:       "Subtotal",
		LabelTax:            "VAT",
		LabelTotal:          "Total",
		LabelAmountPaid:     "Amount paid",
		ColDescription:      "Product",
		ColProduct:          "Product",
		ColAmount:           "Amount",
		ColQty:              "Qty",
		ColUnit:             "Unit price",
		ColTaxRate:          "Tax rate",
		TaxRateDisplay:      "0%",
		SectionTaxBreakdown: "Tax breakdown",
		LabelTaxPercent:     "Tax %",
		LabelTaxTotal:       "Tax total",
		SectionTransaction:  "Transaction",
		LineDescription:     "Wallet top-up",
	}
	pdf, err := payments.BuildPaymentReceiptPDF(rec, "player", "p@example.com", chrome)
	if err != nil {
		t.Fatalf("build: %v", err)
	}
	if len(pdf) < 40 || !strings.HasPrefix(string(pdf), "%PDF") {
		t.Fatalf("bad pdf magic/len=%d", len(pdf))
	}
	name := payments.ReceiptPDFFilename(chrome.FilenameFmt, rec.ID)
	if !strings.HasSuffix(name, ".pdf") || !strings.Contains(name, rec.ID) {
		t.Fatalf("filename=%q", name)
	}
}
