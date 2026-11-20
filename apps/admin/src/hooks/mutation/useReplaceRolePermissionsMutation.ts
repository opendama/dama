import { rbacSnapshotQueryKey } from "@/hooks/query/useRbacSnapshotQuery";
import { restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import type { RBACSnapshot } from "@/types/rbac";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useReplaceRolePermissionsMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { role: string; permissions: string[] }) => {
      const { data } = await restClient.put(
        `/console/rbac/roles/${encodeURIComponent(vars.role)}/permissions`,
        { permissions: vars.permissions },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
    onSuccess: () => {
      const chrome = qc.getQueryData<RBACSnapshot>(rbacSnapshotQueryKey(token))?.chrome;
      void qc.invalidateQueries({ queryKey: rbacSnapshotQueryKey(token) });
      if (chrome?.toast_grants_saved) toast.success(chrome.toast_grants_saved);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<RBACSnapshot>(rbacSnapshotQueryKey(token))?.chrome;
      const msg = apiToastMessage(err, chrome?.toast_save_failed || "");
      if (msg) toast.error(msg);
    },
  });
}
