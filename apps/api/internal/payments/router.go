package payments

import (
	"fmt"
	"strings"

	"dama/apps/api/internal/store"
)

type RouteDecision struct {
	Provider    string `json:"-"` // internal: chapa | manual | paddle
	Currency    string `json:"currency"`
	CountryCode string `json:"country_code"`
	// Reason is internal routing diagnostics only; never serialized to clients.
	Reason string `json:"-"`
}

// ResolveRoute picks gateway + currency from geo_payment + admin Ethiopia payment mode + DB currency.
// ethiopiaCountry must come from platform_settings.geo_payment (fail closed when empty).
// No silent USD/ETB fill: incomplete platform_settings.currency is an error path.
func ResolveRoute(countryCode string, flags store.FeatureFlags, currency store.CurrencyConfig, ethiopiaCountry string) RouteDecision {
	cc := strings.ToUpper(strings.TrimSpace(countryCode))
	et := strings.ToUpper(strings.TrimSpace(ethiopiaCountry))
	if currency.Source != "database" || currency.Global == "" || currency.Ethiopia == "" {
		return RouteDecision{
			CountryCode: cc,
			Reason:      "currency_config_unavailable",
		}
	}
	if et == "" {
		return RouteDecision{
			CountryCode: cc,
			Reason:      "geo_payment_unavailable",
		}
	}
	if cc == "" {
		return RouteDecision{
			CountryCode: "",
			Reason:      "country_code_required",
		}
	}
	if cc == et {
		mode := strings.ToLower(strings.TrimSpace(flags.EthiopiaPaymentMode))
		switch mode {
		case "manual":
			return RouteDecision{Provider: "manual", Currency: currency.Ethiopia, CountryCode: cc, Reason: "ethiopia_manual_mode"}
		case "chapa":
			return RouteDecision{Provider: "chapa", Currency: currency.Ethiopia, CountryCode: cc, Reason: "ethiopia_chapa_mode"}
		default:
			return RouteDecision{
				CountryCode: cc,
				Currency:    currency.Ethiopia,
				Reason:      "ethiopia_payment_mode_unavailable",
			}
		}
	}
	return RouteDecision{Provider: "paddle", Currency: currency.Global, CountryCode: cc, Reason: "international_paddle"}
}

func (d RouteDecision) Validate() error {
	if d.Reason == "currency_config_unavailable" {
		return fmt.Errorf("currency config unavailable")
	}
	if d.Reason == "geo_payment_unavailable" {
		return fmt.Errorf("geo payment config unavailable")
	}
	if d.Reason == "ethiopia_payment_mode_unavailable" {
		return fmt.Errorf("ethiopia payment mode unavailable")
	}
	if d.Reason == "country_code_required" || d.CountryCode == "" {
		return fmt.Errorf("country_code required")
	}
	if d.Provider == "" || d.Currency == "" {
		return fmt.Errorf("payment route incomplete")
	}
	return nil
}

// PublicChannel maps internal gateway ids to player-safe channel labels.
// Unknown providers return empty (no invented public label).
func PublicChannel(provider string) string {
	switch strings.ToLower(strings.TrimSpace(provider)) {
	case "chapa":
		return "local_checkout"
	case "paddle":
		return "international_checkout"
	case "manual":
		return "manual_transfer"
	default:
		return ""
	}
}

// InternalChannel maps public channel labels (or legacy ids) back to gateway ids.
func InternalChannel(label string) string {
	switch strings.ToLower(strings.TrimSpace(label)) {
	case "local_checkout", "chapa":
		return "chapa"
	case "international_checkout", "paddle":
		return "paddle"
	case "manual_transfer", "manual":
		return "manual"
	default:
		return ""
	}
}

// PublicRouteJSON is safe for anonymous/player clients (no vendor names, no reason).
func PublicRouteJSON(d RouteDecision) map[string]any {
	return map[string]any{
		"provider":     PublicChannel(d.Provider),
		"currency":     d.Currency,
		"country_code": d.CountryCode,
	}
}

// PublicBankJSON is the player-facing bank transfer card (no ops timestamps/flags).
func PublicBankJSON(b store.BankAccount) map[string]any {
	return map[string]any{
		"id":             b.ID,
		"label":          b.Label,
		"account_name":   b.AccountName,
		"account_number": b.AccountNumber,
		"mobile_code":    b.MobileCode,
		"currency":       b.Currency,
	}
}

// PublicBanks maps a bank list for anonymous/player checkout payloads.
func PublicBanks(list []store.BankAccount) []map[string]any {
	out := make([]map[string]any, 0, len(list))
	for _, b := range list {
		out = append(out, PublicBankJSON(b))
	}
	return out
}
