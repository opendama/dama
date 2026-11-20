import { isApiClientError } from "@/lib/api-client-error";
import {
  softCommunityJoinStatusMessage,
  softCommunityLoadFailed,
} from "@/lib/community-player-chrome-soft";

function chromeOnly(raw: string | undefined): string {
  const s = (raw || "").trim();
  if (!s) return "";
  if (s.startsWith("{") || s.startsWith("[")) return "";
  return s;
}

/** Map API error_key → player cup-lobby chrome string (api.ts is key-only). */
export function cupLobbyPlayerErrMsg(
  chrome: object | null | undefined,
  err: unknown,
  fallbackKey = "load_failed",
): string {
  if (!chrome) return "";
  const bag = chrome as Record<string, string | undefined>;
  const key = isApiClientError(err) ? (err.errorKey || "").trim() : "";
  if (key) {
    const mapped = chromeOnly(bag[key]);
    if (mapped) {
      return (
        softCommunityJoinStatusMessage(mapped) ||
        softCommunityLoadFailed(chromeOnly(bag[fallbackKey]))
      );
    }
  }
  // Unmapped / legacy transport message - Event-sport fail-open (join-error parity).
  const apiMsg = isApiClientError(err) ? chromeOnly(err.message) : "";
  if (apiMsg) {
    const scrubbed = softCommunityJoinStatusMessage(apiMsg);
    if (scrubbed) return scrubbed;
  }
  return softCommunityLoadFailed(chromeOnly(bag[fallbackKey]));
}
