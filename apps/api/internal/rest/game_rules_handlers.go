package rest

import (
	"encoding/json"
	"net/http"

	"dama/apps/api/internal/store"
)

type GameRulesAPI struct {
	Settings *store.SettingsStore
}

// Public returns FMJD board parameters from platform_settings (fail closed).
func (a *GameRulesAPI) Public(w http.ResponseWriter, r *http.Request) {
	if a.Settings == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "board rules unavailable"})
		return
	}
	cfg := a.Settings.BoardRules()
	if cfg.Source != "database" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "board rules unavailable"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"size":            cfg.Size,
		"pieces_per_side": cfg.PiecesPerSide,
		"setup_rows":      cfg.SetupRows,
		"variant":         cfg.Variant,
	})
}

// ConsolePut updates board_rules in platform_settings.
func (a *GameRulesAPI) ConsolePut(w http.ResponseWriter, r *http.Request) {
	if a.Settings == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "board rules unavailable"})
		return
	}
	var body store.BoardRulesConfig
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	if err := a.Settings.SetBoardRules(r.Context(), body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	cfg := a.Settings.BoardRules()
	writeJSON(w, http.StatusOK, map[string]any{
		"size":            cfg.Size,
		"pieces_per_side": cfg.PiecesPerSide,
		"setup_rows":      cfg.SetupRows,
		"variant":         cfg.Variant,
	})
}
