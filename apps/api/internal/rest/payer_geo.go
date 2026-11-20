package rest

import (
	"net/http"
	"strings"

	"dama/apps/api/internal/geo"
	"dama/apps/api/internal/store"
)

// privateDefaultFromSettings builds geo.PrivateDefault from platform_settings.geo_payment.
func privateDefaultFromSettings(settings *store.SettingsStore) geo.PrivateDefault {
	if settings == nil {
		return geo.PrivateDefault{}
	}
	return geo.PrivateDefault{
		CountryCode: settings.EthiopiaCountry(),
		City:        settings.PrivateDefaultCity(),
		Region:      settings.PrivateDefaultRegion(),
	}
}

// resolvePayerCountryFromRequest resolves pay-chain country from request IP/GPS only
// (reference pay geo: no client country_code, no profile fallback).
func resolvePayerCountryFromRequest(
	r *http.Request,
	locate *geo.Resolver,
	settings *store.SettingsStore,
	lat, lng float64,
) string {
	if r == nil || locate == nil {
		return ""
	}
	res, err := locate.Resolve(
		r.Context(),
		"",
		false,
		lat,
		lng,
		geo.ClientIP(r),
		privateDefaultFromSettings(settings),
	)
	if err != nil || res == nil {
		return ""
	}
	cc := strings.ToUpper(strings.TrimSpace(res.CountryCode))
	if len(cc) != 2 {
		return ""
	}
	return cc
}
