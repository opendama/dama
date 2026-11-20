-- Ad runtime: discrete detail/column labels (fail-closed; seed from existing keys where possible).
-- Admin console must not reuse ph_* / *_prompt / *_suffix / campaigns_title as field/column labels.

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'daily_spend_cap_label', COALESCE(
    NULLIF(trim(value->>'daily_spend_cap_label'), ''),
    NULLIF(trim(value->>'ph_daily_spend_cap'), ''),
    'Daily spend cap'
  ),
  'video_id_label', COALESCE(
    NULLIF(trim(value->>'video_id_label'), ''),
    'Video ID'
  ),
  'creative_url_label', COALESCE(
    NULLIF(trim(value->>'creative_url_label'), ''),
    NULLIF(trim(value->>'creative_url_prompt'), ''),
    'Creative URL'
  ),
  'col_title', COALESCE(
    NULLIF(trim(value->>'col_title'), ''),
    NULLIF(trim(value->>'ph_title'), ''),
    'Title'
  ),
  'created_at_label', COALESCE(
    NULLIF(trim(value->>'created_at_label'), ''),
    'Created'
  )
),
  updated_at = NOW()
WHERE key = 'ad_runtime_chrome';
