package rest

import (
	"context"
	"encoding/json"
	"net/http"

	"dama/apps/api/internal/store"
)

type ProgressionAPI struct {
	Settings *store.SettingsStore
}

// Public returns DB-backed XP ladder + match clock (no client hardcodes).
func (a *ProgressionAPI) Public(w http.ResponseWriter, r *http.Request) {
	if a.Settings == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "progression config unavailable"})
		return
	}
	levels := a.Settings.XPLevels()
	clock := a.Settings.MatchClock()
	rewards := a.Settings.MatchRewards()
	if levels.Source != "database" || clock.Source != "database" || rewards.Source != "database" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "progression config unavailable"})
		return
	}
	writeJSON(w, http.StatusOK, progressionPayload(levels, clock, rewards))
}

// ConsoleGet returns progression + ad pricing for admin console hydration.
func (a *ProgressionAPI) ConsoleGet(w http.ResponseWriter, r *http.Request) {
	if a.Settings == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "progression config unavailable"})
		return
	}
	levels := a.Settings.XPLevels()
	clock := a.Settings.MatchClock()
	ads := a.Settings.AdPricing()
	rewards := a.Settings.MatchRewards()
	if levels.Source != "database" || clock.Source != "database" || ads.Source != "database" || rewards.Source != "database" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "platform settings unavailable"})
		return
	}
	// Always return progression; web_app_origin may be empty so admin can set it (no chicken-egg 503).
	writeJSON(w, http.StatusOK, consolePlatformPayload(r.Context(), a.Settings))
}

type progressionPutBody struct {
	XPLevels []struct {
		MinXP int    `json:"min_xp"`
		Label string `json:"label"`
	} `json:"xp_levels"`
	MatchClock *struct {
		Enabled          bool `json:"enabled"`
		InitialSeconds   int  `json:"initial_seconds"`
		IncrementSeconds int  `json:"increment_seconds"`
		InviteTTLSeconds int  `json:"invite_ttl_seconds"`
		// Pointers so an admin save that omits pause fields keeps the stored config.
		PauseEnabled         *bool `json:"pause_enabled"`
		PauseDurationSeconds *int  `json:"pause_duration_seconds"`
	} `json:"match_clock"`
	AdPricing *struct {
		ImpressionUnitCost                float64 `json:"impression_unit_cost"`
		CampaignCreateFeeEthiopiaAmount   float64 `json:"campaign_create_fee_ethiopia_amount"`
		CampaignCreateFeeEthiopiaCurrency string  `json:"campaign_create_fee_ethiopia_currency"`
		CampaignCreateFeeGlobalAmount     float64 `json:"campaign_create_fee_global_amount"`
		CampaignCreateFeeGlobalCurrency   string  `json:"campaign_create_fee_global_currency"`
	} `json:"ad_pricing"`
	MatchRewards *struct {
		WinXP          int `json:"win_xp"`
		DrawXP         int `json:"draw_xp"`
		LossXP         int `json:"loss_xp"`
		WinRating      int `json:"win_rating"`
		DrawRating     int `json:"draw_rating"`
		LossRating     int `json:"loss_rating"`
		RatingFloor    int `json:"rating_floor"`
		StartingRating int `json:"starting_rating"`
	} `json:"match_rewards"`
	WebAppOrigin *string `json:"web_app_origin"`
}

