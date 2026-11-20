package rest

import (
	"context"
	"encoding/json"
	"net/http"

	"dama/apps/api/internal/pagination"
	"dama/apps/api/internal/store"
)

func paginationLabelsFromSettings(ctx context.Context, settings *store.SettingsStore) (pagination.Labels, int, int, bool) {
	if settings == nil {
		return pagination.Labels{}, 0, 0, false
	}
	raw, err := settings.PaginationChromeJSON(ctx)
	if err != nil || len(raw) == 0 {
		return pagination.Labels{}, 0, 0, false
	}
	var body struct {
		MaxLimit           int    `json:"max_limit"`
		SkipToMaxPages     int    `json:"skip_to_max_pages"`
		PrevActionLabel    string `json:"prev_action_label"`
		NextActionLabel    string `json:"next_action_label"`
		FirstActionLabel   string `json:"first_action_label"`
		LastActionLabel    string `json:"last_action_label"`
		FirstPendingLabel  string `json:"first_pending_label"`
		PrevPendingLabel   string `json:"prev_pending_label"`
		NextPendingLabel   string `json:"next_pending_label"`
		LastPendingLabel   string `json:"last_pending_label"`
		SkipToLabel        string `json:"skip_to_label"`
		SkipToActionLabel  string `json:"skip_to_action_label"`
		SkipToPendingLabel string `json:"skip_to_pending_label"`
		SkipToInvalid      string `json:"skip_to_invalid"`
		PageSummaryFmt     string `json:"page_summary_fmt"`
	}
	if err := json.Unmarshal(raw, &body); err != nil {
		return pagination.Labels{}, 0, 0, false
	}
	if body.MaxLimit < 1 || body.SkipToMaxPages < 1 {
		return pagination.Labels{}, 0, 0, false
	}
	labels := pagination.Labels{
		PrevActionLabel:    body.PrevActionLabel,
		NextActionLabel:    body.NextActionLabel,
		FirstActionLabel:   body.FirstActionLabel,
		LastActionLabel:    body.LastActionLabel,
		FirstPendingLabel:  body.FirstPendingLabel,
		PrevPendingLabel:   body.PrevPendingLabel,
		NextPendingLabel:   body.NextPendingLabel,
		LastPendingLabel:   body.LastPendingLabel,
		SkipToLabel:        body.SkipToLabel,
		SkipToActionLabel:  body.SkipToActionLabel,
		SkipToPendingLabel: body.SkipToPendingLabel,
		SkipToInvalid:      body.SkipToInvalid,
		PageSummaryFmt:     body.PageSummaryFmt,
	}
	if labels.PrevActionLabel == "" || labels.NextActionLabel == "" ||
		labels.FirstActionLabel == "" || labels.LastActionLabel == "" ||
		labels.SkipToActionLabel == "" || labels.PageSummaryFmt == "" {
		return pagination.Labels{}, 0, 0, false
	}
	return labels, body.MaxLimit, body.SkipToMaxPages, true
}

// parseListPagination reads Trim-style skip/limit and DB chrome for BuildMeta.
func parseListPagination(w http.ResponseWriter, r *http.Request, settings *store.SettingsStore) (pagination.Params, pagination.Labels, int, bool) {
	labels, maxLimit, skipCap, ok := paginationLabelsFromSettings(r.Context(), settings)
	if !ok {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "pagination chrome unavailable"})
		return pagination.Params{}, pagination.Labels{}, 0, false
	}
	// Chrome already validated MaxLimit/SkipToMaxPages >= 1 - fail closed, never invent.
	if maxLimit < 1 || skipCap < 1 {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "pagination chrome unavailable"})
		return pagination.Params{}, pagination.Labels{}, 0, false
	}
	params, err := pagination.Parse(r, maxLimit)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return pagination.Params{}, pagination.Labels{}, 0, false
	}
	return params, labels, skipCap, true
}
