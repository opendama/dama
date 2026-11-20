import { rbacSnapshotQueryKey } from "@/hooks/query/useRbacSnapshotQuery";
import { restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import type { RBACPermission, RBACSnapshot } from "@/types/rbac";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useUpsertRbacPermissionMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: RBACPermission) => {
      const { data } = await restClient.put<RBACPermission>("/console/rbac/permissions", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    },
    onSuccess: () => {
      const chrome = qc.getQueryData<RBACSnapshot>(rbacSnapshotQueryKey(token))?.chrome;
      void qc.invalidateQueries({ queryKey: rbacSnapshotQueryKey(token) });
      if (chrome?.toast_permission_saved) toast.success(chrome.toast_permission_saved);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<RBACSnapshot>(rbacSnapshotQueryKey(token))?.chrome;
      const msg = apiToastMessage(err, chrome?.toast_save_failed || "");
      if (msg) toast.error(msg);
    },
  });
}
