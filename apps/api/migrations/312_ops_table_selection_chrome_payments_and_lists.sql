-- Trim OpsDataTable selection chrome for payments + remaining list sections.
-- Fail-closed: labels must exist before checkboxes render.

UPDATE platform_settings
SET value = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        value,
        '{payments}',
        COALESCE(value->'payments', '{}'::jsonb) || jsonb_build_object(
          'select_all_label', COALESCE(NULLIF(trim(value->'payments'->>'select_all_label'), ''), 'Select all'),
          'select_row_label', COALESCE(NULLIF(trim(value->'payments'->>'select_row_label'), ''), 'Select row'),
          'selected_count_fmt', COALESCE(NULLIF(trim(value->'payments'->>'selected_count_fmt'), ''), '{count} selected'),
          'clear_selection_action', COALESCE(NULLIF(trim(value->'payments'->>'clear_selection_action'), ''), 'Clear selection')
        )
      ),
      '{tournaments}',
      COALESCE(value->'tournaments', '{}'::jsonb) || jsonb_build_object(
        'select_all_label', COALESCE(NULLIF(trim(value->'tournaments'->>'select_all_label'), ''), 'Select all'),
        'select_row_label', COALESCE(NULLIF(trim(value->'tournaments'->>'select_row_label'), ''), 'Select row'),
        'selected_count_fmt', COALESCE(NULLIF(trim(value->'tournaments'->>'selected_count_fmt'), ''), '{count} selected'),
        'clear_selection_action', COALESCE(NULLIF(trim(value->'tournaments'->>'clear_selection_action'), ''), 'Clear selection')
      )
    ),
    '{events}',
    COALESCE(value->'events', '{}'::jsonb) || jsonb_build_object(
      'select_all_label', COALESCE(NULLIF(trim(value->'events'->>'select_all_label'), ''), 'Select all'),
      'select_row_label', COALESCE(NULLIF(trim(value->'events'->>'select_row_label'), ''), 'Select row'),
      'selected_count_fmt', COALESCE(NULLIF(trim(value->'events'->>'selected_count_fmt'), ''), '{count} selected'),
      'clear_selection_action', COALESCE(NULLIF(trim(value->'events'->>'clear_selection_action'), ''), 'Clear selection')
    )
  ),
  '{progression}',
  COALESCE(value->'progression', '{}'::jsonb) || jsonb_build_object(
    'select_all_label', COALESCE(NULLIF(trim(value->'progression'->>'select_all_label'), ''), 'Select all'),
    'select_row_label', COALESCE(NULLIF(trim(value->'progression'->>'select_row_label'), ''), 'Select row'),
    'selected_count_fmt', COALESCE(NULLIF(trim(value->'progression'->>'selected_count_fmt'), ''), '{count} selected'),
    'clear_selection_action', COALESCE(NULLIF(trim(value->'progression'->>'clear_selection_action'), ''), 'Clear selection')
  )
),
  updated_at = NOW()
WHERE key = 'admin_console_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  jsonb_set(
    jsonb_set(
      value,
      '{telemetry}',
      COALESCE(value->'telemetry', '{}'::jsonb) || jsonb_build_object(
        'select_all_label', COALESCE(NULLIF(trim(value->'telemetry'->>'select_all_label'), ''), 'Select all'),
        'select_row_label', COALESCE(NULLIF(trim(value->'telemetry'->>'select_row_label'), ''), 'Select row'),
        'selected_count_fmt', COALESCE(NULLIF(trim(value->'telemetry'->>'selected_count_fmt'), ''), '{count} selected'),
        'clear_selection_action', COALESCE(NULLIF(trim(value->'telemetry'->>'clear_selection_action'), ''), 'Clear selection'),
        'search_label', COALESCE(NULLIF(trim(value->'telemetry'->>'search_label'), ''), 'Search'),
        'search_placeholder', COALESCE(NULLIF(trim(value->'telemetry'->>'search_placeholder'), ''), 'Search…')
      )
    ),
    '{rbac}',
    COALESCE(value->'rbac', '{}'::jsonb) || jsonb_build_object(
      'select_all_label', COALESCE(NULLIF(trim(value->'rbac'->>'select_all_label'), ''), 'Select all'),
      'select_row_label', COALESCE(NULLIF(trim(value->'rbac'->>'select_row_label'), ''), 'Select row'),
      'selected_count_fmt', COALESCE(NULLIF(trim(value->'rbac'->>'selected_count_fmt'), ''), '{count} selected'),
      'clear_selection_action', COALESCE(NULLIF(trim(value->'rbac'->>'clear_selection_action'), ''), 'Clear selection')
    )
  ),
  '{ads}',
  COALESCE(value->'ads', '{}'::jsonb) || jsonb_build_object(
    'select_all_label', COALESCE(NULLIF(trim(value->'ads'->>'select_all_label'), ''), 'Select all'),
    'select_row_label', COALESCE(NULLIF(trim(value->'ads'->>'select_row_label'), ''), 'Select row'),
    'selected_count_fmt', COALESCE(NULLIF(trim(value->'ads'->>'selected_count_fmt'), ''), '{count} selected'),
    'clear_selection_action', COALESCE(NULLIF(trim(value->'ads'->>'clear_selection_action'), ''), 'Clear selection')
  )
),
  updated_at = NOW()
WHERE key = 'admin_console_chrome';
