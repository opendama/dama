package rest

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"dama/apps/api/internal/store"
)

func walletChromeString(settings *store.SettingsStore, ctx context.Context, key string) string {
	if settings == nil {
		return ""
	}
	raw, err := settings.WalletChromeJSON(ctx)
	if err != nil || len(raw) == 0 {
		return ""
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return ""
	}
	v, _ := doc[key].(string)
	return strings.TrimSpace(v)
}

// walletListStatusLabel returns wallet_chrome list_status_<code> for notif bodies (fail closed).
func walletListStatusLabel(ctx context.Context, settings *store.SettingsStore, status string) string {
	code := strings.TrimSpace(status)
	if code == "" {
		return ""
	}
	return walletChromeString(settings, ctx, "list_status_"+code)
}

func writeWalletChromeError(w http.ResponseWriter, settings *store.SettingsStore, ctx context.Context, status int, key string) {
	k := strings.TrimSpace(key)
	msg := walletChromeString(settings, ctx, k)
	// Provider checkout failures: expose checkout_failed copy (single professional UX string).
	// Clients still receive error_key=checkout_unavailable for routing.
	if k == "checkout_unavailable" {
		if failed := walletChromeString(settings, ctx, "checkout_failed"); failed != "" {
			msg = failed
		}
	}
	if msg == "" {
		unavailable := walletChromeString(settings, ctx, "wallet_chrome_unavailable")
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"error":     unavailable,
			"error_key": k,
		})
		return
	}
	// Include error_key so clients map to chrome without toasting raw JSON bodies.
	writeJSON(w, status, map[string]string{
		"error":     msg,
		"error_key": k,
	})
}

func storeComplianceChromeString(settings *store.SettingsStore, ctx context.Context, key string) string {
	if settings == nil {
		return ""
	}
	raw, err := settings.StoreComplianceChromeJSON(ctx)
	if err != nil || len(raw) == 0 {
		return ""
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return ""
	}
	v, _ := doc[key].(string)
	return strings.TrimSpace(v)
}

func writeStoreComplianceError(w http.ResponseWriter, settings *store.SettingsStore, ctx context.Context, status int, key string) {
	msg := storeComplianceChromeString(settings, ctx, key)
	if msg == "" {
		unavailable := storeComplianceChromeString(settings, ctx, "store_compliance_unavailable")
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": unavailable})
		return
	}
	writeJSON(w, status, map[string]string{"error": msg})
}

func legalChromeString(settings *store.SettingsStore, ctx context.Context, key string) string {
	if settings == nil || strings.TrimSpace(key) == "" {
		return ""
	}
	raw, err := settings.LegalChromeJSON(ctx)
	if err != nil || len(raw) == 0 {
		return ""
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return ""
	}
	v, _ := doc[key].(string)
	return strings.TrimSpace(v)
}

func writeLegalChromeError(w http.ResponseWriter, settings *store.SettingsStore, ctx context.Context, status int, key string) {
	msg := legalChromeString(settings, ctx, key)
	if msg == "" {
		unavailable := legalChromeString(settings, ctx, "legal_unavailable")
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": unavailable})
		return
	}
	writeJSON(w, status, map[string]string{"error": msg})
}

func avatarChromeString(settings *store.SettingsStore, ctx context.Context, key string) string {
	if settings == nil || strings.TrimSpace(key) == "" {
		return ""
	}
	raw, err := settings.AvatarChromeJSON(ctx)
	if err != nil || len(raw) == 0 {
		return ""
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return ""
	}
	v, _ := doc[key].(string)
	return strings.TrimSpace(v)
}

func writeAvatarChromeError(w http.ResponseWriter, settings *store.SettingsStore, ctx context.Context, status int, key string) {
	msg := avatarChromeString(settings, ctx, key)
	if msg == "" {
		unavailable := avatarChromeString(settings, ctx, "avatar_chrome_unavailable")
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": unavailable})
		return
	}
	writeJSON(w, status, map[string]string{"error": msg})
}

