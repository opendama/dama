"use client";

import { PaymentReceiptDetail } from "@/components/payments/PaymentReceiptDetail";
import { ReceiptDetailSkeletonBoot } from "@/components/payments/ReceiptDetailSkeletonBoot";
import { useParams } from "next/navigation";
import { Suspense } from "react";

function AdminReceiptDetailInner() {
  const params = useParams<{ id: string }>();
  return <PaymentReceiptDetail receiptId={params.id || ""} />;
}

export default function AdminReceiptDetailPage() {
  return (
    <Suspense fallback={<ReceiptDetailSkeletonBoot />}>
      <AdminReceiptDetailInner />
    </Suspense>
  );
}
