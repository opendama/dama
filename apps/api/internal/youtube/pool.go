package youtube

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"dama/apps/api/internal/crypto"
	"dama/apps/api/internal/db"

	"github.com/google/uuid"
)

type Channel struct {
	ID              string     `json:"id"`
	ChannelID       string     `json:"channel_id"`
	Label           string     `json:"label"`
	ClientID        string     `json:"-"`
	ClientSecret    string     `json:"-"`
	RefreshToken    string     `json:"-"`
	APIKey          string     `json:"-"`
	DailyQuotaLimit int        `json:"daily_quota_limit"`
	UploadsToday    int        `json:"uploads_today"`
	SortOrder       int        `json:"sort_order"`
	IsActive        bool       `json:"is_active"`
	LastError       string     `json:"last_error,omitempty"`
	LastUsedAt      *time.Time `json:"last_used_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
}

type UploadResult struct {
	VideoID   string `json:"video_id"`
	ChannelID string `json:"channel_id"`
	Label     string `json:"label"`
	Stub      bool   `json:"-"` // local smoke marker - never client-facing
}

type Pool struct {
	db        *db.Handle
	vault     *crypto.Vault
	mu        sync.RWMutex
	list      []*Channel
	allowStub bool
}

func NewPool(handle *db.Handle, vault *crypto.Vault, allowStub bool) *Pool {
	return &Pool{db: handle, vault: vault, list: []*Channel{}, allowStub: allowStub}
}

type RegisterInput struct {
	ChannelID       string
	Label           string
	ClientID        string
	ClientSecret    string
	RefreshToken    string
	APIKey          string
	DailyQuotaLimit int
}

func (p *Pool) Register(ctx context.Context, in RegisterInput) (*Channel, error) {
	if in.ChannelID == "" || in.Label == "" {
		return nil, fmt.Errorf("channel_id and label required")
	}
	if in.DailyQuotaLimit <= 0 {
		return nil, fmt.Errorf("daily_quota_limit required from admin config")
	}
	var cidEnc, secEnc, refEnc, keyEnc []byte
	if p.db != nil && p.db.Ready() {
		var err error
		cidEnc, err = p.encrypt(in.ClientID)
		if err != nil {
			return nil, fmt.Errorf("unable to encrypt channel credentials")
		}
		secEnc, err = p.encrypt(in.ClientSecret)
		if err != nil {
			return nil, fmt.Errorf("unable to encrypt channel credentials")
		}
		refEnc, err = p.encrypt(in.RefreshToken)
		if err != nil {
			return nil, fmt.Errorf("unable to encrypt channel credentials")
		}
		keyEnc, err = p.encrypt(in.APIKey)
		if err != nil {
			return nil, fmt.Errorf("unable to encrypt channel credentials")
		}
	}
	ch := &Channel{
		ID:              uuid.NewString(),
		ChannelID:       in.ChannelID,
		Label:           in.Label,
		ClientID:        in.ClientID,
		ClientSecret:    in.ClientSecret,
		RefreshToken:    in.RefreshToken,
		APIKey:          in.APIKey,
		DailyQuotaLimit: in.DailyQuotaLimit,
		IsActive:        true,
		CreatedAt:       time.Now().UTC(),
	}
	if p.db != nil && p.db.Ready() {
		p.mu.Lock()
		sortOrder := len(p.list) + 1
		ch.SortOrder = sortOrder
		p.mu.Unlock()
		if _, err := p.db.Pool.Exec(ctx, `
			INSERT INTO youtube_channels (
				id, channel_id, label, client_id_enc, client_secret_enc, refresh_token_enc, api_key_enc,
				daily_quota_limit, uploads_today, is_active, sort_order, created_at, updated_at
			) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,TRUE,$9,NOW(),NOW())
		`, ch.ID, ch.ChannelID, ch.Label, cidEnc, secEnc, refEnc, keyEnc, in.DailyQuotaLimit, sortOrder); err != nil {
			return nil, fmt.Errorf("unable to persist channel")
		}
	}
	p.mu.Lock()
	p.list = append(p.list, ch)
	p.sortLocked()
	p.mu.Unlock()
	cp := *ch
	cp.ClientID = ""
	cp.ClientSecret = ""
	cp.RefreshToken = ""
	cp.APIKey = ""
	return &cp, nil
}

func (p *Pool) List() []Channel {
	list, _ := p.ListPaged(0, 0, "", "")
	return list
}

// ChannelListFilter optional in-memory pool filters (empty = no constraint).
type ChannelListFilter struct {
	Q      string
	Status string // active | inactive
}

// ListPaged returns a skip/limit slice and total count (secrets stripped). limit<=0 returns all.
// Optional q matches label/channel_id/id; status filters active/inactive.
func (p *Pool) ListPaged(skip, limit int, q, status string) ([]Channel, int) {
	p.mu.RLock()
	defer p.mu.RUnlock()
	needle := strings.ToLower(strings.TrimSpace(q))
	st := strings.TrimSpace(strings.ToLower(status))
	filtered := make([]*Channel, 0, len(p.list))
	for _, ch := range p.list {
		if st == "active" && !ch.IsActive {
			continue
		}
		if st == "inactive" && ch.IsActive {
			continue
		}
		if needle != "" {
			hay := strings.ToLower(strings.Join([]string{ch.Label, ch.ChannelID, ch.ID}, " "))
			if !strings.Contains(hay, needle) {
				continue
			}
		}
		filtered = append(filtered, ch)
	}
	total := len(filtered)
	if skip < 0 {
		skip = 0
	}
	if skip > total {
		skip = total
	}
	end := total
	if limit > 0 {
		end = skip + limit
		if end > total {
			end = total
		}
	}
	out := make([]Channel, 0, end-skip)
	for i := skip; i < end; i++ {
		cp := *filtered[i]
		cp.ClientID = ""
		cp.ClientSecret = ""
		cp.RefreshToken = ""
		cp.APIKey = ""
		out = append(out, cp)
	}
	return out, total
}

func (p *Pool) SetActive(ctx context.Context, id string, active bool) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	for _, ch := range p.list {
		if ch.ID == id {
			ch.IsActive = active
			if p.db != nil && p.db.Ready() {
				_, _ = p.db.Pool.Exec(ctx, `UPDATE youtube_channels SET is_active=$2 WHERE id=$1`, id, active)
			}
			return nil
		}
	}
	return fmt.Errorf("channel not found")
}

func (p *Pool) persistLastError(ctx context.Context, ch *Channel, msg string) {
	ch.LastError = msg
	if p.db != nil && p.db.Ready() {
		_, _ = p.db.Pool.Exec(ctx, `UPDATE youtube_channels SET last_error=$2 WHERE id=$1`, ch.ID, msg)
	}
}

func (p *Pool) resetDailyQuotas(ctx context.Context) {
	today := time.Now().UTC().Format("2006-01-02")
	if p.db != nil && p.db.Ready() {
		_, _ = p.db.Pool.Exec(ctx, `
			UPDATE youtube_channels
			SET uploads_today = 0
			WHERE uploads_today > 0
			  AND COALESCE((last_used_at AT TIME ZONE 'UTC')::date, DATE '1970-01-01')
			      < (NOW() AT TIME ZONE 'UTC')::date
		`)
	}
	for _, ch := range p.list {
		if ch.LastUsedAt == nil {
			continue
		}
		if ch.LastUsedAt.UTC().Format("2006-01-02") != today {
			ch.UploadsToday = 0
		}
	}
}

// UploadVideo tries each healthy channel until one succeeds (quota failover).
func (p *Pool) UploadVideo(ctx context.Context, title, description, localPath string) (*UploadResult, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	p.resetDailyQuotas(ctx)

	var lastErr error
	for _, ch := range p.list {
		if !ch.IsActive {
			continue
		}
		if ch.UploadsToday >= ch.DailyQuotaLimit {
			p.persistLastError(ctx, ch, "daily quota exceeded")
			lastErr = fmt.Errorf("channel %s quota exceeded", ch.Label)
			continue
		}
		ready, err := p.preflight(ch)
		if err != nil || !ready {
			if err != nil {
				p.persistLastError(ctx, ch, "channel unavailable")
				lastErr = err
			} else {
				p.persistLastError(ctx, ch, "not ready")
				lastErr = fmt.Errorf("channel %s not ready", ch.Label)
			}
			continue
		}

		videoID, stub, err := p.doUpload(ch, title, description, localPath)
		if err != nil {
			p.persistLastError(ctx, ch, "upload failed")
			lastErr = err
			continue
		}
		now := time.Now().UTC()
		ch.UploadsToday++
		ch.LastUsedAt = &now
		ch.LastError = ""
		if p.db != nil && p.db.Ready() {
			_, _ = p.db.Pool.Exec(ctx, `
				UPDATE youtube_channels
				SET uploads_today=$2, last_used_at=NOW(), last_error=NULL
				WHERE id=$1
			`, ch.ID, ch.UploadsToday)
		}
		return &UploadResult{
			VideoID:   videoID,
			ChannelID: ch.ChannelID,
			Label:     ch.Label,
			Stub:      stub,
		}, nil
	}

	if lastErr == nil {
		lastErr = fmt.Errorf("media channel unavailable")
	}
	return nil, lastErr
}

func (p *Pool) preflight(ch *Channel) (bool, error) {
	if ch.RefreshToken == "" && ch.APIKey == "" && ch.ClientID == "" {
		if p.allowStub {
			return true, nil
		}
		return false, fmt.Errorf("media channel unavailable")
	}
	return p.preflightAPI(ch)
}

// TestChannel runs upload-readiness preflight for one vault channel (admin Test button).
func (p *Pool) TestChannel(ctx context.Context, id string) (map[string]any, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	for _, ch := range p.list {
		if ch.ID != id {
			continue
		}
		ready, err := p.preflight(ch)
		out := map[string]any{
			"id":         ch.ID,
			"label":      ch.Label,
			"channel_id": ch.ChannelID,
			"is_active":  ch.IsActive,
			"ready":      ready && err == nil,
		}
		if err != nil {
			out["error"] = "channel unavailable"
			ch.LastError = "channel unavailable"
			if p.db != nil && p.db.Ready() {
				_, _ = p.db.Pool.Exec(ctx, `UPDATE youtube_channels SET last_error=$2 WHERE id=$1`, ch.ID, "channel unavailable")
			}
			return out, nil
		}
		if !ready {
			out["error"] = "not ready"
			ch.LastError = "not ready"
			if p.db != nil && p.db.Ready() {
				_, _ = p.db.Pool.Exec(ctx, `UPDATE youtube_channels SET last_error=$2 WHERE id=$1`, ch.ID, "not ready")
			}
			return out, nil
		}
		ch.LastError = ""
		if p.db != nil && p.db.Ready() {
			_, _ = p.db.Pool.Exec(ctx, `UPDATE youtube_channels SET last_error=NULL WHERE id=$1`, ch.ID)
		}
		return out, nil
	}
	return nil, fmt.Errorf("channel not found")
}

func (p *Pool) doUpload(ch *Channel, title, description, localPath string) (string, bool, error) {
	if ch.RefreshToken == "" {
		if p.allowStub {
			// Opaque local-smoke id - never advertise stub/vendor prefixes on the wire.
			return uuid.NewString(), true, nil
		}
		return "", false, fmt.Errorf("media channel unavailable")
	}
	access, err := p.exchangeRefreshToken(ch)
	if err != nil {
		return "", false, err
	}
	videoID, err := p.uploadWithAccessToken(access, title, description, localPath)
	if err != nil {
		return "", false, err
	}
	return videoID, false, nil
}

func (p *Pool) encrypt(plain string) ([]byte, error) {
	if p.vault == nil {
		return []byte(plain), nil
	}
	return p.vault.Encrypt(plain)
}

func (p *Pool) decrypt(blob []byte) (string, error) {
	if len(blob) == 0 {
		return "", nil
	}
	if p.vault == nil {
		return string(blob), nil
	}
	return p.vault.Decrypt(blob)
}

// ReloadFromDB hydrates the in-memory channel pool from Postgres (fail closed if DB down).
func (p *Pool) ReloadFromDB(ctx context.Context) error {
	if p.db == nil || !p.db.Ready() {
		return fmt.Errorf("database unavailable")
	}
	rows, err := p.db.Pool.Query(ctx, `
		SELECT id, channel_id, label,
			COALESCE(client_id_enc, ''::bytea), COALESCE(client_secret_enc, ''::bytea),
			COALESCE(refresh_token_enc, ''::bytea), COALESCE(api_key_enc, ''::bytea),
			daily_quota_limit, uploads_today, COALESCE(sort_order, 0), is_active,
			COALESCE(last_error,''), last_used_at, created_at
		FROM youtube_channels
		ORDER BY sort_order ASC, created_at ASC
	`)
	if err != nil {
		return err
	}
	defer rows.Close()
	list := make([]*Channel, 0)
	today := time.Now().UTC().Format("2006-01-02")
	for rows.Next() {
		ch := &Channel{}
		var cidEnc, secEnc, refEnc, keyEnc []byte
		var lastUsed *time.Time
		if err := rows.Scan(
			&ch.ID, &ch.ChannelID, &ch.Label,
			&cidEnc, &secEnc, &refEnc, &keyEnc,
			&ch.DailyQuotaLimit, &ch.UploadsToday, &ch.SortOrder, &ch.IsActive, &ch.LastError, &lastUsed, &ch.CreatedAt,
		); err != nil {
			return err
		}
		ch.LastUsedAt = lastUsed
		if lastUsed != nil && lastUsed.UTC().Format("2006-01-02") != today {
			ch.UploadsToday = 0
		}
		ch.ClientID, _ = p.decrypt(cidEnc)
		ch.ClientSecret, _ = p.decrypt(secEnc)
		ch.RefreshToken, _ = p.decrypt(refEnc)
		ch.APIKey, _ = p.decrypt(keyEnc)
		list = append(list, ch)
	}
	p.mu.Lock()
	p.list = list
	p.mu.Unlock()
	return nil
}

func sanitize(s string) string {
	out := make([]rune, 0, len(s))
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			out = append(out, r)
		}
		if len(out) > 24 {
			break
		}
	}
	if len(out) == 0 {
		return "dama"
	}
	return string(out)
}
