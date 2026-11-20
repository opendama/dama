"use client";

import { PaymentsReceiptsSkeleton } from "@/components/ui/shimmer-skeletons";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

/** Payments hub: land on Receipts (primary ops queue). Preserve ?receipt= deep links. */
function AdminPaymentsIndexInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    const receiptId = (searchParams.get("receipt") || "").trim();
    if (receiptId) {
      router.replace(`/payments/receipts/${encodeURIComponent(receiptId)}`);
      return;
    }
    const qs = searchParams.toString();
    router.replace(qs ? `/payments/receipts?${qs}` : "/payments/receipts");
  }, [router, searchParams]);
  return (
    <div className="space-y-4">
      <PaymentsReceiptsSkeleton />
    </div>
  );
}

export default function AdminPaymentsIndexPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <PaymentsReceiptsSkeleton />
        </div>
      }
    >
      <AdminPaymentsIndexInner />
    </Suspense>
  );
}
