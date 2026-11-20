"use client";

import { ReceiptsPageSkeleton } from "@/components/ui/shimmer-skeletons";
import { ReceiptsWorkspace } from "@/components/wallet/ReceiptsWorkspace";
import { Suspense } from "react";

export default function PlayerReceiptsPage() {
  return (
    <Suspense fallback={<ReceiptsPageSkeleton columns={6} showBlurb showManualForm={false} />}>
      <ReceiptsWorkspace />
    </Suspense>
  );
}
