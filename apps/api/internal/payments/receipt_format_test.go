package payments

import (
	"testing"
	"time"
)

func TestFormatReceiptDay_paddleOrdinal(t *testing.T) {
	got := formatReceiptDay(time.Date(2026, 10, 10, 15, 30, 0, 0, time.UTC))
	want := "10th October 2026"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
	got = formatReceiptDay(time.Date(2026, 11, 1, 22, 41, 13, 0, time.UTC))
	want = "1st November 2026"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestPaymentMethodDisplay_notChannelSlug(t *testing.T) {
	if got := PaymentMethodDisplay("manual"); got != "Manual bank transfer" {
		t.Fatalf("manual: got %q", got)
	}
	if got := PaymentMethodDisplay("manual_transfer"); got != "Manual bank transfer" {
		t.Fatalf("manual_transfer: got %q", got)
	}
	if got := PaymentMethodDisplay("chapa"); got != "Local checkout" {
		t.Fatalf("chapa: got %q", got)
	}
}