// ConsolePut updates xp_levels, match_clock, match_rewards, and/or ad_pricing in platform_settings.
func (a *ProgressionAPI) ConsolePut(w http.ResponseWriter, r *http.Request) {
	if a.Settings == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "progression config unavailable"})
		return
	}
	var body progressionPutBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	if body.XPLevels == nil && body.MatchClock == nil && body.AdPricing == nil && body.MatchRewards == nil && body.WebAppOrigin == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "xp_levels, match_clock, match_rewards, ad_pricing, or web_app_origin required"})
		return
	}
	if body.XPLevels != nil {
		levels := make([]store.XPLevel, 0, len(body.XPLevels))
		for _, lvl := range body.XPLevels {
			levels = append(levels, store.XPLevel{MinXP: lvl.MinXP, Label: lvl.Label})
		}
		if err := a.Settings.SetXPLevels(r.Context(), store.XPLevelsConfig{Levels: levels}); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
	}
	if body.MatchClock != nil {
		cur := a.Settings.MatchClock()
		cfg := store.MatchClockConfig{
			Enabled:              body.MatchClock.Enabled,
			InitialSeconds:       body.MatchClock.InitialSeconds,
			IncrementSeconds:     body.MatchClock.IncrementSeconds,
			InviteTTLSeconds:     body.MatchClock.InviteTTLSeconds,
			PauseEnabled:         cur.PauseEnabled,
			PauseDurationSeconds: cur.PauseDurationSeconds,
		}
		if body.MatchClock.PauseEnabled != nil {
			cfg.PauseEnabled = *body.MatchClock.PauseEnabled
		}
		if body.MatchClock.PauseDurationSeconds != nil {
			cfg.PauseDurationSeconds = *body.MatchClock.PauseDurationSeconds
		}
		if err := a.Settings.SetMatchClock(r.Context(), cfg); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
	}
	if body.AdPricing != nil {
		cfg := store.AdPricingConfig{
			ImpressionUnitCost:                body.AdPricing.ImpressionUnitCost,
			CampaignCreateFeeEthiopiaAmount:   body.AdPricing.CampaignCreateFeeEthiopiaAmount,
			CampaignCreateFeeEthiopiaCurrency: body.AdPricing.CampaignCreateFeeEthiopiaCurrency,
			CampaignCreateFeeGlobalAmount:     body.AdPricing.CampaignCreateFeeGlobalAmount,
			CampaignCreateFeeGlobalCurrency:   body.AdPricing.CampaignCreateFeeGlobalCurrency,
		}
		if err := a.Settings.SetAdPricing(r.Context(), cfg); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
	}
	if body.MatchRewards != nil {
		cfg := store.MatchRewardsConfig{
			WinXP:          body.MatchRewards.WinXP,
			DrawXP:         body.MatchRewards.DrawXP,
			LossXP:         body.MatchRewards.LossXP,
			WinRating:      body.MatchRewards.WinRating,
			DrawRating:     body.MatchRewards.DrawRating,
			LossRating:     body.MatchRewards.LossRating,
			RatingFloor:    body.MatchRewards.RatingFloor,
			StartingRating: body.MatchRewards.StartingRating,
		}
		if err := a.Settings.SetMatchRewards(r.Context(), cfg); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
	}
	if body.WebAppOrigin != nil {
		if err := a.Settings.SetPlayRailWebAppOrigin(r.Context(), *body.WebAppOrigin); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
	}
	writeJSON(w, http.StatusOK, consolePlatformPayload(
		r.Context(), a.Settings,
	))
}

func progressionPayload(levels store.XPLevelsConfig, clock store.MatchClockConfig, rewards store.MatchRewardsConfig) map[string]any {
	outLevels := make([]map[string]any, 0, len(levels.Levels))
	for _, lvl := range levels.Levels {
		outLevels = append(outLevels, map[string]any{
			"min_xp": lvl.MinXP,
			"label":  lvl.Label,
		})
	}
	presets := make([]map[string]any, 0, len(clock.Presets))
	for _, p := range clock.Presets {
		presets = append(presets, map[string]any{
			"seconds": p.Seconds,
			"label":   p.Label,
		})
	}
	return map[string]any{
		"xp_levels": outLevels,
		"match_clock": map[string]any{
			"enabled":                clock.Enabled,
			"initial_seconds":        clock.InitialSeconds,
			"increment_seconds":      clock.IncrementSeconds,
			"presets":                presets,
			"invite_ttl_seconds":     clock.InviteTTLSeconds,
			"pause_enabled":          clock.PauseEnabled,
			"pause_duration_seconds": clock.PauseDurationSeconds,
		},
		"match_rewards": map[string]any{
			"win_xp":          rewards.WinXP,
			"draw_xp":         rewards.DrawXP,
			"loss_xp":         rewards.LossXP,
			"win_rating":      rewards.WinRating,
			"draw_rating":     rewards.DrawRating,
			"loss_rating":     rewards.LossRating,
			"rating_floor":    rewards.RatingFloor,
			"starting_rating": rewards.StartingRating,
		},
	}
}

func consolePlatformPayload(ctx context.Context, settings *store.SettingsStore) map[string]any {
	out := progressionPayload(settings.XPLevels(), settings.MatchClock(), settings.MatchRewards())
	ads := settings.AdPricing()
	out["ad_pricing"] = map[string]any{
		"impression_unit_cost":                  ads.ImpressionUnitCost,
		"campaign_create_fee_ethiopia_amount":   ads.CampaignCreateFeeEthiopiaAmount,
		"campaign_create_fee_ethiopia_currency": ads.CampaignCreateFeeEthiopiaCurrency,
		"campaign_create_fee_global_amount":     ads.CampaignCreateFeeGlobalAmount,
		"campaign_create_fee_global_currency":   ads.CampaignCreateFeeGlobalCurrency,
	}
	origin, _ := settings.PlayRailWebAppOrigin(ctx)
	out["web_app_origin"] = origin // may be empty - admin must set for Flutter share
	return out
}
