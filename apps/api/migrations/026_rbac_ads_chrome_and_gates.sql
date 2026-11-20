-- Console RBAC chrome + player in-match ad chrome (no client invent).
-- Extend ad_runtime_chrome labels used by admin campaign editors.

INSERT INTO platform_settings (key, value, updated_at) VALUES
(
  'rbac_chrome',
  '{
    "page_title": "RBAC",
    "page_body": "Roles catalog and permission grants live in the database. No client invents access.",
    "catalog_title": "Role catalog",
    "roles_label": "Roles (one per line)",
    "console_roles_label": "Console roles (one per line)",
    "publisher_roles_label": "Publisher roles (one per line)",
    "default_role_label": "Default role",
    "save_catalog_action": "Save role catalog",
    "permissions_title": "Permission catalog",
    "perm_key_label": "Key",
    "perm_title_label": "Title",
    "perm_description_label": "Description",
    "upsert_permission_action": "Upsert permission",
    "delete_permission_action": "Delete",
    "grants_title": "Role grants",
    "role_label": "Role",
    "save_grants_action": "Save role permissions",
    "lacks_manage": "Your role lacks rbac.manage. Ask a superadmin to grant it.",
    "load_failed": "Failed to load RBAC snapshot.",
    "unavailable": "RBAC chrome unavailable"
  }'::jsonb,
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = platform_settings.value || EXCLUDED.value,
  updated_at = NOW();

INSERT INTO platform_settings (key, value, updated_at) VALUES
(
  'ad_player_chrome',
  '{
    "sponsored_label": "Sponsored",
    "skip_in_template": "Skip in {seconds}s",
    "can_continue_label": "You can continue",
    "continue_action": "Continue",
    "unavailable": "In-match ad chrome unavailable"
  }'::jsonb,
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = platform_settings.value || EXCLUDED.value,
  updated_at = NOW();

UPDATE platform_settings
SET value = value || '{
  "page_body": "Global non-skippable window, first in-match show delay, repeat interval, and per-campaign day/week/month/year impression caps. All values are database-backed.",
  "status_label": "Status",
  "update_status_action": "Update status",
  "platform_default_placeholder": "Uses platform default when empty",
  "unlimited_cap_placeholder": "Unlimited when empty",
  "campaigns_title": "Campaign schedules",
  "no_campaigns": "No campaigns yet.",
  "load_campaigns_failed": "Failed to load campaigns.",
  "lacks_permissions": "Your role lacks ads.manage_runtime / ads.manage_campaigns."
}'::jsonb,
updated_at = NOW()
WHERE key = 'ad_runtime_chrome';
