package graphql

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/db"
	"dama/apps/api/internal/domain"
	"dama/apps/api/internal/geo"
	"dama/apps/api/internal/notifications"
	"dama/apps/api/internal/payments"
	"dama/apps/api/internal/presence"
	"dama/apps/api/internal/store"
	"dama/apps/api/internal/ws"

	gql "github.com/graphql-go/graphql"
)

type Deps struct {
	Users       *store.UserStore
	Flags       *store.FlagStore
	Tokens      *auth.TokenService
	Tournaments *store.TournamentStore
	Entries     *store.EntryStore
	Payments    *payments.Service
	Presence    *presence.Service
	Ads         *store.AdStore
	Matches     *store.MatchHistoryStore
	Settings    *store.SettingsStore
	Cash        *store.CashRmgStore
	Events      *store.HostedEventStore
	RBAC        *store.RBACStore
	Hub         *ws.Hub
	DB          *db.Handle
	Locate      *geo.Resolver
}

type gqlRequestKey struct{}

func requestFromContext(ctx context.Context) *http.Request {
	r, _ := ctx.Value(gqlRequestKey{}).(*http.Request)
	return r
}

// displayCurrencyForRequest resolves ETB/USD from request IP/GPS (DB currency matrix).
func displayCurrencyForRequest(ctx context.Context, deps Deps) string {
	if deps.Settings == nil || deps.Locate == nil {
		return ""
	}
	r := requestFromContext(ctx)
	if r == nil {
		return ""
	}
	pd := geo.PrivateDefault{
		CountryCode: deps.Settings.EthiopiaCountry(),
		City:        deps.Settings.PrivateDefaultCity(),
		Region:      deps.Settings.PrivateDefaultRegion(),
	}
	res, err := deps.Locate.Resolve(ctx, "", false, 0, 0, geo.ClientIP(r), pd)
	if err != nil || res == nil {
		return ""
	}
	return strings.ToUpper(strings.TrimSpace(deps.Settings.CurrencyForCountry(res.CountryCode)))
}

func emitTournamentLifecycle(ctx context.Context, deps Deps, t *store.Tournament, previousStatus string) {
	if deps.DB == nil || !deps.DB.Ready() || t == nil || deps.Settings == nil {
		return
	}
	enums := deps.Settings.ClientEnums()
	if enums.Source != "database" {
		return
	}
	var entrants []string
	if deps.Entries != nil {
		if ids, err := deps.Entries.ListUserIDsByTournament(ctx, t.ID, false); err == nil {
			entrants = ids
		}
	}
	notifications.NotifyTournamentLifecycle(
		ctx,
		deps.DB.Pool,
		enums.DefaultRole,
		enums.EnrollableTournamentStatus,
		t.ID,
		t.Title,
		t.Status,
		previousStatus,
		entrants,
	)
}

func gqlAuthUnauthorized(deps Deps) error {
	if deps.Settings != nil {
		if msg := strings.TrimSpace(deps.Settings.AuthUnauthorized()); msg != "" {
			return simpleErr(msg)
		}
	}
	return simpleErr("")
}

func gqlAuthForbidden(deps Deps) error {
	if deps.Settings != nil {
		if msg := strings.TrimSpace(deps.Settings.AuthForbidden()); msg != "" {
			return simpleErr(msg)
		}
	}
	return simpleErr("")
}

func gqlAdsChromeErr(deps Deps, key string) error {
	if deps.Settings != nil {
		if msg := strings.TrimSpace(deps.Settings.AdRuntimeChromeString(key)); msg != "" {
			return simpleErr(msg)
		}
	}
	return simpleErr("")
}

// gqlTournamentChromeErr returns tournament_chrome copy for GraphQL mutations (fail closed empty).
func gqlTournamentChromeErr(ctx context.Context, deps Deps, key string) error {
	key = strings.TrimSpace(key)
	if key == "" || deps.Settings == nil {
		return simpleErr("")
	}
	raw, err := deps.Settings.TournamentChromeJSON(ctx)
	if err != nil || len(raw) == 0 {
		return simpleErr("")
	}
	var doc map[string]any
	if json.Unmarshal(raw, &doc) != nil {
		return simpleErr("")
	}
	msg, _ := doc[key].(string)
	msg = strings.TrimSpace(msg)
	if msg == "" {
		return simpleErr("")
	}
	return simpleErr(msg)
}

func requireConsolePerm(ctx context.Context, deps Deps, claims *auth.Claims, permission string) error {
	if claims == nil || deps.Settings == nil || !deps.Settings.IsConsoleRole(claims.Role) {
		return gqlAuthForbidden(deps)
	}
	if deps.RBAC == nil || permission == "" {
		return gqlAuthForbidden(deps)
	}
	ok, err := deps.RBAC.RoleHasPermission(ctx, claims.Role, permission)
	if err != nil || !ok {
		return gqlAuthForbidden(deps)
	}
	return nil
}

type requestBody struct {
	Query         string         `json:"query"`
	OperationName string         `json:"operationName"`
	Variables     map[string]any `json:"variables"`
}

func Handler(deps Deps) http.Handler {
	schema, err := buildSchema(deps)
	if err != nil {
		panic(err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			// Opt-in only. Default is no HTML surface that documents the API.
			if os.Getenv("DAMA_GRAPHQL_PLAYGROUND") != "1" {
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
				return
			}
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_, _ = w.Write([]byte(playgroundHTML))
			return
		}
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var body requestBody
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"errors": []map[string]string{{"message": "invalid JSON body"}},
			})
			return
		}
		qLower := strings.ToLower(body.Query)
		if strings.Contains(qLower, "__schema") || strings.Contains(qLower, "__type") {
			claims := auth.ClaimsFromContext(r.Context())
			if claims == nil || deps.Settings == nil || !deps.Settings.IsConsoleRole(claims.Role) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusForbidden)
				_ = json.NewEncoder(w).Encode(map[string]any{
					"errors": []map[string]string{{"message": "introspection disabled"}},
				})
				return
			}
		}
		result := gql.Do(gql.Params{
			Schema:         schema,
			RequestString:  body.Query,
			VariableValues: body.Variables,
			OperationName:  body.OperationName,
			Context:        context.WithValue(r.Context(), gqlRequestKey{}, r),
		})
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(result)
	})
	return mux
}

