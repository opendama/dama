-- Separate Users console page chrome from the RBAC module title,
-- and add contact-section label for smart-menu-style identity modals.
-- Fail-closed: only fills empty / legacy combined titles; never invents API fields.

UPDATE platform_settings
SET value = jsonb_set(
  jsonb_set(
    jsonb_set(
      value,
      '{users,page_title}',
      to_jsonb(
        CASE
          WHEN NULLIF(trim(value->'users'->>'page_title'), '') IS NULL
            OR lower(trim(value->'users'->>'page_title')) IN ('users & rbac', 'users and rbac')
          THEN 'Users'
          ELSE trim(value->'users'->>'page_title')
        END
      )
    ),
    '{users,page_blurb}',
    to_jsonb(
      CASE
        WHEN NULLIF(trim(value->'users'->>'page_blurb'), '') IS NULL
          OR value->'users'->>'page_blurb' ILIKE '%Roles load from the live user store%'
        THEN 'Search, inspect, and manage player accounts. Role and status changes write through the console API.'
        ELSE trim(value->'users'->>'page_blurb')
      END
    )
  ),
  '{users,contact_section_label}',
  to_jsonb(
    COALESCE(
      NULLIF(trim(value->'users'->>'contact_section_label'), ''),
      'Contact'
    )
  )
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';
