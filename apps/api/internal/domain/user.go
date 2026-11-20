package domain

import "time"

type User struct {
	ID                    string     `json:"id"`
	Email                 *string    `json:"-"` // only via Self()
	Username              string     `json:"username"`
	Role                  string     `json:"-"` // only via Self()
	Rating                int        `json:"rating"`
	XP                    int        `json:"xp"`
	Wins                  int        `json:"wins"`
	Losses                int        `json:"losses"`
	Draws                 int        `json:"draws"`
	AvatarThumbURL        *string    `json:"avatar_thumb_url,omitempty"`
	AvatarFullURL         *string    `json:"avatar_full_url,omitempty"`
	AvatarPublicID        *string    `json:"-"` // CDN object key - never serialize to clients
	CountryCode           *string    `json:"country_code,omitempty"`
	Region                *string    `json:"region,omitempty"`
	PrimaryPhone          *string    `json:"-"` // mirrored from payout method; Self only
	DateOfBirth           *time.Time `json:"-"`
	AgeVerifiedAt         *time.Time `json:"-"`
	PhoneKycVerifiedAt    *time.Time `json:"-"`
	DocumentKycVerifiedAt *time.Time `json:"-"`
	IsActive              bool       `json:"-"` // only via Self()
	CreatedAt             time.Time  `json:"-"`
	UpdatedAt             time.Time  `json:"-"`
}

// Self is the authenticated user's own record (email + role allowed).
func (u User) Self() map[string]any {
	out := map[string]any{
		"id":                    u.ID,
		"email":                 u.Email,
		"username":              u.Username,
		"role":                  u.Role,
		"rating":                u.Rating,
		"xp":                    u.XP,
		"wins":                  u.Wins,
		"losses":                u.Losses,
		"draws":                 u.Draws,
		"avatar_thumb_url":      u.AvatarThumbURL,
		"avatar_full_url":       u.AvatarFullURL,
		"country_code":          u.CountryCode,
		"region":                u.Region,
		"primary_phone":         u.PrimaryPhone,
		"age_verified":          u.AgeVerifiedAt != nil,
		"phone_kyc_verified":    u.PhoneKycVerifiedAt != nil,
		"document_kyc_verified": u.DocumentKycVerifiedAt != nil,
		"is_active":             u.IsActive,
		"created_at":            u.CreatedAt,
	}
	if u.DateOfBirth != nil {
		out["date_of_birth"] = u.DateOfBirth.Format("2006-01-02")
	}
	if u.AgeVerifiedAt != nil {
		out["age_verified_at"] = u.AgeVerifiedAt
	}
	if u.PhoneKycVerifiedAt != nil {
		out["phone_kyc_verified_at"] = u.PhoneKycVerifiedAt
	}
	if u.DocumentKycVerifiedAt != nil {
		out["document_kyc_verified_at"] = u.DocumentKycVerifiedAt
	}
	return out
}

// Public is a card safe for other clients: no email, role, or account flags.
func (u User) Public() map[string]any {
	out := map[string]any{
		"id":                    u.ID,
		"username":              u.Username,
		"rating":                u.Rating,
		"xp":                    u.XP,
		"wins":                  u.Wins,
		"losses":                u.Losses,
		"draws":                 u.Draws,
		"avatar_thumb_url":      u.AvatarThumbURL,
		"avatar_full_url":       u.AvatarFullURL,
		"country_code":          u.CountryCode,
		"region":                u.Region,
		"phone_kyc_verified":    u.PhoneKycVerifiedAt != nil,
		"document_kyc_verified": u.DocumentKycVerifiedAt != nil,
	}
	if !u.CreatedAt.IsZero() {
		out["created_at"] = u.CreatedAt.UTC().Format(time.RFC3339)
	}
	return out
}