func buildSchema(deps Deps) (gql.Schema, error) {
	matchSummaryType := gql.NewObject(gql.ObjectConfig{
		Name: "MatchSummary",
		Fields: gql.Fields{
			"id":         &gql.Field{Type: gql.NewNonNull(gql.ID)},
			"mode":       &gql.Field{Type: gql.NewNonNull(gql.String)},
			"isDraw":     &gql.Field{Type: gql.NewNonNull(gql.Boolean)},
			"moveCount":  &gql.Field{Type: gql.NewNonNull(gql.Int)},
			"isFree":     &gql.Field{Type: gql.NewNonNull(gql.Boolean)},
			"finishedAt": &gql.Field{Type: gql.NewNonNull(gql.String)},
		},
	})

	playerType := gql.NewObject(gql.ObjectConfig{
		Name: "Player",
		Fields: gql.Fields{
			"id":                    &gql.Field{Type: gql.NewNonNull(gql.ID)},
			"username":              &gql.Field{Type: gql.NewNonNull(gql.String)},
			"role":                  &gql.Field{Type: gql.NewNonNull(gql.String)},
			"rating":                &gql.Field{Type: gql.NewNonNull(gql.Int)},
			"xp":                    &gql.Field{Type: gql.NewNonNull(gql.Int)},
			"wins":                  &gql.Field{Type: gql.NewNonNull(gql.Int)},
			"losses":                &gql.Field{Type: gql.NewNonNull(gql.Int)},
			"draws":                 &gql.Field{Type: gql.NewNonNull(gql.Int)},
			"avatarThumbUrl":        &gql.Field{Type: gql.String},
			"avatarFullUrl":         &gql.Field{Type: gql.String},
			"region":                &gql.Field{Type: gql.String},
			"countryCode":           &gql.Field{Type: gql.String},
			"online":                &gql.Field{Type: gql.NewNonNull(gql.Boolean)},
			"regionalRank":          &gql.Field{Type: gql.Int},
			"regionLabel":           &gql.Field{Type: gql.String},
			"levelLabel":            &gql.Field{Type: gql.String},
			"hostTrustTier":         &gql.Field{Type: gql.String},
			"hostTrustBadge":        &gql.Field{Type: gql.String},
			"hostFinishedPaidCups":  &gql.Field{Type: gql.Int},
			"hostCancelledPaidCups": &gql.Field{Type: gql.Int},
			"hostOpenReports":       &gql.Field{Type: gql.Int},
			"recentMatches": &gql.Field{
				Type: gql.NewNonNull(gql.NewList(gql.NewNonNull(matchSummaryType))),
				Resolve: func(p gql.ResolveParams) (any, error) {
					src, _ := p.Source.(map[string]any)
					id, _ := src["id"].(string)
					if id == "" {
						return []map[string]any{}, nil
					}
					if deps.Matches == nil {
						return nil, simpleErr("match history store unavailable")
					}
					list, err := deps.Matches.ListForUser(p.Context, id, 10)
					if err != nil {
						return nil, simpleErr("unable to load match history")
					}
					out := make([]map[string]any, 0, len(list))
					for i := range list {
						m := &list[i]
						out = append(out, map[string]any{
							"id":         m.ID,
							"mode":       m.Mode,
							"isDraw":     m.IsDraw,
							"moveCount":  m.MoveCount,
							"isFree":     m.IsFree,
							"finishedAt": m.FinishedAt.UTC().Format(time.RFC3339),
						})
					}
					return out, nil
				},
			},
		},
	})

	// Public flags only. Payment-mode lives on ConsoleFeatureFlags (console-auth).
	featureFlagsType := gql.NewObject(gql.ObjectConfig{
		Name: "FeatureFlags",
		Fields: gql.Fields{
			"vsAiEnabled":               &gql.Field{Type: gql.NewNonNull(gql.Boolean)},
			"otpRequired":               &gql.Field{Type: gql.NewNonNull(gql.Boolean)},
			"cashRmgEnabled":            &gql.Field{Type: gql.NewNonNull(gql.Boolean)},
			"cashPhoneKycRequired":      &gql.Field{Type: gql.NewNonNull(gql.Boolean)},
			"cashPhoneOtpRequired":      &gql.Field{Type: gql.NewNonNull(gql.Boolean)},
			"cashRmgDisabledCountries":  &gql.Field{Type: gql.NewNonNull(gql.NewList(gql.NewNonNull(gql.String)))},
			"hostedEventsEnabled":       &gql.Field{Type: gql.NewNonNull(gql.Boolean)},
			"publicEventsEnabled":       &gql.Field{Type: gql.NewNonNull(gql.Boolean)},
			"publicEventMatchesRated":   &gql.Field{Type: gql.NewNonNull(gql.Boolean)},
			"prizePoolDisplayEnabled":   &gql.Field{Type: gql.NewNonNull(gql.Boolean)},
			"prizePoolGuaranteeEnabled": &gql.Field{Type: gql.NewNonNull(gql.Boolean)},
			"kycAutoApprove":            &gql.Field{Type: gql.NewNonNull(gql.Boolean)},
			"aiDepths":                  &gql.Field{Type: gql.NewNonNull(gql.NewList(gql.NewNonNull(gql.Int)))},
		},
	})
	consoleFeatureFlagsType := gql.NewObject(gql.ObjectConfig{
		Name: "ConsoleFeatureFlags",
		Fields: gql.Fields{
			"vsAiEnabled":               &gql.Field{Type: gql.NewNonNull(gql.Boolean)},
			"otpRequired":               &gql.Field{Type: gql.NewNonNull(gql.Boolean)},
			"cashRmgEnabled":            &gql.Field{Type: gql.NewNonNull(gql.Boolean)},
			"cashPhoneKycRequired":      &gql.Field{Type: gql.NewNonNull(gql.Boolean)},
			"cashPhoneOtpRequired":      &gql.Field{Type: gql.NewNonNull(gql.Boolean)},
			"cashRmgDisabledCountries":  &gql.Field{Type: gql.NewNonNull(gql.NewList(gql.NewNonNull(gql.String)))},
			"hostedEventsEnabled":       &gql.Field{Type: gql.NewNonNull(gql.Boolean)},
			"publicEventsEnabled":       &gql.Field{Type: gql.NewNonNull(gql.Boolean)},
			"publicEventMatchesRated":   &gql.Field{Type: gql.NewNonNull(gql.Boolean)},
			"prizePoolDisplayEnabled":   &gql.Field{Type: gql.NewNonNull(gql.Boolean)},
			"prizePoolGuaranteeEnabled": &gql.Field{Type: gql.NewNonNull(gql.Boolean)},
			"kycAutoApprove":            &gql.Field{Type: gql.NewNonNull(gql.Boolean)},
			"ethiopiaPaymentMode":       &gql.Field{Type: gql.NewNonNull(gql.String)},
			"aiDepths":                  &gql.Field{Type: gql.NewNonNull(gql.NewList(gql.NewNonNull(gql.Int)))},
		},
	})

	tournamentType := gql.NewObject(gql.ObjectConfig{
		Name: "Tournament",
		Fields: gql.Fields{
			"id":                       &gql.Field{Type: gql.NewNonNull(gql.ID)},
			"title":                    &gql.Field{Type: gql.NewNonNull(gql.String)},
			"description":              &gql.Field{Type: gql.String},
			"isFree":                   &gql.Field{Type: gql.NewNonNull(gql.Boolean)},
			"entryFeeAmount":           &gql.Field{Type: gql.NewNonNull(gql.Float)},
			"entryFeeCurrency":         &gql.Field{Type: gql.NewNonNull(gql.String)},
			"prizePoolAmount":          &gql.Field{Type: gql.NewNonNull(gql.Float)},
			"prizePoolCurrency":        &gql.Field{Type: gql.String},
			"prizeImageUrl":            &gql.Field{Type: gql.String},
			"gallery":                  &gql.Field{Type: gql.NewNonNull(gql.NewList(gql.NewNonNull(gql.String)))},
			"playersCount":             &gql.Field{Type: gql.NewNonNull(gql.Int)},
			"status":                   &gql.Field{Type: gql.NewNonNull(gql.String)},
			"prizePoolDisplayEnabled":  &gql.Field{Type: gql.NewNonNull(gql.Boolean)},
			"maxPlayers":               &gql.Field{Type: gql.Int},
			"seatCapUnlimited":         &gql.Field{Type: gql.Boolean},
			"prizePoolNow":             &gql.Field{Type: gql.Float},
			"prizePoolIfFull":          &gql.Field{Type: gql.Float},
			"prizePoolGuaranteeAmount": &gql.Field{Type: gql.Float},
			"prizePoolFrozen":          &gql.Field{Type: gql.NewNonNull(gql.Boolean)},
			"formatId":                 &gql.Field{Type: gql.String},
			"arenaDurationMinutes":     &gql.Field{Type: gql.Int},
			"prizePayoutMode":          &gql.Field{Type: gql.String},
			"prizePlacePercents":       &gql.Field{Type: gql.String},
		},
	})

	adCampaignType := gql.NewObject(gql.ObjectConfig{
		Name: "AdCampaign",
		Fields: gql.Fields{
			"id":               &gql.Field{Type: gql.NewNonNull(gql.ID)},
			"title":            &gql.Field{Type: gql.NewNonNull(gql.String)},
			"status":           &gql.Field{Type: gql.NewNonNull(gql.String)},
			"statusLabel":      &gql.Field{Type: gql.String},
			"impressions":      &gql.Field{Type: gql.NewNonNull(gql.Int)},
			"clicks":           &gql.Field{Type: gql.NewNonNull(gql.Int)},
			"uniqueReach":      &gql.Field{Type: gql.NewNonNull(gql.Int)},
			"videoCompletions": &gql.Field{Type: gql.NewNonNull(gql.Int)},
			"creativeUrl":      &gql.Field{Type: gql.String},
			"thumbnailUrl":     &gql.Field{Type: gql.String},
			"gallery":          &gql.Field{Type: gql.NewNonNull(gql.NewList(gql.NewNonNull(gql.String)))},
		},
	})

	publisherDashboardType := gql.NewObject(gql.ObjectConfig{
		Name: "PublisherDashboard",
		Fields: gql.Fields{
			"me":                     &gql.Field{Type: playerType},
			"campaigns":              &gql.Field{Type: gql.NewNonNull(gql.NewList(gql.NewNonNull(adCampaignType)))},
			"totalImpressions":       &gql.Field{Type: gql.NewNonNull(gql.Int)},
			"totalClicks":            &gql.Field{Type: gql.NewNonNull(gql.Int)},
			"totalUniqueReach":       &gql.Field{Type: gql.NewNonNull(gql.Int)},
			"totalVideoCompletions":  &gql.Field{Type: gql.NewNonNull(gql.Int)},
			"ctrPercent":             &gql.Field{Type: gql.NewNonNull(gql.Float)},
			"cpc":                    &gql.Field{Type: gql.NewNonNull(gql.Float)},
			"cpcCurrency":            &gql.Field{Type: gql.NewNonNull(gql.String)},
			"completionPercent":      &gql.Field{Type: gql.NewNonNull(gql.Float)},
			"createFeeSpendSum":      &gql.Field{Type: gql.NewNonNull(gql.Float)},
			"createFeeSpendCurrency": &gql.Field{Type: gql.NewNonNull(gql.String)},
		},
	})

	query := gql.NewObject(gql.ObjectConfig{
		Name: "Query",
		Fields: gql.Fields{
			"health": &gql.Field{
				Type: gql.NewNonNull(gql.String),
				Resolve: func(p gql.ResolveParams) (any, error) {
					return "ok", nil
				},
			},
			"featureFlags": &gql.Field{
				Type: gql.NewNonNull(featureFlagsType),
				Resolve: func(p gql.ResolveParams) (any, error) {
					return flagsMapPublic(deps.Flags.Get(p.Context)), nil
				},
			},
			"consoleFeatureFlags": &gql.Field{
				Type: gql.NewNonNull(consoleFeatureFlagsType),
				Resolve: func(p gql.ResolveParams) (any, error) {
					claims := auth.ClaimsFromContext(p.Context)
					if claims == nil || deps.Settings == nil || !deps.Settings.IsConsoleRole(claims.Role) {
						return nil, gqlAuthForbidden(deps)
					}
					return flagsMap(deps.Flags.Get(p.Context)), nil
				},
			},
			"me": &gql.Field{
				Type: playerType,
				Resolve: func(p gql.ResolveParams) (any, error) {
					claims := auth.ClaimsFromContext(p.Context)
					if claims == nil {
						return nil, nil
					}
					u, err := deps.Users.GetByID(p.Context, claims.UserID)
					if err != nil {
						return nil, simpleErr("user not found")
					}
					return mapPlayer(deps, p, u), nil
				},
			},
			"player": &gql.Field{
				Type: playerType,
				Args: gql.FieldConfigArgument{
					"id": &gql.ArgumentConfig{Type: gql.NewNonNull(gql.ID)},
				},
				Resolve: func(p gql.ResolveParams) (any, error) {
					id, _ := p.Args["id"].(string)
					u, err := deps.Users.GetByID(p.Context, id)
					if err != nil || !u.IsActive {
						return nil, nil
					}
					// Console accounts are never exposed on the public player query.
					if deps.Settings != nil && deps.Settings.IsConsoleRole(u.Role) {
						return nil, nil
					}
					m := mapPlayer(deps, p, u)
					if deps.Settings != nil {
						enums := deps.Settings.ClientEnums()
						if enums.Source == "database" && enums.DefaultRole != "" {
							m["role"] = enums.DefaultRole
						}
					}
					return m, nil
				},
			},
			"tournaments": &gql.Field{
				Type: gql.NewNonNull(gql.NewList(gql.NewNonNull(tournamentType))),
				Resolve: func(p gql.ResolveParams) (any, error) {
					claims := auth.ClaimsFromContext(p.Context)
					var list []store.Tournament
					var err error
					if claims != nil && deps.Settings != nil && deps.Settings.IsConsoleRole(claims.Role) {
						list, err = deps.Tournaments.List(p.Context)
					} else {
						enrollable := ""
						if deps.Settings != nil {
							enums := deps.Settings.ClientEnums()
							if enums.Source == "database" {
								enrollable = enums.EnrollableTournamentStatus
							}
						}
						if enrollable == "" {
							return nil, simpleErr("enrollable tournament status unavailable")
						}
						list, err = deps.Tournaments.List(p.Context, enrollable)
					}
					if err != nil {
						return nil, simpleErr("unable to load tournaments")
					}
					out := make([]map[string]any, 0, len(list))
					for i := range list {
						out = append(out, tournamentMap(deps, p.Context, &list[i]))
					}
					return out, nil
				},
			},
			"tournament": &gql.Field{
				Type: tournamentType,
				Args: gql.FieldConfigArgument{
					"id": &gql.ArgumentConfig{Type: gql.NewNonNull(gql.ID)},
				},
				Resolve: func(p gql.ResolveParams) (any, error) {
					id, _ := p.Args["id"].(string)
					t, err := deps.Tournaments.Get(p.Context, id)
					if err != nil {
						return nil, nil
					}
					return tournamentMap(deps, p.Context, t), nil
				},
			},
			"leaderboard": &gql.Field{
				Type: gql.NewNonNull(gql.NewList(gql.NewNonNull(playerType))),
				Args: gql.FieldConfigArgument{
					"limit": &gql.ArgumentConfig{Type: gql.Int},
				},
				Resolve: func(p gql.ResolveParams) (any, error) {
					limit := 50
					if v, ok := p.Args["limit"].(int); ok && v > 0 {
						limit = v
					}
					publicRole := ""
					if deps.Settings != nil {
						enums := deps.Settings.ClientEnums()
						if enums.Source == "database" {
							publicRole = enums.DefaultRole
						}
					}
					if publicRole == "" {
						return nil, simpleErr("default role unavailable")
					}
					list, err := deps.Users.Leaderboard(p.Context, limit, publicRole)
					if err != nil {
						return nil, simpleErr("unable to load leaderboard")
					}
					out := make([]map[string]any, 0, len(list))
					ids := make([]string, 0, len(list))
					for i := range list {
						e := list[i]
						online := false
						if deps.Presence != nil {
							online = deps.Presence.Online(p.Context, e.ID)
						}
						rank, label, _ := deps.Users.RegionalRank(p.Context, e.ID)
						entry := map[string]any{
							"id": e.ID, "username": e.Username, "role": publicRole,
							"rating": e.Rating, "xp": e.XP, "wins": e.Wins, "losses": e.Losses, "draws": e.Draws,
							"avatarThumbUrl": e.AvatarThumbURL, "avatarFullUrl": e.AvatarFullURL,
							"region": e.Region, "countryCode": e.CountryCode, "online": online,
							"regionalRank": rank, "regionLabel": label,
						}
						if deps.Settings != nil {
							if lvl := deps.Settings.LevelLabelForXP(e.XP); lvl != "" {
								entry["levelLabel"] = lvl
							}
						}
						out = append(out, entry)
						ids = append(ids, e.ID)
					}
					if deps.Cash != nil && deps.Cash.Ready() && deps.Users != nil {
						if flags, ferr := deps.Users.MapHostKycFlags(p.Context, ids); ferr == nil {
							for i := range out {
								id, _ := out[i]["id"].(string)
								f, ok := flags[id]
								if !ok {
									continue
								}
								if tier, badge := deps.Cash.HostTrust(f.PhoneVerified, f.DocumentVerified); tier != "" && badge != "" {
									out[i]["hostTrustTier"] = tier
									out[i]["hostTrustBadge"] = badge
								}
							}
						}
					}
					return out, nil
				},
			},
			"myCampaigns": &gql.Field{
				Type: gql.NewNonNull(gql.NewList(gql.NewNonNull(adCampaignType))),
				Resolve: func(p gql.ResolveParams) (any, error) {
					claims := auth.ClaimsFromContext(p.Context)
					if claims == nil {
						return nil, gqlAuthUnauthorized(deps)
					}
					if deps.Ads == nil {
						return []map[string]any{}, nil
					}
					list, err := deps.Ads.ListByPublisher(p.Context, claims.UserID)
					if err != nil {
						return nil, gqlAdsChromeErr(deps, "err_list_failed")
					}
					var statusLabels map[string]string
					if deps.Settings != nil {
						enums := deps.Settings.ClientEnums()
						if enums.Source == "database" {
							statusLabels = enums.CampaignStatusLabels
						}
					}
					out := make([]map[string]any, 0, len(list))
					for i := range list {
						out = append(out, adCampaignMap(&list[i], statusLabels))
					}
					return out, nil
				},
			},
			"publisherDashboard": &gql.Field{
				Type: gql.NewNonNull(publisherDashboardType),
				Resolve: func(p gql.ResolveParams) (any, error) {
					claims := auth.ClaimsFromContext(p.Context)
					if claims == nil {
						return nil, gqlAuthUnauthorized(deps)
					}
					var me any
					if u, err := deps.Users.GetByID(p.Context, claims.UserID); err == nil {
						me = mapPlayer(deps, p, u)
					}
					campaigns := []map[string]any{}
					totalImp := 0
					totalClk := 0
					totalReach := 0
					totalCompletions := 0
					var statusLabels map[string]string
					if deps.Settings != nil {
						enums := deps.Settings.ClientEnums()
						if enums.Source == "database" {
							statusLabels = enums.CampaignStatusLabels
						}
					}
					if deps.Ads != nil {
						list, err := deps.Ads.ListByPublisher(p.Context, claims.UserID)
						if err != nil {
							return nil, gqlAdsChromeErr(deps, "err_dashboard_failed")
						}
						for i := range list {
							c := list[i]
							totalImp += int(c.Impressions)
							totalClk += int(c.Clicks)
							totalReach += int(c.UniqueReach)
							totalCompletions += int(c.VideoCompletions)
							campaigns = append(campaigns, adCampaignMap(&c, statusLabels))
						}
					}
					ctr := 0.0
					if totalImp > 0 {
						ctr = (float64(totalClk) / float64(totalImp)) * 100
					}
					completionPct := 0.0
					if totalImp > 0 {
						completionPct = (float64(totalCompletions) / float64(totalImp)) * 100
					}
					cpc := 0.0
					// Display currency from request geo (ETB domestic / USD elsewhere) - not static ad_pricing.
					cpcCurrency := displayCurrencyForRequest(p.Context, deps)
					createFeeCurrency := cpcCurrency
					if deps.Settings != nil {
						pricing := deps.Settings.AdPricing()
						if pricing.Source == "database" && totalClk > 0 {
							cpc = (float64(totalImp) * pricing.ImpressionUnitCost) / float64(totalClk)
						}
					}
					// Sum create-fee spend only in the request-geo display currency
					// (never mix Ethiopia ETB rows with global USD rows).
					createFeeSpend := 0.0
					if deps.DB != nil && deps.DB.Ready() && strings.TrimSpace(createFeeCurrency) != "" {
						_ = deps.DB.Pool.QueryRow(p.Context, `
							SELECT COALESCE(SUM(amount), 0)
							FROM wallet_ledger
							WHERE user_id = $1 AND kind = $2 AND status = 'posted'
							  AND UPPER(TRIM(currency)) = UPPER(TRIM($3::text))
						`, claims.UserID, payments.LedgerKindCampaignCreateFee, createFeeCurrency).Scan(&createFeeSpend)
					}
					return map[string]any{
						"me":                     me,
						"totalUniqueReach":       totalReach,
						"campaigns":              campaigns,
						"totalImpressions":       totalImp,
						"totalClicks":            totalClk,
						"totalVideoCompletions":  totalCompletions,
						"ctrPercent":             ctr,
						"cpc":                    cpc,
						"cpcCurrency":            cpcCurrency,
						"completionPercent":      completionPct,
						"createFeeSpendSum":      createFeeSpend,
						"createFeeSpendCurrency": createFeeCurrency,
					}, nil
				},
			},
		},
	})

	mutation := gql.NewObject(gql.ObjectConfig{
		Name: "Mutation",
		Fields: gql.Fields{
			"createTournament": &gql.Field{
				Type: gql.NewNonNull(tournamentType),
				Args: gql.FieldConfigArgument{
					"title":                   &gql.ArgumentConfig{Type: gql.NewNonNull(gql.String)},
					"description":             &gql.ArgumentConfig{Type: gql.String},
					"isFree":                  &gql.ArgumentConfig{Type: gql.Boolean},
					"entryFeeAmount":          &gql.ArgumentConfig{Type: gql.Float},
					"entryFeeCurrency":        &gql.ArgumentConfig{Type: gql.String},
					"prizePoolAmount":         &gql.ArgumentConfig{Type: gql.Float},
					"prizePoolCurrency":       &gql.ArgumentConfig{Type: gql.String},
					"prizePoolDisplayEnabled": &gql.ArgumentConfig{Type: gql.Boolean},
					"maxPlayers":              &gql.ArgumentConfig{Type: gql.Int},
					"formatId":                &gql.ArgumentConfig{Type: gql.String},
					"arenaDurationMinutes":    &gql.ArgumentConfig{Type: gql.Int},
					"prizePayoutMode":         &gql.ArgumentConfig{Type: gql.String},
					"prizePlacePercents":      &gql.ArgumentConfig{Type: gql.String},
				},
				Resolve: func(p gql.ResolveParams) (any, error) {
					claims := auth.ClaimsFromContext(p.Context)
					if err := requireConsolePerm(p.Context, deps, claims, "tournaments.write"); err != nil {
						return nil, err
					}
					title, _ := p.Args["title"].(string)
					desc, _ := p.Args["description"].(string)
					isFree, _ := p.Args["isFree"].(bool)
					amount, _ := p.Args["entryFeeAmount"].(float64)
					currency, _ := p.Args["entryFeeCurrency"].(string)
					status := ""
					enums := deps.Settings.ClientEnums()
					if enums.Source == "database" {
						status = enums.DefaultTournamentStatus
					}
					if status == "" {
						return nil, simpleErr("default tournament status unavailable")
					}
					if deps.Settings == nil {
						return nil, simpleErr("unable to create tournament")
					}
					formatArg, _ := p.Args["formatId"].(string)
					formatID, err := deps.Settings.ResolveTournamentFormatID(formatArg)
					if err != nil {
						return nil, simpleErr("unable to create tournament")
					}
					var arenaDur *int
					if ad, ok := p.Args["arenaDurationMinutes"].(int); ok && ad > 0 {
						arenaDur = &ad
					} else if strings.TrimSpace(formatID) == strings.TrimSpace(enums.HostedEventArenaFormat) {
						if n, err := strconv.Atoi(strings.TrimSpace(enums.CompetitionArenaDefaultDurationMinutes)); err == nil && n > 0 {
							arenaDur = &n
						}
					}
					prizePool := map[string]any{}
					if prizeAmt, ok := p.Args["prizePoolAmount"].(float64); ok && prizeAmt > 0 {
						if isFree {
							return nil, simpleErr("prize pool not allowed on free tournament")
						}
						prizeCur, _ := p.Args["prizePoolCurrency"].(string)
						prizeCur = strings.TrimSpace(prizeCur)
						if prizeCur == "" {
							// Fail closed: never invent prize currency from entry currency.
							return nil, simpleErr("prize pool currency required")
						}
						prizePool["total"] = prizeAmt
						prizePool["currency"] = prizeCur
					}
					prizeDisplay := false
					if v, ok := p.Args["prizePoolDisplayEnabled"].(bool); ok {
						prizeDisplay = v
					}
					platformDisplay := deps.Flags != nil && deps.Flags.Get(p.Context).PrizePoolDisplayEnabled
					if isFree || !platformDisplay {
						prizeDisplay = false
					}
					// Omit/null → Unlimited (Arena only). Present but < 2 must reject
					// (never coerce invalid lows into open enroll).
					var maxPlayers *int
					if raw, exists := p.Args["maxPlayers"]; exists && raw != nil {
						mp, ok := raw.(int)
						if !ok {
							return nil, gqlTournamentChromeErr(p.Context, deps, "err_max_players_required")
						}
						maxPlayers = &mp
					}
					swiss := map[string]int{}
					if deps.Settings != nil {
						swiss = deps.Settings.EventsCatalog().SwissRoundsByMaxPlayers
					}
					if errKey := store.ValidateOfficialMaxPlayers(
						formatID, enums.HostedEventArenaFormat, maxPlayers, swiss,
					); errKey != "" {
						return nil, gqlTournamentChromeErr(p.Context, deps, errKey)
					}
					payoutMode := ""
					placePercents := map[string]any{}
					bodyMode, _ := p.Args["prizePayoutMode"].(string)
					var rawPercents map[string]float64
					if raw, ok := p.Args["prizePlacePercents"].(string); ok && strings.TrimSpace(raw) != "" {
						_ = json.Unmarshal([]byte(raw), &rawPercents)
					}
					// Paid + prize display: always apply DB format default when mode omitted.
					payoutEngage := prizeDisplay && !isFree && amount > 0
					if payoutEngage {
						mode := strings.TrimSpace(bodyMode)
						if mode == "" {
							mode = store.DefaultPayoutModeForFormat(enums, formatID)
						}
						if err := store.ValidatePayoutModeForFormat(enums, formatID, mode); err != nil {
							return nil, simpleErr("unable to create tournament")
						}
						payoutMode = mode
						placesMode := strings.TrimSpace(enums.CompetitionPayoutModePlacesPercent)
						dualMode := strings.TrimSpace(enums.CompetitionPayoutModeDualPurse)
						// Dual purse place purse uses the same finish-% map as places_percent
						// (applied to the place-purse slice at cup end).
						if mode == placesMode || mode == dualMode {
							var parsed map[int]float64
							var perr error
							if len(rawPercents) > 0 {
								parsed, perr = store.ParsePlacePercentsMap(rawPercents)
							} else {
								parsed, perr = store.PlacePercentsFromEnums(enums)
							}
							if perr != nil {
								return nil, simpleErr("unable to create tournament")
							}
							for place, pct := range parsed {
								if pct > 0 {
									placePercents[strconv.Itoa(place)] = pct
								}
							}
						}
						if mode == dualMode {
							if _, err := store.DualPursePlacePercent(enums); err != nil {
								return nil, simpleErr("unable to create tournament")
							}
						}
					}
					uid := claims.UserID
					t, err := deps.Tournaments.Create(p.Context, store.CreateTournamentInput{
						Title:                   title,
						Description:             desc,
						IsFree:                  isFree,
						EntryFeeAmount:          amount,
						EntryFeeCurrency:        currency,
						PrizePool:               prizePool,
						Status:                  status,
						FormatID:                formatID,
						CreatedBy:               &uid,
						PrizePoolDisplayEnabled: prizeDisplay,
						MaxPlayers:              maxPlayers,
						ArenaDurationMinutes:    arenaDur,
						PrizePayoutMode:         payoutMode,
						PrizePlacePercents:      placePercents,
					})
					if err != nil {
						return nil, simpleErr("unable to create tournament")
					}
					// Broadcast when created already enrollable (default is usually draft).
					emitTournamentLifecycle(p.Context, deps, t, "")
					return tournamentMap(deps, p.Context, t), nil
				},
			},
			"setTournamentStatus": &gql.Field{
				Type: gql.NewNonNull(tournamentType),
				Args: gql.FieldConfigArgument{
					"id":     &gql.ArgumentConfig{Type: gql.NewNonNull(gql.ID)},
					"status": &gql.ArgumentConfig{Type: gql.NewNonNull(gql.String)},
				},
				Resolve: func(p gql.ResolveParams) (any, error) {
					claims := auth.ClaimsFromContext(p.Context)
					if err := requireConsolePerm(p.Context, deps, claims, "tournaments.write"); err != nil {
						return nil, err
					}
					id, _ := p.Args["id"].(string)
					status, _ := p.Args["status"].(string)
					if deps.Settings == nil || deps.Settings.ClientEnums().Source != "database" || !deps.Settings.IsAllowedTournamentStatus(status) {
						return nil, simpleErr("invalid status")
					}
					enums := deps.Settings.ClientEnums()
					prevStatus := ""
					var prev *store.Tournament
					if pTour, err := deps.Tournaments.Get(p.Context, id); err == nil && pTour != nil {
						prev = pTour
						prevStatus = pTour.Status
					}
					enrollable := strings.TrimSpace(enums.EnrollableTournamentStatus)
					archivedStatus := "archived"
					for _, st := range enums.TournamentStatuses {
						if strings.TrimSpace(st) == "archived" {
							archivedStatus = st
							break
						}
					}
					// REST SetStatus parity:
					// after start/finish: only Archive (no refund); before start open→archived refunds seats.
					if prev != nil && prev.StartedAt != nil {
						if status != archivedStatus && status != prevStatus {
							return nil, gqlTournamentChromeErr(p.Context, deps, "err_cup_already_started")
						}
					} else if prev != nil && enrollable != "" && prevStatus == enrollable && status == archivedStatus {
						if err := refundTournamentEntriesBeforeClose(p.Context, deps, id); err != nil {
							return nil, gqlTournamentChromeErr(p.Context, deps, "err_refund_failed")
						}
						if _, err := deps.Tournaments.ClearPrizePoolFreeze(p.Context, id); err != nil {
							return nil, gqlTournamentChromeErr(p.Context, deps, "err_refund_failed")
						}
					} else if err := freezeTournamentPrizePoolOnLeaveEnrollable(p.Context, deps, prev, prevStatus, status); err != nil {
						return nil, gqlTournamentChromeErr(p.Context, deps, "err_status_update_failed")
					}
					t, err := deps.Tournaments.SetStatus(p.Context, id, status)
					if err != nil {
						return nil, simpleErr("unable to update tournament status")
					}
					emitTournamentLifecycle(p.Context, deps, t, prevStatus)
					return tournamentMap(deps, p.Context, t), nil
				},
			},
			"setFeatureFlag": &gql.Field{
				Type: gql.NewNonNull(consoleFeatureFlagsType),
				Args: gql.FieldConfigArgument{
					"key":               &gql.ArgumentConfig{Type: gql.NewNonNull(gql.String)},
					"enabled":           &gql.ArgumentConfig{Type: gql.NewNonNull(gql.Boolean)},
					"mode":              &gql.ArgumentConfig{Type: gql.String},
					"depths":            &gql.ArgumentConfig{Type: gql.NewList(gql.NewNonNull(gql.Int))},
					"disabledCountries": &gql.ArgumentConfig{Type: gql.NewList(gql.NewNonNull(gql.String))},
				},
				Resolve: func(p gql.ResolveParams) (any, error) {
					claims := auth.ClaimsFromContext(p.Context)
					if err := requireConsolePerm(p.Context, deps, claims, "feature_flags.write"); err != nil {
						return nil, err
					}
					key, _ := p.Args["key"].(string)
					enabled, _ := p.Args["enabled"].(bool)
					if deps.Settings.FeatureFlagCatalog().Source != "database" || !deps.Settings.IsCatalogFlagKey(key) {
						return nil, simpleErr("unknown feature flag key")
					}
					catalog := deps.Settings.FeatureFlagCatalog()
					current := deps.Flags.Get(p.Context)
					payload := map[string]any{}
					if raw, ok := current.Raw[key].(map[string]any); ok {
						if prev, ok := raw["payload"].(map[string]any); ok {
							for k, v := range prev {
								payload[k] = v
							}
						}
					}
					if raw, ok := p.Args["disabledCountries"].([]any); ok {
						out := make([]any, 0, len(raw))
						for _, item := range raw {
							s, _ := item.(string)
							s = strings.ToUpper(strings.TrimSpace(s))
							if s != "" {
								out = append(out, s)
							}
						}
						payload["disabled_countries"] = out
					}
					if key == catalog.AIDepthsFlagKey {
						depths := make([]any, 0)
						if raw, ok := p.Args["depths"].([]any); ok && len(raw) > 0 {
							for _, item := range raw {
								d, ok := item.(int)
								if !ok {
									if f, ok := item.(float64); ok {
										d = int(f)
									} else {
										return nil, simpleErr("ai depth invalid")
									}
								}
								if d < 1 || d > 20 {
									return nil, simpleErr("ai depth out of range (1-20)")
								}
								depths = append(depths, d)
							}
						} else {
							for _, d := range current.AIDepths {
								depths = append(depths, d)
							}
						}
						if len(depths) == 0 {
							return nil, simpleErr("ai depths required in database feature flag payload")
						}
						payload["depths"] = depths
					}
					for _, t := range catalog.Toggles {
						if t.Key == key && t.Kind == "mode" {
							modeArg, _ := p.Args["mode"].(string)
							if !deps.Settings.IsAllowedEthiopiaPaymentMode(modeArg) {
								return nil, simpleErr("invalid payment mode")
							}
							mode := payments.InternalChannel(modeArg)
							if mode == "" {
								return nil, simpleErr("invalid payment mode")
							}
							payload["mode"] = mode
							break
						}
					}
					if err := deps.Flags.Set(p.Context, key, enabled, payload); err != nil {
						return nil, simpleErr("unable to update flag")
					}
					f := deps.Flags.Get(p.Context)
					if deps.Hub != nil {
						deps.Hub.BroadcastFeatureFlags(map[string]any{
							"type": "feature_flags",
							"flags": map[string]any{
								"vs_ai_enabled":                f.VSAIEnabled,
								"otp_required":                 f.OTPRequired,
								"cash_rmg_enabled":             f.CashRmgEnabled,
								"cash_phone_kyc_required":      f.CashPhoneKycRequired,
								"cash_phone_otp_required":      f.CashPhoneOtpRequired,
								"cash_rmg_disabled_countries":  f.CashRmgDisabledCountries,
								"hosted_events_enabled":        f.HostedEventsEnabled,
								"public_events_enabled":        f.PublicEventsEnabled,
								"public_event_matches_rated":   f.PublicEventMatchesRated,
								"prize_pool_display_enabled":   f.PrizePoolDisplayEnabled,
								"prize_pool_guarantee_enabled": f.PrizePoolGuaranteeEnabled,
								"kyc_auto_approve":             f.KycAutoApprove,
								"ai_depths":                    f.AIDepths,
							},
						})
					}
					return flagsMap(f), nil
				},
			},
		},
	})

	return gql.NewSchema(gql.SchemaConfig{Query: query, Mutation: mutation})
}

