package payments

import (
	"fmt"
	"strings"
	"time"
)

// formatReceiptDay formats a timestamp like Trim/Paddle invoices: "10th October 2026" (UTC day).
func formatReceiptDay(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return formatPaddleInvoiceDay(t.UTC())
}

func formatPaddleInvoiceDay(t time.Time) string {
	d := t.Day()
	return fmt.Sprintf("%d%s %s %d", d, englishDayOrdinal(d), t.Format("January"), t.Year())
}

func englishDayOrdinal(d int) string {
	if d%100 >= 11 && d%100 <= 13 {
		return "th"
	}
	switch d % 10 {
	case 1:
		return "st"
	case 2:
		return "nd"
	case 3:
		return "rd"
	default:
		return "th"
	}
}

// PaymentMethodDisplay is the Trim "Payment method:" value (human label, not channel slug).
// Accepts internal gateway ids or PublicChannel labels.
func PaymentMethodDisplay(provider string) string {
	ch := PublicChannel(provider)
	if ch == "" {
		ch = strings.ToLower(strings.TrimSpace(provider))
	}
	switch ch {
	case "manual_transfer", "manual":
		return "Manual bank transfer"
	case "local_checkout", "chapa":
		return "Local checkout"
	case "international_checkout", "paddle":
		return "Card payment"
	default:
		return ""
	}
}
