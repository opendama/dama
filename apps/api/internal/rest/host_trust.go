package rest

import "dama/apps/api/internal/store"

// stampHostTrustFields adds DB-driven host trust tier/badge onto a user Self() map.
func stampHostTrustFields(cash *store.CashRmgStore, phoneVerified, documentVerified bool, out map[string]any) {
	if out == nil || cash == nil || !cash.Ready() {
		return
	}
	if tier, badge := cash.HostTrust(phoneVerified, documentVerified); tier != "" && badge != "" {
		out["host_trust_tier"] = tier
		out["host_trust_badge"] = badge
	}
}
