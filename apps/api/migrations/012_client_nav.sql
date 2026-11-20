-- Player / ads / marketing / mobile nav modules (no client route hardcodes).
INSERT INTO platform_settings (key, value) VALUES
  (
    'client_nav',
    '{
      "player": [
        {"title": "Dashboard", "href": "/dashboard", "route_key": "dashboard"},
        {"title": "Play", "href": "/play", "route_key": "play"},
        {"title": "Matchmaking", "href": "/matchmaking", "route_key": "matchmaking"},
        {"title": "Profile", "href": "/profile", "route_key": "profile"},
        {"title": "Wallet", "href": "/wallet", "route_key": "wallet"},
        {"title": "Tournaments", "href": "/tournaments", "route_key": "tournaments"},
        {"title": "Leaderboard", "href": "/leaderboard", "route_key": "leaderboard"},
        {"title": "Spectate", "href": "/spectate", "route_key": "spectate"},
        {"title": "Ads", "href": "/ads/dashboard", "route_key": "ads"},
        {"title": "Sign in", "href": "/auth/login", "route_key": "login"}
      ],
      "ads": [
        {"title": "Dashboard", "href": "/ads/dashboard", "route_key": "ads_dashboard"},
        {"title": "Campaigns", "href": "/ads/campaigns", "route_key": "ads_campaigns"},
        {"title": "Analytics", "href": "/ads/analytics", "route_key": "ads_analytics"}
      ],
      "marketing": [
        {"title": "Player", "href": "/dashboard", "route_key": "dashboard"},
        {"title": "Play", "href": "/play", "route_key": "play"},
        {"title": "Wallet", "href": "/wallet", "route_key": "wallet"},
        {"title": "Ads", "href": "/ads/dashboard", "route_key": "ads"}
      ],
      "mobile": [
        {"title": "Play", "route_key": "play"},
        {"title": "Matchmaking", "route_key": "matchmaking"},
        {"title": "Spectate", "route_key": "spectate"},
        {"title": "Leaderboard", "route_key": "leaderboard"},
        {"title": "Tournaments", "route_key": "tournaments"},
        {"title": "Wallet", "route_key": "wallet"},
        {"title": "Profile", "route_key": "profile"},
        {"title": "Avatar", "route_key": "avatar"}
      ],
      "dashboard": [
        {"title": "Play", "href": "/play", "route_key": "play", "body": "Open the board for practice or live queues.", "body_when_vs_ai": "Practice against the computer or open live queues.", "cta": "Open board"},
        {"title": "Matchmaking", "href": "/matchmaking", "route_key": "matchmaking", "body": "Join 1v1 queues with live avatars and presence.", "cta": "Find match"},
        {"title": "Profile", "href": "/profile", "route_key": "profile", "body": "Update your avatar and view career stats.", "cta": "View profile"},
        {"title": "Wallet", "href": "/wallet", "route_key": "wallet", "body": "Top up, view balance, and pay tournament entry fees.", "cta": "Open wallet"},
        {"title": "Tournaments", "href": "/tournaments", "route_key": "tournaments", "body": "Enroll in paid or free events.", "cta": "Browse events"},
        {"title": "Ad publisher", "href": "/ads/dashboard", "route_key": "ads", "body": "Campaigns, analytics, and spend caps for creators.", "cta": "Open ads"}
      ]
    }'::jsonb
  )
ON CONFLICT (key) DO NOTHING;
