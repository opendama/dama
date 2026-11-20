-- Complete progression form body chrome (fail closed; no client invent).

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{progression}',
  COALESCE(value->'progression', '{}'::jsonb) || '{
    "xp_levels_label": "XP levels (JSON array of min_xp + label)",
    "match_clock_enabled_label": "Match clock enabled",
    "initial_seconds_label": "Initial seconds",
    "increment_seconds_label": "Increment seconds (per move)",
    "unit_cost_label": "Ad impression unit cost (publisher CPC / daily spend caps)",
    "save_platform_action": "Save platform settings",
    "board_section_title": "FMJD board rules",
    "board_unavailable": "Board rules unavailable from database.",
    "board_size_label": "Board size",
    "pieces_per_side_label": "Pieces per side",
    "setup_rows_label": "Setup rows",
    "variant_label": "Variant",
    "save_board_action": "Save board rules",
    "err_unit_cost": "impression_unit_cost must be > 0 from platform_settings",
    "err_clock_values": "match clock values must load from platform_settings first",
    "toast_save_failed": "Save failed"
  }'::jsonb,
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';
