import { notificationsUnreadQueryKey } from "@/hooks/query/useNotificationsQuery";
import { restClient } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useMarkNotificationRead(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await restClient.post<{ status: string; message?: string }>(
        `/me/notifications/${id}/read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["notifications"] }),
        qc.invalidateQueries({ queryKey: notificationsUnreadQueryKey(token) }),
      ]);
    },
  });
}

export function useMarkAllNotificationsRead(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await restClient.post<{ status: string; message?: string }>(
        "/me/notifications/read-all",
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["notifications"] }),
        qc.invalidateQueries({ queryKey: notificationsUnreadQueryKey(token) }),
      ]);
    },
  });
}
