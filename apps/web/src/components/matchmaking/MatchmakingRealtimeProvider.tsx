"use client";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useMatchmakingChromeQuery } from "@/hooks/query/useMatchmakingChromeQuery";
import { meQueryKey } from "@/hooks/query/useMeQuery";
import { usePlayRailChromeQuery } from "@/hooks/query/usePlayRailChromeQuery";
import { useProgressionQuery } from "@/hooks/query/useProgressionQuery";
import { playGameNotify } from "@/lib/audio-notify";
import { patchAvatarEverywhere } from "@/lib/avatar-cache-patch";
import { notifyIncomingChatMessage } from "@/lib/chat-message-notify";
import { apiRestUrl, apiWsUrl } from "@/lib/env";
import { invalidateAvatarSurfaces, invalidateFeatureFlags } from "@/lib/invalidate";
import {
  playInviteResolvedChime,
  playInviteSentAlert,
  startInviteAlert,
  stopInviteAlert,
} from "@/lib/invite-alert";
import { useAuthStore } from "@/store/auth";
import { isMatchmakingChromeReady } from "@/types/matchmaking-chrome";
import { isPlayRailChromeReady } from "@/types/play-rail-chrome";
import type { MatchInviteIncoming, MatchmakingWsMessage, MeProfile } from "@/types/player";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

/** Build accept-dialog meta from WS invite + DB chrome/presets (no client invent). */
function formatIncomingInviteDescription(
  chrome: { invite_from_prefix: string; meta_separator: string; toast_invite_received: string },
  rail:
    | {
        label_rated: string;
        label_unrated: string;
        aria_color_white: string;
        aria_color_black: string;
        aria_color_random: string;
      }
    | undefined,
  invite: MatchInviteIncoming | null | undefined,
  tcLabel: string,
): string {
  if (!invite) return chrome.toast_invite_received;
  const from = (invite.from_username || "").trim();
  // Fail-closed: never invent truncated invite ids when username is missing.
  const parts: string[] = [
    from ? `${chrome.invite_from_prefix} ${from}`.trim() : chrome.toast_invite_received,
  ];
  const trust = (invite.from_host_trust_badge || "").trim();
  if (trust) parts.push(trust);
  if (rail) {
    if (invite.rated === true) parts.push(rail.label_rated);
    else if (invite.rated === false) parts.push(rail.label_unrated);
    const color = (invite.preferred_color || "").trim();
    if (color === "white") parts.push(rail.aria_color_white);
    else if (color === "black") parts.push(rail.aria_color_black);
    else if (color === "random") parts.push(rail.aria_color_random);
  }
  if (tcLabel) parts.push(tcLabel);
  return parts.filter(Boolean).join(chrome.meta_separator) || chrome.toast_invite_received;
}

type MatchFoundPayload = {
  gameId: string;
  player1Id?: string;
  player2Id?: string;
};

type OutgoingInvite = {
  id: string;
  toUsername?: string;
};

type MatchmakingRealtimeValue = {
  connected: boolean;
  queueSize: number | null;
  incoming: MatchInviteIncoming | null;
  outgoing: OutgoingInvite | null;
  lastMatch: MatchFoundPayload | null;
  inviteActionPending: "accept" | "decline" | "cancel" | null;
  send: (payload: Record<string, unknown>) => boolean;
  clearIncoming: () => void;
  acceptIncoming: () => void;
  declineIncoming: () => void;
  dismissOutgoing: () => void;
  cancelOutgoing: () => void;
  /** Open outgoing wait UI from REST create response (WS invite_sent is confirmation). */
  noteOutgoing: (invite: OutgoingInvite) => void;
};

const MatchmakingRealtimeContext = createContext<MatchmakingRealtimeValue | null>(null);

export function useMatchmakingRealtime(): MatchmakingRealtimeValue {
  const ctx = useContext(MatchmakingRealtimeContext);
  if (!ctx) {
    throw new Error("useMatchmakingRealtime requires MatchmakingRealtimeProvider");
  }
  return ctx;
}

export function useOptionalMatchmakingRealtime(): MatchmakingRealtimeValue | null {
  return useContext(MatchmakingRealtimeContext);
}

