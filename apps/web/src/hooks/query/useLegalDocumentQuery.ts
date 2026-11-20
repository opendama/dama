import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import {
  type LegalDocKind,
  type LegalDocumentPayload,
  isLegalDocumentReady,
} from "@/types/legal-chrome";
import { useQuery } from "@tanstack/react-query";

export function legalDocumentQueryKey(kind: LegalDocKind) {
  return ["legal-document", kind] as const;
}

export function useLegalDocumentQuery(kind: LegalDocKind, enabled = true) {
  return useQuery({
    queryKey: legalDocumentQueryKey(kind),
    enabled,
    staleTime: QueryStale.platform,
    queryFn: async (): Promise<LegalDocumentPayload> => {
      const { data } = await restClient.get<LegalDocumentPayload>(`/public/legal/${kind}`);
      if (!isLegalDocumentReady(data)) {
        throw new Error("");
      }
      return data;
    },
  });
}
