"use client";

import { WalletPanelSkeleton } from "@/components/ui/shimmer-skeletons";
import { WalletWorkspace } from "@/components/wallet/WalletWorkspace";
import { Suspense } from "react";

export default function WalletPage() {
  return (
    <Suspense fallback={<WalletPanelSkeleton />}>
      <WalletWorkspace />
    </Suspense>
  );
}
