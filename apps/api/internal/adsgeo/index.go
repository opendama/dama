package adsgeo

import (
	"context"
	"encoding/json"
	"strings"
	"sync"

	"dama/apps/api/internal/redisx"
	"dama/apps/api/internal/store"
)

// Index matches active campaigns to a player's country/region/district.
// Pin lat/lng remain on geo_targets for create pricing only - not used for serve match.
type Index struct {
	Redis    *redisx.Client
	Ads      *store.AdStore
	Settings *store.SettingsStore
	mu       sync.RWMutex
	byKey    map[string][]string // geo key -> campaign IDs
}

func New(redisClient *redisx.Client, ads *store.AdStore, settings *store.SettingsStore) *Index {
	return &Index{Redis: redisClient, Ads: ads, Settings: settings, byKey: map[string][]string{}}
}

func (i *Index) servableStatus() string {
	if i.Settings == nil {
		return ""
	}
	enums := i.Settings.ClientEnums()
	if enums.Source != "database" {
		return ""
	}
	return enums.ServableCampaignStatus
}

func geoKey(country, region, district string) string {
	cc := strings.ToUpper(strings.TrimSpace(country))
	rg := strings.ToLower(strings.TrimSpace(region))
	dist := strings.ToLower(strings.TrimSpace(district))
	if cc == "" {
		cc = "GLOBAL"
	}
	if rg == "" {
		return "dama:adgeo:" + cc
	}
	if dist == "" {
		return "dama:adgeo:" + cc + ":" + rg
	}
	return "dama:adgeo:" + cc + ":" + rg + ":" + dist
}

// RemoveCampaign drops a campaign from its geo SET keys.
func (i *Index) RemoveCampaign(ctx context.Context, c *store.AdCampaign) {
	if c == nil || c.ID == "" {
		return
	}
	keys := []string{geoKey("", "", "")}
	var targets []any
	_ = json.Unmarshal(c.GeoTargets, &targets)
	for _, t := range targets {
		switch v := t.(type) {
		case string:
			if strings.TrimSpace(v) != "" {
				keys = append(keys, geoKey(v, "", ""))
			}
		case map[string]any:
			cc, _ := v["country"].(string)
			rg, _ := v["region"].(string)
			dist, _ := v["district"].(string)
			keys = append(keys, geoKey(cc, rg, dist))
			if dist != "" {
				keys = append(keys, geoKey(cc, rg, ""))
			}
			if rg != "" {
				keys = append(keys, geoKey(cc, "", ""))
			}
		}
	}
	seen := map[string]struct{}{}
	for _, k := range keys {
		if _, ok := seen[k]; ok {
			continue
		}
		seen[k] = struct{}{}
		if i.Redis != nil && i.Redis.Ready() {
			_ = i.Redis.RDB.SRem(ctx, k, c.ID).Err()
		} else {
			i.mu.Lock()
			i.byKey[k] = removeID(i.byKey[k], c.ID)
			i.mu.Unlock()
		}
	}
}

func (i *Index) IndexCampaign(ctx context.Context, c *store.AdCampaign) {
	// Caller must pass only servable campaigns (platform_settings.client_enums.servable_campaign_status).
	if c == nil {
		return
	}
	var targets []any
	_ = json.Unmarshal(c.GeoTargets, &targets)
	keys := []string{}
	for _, t := range targets {
		switch v := t.(type) {
		case string:
			if strings.TrimSpace(v) != "" {
				keys = append(keys, geoKey(v, "", ""))
			}
		case map[string]any:
			cc, _ := v["country"].(string)
			rg, _ := v["region"].(string)
			dist, _ := v["district"].(string)
			if dist == "" {
				dist, _ = v["city_district"].(string)
			}
			if strings.TrimSpace(cc) != "" || strings.TrimSpace(rg) != "" || strings.TrimSpace(dist) != "" {
				keys = append(keys, geoKey(cc, rg, dist))
			}
		}
	}
	if len(keys) == 0 {
		keys = []string{geoKey("", "", "")}
	}
	globalKey := geoKey("", "", "")
	scopedOnly := true
	for _, k := range keys {
		if k == globalKey {
			scopedOnly = false
		}
	}
	for _, k := range keys {
		if i.Redis != nil && i.Redis.Ready() {
			_ = i.Redis.RDB.SAdd(ctx, k, c.ID).Err()
			continue
		}
		i.mu.Lock()
		i.byKey[k] = appendUnique(i.byKey[k], c.ID)
		i.mu.Unlock()
	}
	if scopedOnly {
		if i.Redis != nil && i.Redis.Ready() {
			_ = i.Redis.RDB.SRem(ctx, globalKey, c.ID).Err()
		} else {
			i.mu.Lock()
			i.byKey[globalKey] = removeID(i.byKey[globalKey], c.ID)
			i.mu.Unlock()
		}
	}
}

func removeID(list []string, id string) []string {
	out := make([]string, 0, len(list))
	for _, x := range list {
		if x != id {
			out = append(out, x)
		}
	}
	return out
}

func appendUnique(list []string, id string) []string {
	for _, x := range list {
		if x == id {
			return list
		}
	}
	return append(list, id)
}

func (i *Index) Match(ctx context.Context, country, region, district string) []store.AdCampaign {
	return i.MatchCoords(ctx, country, region, district, nil, nil)
}

// MatchCoords matches by country/region/district SETs only.
// lat/lng are retained for call-site compatibility and are not used for serve match.
func (i *Index) MatchCoords(ctx context.Context, country, region, district string, lat, lng *float64) []store.AdCampaign {
	_ = lat
	_ = lng
	keys := []string{
		geoKey(country, region, district),
		geoKey(country, region, ""),
		geoKey(country, "", ""),
		geoKey("", "", ""),
	}
	seen := map[string]struct{}{}
	ids := []string{}
	for _, k := range keys {
		if i.Redis != nil && i.Redis.Ready() {
			members, err := i.Redis.RDB.SMembers(ctx, k).Result()
			if err == nil {
				for _, id := range members {
					if _, ok := seen[id]; !ok {
						seen[id] = struct{}{}
						ids = append(ids, id)
					}
				}
			}
			continue
		}
		i.mu.RLock()
		for _, id := range i.byKey[k] {
			if _, ok := seen[id]; !ok {
				seen[id] = struct{}{}
				ids = append(ids, id)
			}
		}
		i.mu.RUnlock()
	}

	out := []store.AdCampaign{}
	if i.Ads == nil {
		return out
	}
	status := i.servableStatus()
	if status == "" {
		return out
	}
	all, err := i.Ads.ListActive(ctx, status)
	if err != nil {
		return out
	}
	want := map[string]struct{}{}
	for _, id := range ids {
		want[id] = struct{}{}
	}
	if len(want) == 0 {
		if strings.TrimSpace(country) != "" || strings.TrimSpace(region) != "" || strings.TrimSpace(district) != "" {
			return out
		}
		return all
	}
	for _, c := range all {
		if _, ok := want[c.ID]; ok {
			out = append(out, c)
		}
	}
	return out
}
