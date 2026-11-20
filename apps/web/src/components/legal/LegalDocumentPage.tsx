"use client";

import { LegalDocTabs } from "@/components/legal/LegalDocTabs";
import { LegalPageShell } from "@/components/legal/LegalPageShell";
import { LegalDocumentSkeleton } from "@/components/ui/shimmer-skeletons";
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
    return <LegalDocumentSkeleton />;
  }

  if (!chrome || !doc) {
    const unavailable =
      (chromeQuery.data?.legal_unavailable || "").trim() ||
      (chromeQuery.error instanceof Error ? chromeQuery.error.message : "").trim();
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-12">
        {chromeQuery.data ? (
          <LegalDocTabs
            active={kind}
            chrome={{
              privacy_nav_label: chromeQuery.data.privacy_nav_label,
              terms_nav_label: chromeQuery.data.terms_nav_label,
              refunds_nav_label: chromeQuery.data.refunds_nav_label,
            }}
          />
        ) : null}
        <p className="text-sm text-[var(--dama-danger)]">{unavailable}</p>
      </div>
    );
  }

  const title = legalDocTitle(chrome, kind);

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-12">
      <LegalDocTabs active={kind} chrome={chrome} />
      <LegalPageShell title={title} sections={doc.sections} supportEmail={doc.support_email} />
    </div>
  );
}
