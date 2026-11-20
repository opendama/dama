"use client";

import { SignInModalProvider } from "@/components/auth/SignInModal";
import { MatchmakingRealtimeProvider } from "@/components/matchmaking/MatchmakingRealtimeProvider";
import { SessionSecurity } from "@/components/session/SessionSecurity";
import { ThemedToaster } from "@/components/theme/ThemedToaster";
import { useReleaseStuckBodyPointerEvents } from "@/hooks/use-deferred-dialog-selection";
import { hydratePalettesFromStorage } from "@/lib/board-palette";
import { bindPauseQueryClient } from "@/lib/pause-active-game";
import { createAppQueryClient } from "@/lib/query-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => createAppQueryClient());
  useReleaseStuckBodyPointerEvents();

  // Apply stored (or migrated B&W default) board/piece CSS tokens before paint of children.
  useLayoutEffect(() => {
    hydratePalettesFromStorage();
  }, []);

  // Leave-pause writes the same game-state cache LivePlayHub/SpectateHub seed from.
  useEffect(() => {
    bindPauseQueryClient(client);
    return () => bindPauseQueryClient(null);
  }, [client]);

  return (
    <QueryClientProvider client={client}>
      <MatchmakingRealtimeProvider>
        <SignInModalProvider>
          <SessionSecurity />
          {children}
          <ThemedToaster />
        </SignInModalProvider>
      </MatchmakingRealtimeProvider>
    </QueryClientProvider>
  );
}
