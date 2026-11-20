-- Mig 400: Refund Policy tournament entry section - Tournament wording (not Event sport).
-- Players read /refunds; "the event has started" under Tournament entry fees confuses Event ≠ Tournament.
-- Idempotent. Privacy "serve events" telemetry phrasing unchanged. Backend tables unmerged.

UPDATE site_legal_sections
SET body = replace(body, 'the event has started', 'the tournament has started')
WHERE doc_kind = 'refunds'
  AND sort_order = 30
  AND body ILIKE '%the event has started%';
