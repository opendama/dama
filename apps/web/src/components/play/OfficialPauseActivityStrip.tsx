"use client";

import {
  officialPauseEventsQueryKey,
  useOfficialPauseEventsQuery,
} from "@/hooks/query/useOfficialPauseEventsQuery";
import { isApiClientError } from "@/lib/api-client-error";
import { applyOfficialPauseFmt, officialPauseRoleLabel } from "@/lib/official-pause-display";
import type { OfficialPauseChrome } from "@/types/official-pause-chrome";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

type Props = {
  token: string | null | undefined;
  gameId: string | null | undefined;
  chrome: OfficialPauseChrome | null | undefined;
  enabled?: boolean;
  /** Bump when pause/resume/meta lands via WS so the audit strip refetches. */
  refreshKey?: string | number;
};

/** Compact match pause/resume timeline (DB audit; seats + operators). */
export function OfficialPauseActivityStrip({
  token,
  gameId,
  chrome,
  enabled = true,
  refreshKey = "",
}: Props) {
  const title = (chrome?.activity_title || "").trim();
  const empty = (chrome?.activity_empty || "").trim();
  const gid = (gameId || "").trim();
  const qc = useQueryClient();
  const query = useOfficialPauseEventsQuery(token, gid, enabled && Boolean(gid) && Boolean(title));
  useEffect(() => {
    if (!enabled || !gid || refreshKey === "" || refreshKey === 0) return;
    void qc.invalidateQueries({ queryKey: officialPauseEventsQueryKey(gid) });
  }, [enabled, gid, qc, refreshKey]);
  if (!title || !gid) return null;
  // Pure spectators are forbidden by the API; hide the shell (blur cover only).
  if (query.isError) {
    const status = isApiClientError(query.error) ? query.error.status : 0;
    if (status === 401 || status === 403) return null;
  }
  if (query.isError) return null;
  const events = query.data ?? [];
  return (
    <div className="space-y-1 rounded-md border border-[var(--dama-border)] p-2">
      <p className="text-xs font-medium text-[var(--dama-muted)]">{title}</p>
      {events.length === 0 ? (
        empty ? (
          <p className="text-xs text-[var(--dama-muted)]">{empty}</p>
        ) : null
      ) : (
        <ul className="space-y-1">
          {events.slice(0, 5).map((ev) => {
            const action = (ev.action || "").trim();
            const role = officialPauseRoleLabel(ev.actor_role, chrome);
            const name = (ev.actor_display_name || "").trim();
            const reason = (ev.reason_label || "").trim();
            const note = (ev.note || "").trim();
            const fmt =
              action === "resume"
                ? (chrome?.activity_resume_fmt || "").trim()
                : action === "meta"
                  ? (chrome?.activity_meta_fmt || "").trim()
                  : (chrome?.activity_pause_fmt || "").trim();
            if (!fmt) return null;
            // Fail closed: never show hollow "by ·" (fmt needs both role and name).
            if (!role || !name) return null;
            const line = applyOfficialPauseFmt(fmt, { role, name, reason, note });
            if (!line) return null;
            return (
              <li key={ev.id} className="text-xs text-[var(--dama-text)]">
                {line}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
