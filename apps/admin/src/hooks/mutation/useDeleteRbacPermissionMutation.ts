import { rbacSnapshotQueryKey } from "@/hooks/query/useRbacSnapshotQuery";
import { restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import type { RBACSnapshot } from "@/types/rbac";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useDeleteRbacPermissionMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) => {
      await restClient.delete(`/console/rbac/permissions/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return key;
    },
    onSuccess: () => {
      const chrome = qc.getQueryData<RBACSnapshot>(rbacSnapshotQueryKey(token))?.chrome;
      void qc.invalidateQueries({ queryKey: rbacSnapshotQueryKey(token) });
      if (chrome?.toast_permission_deleted) toast.success(chrome.toast_permission_deleted);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<RBACSnapshot>(rbacSnapshotQueryKey(token))?.chrome;
      const msg = apiToastMessage(err, chrome?.toast_delete_failed || "");
      if (msg) toast.error(msg);
    },
  });
}
