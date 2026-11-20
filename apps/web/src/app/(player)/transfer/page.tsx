"use client";

import { ReceiptsPageSkeleton } from "@/components/ui/shimmer-skeletons";
import { ManualTransferWorkspace } from "@/components/wallet/ManualTransferWorkspace";
import { Suspense } from "react";

export default function PlayerTransferPage() {
  return (
    <Suspense fallback={<ReceiptsPageSkeleton columns={0} showBlurb showManualForm />}>
      <ManualTransferWorkspace />
    </Suspense>
  );
}
