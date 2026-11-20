package rest

import (
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"dama/apps/api/internal/payments"
)

// allowedFinancialOverviewDays is the only period window clients may request.
var allowedFinancialOverviewDays = map[int]bool{7: true, 30: true, 90: true}

// ConsoleFinancialOverview returns platform money KPIs for the Sales overview page.
// All amounts are real queue / ledger / fee aggregates (no client invent).
// Optional query: days=7|30|90 (default 7). Fail-closed on SQL errors (no silent zeros).
func (a *PaymentsAPI) ConsoleFinancialOverview(w http.ResponseWriter, r *http.Request) {
	if a == nil || a.DB == nil || !a.DB.Ready() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "database unavailable"})
		return
	}
	ctx := r.Context()
	days := 7
	if raw := strings.TrimSpace(r.URL.Query().Get("days")); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || !allowedFinancialOverviewDays[n] {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid days"})
			return
		}
		days = n
	}
	since := time.Now().UTC().Add(-time.Duration(days) * 24 * time.Hour)

	var pendingReceipts, pendingPayouts, pendingKyc int
	if err := a.DB.Pool.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM payment_intents
		WHERE lower(trim(status)) = 'pending'
		   OR lower(trim(status)) = 'awaiting_receipt'`).Scan(&pendingReceipts); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "overview_query_failed"})
		return
	}
	if err := a.DB.Pool.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM payout_requests
		WHERE lower(trim(status)) = 'pending'`).Scan(&pendingPayouts); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "overview_query_failed"})
		return
	}
	if err := a.DB.Pool.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM kyc_document_submissions
		WHERE lower(trim(status)) = 'pending'`).Scan(&pendingKyc); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "overview_query_failed"})
		return
	}

	type currAmt struct {
		Currency string  `json:"currency"`
		Amount   float64 `json:"amount"`
	}
	scanCurr := func(q string, args ...any) ([]currAmt, error) {
		rows, err := a.DB.Pool.Query(ctx, q, args...)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		out := make([]currAmt, 0)
		for rows.Next() {
			var c currAmt
			if err := rows.Scan(&c.Currency, &c.Amount); err != nil {
				return nil, err
			}
			c.Currency = strings.ToUpper(strings.TrimSpace(c.Currency))
			if c.Currency == "" {
				continue
			}
			c.Amount = payments.RoundMoney2(c.Amount)
			out = append(out, c)
		}
		if err := rows.Err(); err != nil {
			return nil, err
		}
		return out, nil
	}

	topups, err := scanCurr(`
		SELECT upper(trim(currency)), COALESCE(SUM(amount), 0)::float8
		FROM payment_intents
		WHERE lower(trim(status)) IN ('paid', 'approved')
		  AND lower(trim(purpose)) = 'wallet_topup'
		  AND COALESCE(updated_at, created_at) >= $1
		GROUP BY 1
		ORDER BY 1`, since)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "overview_query_failed"})
		return
	}
	payouts, err := scanCurr(`
		SELECT upper(trim(currency)), COALESCE(SUM(amount), 0)::float8
		FROM payout_requests
		WHERE lower(trim(status)) IN ('paid', 'approved')
		  AND COALESCE(reviewed_at, created_at) >= $1
		GROUP BY 1
		ORDER BY 1`, since)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "overview_query_failed"})
		return
	}
	hostFees, err := scanCurr(`
		SELECT upper(trim(currency)), COALESCE(SUM(ABS(amount)), 0)::float8
		FROM wallet_ledger
		WHERE kind = $2
		  AND created_at >= $1
		GROUP BY 1
		ORDER BY 1`, since, payments.LedgerKindEventHostFee)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "overview_query_failed"})
		return
	}
	entryComm, err := scanCurr(`
		SELECT upper(trim(currency)), COALESCE(SUM(ABS(amount)), 0)::float8
		FROM wallet_ledger
		WHERE kind = $2
		  AND created_at >= $1
		GROUP BY 1
		ORDER BY 1`, since, payments.LedgerKindEventEntryCommission)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "overview_query_failed"})
		return
	}
	balances, err := scanCurr(`
		SELECT upper(trim(currency)), COALESCE(SUM(balance), 0)::float8
		FROM wallets
		GROUP BY 1
		ORDER BY 1`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "overview_query_failed"})
		return
	}

	// Platform take = host fees + entry commissions in the window (per currency).
	revMap := map[string]float64{}
	for _, row := range hostFees {
		revMap[row.Currency] += row.Amount
	}
	for _, row := range entryComm {
		revMap[row.Currency] += row.Amount
	}
	revKeys := make([]string, 0, len(revMap))
	for cur := range revMap {
		revKeys = append(revKeys, cur)
	}
	sort.Strings(revKeys)
	platformRevenue := make([]currAmt, 0, len(revKeys))
	for _, cur := range revKeys {
		platformRevenue = append(platformRevenue, currAmt{
			Currency: cur,
			Amount:   payments.RoundMoney2(revMap[cur]),
		})
	}

	// Net cashflow = paid top-ups minus paid/approved payouts (per currency).
	cashMap := map[string]float64{}
	for _, row := range topups {
		cashMap[row.Currency] += row.Amount
	}
	for _, row := range payouts {
		cashMap[row.Currency] -= row.Amount
	}
	cashKeys := make([]string, 0, len(cashMap))
	for cur := range cashMap {
		cashKeys = append(cashKeys, cur)
	}
	sort.Strings(cashKeys)
	netCashflow := make([]currAmt, 0, len(cashKeys))
	for _, cur := range cashKeys {
		netCashflow = append(netCashflow, currAmt{
			Currency: cur,
			Amount:   payments.RoundMoney2(cashMap[cur]),
		})
	}

	// Net profit for ops = platform take in the window (same amounts as platform_revenue).
	netProfit := make([]currAmt, len(platformRevenue))
	copy(netProfit, platformRevenue)

	writeJSON(w, http.StatusOK, map[string]any{
		"pending_receipts": pendingReceipts,
		"pending_payouts":  pendingPayouts,
		"pending_kyc":      pendingKyc,
		"period_days":      days,
		"topup_volume":     topups,
		"payout_volume":    payouts,
		"host_fee_volume":  hostFees,
		"entry_commission": entryComm,
		"platform_revenue": platformRevenue,
		"net_profit":       netProfit,
		"net_cashflow":     netCashflow,
		"wallet_balances":  balances,
		"generated_at":     time.Now().UTC(),
	})
}
