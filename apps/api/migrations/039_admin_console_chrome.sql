-- Remaining admin console page chrome (fail closed; no client invent).

INSERT INTO platform_settings (key, value, updated_at)
VALUES (
  'admin_console_chrome',
  '{
    "source": "database",
    "admin_console_chrome_unavailable": "Admin console chrome unavailable",
    "banks": {
      "page_title": "Payment accounts",
      "page_blurb": "Database-backed CBE / Telebirr details shown during manual transfer checkout.",
      "provider_placeholder": "Provider (e.g. CBE, Telebirr)",
      "label_placeholder": "Label",
      "account_placeholder": "Account number",
      "mobile_placeholder": "Mobile code",
      "add_action": "Add account",
      "active_label": "Active",
      "inactive_label": "Inactive",
      "toast_added": "Bank account added",
      "toast_updated": "Updated"
    },
    "payments": {
      "page_title": "Payments",
      "page_blurb": "Currency matrix is database-backed. Clients resolve display currency from geo against this matrix. Review manual transfer receipts below.",
      "currency_section_title": "Currency matrix",
      "currency_load_failed": "Failed to load currency settings.",
      "global_label": "Global (non-Ethiopia)",
      "ethiopia_label": "Ethiopia",
      "supported_label": "Supported (comma-separated)",
      "save_currency_action": "Save currency matrix",
      "receipts_section_title": "Pending receipts",
      "no_receipts": "No pending receipts.",
      "user_prefix": "User:",
      "ref_prefix": "Ref:",
      "view_receipt_action": "View receipt",
      "approve_action": "Approve",
      "reject_action": "Reject",
      "toast_currency_saved": "Currency matrix saved",
      "toast_receipt_reviewed": "Receipt reviewed"
    },
    "media_pool": {
      "page_title": "Media pool",
      "page_blurb": "Multi-channel YouTube OAuth vault with daily quota failover. Secrets are AES-encrypted in PostgreSQL and never returned to the client after save.",
      "register_title": "Register channel",
      "channel_id_label": "Channel ID",
      "label_label": "Label",
      "client_id_label": "OAuth2 Client ID",
      "client_secret_label": "OAuth2 Client Secret",
      "refresh_token_label": "OAuth2 Refresh Token",
      "api_key_label": "Google API Key",
      "quota_label": "Daily upload quota",
      "quota_placeholder": "From channel capacity plan",
      "add_channel_action": "Add channel",
      "quota_invalid": "Daily upload quota must be a positive number from admin config",
      "test_upload_title": "Test failover upload",
      "upload_title_placeholder": "Ad creative title",
      "upload_title_required": "Upload title required",
      "run_upload_action": "Run upload through pool",
      "active_pool_title": "Active pool",
      "no_channels": "No channels yet.",
      "active_status": "active",
      "inactive_status": "inactive",
      "test_readiness_action": "Test readiness",
      "remove_from_pool_action": "Remove from pool",
      "restore_to_pool_action": "Restore to pool",
      "toast_registered": "Channel registered (credentials encrypted at rest)",
      "toast_status_updated": "Channel status updated",
      "toast_channel_ready": "Channel ready for upload"
    },
    "feature_flags": {
      "page_title": "Feature flags",
      "page_blurb": "Database-backed runtime switches. Player clients receive only the public flag subset.",
      "load_failed": "Failed to load flags catalog.",
      "depths_invalid": "Enter integer AI depths between 1 and 20",
      "flags_not_loaded": "Feature flags not loaded from server yet",
      "current_prefix": "Current:",
      "unavailable": "unavailable",
      "toast_updated": "Feature flag updated",
      "ai_depths_title": "VS-AI search depths",
      "ai_depths_blurb": "Database-backed Minimax depths. Values load from the live flag payload.",
      "save_depths_action": "Save AI depths",
      "toggle_on": "On",
      "toggle_off": "Off"
    },
    "avatars": {
      "page_title": "Avatar moderation",
      "page_blurb": "Review, flag, or reset player avatars. Pipeline rules are database-backed.",
      "rules_title": "Automated moderation rules",
      "config_unavailable": "Moderation config unavailable from database.",
      "provider_prefix": "Current provider:",
      "enabled_suffix": "(enabled)",
      "disabled_suffix": "(disabled)",
      "auto_review_action": "Auto review on",
      "manual_review_action": "Manual review only",
      "no_pending": "No pending avatars.",
      "approve_action": "Approve",
      "flag_action": "Flag",
      "reset_action": "Reset",
      "toast_moderation_saved": "Moderation settings saved",
      "toast_avatar_updated": "Avatar moderation updated"
    },
    "telemetry": {
      "page_title": "Player telemetry",
      "page_title_short": "Telemetry",
      "page_blurb": "Fingerprints, Geo-IP records, and audit vault rows load from the live store only.",
      "fingerprints_title": "Device fingerprints",
      "no_fingerprints": "No fingerprints yet.",
      "geo_title": "Geo-IP records",
      "no_geo": "No geo-ip rows yet.",
      "audit_title": "Audit vault",
      "no_audit": "No audit rows yet."
    },
    "users": {
      "page_title": "Users & RBAC",
      "page_blurb": "Roles load from the live user store. Changes write through the console API.",
      "rating_prefix": "Rating",
      "xp_prefix": "XP",
      "active_label": "active",
      "disabled_label": "disabled",
      "deactivate_action": "Deactivate",
      "activate_action": "Activate",
      "toast_role_updated": "Role updated"
    },
    "dashboard": {
      "page_title": "Control console",
      "page_blurb": "Absolute CRUD control. Every toggle is database-backed and served to clients live.",
      "nav_unavailable": "Console navigation unavailable from database."
    },
    "progression": {
      "page_title": "Progression & board",
      "page_blurb": "XP ladder, match clock, ad pricing unit, and FMJD board rules are database-backed.",
      "load_failed": "Failed to load platform settings.",
      "toast_progression_saved": "Platform settings saved",
      "toast_board_saved": "Board rules saved",
      "board_fields_required": "board_rules fields required from database form"
    }
  }'::jsonb,
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = platform_settings.value || EXCLUDED.value,
  updated_at = NOW();
