-- Publisher form/dashboard/analytics chrome + creative type enums (DB only; no client invent).

UPDATE platform_settings
SET value = value || '{
  "ph_title": "Campaign title",
  "ph_country": "Country",
  "ph_region": "Region (optional)",
  "ph_district": "District (optional)",
  "ph_lat": "Lat",
  "ph_lng": "Lng",
  "ph_radius_km": "Radius km",
  "ph_daily_spend_cap": "Daily spend cap",
  "create_action": "Create",
  "replace_creative_action": "Replace creative",
  "attach_video_action": "Attach video",
  "publisher_no_campaigns": "No campaigns yet.",
  "creative_url_prompt": "Creative asset URL",
  "creative_url_required": "Creative URL required",
  "stats_impressions_suffix": "impressions",
  "stats_reach_suffix": "reach",
  "stats_clicks_suffix": "clicks",
  "video_attached_suffix": "video attached",
  "daily_cap_suffix": "daily cap",
  "publisher_dash_title": "Ad publisher",
  "publisher_dash_body": "Track campaign performance, click-through rate, cost per click, and creative status.",
  "publisher_dash_load_failed": "Failed to load dashboard",
  "publisher_stat_impressions": "Impressions",
  "publisher_stat_reach": "Unique reach",
  "publisher_stat_clicks": "Clicks",
  "publisher_stat_ctr": "CTR %",
  "publisher_stat_cpc": "CPC",
  "publisher_stat_completion": "Video completion %",
  "publisher_stat_source_note": "Live publisher metrics",
  "publisher_campaigns_heading": "Campaigns",
  "publisher_manage_campaigns": "Manage campaigns",
  "publisher_analytics_title": "Analytics",
  "publisher_analytics_body": "Live campaign performance. CPC uses impression unit cost from platform_settings.",
  "publisher_pricing_unavailable": "Ad pricing unavailable from server.",
  "publisher_invoice_action": "Download PDF invoice",
  "publisher_invoice_pending": "Downloading…",
  "publisher_invoice_failed": "Invoice download failed"
}'::jsonb,
updated_at = NOW()
WHERE key = 'ad_runtime_chrome';

UPDATE platform_settings
SET value = value || '{
  "creative_types": ["image", "video"],
  "default_creative_type": "image",
  "video_creative_type": "video"
}'::jsonb,
updated_at = NOW()
WHERE key = 'client_enums';
