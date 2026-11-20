import { playMessageDeliveredSound } from "@/lib/audio-notify";

/** Extract sender user id from a WS chat payload (game / DM). */
export function chatMessageSenderId(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const msg = (payload as { message?: unknown }).message;
  if (!msg || typeof msg !== "object") return "";
  const uid = (msg as { user_id?: unknown }).user_id;
  return typeof uid === "string" ? uid.trim() : "";
}

/**
 * Recipient-only delivery chime. Skips when the sender is the current user
 * (own outbound echoes on the same WS).
 */
export function notifyIncomingChatMessage(opts: {
  myUserId: string | null | undefined;
  payload: unknown;
}): void {
  const mine = (opts.myUserId || "").trim();
  const from = chatMessageSenderId(opts.payload);
  if (!from || (mine && from === mine)) return;
  void playMessageDeliveredSound();
}
