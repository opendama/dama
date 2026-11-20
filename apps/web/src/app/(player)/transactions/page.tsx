"use client";

import { SearchableListPageSkeleton } from "@/components/ui/shimmer-skeletons";
import { TransactionsWorkspace } from "@/components/wallet/TransactionsWorkspace";
import { Suspense } from "react";

export default function PlayerTransactionsPage() {
  return (
    <Suspense fallback={<SearchableListPageSkeleton columns={7} showBlurb />}>
      <TransactionsWorkspace />
    </Suspense>
  );
}
