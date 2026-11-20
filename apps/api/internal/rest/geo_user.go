package rest

import (
	"context"
	"net/http"

	"dama/apps/api/internal/geo"
	"dama/apps/api/internal/store"
)

// applyVerifiedGeoIPToUser writes users.country_code from IP GeoIP or localhost invent
// (reference parity). Never accepts client country hints or profile loops.
func applyVerifiedGeoIPToUser(
	ctx context.Context,
	users *store.UserStore,
	resolver *geo.Resolver,
	settings *store.SettingsStore,
	r *http.Request,
	userID string,
) {
	if users == nil || resolver == nil || userID == "" || r == nil {
		return
	}
	result, err := resolver.Resolve(ctx, "", false, 0, 0, geo.ClientIP(r), privateDefaultFromSettings(settings))
	if err != nil || result == nil || result.CountryCode == "" {
		return
	}
	if result.Source != "geoip" && result.Source != "dev_default" && result.Source != "gps" {
		return
	}
	_ = users.UpdateLocation(ctx, userID, result.CountryCode, result.Region)
}
