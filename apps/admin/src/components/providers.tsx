"use client";

import { AdminAvatarRealtime } from "@/components/realtime/AdminAvatarRealtime";
import { ThemedToaster } from "@/components/theme/ThemedToaster";
import { useReleaseStuckBodyPointerEvents } from "@/hooks/use-deferred-dialog-selection";
import { createAppQueryClient } from "@/lib/query-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => createAppQueryClient());
  useReleaseStuckBodyPointerEvents();

  return (
    <QueryClientProvider client={client}>
      <AdminAvatarRealtime />
      {children}
      <ThemedToaster />
    </QueryClientProvider>
  );
}
