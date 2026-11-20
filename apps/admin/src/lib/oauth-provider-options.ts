import type { AuthProvidersResponse } from "@/types/auth-providers";

export type OAuthProviderOptions = {
  redirectTo: string;
  scopes?: string;
  queryParams?: Record<string, string>;
};

function chromeStr(chrome: unknown, key: string): string {
  if (!chrome || typeof chrome !== "object") return "";
  const v = (chrome as Record<string, unknown>)[key];
  return typeof v === "string" ? v.trim() : "";
}

/** Backend-owned OAuth scopes / query params. Fail closed when chrome is empty. */
export function buildOAuthProviderOptions(
  provider: string,
  chrome: AuthProvidersResponse | undefined,
  redirectTo: string,
  missingMessage: string,
): OAuthProviderOptions {
  const id = provider.trim().toLowerCase();
  if (!id) {
    throw new Error(missingMessage);
  }
  const options: OAuthProviderOptions = { redirectTo };
  const accessType = chromeStr(chrome, `${id}_oauth_access_type`);
  const prompt = chromeStr(chrome, `${id}_oauth_prompt`);
  const scopes = chromeStr(chrome, `${id}_oauth_scopes`);
  const paramsMissing = chromeStr(chrome, `${id}_oauth_params_missing`) || missingMessage;
  const scopesMissing = chromeStr(chrome, `${id}_oauth_scopes_missing`) || missingMessage;

  if (accessType || prompt) {
    if (!accessType || !prompt) {
      throw new Error(paramsMissing);
    }
    options.queryParams = { access_type: accessType, prompt };
    return options;
  }
  if (scopes) {
    options.scopes = scopes;
    return options;
  }
  throw new Error(scopesMissing);
}
