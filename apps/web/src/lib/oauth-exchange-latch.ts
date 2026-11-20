/**
 * Survives React Strict Mode remount (component refs reset; module state does not).
 * Prevents repeated POST /auth/oauth/supabase → 429 loops.
 * Reset when the user explicitly starts a new OAuth attempt from login.
 */
let claimed = false;

export function claimWebOAuthExchange(): boolean {
  if (claimed) return false;
  claimed = true;
  return true;
}

export function resetWebOAuthExchangeClaim(): void {
  claimed = false;
}
