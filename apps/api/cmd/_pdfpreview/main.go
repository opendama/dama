package main

import (
	"fmt"
	"os"
	"time"

	"dama/apps/api/internal/payments"
)

func main() {
	now := time.Date(2026, 11, 1, 20, 56, 0, 0, time.UTC)
	rec := &payments.Receipt{
		ID:        "e9c13cb2-7cd6-42f9-987d-dcebbfa3abd5",
		UserID:    "u",
		Amount:    5,
		Currency:  "ETB",
		Provider:  "manual_transfer",
		Reference: "e2e_rcpt_456c9929e8",
		Status:    "pending",
		CreatedAt: now,
	}
	chrome := payments.ReceiptPDFChrome{
		DocumentTitle:       "Tax invoice",
		BrandName:           "dama",
		SectionBillTo:       "Invoice to",
		SectionFrom:         "Invoice from",
		SectionDetails:      "Invoice details",
		SectionPayment:      "Payment method",
		SectionTransaction:  "Transaction",
		LabelReference:      "Invoice reference",
		LabelAmount:         "Amount",
		LabelCurrency:       "Currency code",
		LabelStatus:         "Status",
		LabelChannel:        "Channel",
		LabelDate:           "Submitted",
		LabelID:             "Receipt ID",
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
	b, err := payments.BuildPaymentReceiptPDF(rec, "rcpt_456c9929e8", "rcpt_456c9929e8@e2e.test", chrome)
	if err != nil {
		panic(err)
	}
	out := `C:\Users\berek\Downloads\C-Projects\addismender-project\dama\tmp-receipt-fixed.pdf`
	if err := os.WriteFile(out, b, 0o644); err != nil {
		panic(err)
	}
	att := `C:\Users\berek\.cursor\projects\c-Users-berek-Downloads-C-Projects-addismender-project-dama\attachments\dama-receipt-footer-fixed-v2.pdf`
	_ = os.WriteFile(att, b, 0o644)
	fmt.Println(len(b), out)
}