func mapPlayer(deps Deps, p gql.ResolveParams, u *domain.User) map[string]any {
	online := false
	if deps.Presence != nil {
		online = deps.Presence.Online(p.Context, u.ID)
	}
	m := playerMapWithSettings(u, online, deps.Settings)
	if deps.Users != nil {
		rank, label, err := deps.Users.RegionalRank(p.Context, u.ID)
		if err == nil {
			m["regionalRank"] = rank
			m["regionLabel"] = label
		}
	}
	if deps.Cash != nil && deps.Cash.Ready() {
		if tier, badge := deps.Cash.HostTrust(u.PhoneKycVerifiedAt != nil, u.DocumentKycVerifiedAt != nil); tier != "" && badge != "" {
			m["hostTrustTier"] = tier
			m["hostTrustBadge"] = badge
		}
	}
	if deps.Events != nil && deps.Settings != nil {
		enums := deps.Settings.ClientEnums()
		finishedSt := strings.TrimSpace(enums.HostedEventFinishedStatus)
		cancelledSt := strings.TrimSpace(enums.HostedEventCancelledStatus)
		openReportSt := strings.TrimSpace(enums.HostedEventReportOpenStatus)
		if finishedSt != "" && cancelledSt != "" && openReportSt != "" {
			if reps, repErr := deps.Events.MapHostReputation(p.Context, []string{u.ID}, finishedSt, cancelledSt, openReportSt); repErr == nil {
				rep := reps[u.ID]
				m["hostFinishedPaidCups"] = rep.FinishedPaidCups
				m["hostCancelledPaidCups"] = rep.CancelledPaidCups
				m["hostOpenReports"] = rep.OpenReports
			}
		}
	}
	return m
}

