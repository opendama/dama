package rest

import (
	"encoding/json"
	"net/http"
	"strings"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/db"
	"dama/apps/api/internal/geo"
	"dama/apps/api/internal/payments"
	"dama/apps/api/internal/presence"
	"dama/apps/api/internal/store"
)

type GeoAPI struct {
	Geo      *geo.Resolver
	Payments *payments.Service
	Presence *presence.Service
	Users    *store.UserStore
	Settings *store.SettingsStore
	DB       *db.Handle
	Activity *ActivityAPI
}

type locateBody struct {
	// country_code is never accepted (reference pay geo: IP / GPS / DB localhost invent only).
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

func (a *GeoAPI) Locate(w http.ResponseWriter, r *http.Request) {
	var body locateBody
	_ = json.NewDecoder(r.Body).Decode(&body)

	clientIP := geo.ClientIP(r)
	// Never honor client country hints (even when DAMA_ALLOW_E2E_AUTH=1).
	// E2E geo uses X-Forwarded-For / CF-Connecting-IP instead.
	result, err := a.Geo.Resolve(
		r.Context(),
		"",
		false,
		body.Latitude,
		body.Longitude,
		clientIP,
		privateDefaultFromSettings(a.Settings),
	)
	if err != nil {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "location_unavailable")
		return
	}

	// Pay-chain parity with reference: no profile-country fill on locate.
	if strings.TrimSpace(result.CountryCode) == "" {
		writeJSON(w, http.StatusOK, map[string]any{
			"location": map[string]any{
				"country_code": "",
				"region":       result.Region,
				"city":         result.City,
			},
			"route": map[string]any{
				"provider":     "",
				"currency":     "",
				"country_code": "",
			},
		})
		return
	}

	route := payments.ResolveRoute(result.CountryCode, a.Payments.Flags(), a.Payments.CurrencyConfig(), a.Payments.EthiopiaCountry())
	if err := route.Validate(); err != nil {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "payment_route_unavailable")
		return
	}

	userID := auth.UserIDFromContext(r.Context())
	if userID != "" {
		if a.Presence != nil {
			_ = a.Presence.Touch(r.Context(), userID)
		}
		persist := result.Source == "geoip" || result.Source == "gps" || result.Source == "dev_default"
		if persist && a.DB != nil && a.DB.Ready() && result.CountryCode != "" {
			_, _ = a.DB.Pool.Exec(r.Context(), `
				INSERT INTO geo_ip_records (user_id, ip, country_code, region, city, source, latitude, longitude, created_at)
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
			`, userID, clientIP, result.CountryCode, result.Region, result.City, result.Source, result.Latitude, result.Longitude)
			if a.Users != nil {
				_ = a.Users.UpdateLocation(r.Context(), userID, result.CountryCode, result.Region)
			}
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"location": map[string]any{
			"country_code": result.CountryCode,
			"region":       result.Region,
			"city":         result.City,
		},
		"route": payments.PublicRouteJSON(route),
	})
}

func (a *GeoAPI) Heartbeat(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	if err := a.Presence.Touch(r.Context(), userID); err != nil {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_presence_unavailable")
		return
	}
	if a.Activity != nil {
		a.Activity.RecordAuthVisit(r, userID)
	}
	writeJSON(w, http.StatusOK, map[string]any{"online": true, "user_id": userID})
}

func (a *GeoAPI) OnlineStatus(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("user_id")
	if id == "" {
		id = r.URL.Query().Get("user_ids")
	}
	online := false
	if id != "" && a.Presence != nil {
		if a.Users != nil {
			if u, err := a.Users.GetByID(r.Context(), id); err == nil {
				if a.Settings != nil && a.Settings.IsConsoleRole(u.Role) {
					writeJSON(w, http.StatusOK, map[string]any{"user_id": id, "online": false})
					return
				}
			}
		}
		online = a.Presence.Online(r.Context(), id)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"user_id": id,
		"online":  online,
	})
}
