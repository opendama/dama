package payments

import "testing"

func TestReceiptDisplayStatus(t *testing.T) {
	t.Parallel()
	cases := []struct {
		in, want string
	}{
		{"approved", "paid"},
		{"Approved", "paid"},
		{"pending", "pending"},
		{"rejected", "rejected"},
		{"paid", "paid"},
		{"", ""},
		{"  approved  ", "paid"},
	}
	for _, tc := range cases {
		if got := ReceiptDisplayStatus(tc.in); got != tc.want {
			t.Fatalf("ReceiptDisplayStatus(%q)=%q want %q", tc.in, got, tc.want)
		}
	}
}

func TestReceiptListFilterStatus(t *testing.T) {
	t.Parallel()
	cases := []struct {
		in, want string
	}{
		{"paid", "approved"},
		{"Paid", "approved"},
		{"pending", "pending"},
		{"rejected", "rejected"},
		{"approved", "approved"},
		{"", ""},
	}
	for _, tc := range cases {
		if got := ReceiptListFilterStatus(tc.in); got != tc.want {
			t.Fatalf("ReceiptListFilterStatus(%q)=%q want %q", tc.in, got, tc.want)
		}
	}
}