func playerMap(u *domain.User, online bool) map[string]any {
	return map[string]any{
		"id":             u.ID,
		"username":       u.Username,
		"role":           u.Role,
		"rating":         u.Rating,
		"xp":             u.XP,
		"wins":           u.Wins,
		"losses":         u.Losses,
		"draws":          u.Draws,
		"avatarThumbUrl": deref(u.AvatarThumbURL),
		"avatarFullUrl":  deref(u.AvatarFullURL),
		"region":         deref(u.Region),
		"countryCode":    deref(u.CountryCode),
		"online":         online,
	}
}

func playerMapWithSettings(u *domain.User, online bool, settings *store.SettingsStore) map[string]any {
	m := playerMap(u, online)
	if settings != nil {
		if label := settings.LevelLabelForXP(u.XP); label != "" {
			m["levelLabel"] = label
		}
	}
	return m
}

func flagsMap(f store.FeatureFlags) map[string]any {
	// No store-source field - avoids advertising memory vs database internals.
	// Payment mode uses public channel labels (never vendor gateway ids).
	disabled := f.CashRmgDisabledCountries
	if disabled == nil {
		disabled = []string{}
	}
	return map[string]any{
		"vsAiEnabled":               f.VSAIEnabled,
		"otpRequired":               f.OTPRequired,
		"cashRmgEnabled":            f.CashRmgEnabled,
		"cashPhoneKycRequired":      f.CashPhoneKycRequired,
		"cashPhoneOtpRequired":      f.CashPhoneOtpRequired,
		"cashRmgDisabledCountries":  disabled,
		"hostedEventsEnabled":       f.HostedEventsEnabled,
		"publicEventsEnabled":       f.PublicEventsEnabled,
		"publicEventMatchesRated":   f.PublicEventMatchesRated,
		"prizePoolDisplayEnabled":   f.PrizePoolDisplayEnabled,
		"prizePoolGuaranteeEnabled": f.PrizePoolGuaranteeEnabled,
		"kycAutoApprove":            f.KycAutoApprove,
		"ethiopiaPaymentMode":       payments.PublicChannel(f.EthiopiaPaymentMode),
		"aiDepths":                  f.AIDepths,
	}
}

