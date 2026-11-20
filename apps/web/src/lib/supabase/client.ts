import { createBrowserClient } from "@supabase/ssr";

/** Browser Supabase client for Google OAuth. Message from env (aligned with auth_providers.login_missing_supabase_env). */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    const msg = (process.env.NEXT_PUBLIC_SUPABASE_ENV_MISSING || "").trim();
    throw new Error(msg);
  }
  return createBrowserClient(url, key);
}
