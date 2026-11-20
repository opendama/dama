package rest

import (
	"context"
	"log"
	"time"

	"dama/apps/api/internal/notifications"
)

// RunCampaignAutoCloseWorker periodically archives campaigns past ends_at.
func RunCampaignAutoCloseWorker(ctx context.Context, a *AdsAPI) {
	if a == nil || a.Ads == nil {
		return
	}
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()
	run := func() {
		archived := a.archivedStatus()
		if archived == "" {
			return
		}
		closed, err := a.Ads.AutoCloseExpired(ctx, archived)
		if err != nil {
			log.Printf("ads auto-close: %v", err)
			return
		}
		if len(closed) == 0 || a.DB == nil || !a.DB.Ready() {
			return
		}
		roles := []string{}
		if a.Settings != nil {
			enums := a.Settings.ClientEnums()
			if enums.Source == "database" {
				roles = enums.ConsoleRoles
			}
		}
		for i := range closed {
			c := closed[i]
			if a.Geo != nil {
				a.Geo.RemoveCampaign(ctx, &c)
			}
			if c.PublisherID != "" {
				notifications.EmitPlayer(ctx, a.DB.Pool, c.PublisherID, notifications.KindPlayerCampaignAutoClosed,
					"campaign_auto_closed:"+c.ID, c.ID, c.Title)
			}
			if len(roles) > 0 {
				notifications.EmitAdmins(ctx, a.DB.Pool, roles, notifications.KindAdminCampaignAutoClosed,
					"admin_campaign_auto_closed:"+c.ID, c.ID, c.Title)
			}
		}
	}
	run()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			run()
		}
	}
}