func flagsMapPublic(f store.FeatureFlags) map[string]any {
	disabled := f.CashRmgDisabledCountries
	if disabled == nil {
		disabled = []string{}
	}
	return map[string]any{
		"vsAiEnabled":               f.VSAIEnabled,
		"otpRequired":               f.OTPRequired,
		"cashRmgEnabled":            f.CashRmgEnabled,
		"cashPhoneKycRequired":      f.CashPhoneKycRequired,
		"cashPhoneOtpRequired":      f.CashPhoneOtpRequired,
		"cashRmgDisabledCountries":  disabled,
		"hostedEventsEnabled":       f.HostedEventsEnabled,
		"publicEventsEnabled":       f.PublicEventsEnabled,
		"publicEventMatchesRated":   f.PublicEventMatchesRated,
		"prizePoolDisplayEnabled":   f.PrizePoolDisplayEnabled,
		"prizePoolGuaranteeEnabled": f.PrizePoolGuaranteeEnabled,
		"kycAutoApprove":            f.KycAutoApprove,
		"aiDepths":                  f.AIDepths,
	}
}

func tournamentMap(deps Deps, ctx context.Context, t *store.Tournament) map[string]any {
	prizeAmt := 0.0
	var prizeCur any
	if t.PrizePool != nil {
		switch v := t.PrizePool["total"].(type) {
		case float64:
			prizeAmt = v
		case int:
			prizeAmt = float64(v)
		}
		if c, ok := t.PrizePool["currency"].(string); ok && c != "" {
			prizeCur = c
		}
	}
	gallery := t.Gallery
	if gallery == nil {
		gallery = []string{}
	}
	playersCount := 0
	countOK := deps.Entries != nil
	if deps.Entries != nil {
		n, err := deps.Entries.CountByTournament(ctx, t.ID)
		if err != nil {
			countOK = false
		} else {
			playersCount = n
		}
	}
	platformOn := deps.Flags != nil && deps.Flags.Get(ctx).PrizePoolDisplayEnabled
	currency := strings.TrimSpace(t.EntryFeeCurrency)
	// Omit live pot when enroll count is unknown (never invent a zero-player pot).
	showPool := countOK && platformOn && t.PrizePoolDisplayEnabled && !t.IsFree && t.EntryFeeAmount > 0 && currency != ""
	out := map[string]any{
		"id":                      t.ID,
		"title":                   t.Title,
		"description":             t.Description,
		"isFree":                  t.IsFree,
		"entryFeeAmount":          t.EntryFeeAmount,
		"entryFeeCurrency":        t.EntryFeeCurrency,
		"prizePoolAmount":         prizeAmt,
		"prizePoolCurrency":       prizeCur,
		"prizeImageUrl":           t.PrizeImageURL,
		"gallery":                 gallery,
		"playersCount":            playersCount,
		"status":                  t.Status,
		"prizePoolDisplayEnabled": showPool,
	}
	formatID := strings.TrimSpace(t.FormatID)
	if formatID == "" && deps.Settings != nil {
		enums := deps.Settings.ClientEnums()
		if enums.Source == "database" {
			formatID = strings.TrimSpace(enums.TournamentDefaultFormat)
		}
	}
	if formatID != "" {
		out["formatId"] = formatID
	}
	if t.ArenaDurationMinutes != nil && *t.ArenaDurationMinutes > 0 {
		out["arenaDurationMinutes"] = *t.ArenaDurationMinutes
	}
	// Emit present max even when < 2 (invalid orphan) so clients never treat omit as Unlimited.
	if t.MaxPlayers != nil {
		out["maxPlayers"] = *t.MaxPlayers
	}
	var swiss map[string]int
	if deps.Settings != nil {
		swiss = deps.Settings.EventsCatalog().SwissRoundsByMaxPlayers
	}
	if store.SeatCapRequiresArenaOnly(t.MaxPlayers, swiss) {
		out["seatCapUnlimited"] = true
	}
	out["prizePoolFrozen"] = showPool && t.PrizePoolFrozenAmount != nil
	if showPool {
		// Live pot currency is always the entry-fee currency (same as REST prize_pool_currency).
		out["prizePoolCurrency"] = currency
		guarantee := payments.RoundMoney2(prizeAmt)
		if guarantee > 0 {
			out["prizePoolGuaranteeAmount"] = guarantee
		}
		if t.PrizePoolFrozenAmount != nil {
			out["prizePoolNow"] = payments.RoundMoney2(*t.PrizePoolFrozenAmount)
		} else {
			out["prizePoolNow"] = payments.RoundMoney2(float64(playersCount)*t.EntryFeeAmount + guarantee)
		}
		if store.HasPlayerCap(t.MaxPlayers) && !store.SeatCapRequiresArenaOnly(t.MaxPlayers, swiss) {
			out["prizePoolIfFull"] = payments.RoundMoney2(float64(*t.MaxPlayers)*t.EntryFeeAmount + guarantee)
		}
	}
	if mode := strings.TrimSpace(t.PrizePayoutMode); mode != "" {
		out["prizePayoutMode"] = mode
	}
	if len(t.PrizePlacePercents) > 0 {
		if b, err := json.Marshal(t.PrizePlacePercents); err == nil {
			out["prizePlacePercents"] = string(b)
		}
	}
	return out
}

