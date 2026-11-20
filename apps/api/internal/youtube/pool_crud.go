package youtube

import (
	"context"
	"fmt"
	"strings"
)

// UpdateInput patches channel metadata; empty credential fields keep existing secrets.
type UpdateInput struct {
	Label           *string
	DailyQuotaLimit *int
	SortOrder       *int
	IsActive        *bool
	ClientID        *string
	ClientSecret    *string
	RefreshToken    *string
	APIKey          *string
	ChannelID       *string
}

func (p *Pool) Update(ctx context.Context, id string, in UpdateInput) (*Channel, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return nil, fmt.Errorf("channel not found")
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	var target *Channel
	for _, ch := range p.list {
		if ch.ID == id {
			target = ch
			break
		}
	}
	if target == nil {
		return nil, fmt.Errorf("channel not found")
	}
	if in.Label != nil {
		label := strings.TrimSpace(*in.Label)
		if label == "" {
			return nil, fmt.Errorf("label required")
		}
		target.Label = label
	}
	if in.ChannelID != nil {
		cid := strings.TrimSpace(*in.ChannelID)
		if cid == "" {
			return nil, fmt.Errorf("channel_id required")
		}
		target.ChannelID = cid
	}
	if in.DailyQuotaLimit != nil {
		if *in.DailyQuotaLimit < 1 {
			return nil, fmt.Errorf("daily_quota_limit invalid")
		}
		target.DailyQuotaLimit = *in.DailyQuotaLimit
	}
	if in.SortOrder != nil {
		if *in.SortOrder < 0 {
			return nil, fmt.Errorf("sort_order invalid")
		}
		target.SortOrder = *in.SortOrder
	}
	if in.IsActive != nil {
		target.IsActive = *in.IsActive
	}
	if in.ClientID != nil && strings.TrimSpace(*in.ClientID) != "" {
		target.ClientID = strings.TrimSpace(*in.ClientID)
	}
	if in.ClientSecret != nil && strings.TrimSpace(*in.ClientSecret) != "" {
		target.ClientSecret = strings.TrimSpace(*in.ClientSecret)
	}
	if in.RefreshToken != nil && strings.TrimSpace(*in.RefreshToken) != "" {
		target.RefreshToken = strings.TrimSpace(*in.RefreshToken)
	}
	if in.APIKey != nil && strings.TrimSpace(*in.APIKey) != "" {
		target.APIKey = strings.TrimSpace(*in.APIKey)
	}

	if p.db != nil && p.db.Ready() {
		cidEnc, err := p.encrypt(target.ClientID)
		if err != nil {
			return nil, fmt.Errorf("unable to encrypt channel credentials")
		}
		secEnc, err := p.encrypt(target.ClientSecret)
		if err != nil {
			return nil, fmt.Errorf("unable to encrypt channel credentials")
		}
		refEnc, err := p.encrypt(target.RefreshToken)
		if err != nil {
			return nil, fmt.Errorf("unable to encrypt channel credentials")
		}
		keyEnc, err := p.encrypt(target.APIKey)
		if err != nil {
			return nil, fmt.Errorf("unable to encrypt channel credentials")
		}
		_, err = p.db.Pool.Exec(ctx, `
			UPDATE youtube_channels
			SET channel_id=$2, label=$3,
			    client_id_enc=$4, client_secret_enc=$5, refresh_token_enc=$6, api_key_enc=$7,
			    daily_quota_limit=$8, sort_order=$9, is_active=$10, updated_at=NOW()
			WHERE id=$1
		`, target.ID, target.ChannelID, target.Label, cidEnc, secEnc, refEnc, keyEnc,
			target.DailyQuotaLimit, target.SortOrder, target.IsActive)
		if err != nil {
			return nil, fmt.Errorf("unable to update channel")
		}
	}
	p.sortLocked()
	cp := *target
	cp.ClientID = ""
	cp.ClientSecret = ""
	cp.RefreshToken = ""
	cp.APIKey = ""
	return &cp, nil
}

func (p *Pool) Delete(ctx context.Context, id string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return fmt.Errorf("channel not found")
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	idx := -1
	for i, ch := range p.list {
		if ch.ID == id {
			idx = i
			break
		}
	}
	if idx < 0 {
		return fmt.Errorf("channel not found")
	}
	if p.db != nil && p.db.Ready() {
		tag, err := p.db.Pool.Exec(ctx, `DELETE FROM youtube_channels WHERE id=$1`, id)
		if err != nil {
			return fmt.Errorf("unable to delete channel")
		}
		if tag.RowsAffected() == 0 {
			return fmt.Errorf("channel not found")
		}
	}
	p.list = append(p.list[:idx], p.list[idx+1:]...)
	return nil
}

func (p *Pool) sortLocked() {
	// Insertion order by sort_order then created_at (stable for failover).
	n := len(p.list)
	for i := 1; i < n; i++ {
		j := i
		for j > 0 {
			a, b := p.list[j-1], p.list[j]
			if a.SortOrder < b.SortOrder || (a.SortOrder == b.SortOrder && !a.CreatedAt.After(b.CreatedAt)) {
				break
			}
			p.list[j-1], p.list[j] = b, a
			j--
		}
	}
}
