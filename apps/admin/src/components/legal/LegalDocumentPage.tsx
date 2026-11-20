"use client";

import { LegalPageShell } from "@/components/legal/LegalPageShell";
import { FormCardSkeleton } from "@/components/ui/shimmer-skeletons";
import { useLegalChromeQuery } from "@/hooks/query/useLegalChromeQuery";
import { useLegalDocumentQuery } from "@/hooks/query/useLegalDocumentQuery";
import {
  type LegalDocKind,
  isLegalChromeReady,
  isLegalDocumentReady,
  legalDocTitle,
} from "@/types/legal-chrome";

export function LegalDocumentPage({ kind }: { kind: LegalDocKind }) {
  const chromeQuery = useLegalChromeQuery(true);
  const docQuery = useLegalDocumentQuery(kind, true);
  const chrome = isLegalChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  const doc = isLegalDocumentReady(docQuery.data) ? docQuery.data : undefined;

  if (chromeQuery.isLoading || docQuery.isLoading) {
    return <FormCardSkeleton />;
  }

  if (!chrome || !doc) {
    const unavailable = (chromeQuery.data?.legal_unavailable || "").trim();
    return unavailable ? (
      <p className="text-sm text-[var(--dama-danger)]" role="alert">
        {unavailable}
      </p>
    ) : null;
  }

  const title = legalDocTitle(chrome, kind);

  return <LegalPageShell title={title} sections={doc.sections} supportEmail={doc.support_email} />;
}
