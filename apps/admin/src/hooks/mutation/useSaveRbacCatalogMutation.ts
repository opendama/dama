import { rbacSnapshotQueryKey } from "@/hooks/query/useRbacSnapshotQuery";
import { restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import { invalidateRbac } from "@/lib/invalidate";
import type { RBACSnapshot } from "@/types/rbac";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type CatalogInput = {
  roles: string[];
  console_roles: string[];
  publisher_roles: string[];
  default_role: string;
};

export function useSaveRbacCatalogMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CatalogInput) => {
      const { data } = await restClient.put("/console/rbac/catalog", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    },
    onSuccess: () => {
      const chrome = qc.getQueryData<RBACSnapshot>(rbacSnapshotQueryKey(token))?.chrome;
      void qc.invalidateQueries({ queryKey: rbacSnapshotQueryKey(token) });
      void invalidateRbac(qc);
      if (chrome?.toast_catalog_saved) toast.success(chrome.toast_catalog_saved);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<RBACSnapshot>(rbacSnapshotQueryKey(token))?.chrome;
      const msg = apiToastMessage(err, chrome?.toast_save_failed || "");
      if (msg) toast.error(msg);
    },
  });
}
