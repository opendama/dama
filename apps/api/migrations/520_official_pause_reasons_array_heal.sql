-- Heal official_pause_chrome.reasons when stored as a JSON string instead of array.
-- Fail-closed public chrome requires reasons to be a JSON array of {key,label}.
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{reasons}',
  CASE
    WHEN jsonb_typeof(value->'reasons') = 'array' THEN value->'reasons'
    WHEN jsonb_typeof(value->'reasons') = 'string'
      AND left(trim(value->>'reasons'), 1) = '['
      THEN (value->>'reasons')::jsonb
    ELSE value->'reasons'
  END
),
updated_at = NOW()
WHERE key = 'official_pause_chrome'
  AND jsonb_typeof(value->'reasons') = 'string';