// refundTournamentEntriesBeforeClose credits paid seats (REST TournamentAPI parity).
func refundTournamentEntriesBeforeClose(ctx context.Context, deps Deps, tournamentID string) error {
	if deps.Entries == nil {
		return fmt.Errorf("entries unavailable")
	}
	entries, err := deps.Entries.ListByTournament(ctx, tournamentID)
	if err != nil {
		return err
	}
	for i := range entries {
		en := entries[i]
		if en.IsFree || en.EntryFeeCharged <= 0 {
			continue
		}
		if deps.Payments == nil {
			return fmt.Errorf("payments unavailable for tournament entry refund")
		}
		if err := deps.Payments.RefundTournamentEntryFee(ctx, en.UserID, en.EntryFeeCharged, en.Currency, en.ID); err != nil {
			return err
		}
		if err := deps.Entries.ClearEntryFeeCharged(ctx, en.ID); err != nil {
			return err
		}
	}
	return nil
}

// freezeTournamentPrizePoolOnLeaveEnrollable locks the funded pot when leaving enrollable (fail closed).
// Skips archive: open → archived refunds seats instead (setTournamentStatus / REST SetStatus).
func freezeTournamentPrizePoolOnLeaveEnrollable(
	ctx context.Context,
	deps Deps,
	prev *store.Tournament,
	prevStatus, nextStatus string,
) error {
	if prev == nil || !prev.PrizePoolDisplayEnabled || prev.IsFree || prev.PrizePoolFrozenAmount != nil {
		return nil
	}
	if deps.Settings == nil {
		return fmt.Errorf("settings unavailable")
	}
	enums := deps.Settings.ClientEnums()
	if enums.Source != "database" {
		return fmt.Errorf("enums unavailable")
	}
	enrollable := strings.TrimSpace(enums.EnrollableTournamentStatus)
	if enrollable == "" || prevStatus != enrollable || nextStatus == enrollable {
		return nil
	}
	archivedStatus := "archived"
	for _, st := range enums.TournamentStatuses {
		if strings.TrimSpace(st) == "archived" {
			archivedStatus = st
			break
		}
	}
	if nextStatus == archivedStatus {
		return nil
	}
	if deps.Entries == nil {
		return fmt.Errorf("tournament entries unavailable")
	}
	playersCount, err := deps.Entries.CountByTournament(ctx, prev.ID)
	if err != nil {
		return err
	}
	guarantee := 0.0
	if prev.PrizePool != nil {
		switch v := prev.PrizePool["total"].(type) {
		case float64:
			guarantee = payments.RoundMoney2(v)
		case int:
			guarantee = payments.RoundMoney2(float64(v))
		}
	}
	amt := payments.RoundMoney2(float64(playersCount)*prev.EntryFeeAmount + guarantee)
	_, err = deps.Tournaments.FreezePrizePool(ctx, prev.ID, amt)
	return err
}

