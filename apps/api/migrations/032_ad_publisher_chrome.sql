-- Publisher campaigns page + schedule toasts (DB chrome; no client invent).

UPDATE platform_settings
SET value = value || '{
  "publisher_page_title": "Campaigns",
  "publisher_page_body": "Create campaigns, set spend caps, schedule in-match delivery, and manage creative status.",
  "toast_campaign_created": "Campaign created",
  "toast_campaign_status_updated": "Status updated",
  "toast_creative_replaced": "Creative replaced",
  "toast_video_attached": "Video creative attached",
  "video_upload_job_title": "Campaign video"
}'::jsonb,
updated_at = NOW()
WHERE key = 'ad_runtime_chrome';
