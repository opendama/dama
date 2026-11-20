package auth

import (
	"encoding/json"
	"net/http"
	"strings"
)

// GateChrome supplies DB-backed auth gate copy (auth_providers). Fail closed empty.
type GateChrome interface {
	AuthUnauthorized() string
	AuthForbidden() string
}

var gateChrome GateChrome

// SetGateChrome wires platform_settings auth_providers into RequireAuth gates.
func SetGateChrome(c GateChrome) {
	gateChrome = c
}

func writeAuthGateError(w http.ResponseWriter, status int, forbidden bool) {
	msg := ""
	if gateChrome != nil {
		if forbidden {
			msg = strings.TrimSpace(gateChrome.AuthForbidden())
		} else {
			msg = strings.TrimSpace(gateChrome.AuthUnauthorized())
		}
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	body, err := json.Marshal(map[string]string{"error": msg})
	if err != nil {
		_, _ = w.Write([]byte(`{"error":""}`))
		return
	}
	_, _ = w.Write(body)
}

// WriteUnauthorized writes DB auth_providers err_unauthorized (fail closed empty).
func WriteUnauthorized(w http.ResponseWriter) {
	writeAuthGateError(w, http.StatusUnauthorized, false)
}

// WriteForbidden writes DB auth_providers err_forbidden (fail closed empty).
func WriteForbidden(w http.ResponseWriter) {
	writeAuthGateError(w, http.StatusForbidden, true)
}