// adminPaymentsChromeString reads admin_console_chrome.payments.<key> (fail closed → empty).
func adminPaymentsChromeString(settings *store.SettingsStore, ctx context.Context, key string) string {
	if settings == nil || strings.TrimSpace(key) == "" {
		return ""
	}
	raw, err := settings.AdminConsoleChromeJSON(ctx)
	if err != nil || len(raw) == 0 {
		return ""
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return ""
	}
	pay, ok := doc["payments"].(map[string]any)
	if !ok {
		return ""
	}
	v, _ := pay[key].(string)
	return strings.TrimSpace(v)
}

// tournamentChromeString reads payment_modal_chrome (enroll copy) fail-closed → empty.
func tournamentChromeString(settings *store.SettingsStore, ctx context.Context, key string) string {
	if settings == nil {
		return ""
	}
	raw, err := settings.PaymentModalChromeJSON(ctx)
	if err != nil || len(raw) == 0 {
		return ""
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return ""
	}
	v, _ := doc[key].(string)
	return strings.TrimSpace(v)
}

func tournamentsPlayerChromeString(settings *store.SettingsStore, ctx context.Context, key string) string {
	if settings == nil || strings.TrimSpace(key) == "" {
		return ""
	}
	raw, err := settings.TournamentsPlayerChromeJSON(ctx)
	if err != nil || len(raw) == 0 {
		return ""
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return ""
	}
	v, _ := doc[key].(string)
	return strings.TrimSpace(v)
}

func writeTournamentsPlayerErr(w http.ResponseWriter, settings *store.SettingsStore, ctx context.Context, status int, key string) {
	msg := tournamentsPlayerChromeString(settings, ctx, key)
	if msg == "" {
		unavailable := tournamentsPlayerChromeString(settings, ctx, "tournaments_player_chrome_unavailable")
		if key == "" {
			key = "tournaments_player_chrome_unavailable"
		}
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": unavailable, "error_key": key})
		return
	}
	// Hosted writeEventsPlayerErr parity: clients map error_key → chrome (api.ts key-only).
	writeJSON(w, status, map[string]string{"error": msg, "error_key": key})
}

func adminTournamentChromeString(settings *store.SettingsStore, ctx context.Context, key string) string {
	if settings == nil || strings.TrimSpace(key) == "" {
		return ""
	}
	raw, err := settings.TournamentChromeJSON(ctx)
	if err != nil || len(raw) == 0 {
		return ""
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return ""
	}
	v, _ := doc[key].(string)
	return strings.TrimSpace(v)
}

func writeAdminTournamentErr(w http.ResponseWriter, settings *store.SettingsStore, ctx context.Context, status int, key string) {
	key = strings.TrimSpace(key)
	msg := adminTournamentChromeString(settings, ctx, key)
	if msg == "" {
		unavailable := adminTournamentChromeString(settings, ctx, "tournament_chrome_unavailable")
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": unavailable, "error_key": "tournament_chrome_unavailable"})
		return
	}
	writeJSON(w, status, map[string]string{"error": msg, "error_key": key})
}

func playRailChromeString(settings *store.SettingsStore, ctx context.Context, key string) string {
	if settings == nil {
		return ""
	}
	raw, err := settings.PlayRailChromeJSON(ctx)
	if err != nil || len(raw) == 0 {
		return ""
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return ""
	}
	v, _ := doc[key].(string)
	return strings.TrimSpace(v)
}

func matchmakingChromeString(settings *store.SettingsStore, ctx context.Context, key string) string {
	if settings == nil {
		return ""
	}
	raw, err := settings.MatchmakingChromeJSON(ctx)
	if err != nil || len(raw) == 0 {
		return ""
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return ""
	}
	v, _ := doc[key].(string)
	return strings.TrimSpace(v)
}

// inviteChromeString prefers play_rail then matchmaking (same key in both).
func inviteChromeString(settings *store.SettingsStore, ctx context.Context, key string) string {
	if msg := playRailChromeString(settings, ctx, key); msg != "" {
		return msg
	}
	return matchmakingChromeString(settings, ctx, key)
}
