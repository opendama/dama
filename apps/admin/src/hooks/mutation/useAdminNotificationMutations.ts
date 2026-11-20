import { adminNotificationsUnreadQueryKey } from "@/hooks/query/useAdminNotificationsQuery";
import { restClient } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useAdminMarkNotificationRead(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await restClient.post<{ status: string; message?: string }>(
        `/console/notifications/${id}/read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-notifications"] }),
        qc.invalidateQueries({ queryKey: adminNotificationsUnreadQueryKey(token) }),
      ]);
    },
  });
}

export function useAdminMarkAllNotificationsRead(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await restClient.post<{ status: string; message?: string }>(
        "/console/notifications/read-all",
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-notifications"] }),
        qc.invalidateQueries({ queryKey: adminNotificationsUnreadQueryKey(token) }),
      ]);
    },
  });
}
