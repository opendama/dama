import type { EventsCatalog } from "@/types/events";
import { isAxiosError } from "axios";

/**
 * Hosted cups gate: catalog returns `hosted_events_enabled: false` on success, or
 * HTTP 503 from `requireEventsEnabled` when the feature flag is off.
 * Missing key / other errors → not gated (legacy / keep Community).
 */
export function catalogHostedFeatureOff(data: EventsCatalog | undefined, error: unknown): boolean {
  if (data?.hosted_events_enabled === false) return true;
  return isAxiosError(error) && error.response?.status === 503;
}
