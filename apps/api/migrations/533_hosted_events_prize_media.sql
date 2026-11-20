-- Community hosted cups: Official-parity description + prize thumbnail + gallery.
-- Additive only. logo_url / sponsor_logo_url / brand_color / sponsor_name stay branding.
-- Free and paid cups share the same media columns; pot/escrow logic is unchanged.

ALTER TABLE hosted_events
  ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS prize_image_url TEXT,
  ADD COLUMN IF NOT EXISTS gallery JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Organizer Manage: description + EntityMediaEditor labels (mirror tournament_chrome / 346).
UPDATE platform_settings
SET value = value || jsonb_build_object(
  'description_label', COALESCE(NULLIF(trim(value->>'description_label'), ''), 'Description'),
  'description_placeholder', COALESCE(
    NULLIF(trim(value->>'description_placeholder'), ''),
    'Rules, rewards, and how winners receive prizes'
  ),
  'prize_media_section_title', COALESCE(
    NULLIF(trim(value->>'prize_media_section_title'), ''),
    'Reward images'
  ),
  'prize_media_section_blurb', COALESCE(
    NULLIF(trim(value->>'prize_media_section_blurb'), ''),
    'Show players what winners get. Branding logos stay separate below.'
  ),
  'thumbnail_label', COALESCE(NULLIF(trim(value->>'thumbnail_label'), ''), 'Prize image'),
  'gallery_label', COALESCE(NULLIF(trim(value->>'gallery_label'), ''), 'Gallery'),
  'gallery_add_action', COALESCE(NULLIF(trim(value->>'gallery_add_action'), ''), 'Add gallery image'),
  'gallery_empty', COALESCE(NULLIF(trim(value->>'gallery_empty'), ''), 'No gallery images yet'),
  'thumbnail_upload_action', COALESCE(
    NULLIF(trim(value->>'thumbnail_upload_action'), ''),
    'Upload prize image'
  ),
  'thumbnail_upload_pending', COALESCE(
    NULLIF(trim(value->>'thumbnail_upload_pending'), ''),
    'Uploading prize image'
  ),
  'gallery_upload_pending', COALESCE(
    NULLIF(trim(value->>'gallery_upload_pending'), ''),
    'Uploading gallery'
  ),
  'toast_thumbnail_saved', COALESCE(
    NULLIF(trim(value->>'toast_thumbnail_saved'), ''),
    'Prize image saved'
  ),
  'toast_gallery_saved', COALESCE(
    NULLIF(trim(value->>'toast_gallery_saved'), ''),
    'Gallery updated'
  ),
  'media_upload_failed', COALESCE(
    NULLIF(trim(value->>'media_upload_failed'), ''),
    'Media upload failed'
  ),
  'gallery_max_slots', COALESCE(NULLIF(trim(value->>'gallery_max_slots'), ''), '9'),
  'gallery_slots_fmt', COALESCE(NULLIF(trim(value->>'gallery_slots_fmt'), ''), '{count} / {max}'),
  'thumbnail_main_badge', COALESCE(NULLIF(trim(value->>'thumbnail_main_badge'), ''), 'Main Image'),
  'thumbnail_empty_hint', COALESCE(
    NULLIF(trim(value->>'thumbnail_empty_hint'), ''),
    'Upload main prize image'
  ),
  'thumbnail_hint', COALESCE(
    NULLIF(trim(value->>'thumbnail_hint'), ''),
    'Main image is what players see first on cards. Recommended: 800x800px square.'
  ),
  'gallery_limit_reached', COALESCE(
    NULLIF(trim(value->>'gallery_limit_reached'), ''),
    'Gallery limit reached'
  )
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome';

-- Player detail: description label (body text comes from hosted_events.description).
UPDATE platform_settings
SET value = value || jsonb_build_object(
  'detail_description_label', COALESCE(
    NULLIF(trim(value->>'detail_description_label'), ''),
    'About this cup'
  )
),
updated_at = NOW()
WHERE key = 'events_player_chrome';

-- Admin hosted-event detail: prize media labels (read-only display).
UPDATE platform_settings
SET value = value || jsonb_build_object(
  'detail_description_label', COALESCE(
    NULLIF(trim(value->>'detail_description_label'), ''),
    'Description'
  ),
  'detail_prize_image_label', COALESCE(
    NULLIF(trim(value->>'detail_prize_image_label'), ''),
    'Prize image'
  ),
  'detail_gallery_label', COALESCE(
    NULLIF(trim(value->>'detail_gallery_label'), ''),
    'Gallery'
  ),
  'gallery_empty', COALESCE(
    NULLIF(trim(value->>'gallery_empty'), ''),
    'No gallery images yet'
  )
),
updated_at = NOW()
WHERE key = 'events_admin_chrome';