func adCampaignMap(c *store.AdCampaign, statusLabels map[string]string) map[string]any {
	gallery := c.Gallery
	if gallery == nil {
		gallery = []string{}
	}
	out := map[string]any{
		"id":               c.ID,
		"title":            c.Title,
		"status":           c.Status,
		"impressions":      int(c.Impressions),
		"clicks":           int(c.Clicks),
		"uniqueReach":      int(c.UniqueReach),
		"videoCompletions": int(c.VideoCompletions),
		"creativeUrl":      c.CreativeURL,
		"thumbnailUrl":     c.ThumbnailURL,
		"gallery":          gallery,
	}
	if label := store.StatusLabel(statusLabels, c.Status); label != "" {
		out["statusLabel"] = label
	}
	return out
}

func deref(v *string) any {
	if v == nil {
		return nil
	}
	return *v
}

type simpleErr string

func (e simpleErr) Error() string { return string(e) }

const playgroundHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>API</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #f8fafc; padding: 2rem; }
    pre { background: #111; padding: 1rem; border-radius: 0.5rem; overflow: auto; }
  </style>
</head>
<body>
  <h1>Query endpoint</h1>
  <p>POST documents to this path.</p>
  <pre>{ featureFlags { vsAiEnabled otpRequired aiDepths } }</pre>
</body>
</html>`