/** Single matchmaking WS for invites (global) + queue events (smart-menu GuestGameChallenge parity). */
export function MatchmakingRealtimeProvider({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  const router = useRouter();
  const chromeQuery = useMatchmakingChromeQuery(Boolean(token));
  const chrome = isMatchmakingChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  const railChromeQuery = usePlayRailChromeQuery(Boolean(token));
  const railChrome = isPlayRailChromeReady(railChromeQuery.data) ? railChromeQuery.data : undefined;
  const progressionQuery = useProgressionQuery();
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [queueSize, setQueueSize] = useState<number | null>(null);
  const [incoming, setIncoming] = useState<MatchInviteIncoming | null>(null);
  const [outgoing, setOutgoing] = useState<OutgoingInvite | null>(null);
  const [outgoingDismissed, setOutgoingDismissed] = useState(false);
  const [inviteActionPending, setInviteActionPending] = useState<
    "accept" | "decline" | "cancel" | null
  >(null);
  const [lastMatch, setLastMatch] = useState<MatchFoundPayload | null>(null);
  /** Sync latch - React state alone can double-fire before re-render. */
  const inviteActionLatchRef = useRef<string | null>(null);
  const enterAcceptedMatchRef = useRef<(gameId: string) => void>(() => undefined);
  const navigatingMatchRef = useRef(false);

  const clearIncoming = useCallback(() => {
    setIncoming(null);
    stopInviteAlert();
  }, []);

  const clearOutgoing = useCallback(() => {
    setOutgoing(null);
    setOutgoingDismissed(false);
  }, []);

  const send = useCallback((payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(payload));
    return true;
  }, []);

  const acceptIncoming = useCallback(() => {
    const id = incoming?.id;
    if (!id) return;
    if (inviteActionLatchRef.current === id || inviteActionPending) return;
    inviteActionLatchRef.current = id;
    setInviteActionPending("accept");
    // Keep dialog until invite_accepted / error - do not clear on send alone.
    if (!send({ type: "invite_accept", invite_id: id })) {
      inviteActionLatchRef.current = null;
      setInviteActionPending(null);
      if (chrome?.toast_live_required) toast.error(chrome.toast_live_required);
    }
  }, [chrome?.toast_live_required, incoming?.id, inviteActionPending, send]);

  const declineIncoming = useCallback(() => {
    const id = incoming?.id;
    if (!id) return;
    if (inviteActionLatchRef.current === `decline:${id}` || inviteActionPending) return;
    inviteActionLatchRef.current = `decline:${id}`;
    setInviteActionPending("decline");
    playInviteResolvedChime();
    // Keep dialog until invite_declined / error - do not clear on send alone.
    if (!send({ type: "invite_decline", invite_id: id })) {
      inviteActionLatchRef.current = null;
      setInviteActionPending(null);
      if (chrome?.toast_live_required) toast.error(chrome.toast_live_required);
    }
  }, [chrome?.toast_live_required, incoming?.id, inviteActionPending, send]);

  const dismissOutgoing = useCallback(() => {
    setOutgoingDismissed(true);
  }, []);

  const noteOutgoing = useCallback((invite: OutgoingInvite) => {
    if (!invite?.id) return;
    setOutgoing((prev) => {
      if (prev?.id !== invite.id) playInviteSentAlert();
      return invite;
    });
    setOutgoingDismissed(false);
  }, []);

  const enterAcceptedMatch = useCallback(
    (gameId: string) => {
      const gid = gameId.trim();
      if (!gid || navigatingMatchRef.current) return;
      navigatingMatchRef.current = true;
      playInviteResolvedChime();
      void playGameNotify("match_found");
      inviteActionLatchRef.current = null;
      setInviteActionPending(null);
      clearIncoming();
      clearOutgoing();
      if (chrome?.toast_invite_accepted) toast.success(chrome.toast_invite_accepted);
      window.setTimeout(() => {
        router.push(`/?gameId=${gid}&mode=pvp`);
        navigatingMatchRef.current = false;
      }, 500);
    },
    [chrome?.toast_invite_accepted, clearIncoming, clearOutgoing, router],
  );
  enterAcceptedMatchRef.current = enterAcceptedMatch;

  /** While waiting on an outgoing invite (incl. open challenge link), poll status
   *  so the challenger still enters the match if invite_accepted WS is missed. */
  useEffect(() => {
    const id = (outgoing?.id || "").trim();
    if (!token || !id) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`${apiRestUrl()}/invites/${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as {
          invite?: { status?: string; game_id?: string; from_user_id?: string };
        };
        const inv = body.invite;
        const status = (inv?.status || "").trim();
        const gid = (inv?.game_id || "").trim();
        if (status === "accepted" && gid) {
          enterAcceptedMatchRef.current(gid);
        }
      } catch {
        /* ignore transient */
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [outgoing?.id, token]);

  const cancelOutgoing = useCallback(() => {
    const id = outgoing?.id;
    if (!id) return;
    if (inviteActionLatchRef.current === `cancel:${id}` || inviteActionPending) return;
    inviteActionLatchRef.current = `cancel:${id}`;
    setInviteActionPending("cancel");
    // Keep outgoing until invite_cancelled / error - do not clear on send alone.
    if (!send({ type: "invite_cancel", invite_id: id })) {
      inviteActionLatchRef.current = null;
      setInviteActionPending(null);
      if (chrome?.toast_live_required) toast.error(chrome.toast_live_required);
    }
  }, [chrome?.toast_live_required, inviteActionPending, outgoing?.id, send]);

  useEffect(() => {
    void incoming?.id;
    void outgoing?.id;
    inviteActionLatchRef.current = null;
  }, [incoming?.id, outgoing?.id]);

  useEffect(() => {
    if (!token) {
      stopInviteAlert();
      inviteActionLatchRef.current = null;
      setConnected(false);
      setIncoming(null);
      setOutgoing(null);
      setOutgoingDismissed(false);
      setQueueSize(null);
      setLastMatch(null);
      return;
    }
    const base = apiWsUrl();
    const url = `${base.replace(/\/$/, "").replace(/\/game$/, "")}/matchmaking?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => {
      setConnected(true);
      // Reconcile outgoing wait after refresh / reconnect (open link + targeted).
      void (async () => {
        try {
          const res = await fetch(`${apiRestUrl()}/invites/pending`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return;
          const body = (await res.json()) as {
            invites?: Array<{
              id?: string;
              from_user_id?: string;
              to_user_id?: string;
              status?: string;
            }>;
          };
          const me = useAuthStore.getState().user?.id || "";
          const mine = (body.invites || []).find(
            (inv) =>
              (inv.status || "").trim() === "pending" &&
              (inv.from_user_id || "").trim() === me &&
              Boolean((inv.id || "").trim()),
          );
          const mineId = (mine?.id || "").trim();
          if (mineId) {
            setOutgoing((prev) => prev ?? { id: mineId });
            setOutgoingDismissed(false);
          }
        } catch {
          /* ignore */
        }
      })();
    };
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as MatchmakingWsMessage;
        if (msg.type === "feature_flags") {
          void invalidateFeatureFlags(qc);
          return;
        }
        if (msg.type === "avatar_updated") {
          const uid = typeof msg.user_id === "string" ? msg.user_id.trim() : "";
          const thumbRaw = msg.avatar_thumb_url;
          const fullRaw = msg.avatar_full_url;
          const thumb =
            typeof thumbRaw === "string" ? thumbRaw.trim() : thumbRaw === null ? "" : undefined;
          const full =
            typeof fullRaw === "string" ? fullRaw.trim() : fullRaw === null ? "" : undefined;
          if (uid && (thumb !== undefined || full !== undefined)) {
            const nextThumb = thumb ?? "";
            const nextFull = full ?? "";
            const selfId = useAuthStore.getState().user?.id;
            const sessionToken = useAuthStore.getState().token;
            if (selfId && uid === selfId && sessionToken) {
              const cur = useAuthStore.getState().user;
              if (cur) {
                useAuthStore.getState().setSession(sessionToken, {
                  ...cur,
                  avatarThumbUrl: nextThumb || null,
                  avatarFullUrl: nextFull || null,
                });
              }
              qc.setQueryData(meQueryKey(sessionToken), (prev: MeProfile | null | undefined) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  avatarThumbUrl: nextThumb || null,
                  avatarFullUrl: nextFull || null,
                };
              });
            }
            patchAvatarEverywhere(qc, uid, nextThumb || null, nextFull || null);
          }
          void invalidateAvatarSurfaces(qc, uid || null);
          return;
        }
        if (
          msg.type === "dm_request" ||
          msg.type === "dm_message" ||
          msg.type === "dm_request_updated" ||
          msg.type === "dm_reaction" ||
          msg.type === "dm_read"
        ) {
          if (msg.type === "dm_message") {
            notifyIncomingChatMessage({
              myUserId: useAuthStore.getState().user?.id,
              payload: msg,
            });
          }
          void qc.invalidateQueries({ queryKey: ["dms"] });
          return;
        }
        if (msg.type === "match_found" && msg.game_id) {
          void playGameNotify("match_found");
          clearOutgoing();
          setLastMatch({
            gameId: msg.game_id,
            player1Id: msg.player1_id,
            player2Id: msg.player2_id,
          });
          if (chrome?.toast_match_found) toast.success(chrome.toast_match_found);
          window.setTimeout(() => {
            router.push(`/?gameId=${msg.game_id}&mode=pvp`);
          }, 900);
          return;
        }
        if (msg.type === "invite_received" && msg.invite?.id) {
          setIncoming(msg.invite);
          startInviteAlert();
          if (chrome) {
            toast.message(
              msg.invite.from_username
                ? `${chrome.invite_from_prefix} ${msg.invite.from_username}`
                : chrome.toast_invite_received,
            );
          }
          return;
        }
        if (msg.type === "invite_sent" && typeof msg.invite_id === "string") {
          setOutgoing((prev) => {
            const next = {
              id: msg.invite_id as string,
              toUsername: typeof msg.to_username === "string" ? msg.to_username : undefined,
            };
            if (prev?.id !== next.id) playInviteSentAlert();
            return next;
          });
          setOutgoingDismissed(false);
          return;
        }
        if (msg.type === "invite_accepted" && msg.game_id) {
          enterAcceptedMatchRef.current(String(msg.game_id));
          return;
        }
        if (msg.type === "invite_declined") {
          playInviteResolvedChime();
          inviteActionLatchRef.current = null;
          setInviteActionPending(null);
          clearIncoming(); // actor who declined
          clearOutgoing(); // inviter notified
          if (chrome?.toast_invite_declined) toast.message(chrome.toast_invite_declined);
          return;
        }
        if (msg.type === "invite_cancelled") {
          inviteActionLatchRef.current = null;
          setInviteActionPending(null);
          clearOutgoing(); // actor who cancelled
          clearIncoming(); // invitee notified
          stopInviteAlert();
          if (chrome?.toast_invite_cancelled) toast.message(chrome.toast_invite_cancelled);
          return;
        }
        if (msg.type === "error") {
          const err = typeof msg.error === "string" ? msg.error.trim() : "";
          inviteActionLatchRef.current = null;
          setInviteActionPending(null);
          if (err) toast.error(err);
          return;
        }
        if (
          msg.type === "queue_joined" ||
          msg.type === "queue_left" ||
          msg.type === "queue_updated"
        ) {
          if (typeof msg.size === "number") setQueueSize(msg.size);
        }
      } catch {
        /* ignore */
      }
    };
    return () => {
      stopInviteAlert();
      ws.close();
      wsRef.current = null;
      setConnected(false);
    };
  }, [token, chrome, qc, router, clearIncoming, clearOutgoing]);

  const value = useMemo(
    () => ({
      connected,
      queueSize,
      incoming,
      outgoing,
      lastMatch,
      inviteActionPending,
      send,
      clearIncoming,
      acceptIncoming,
      declineIncoming,
      dismissOutgoing,
      cancelOutgoing,
      noteOutgoing,
    }),
    [
      connected,
      queueSize,
      incoming,
      outgoing,
      lastMatch,
      inviteActionPending,
      send,
      clearIncoming,
      acceptIncoming,
      declineIncoming,
      dismissOutgoing,
      cancelOutgoing,
      noteOutgoing,
    ],
  );

  const inviteTcLabel = useMemo(() => {
    const sec = incoming?.time_control_seconds;
    if (!(typeof sec === "number" && sec > 0)) return "";
    const presets = progressionQuery.data?.match_clock?.presets;
    if (!Array.isArray(presets)) return "";
    const hit = presets.find(
      (p) =>
        typeof p?.seconds === "number" &&
        p.seconds === sec &&
        typeof p?.label === "string" &&
        p.label.trim().length > 0,
    );
    return hit?.label?.trim() || "";
  }, [incoming?.time_control_seconds, progressionQuery.data?.match_clock?.presets]);

  const inviteDescription = chrome
    ? formatIncomingInviteDescription(chrome, railChrome, incoming, inviteTcLabel)
    : "";
  const outgoingDescription = chrome
    ? `${chrome.outgoing_invite_blurb}${
        outgoing?.toUsername ? `${chrome.meta_separator}${outgoing.toUsername}` : ""
      }`
    : "";

  return (
    <MatchmakingRealtimeContext.Provider value={value}>
      {children}
      {chrome ? (
        <ConfirmDialog
          open={Boolean(incoming)}
          onOpenChange={(open) => {
            if (!open) declineIncoming();
          }}
          title={chrome.direct_invite_title}
          description={inviteDescription || chrome.toast_invite_received}
          cancelLabel={chrome.decline_action}
          confirmLabel={chrome.accept_action}
          pendingLabel={chrome.accept_pending}
          cancelPendingLabel={chrome.decline_pending}
          isPending={inviteActionPending === "accept"}
          isPendingCancel={inviteActionPending === "decline"}
          onConfirm={acceptIncoming}
        />
      ) : null}
      {chrome ? (
        <ConfirmDialog
          open={Boolean(outgoing) && !outgoingDismissed && !incoming}
          onOpenChange={(open) => {
            if (!open) dismissOutgoing();
          }}
          title={chrome.outgoing_invite_title}
          description={outgoingDescription || chrome.outgoing_invite_blurb}
          cancelLabel={chrome.outgoing_keep_waiting_action}
          confirmLabel={chrome.outgoing_cancel_action}
          pendingLabel={chrome.outgoing_cancel_pending}
          isPending={inviteActionPending === "cancel"}
          destructive
          onConfirm={cancelOutgoing}
        />
      ) : null}
    </MatchmakingRealtimeContext.Provider>
  );
}
