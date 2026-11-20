-- At most one pending DM request between a user pair (friend-request parity).

CREATE UNIQUE INDEX IF NOT EXISTS idx_dm_requests_one_pending_pair
  ON dm_requests (
    LEAST(from_user_id, to_user_id),
    GREATEST(from_user_id, to_user_id)
  )
  WHERE status = 'pending';
