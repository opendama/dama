package pagination

import (
	"fmt"
	"net/http"
	"strconv"
)

// Params is OFFSET/LIMIT pagination driven by query params skip and limit.
type Params struct {
	Skip  int
	Limit int
}

// Labels are DB-backed chrome strings (platform_settings.pagination_chrome).
type Labels struct {
	PrevActionLabel    string
	NextActionLabel    string
	FirstActionLabel   string
	LastActionLabel    string
	FirstPendingLabel  string
	PrevPendingLabel   string
	NextPendingLabel   string
	LastPendingLabel   string
	SkipToLabel        string
	SkipToActionLabel  string
	SkipToPendingLabel string
	SkipToInvalid      string
	PageSummaryFmt     string // fmt with %d,%d,%d = page, totalPages, total
}

// Meta is returned with every list response so the client never invents totals.
type Meta struct {
	Skip               int    `json:"skip"`
	Limit              int    `json:"limit"`
	Total              int    `json:"total"`
	HasMore            bool   `json:"has_more"`
	NextSkip           *int   `json:"next_skip"`
	PrevSkip           *int   `json:"prev_skip"`
	Page               int    `json:"page"`
	TotalPages         int    `json:"total_pages"`
	PrevActionLabel    string `json:"prev_action_label"`
	NextActionLabel    string `json:"next_action_label"`
	FirstSkip          *int   `json:"first_skip"`
	LastSkip           *int   `json:"last_skip"`
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
	PageSummary        string `json:"page_summary"`
	// PageSkips[i] is the database OFFSET for 1-based page i+1.
	PageSkips []int `json:"page_skips,omitempty"`
}

// CodeError is an error whose Error() returns a stable code string.
type CodeError struct {
	Code string
}

func (e CodeError) Error() string { return e.Code }

// Parse reads skip and limit from the request. Both must be present as integers.
func Parse(r *http.Request, maxLimit int) (Params, error) {
	if maxLimit < 1 {
		return Params{}, CodeError{Code: "PAGINATION_MAX_LIMIT_INVALID"}
	}

	skipRaw := r.URL.Query().Get("skip")
	limitRaw := r.URL.Query().Get("limit")
	if skipRaw == "" {
		return Params{}, CodeError{Code: "PAGINATION_SKIP_REQUIRED"}
	}
	if limitRaw == "" {
		return Params{}, CodeError{Code: "PAGINATION_LIMIT_REQUIRED"}
	}

	skip, err := strconv.Atoi(skipRaw)
	if err != nil {
		return Params{}, CodeError{Code: "PAGINATION_SKIP_NOT_INT"}
	}
	limit, err := strconv.Atoi(limitRaw)
	if err != nil {
		return Params{}, CodeError{Code: "PAGINATION_LIMIT_NOT_INT"}
	}
	if skip < 0 {
		return Params{}, CodeError{Code: "PAGINATION_SKIP_NEGATIVE"}
	}
	if limit < 1 {
		return Params{}, CodeError{Code: "PAGINATION_LIMIT_TOO_SMALL"}
	}
	if limit > maxLimit {
		return Params{}, CodeError{Code: "PAGINATION_LIMIT_TOO_LARGE"}
	}

	return Params{Skip: skip, Limit: limit}, nil
}

// BuildMeta computes pagination metadata from a real total count.
// maxSkipToPages caps page_skips; beyond that, first/last/prev/next only.
func BuildMeta(p Params, total int, maxSkipToPages int, labels Labels) Meta {
	if total < 0 {
		total = 0
	}
	page := 1
	if p.Limit > 0 {
		page = (p.Skip / p.Limit) + 1
	}
	totalPages := 0
	if p.Limit > 0 && total > 0 {
		totalPages = (total + p.Limit - 1) / p.Limit
	}

	pageSummary := ""
	if labels.PageSummaryFmt != "" {
		pageSummary = fmt.Sprintf(labels.PageSummaryFmt, page, totalPages, total)
	}
	meta := Meta{
		Skip:               p.Skip,
		Limit:              p.Limit,
		Total:              total,
		HasMore:            p.Skip+p.Limit < total,
		Page:               page,
		TotalPages:         totalPages,
		PrevActionLabel:    labels.PrevActionLabel,
		NextActionLabel:    labels.NextActionLabel,
		FirstActionLabel:   labels.FirstActionLabel,
		LastActionLabel:    labels.LastActionLabel,
		FirstPendingLabel:  labels.FirstPendingLabel,
		PrevPendingLabel:   labels.PrevPendingLabel,
		NextPendingLabel:   labels.NextPendingLabel,
		LastPendingLabel:   labels.LastPendingLabel,
		SkipToLabel:        labels.SkipToLabel,
		SkipToActionLabel:  labels.SkipToActionLabel,
		SkipToPendingLabel: labels.SkipToPendingLabel,
		SkipToInvalid:      labels.SkipToInvalid,
		PageSummary:        pageSummary,
	}

	if meta.HasMore {
		next := p.Skip + p.Limit
		meta.NextSkip = &next
	}
	if p.Skip > 0 {
		prev := p.Skip - p.Limit
		if prev < 0 {
			prev = 0
		}
		meta.PrevSkip = &prev
		zero := 0
		meta.FirstSkip = &zero
	}
	if totalPages > 1 && page < totalPages && p.Limit > 0 {
		last := (totalPages - 1) * p.Limit
		meta.LastSkip = &last
	}

	if maxSkipToPages > 0 && totalPages > 0 && totalPages <= maxSkipToPages && p.Limit > 0 {
		skips := make([]int, totalPages)
		for i := 0; i < totalPages; i++ {
			skips[i] = i * p.Limit
		}
		meta.PageSkips = skips
	}

	return meta
}
