import { eventsAdminChromeQueryKey } from "@/hooks/query/useEventsAdminChromeQuery";
import { adminEventsCatalogSizesQueryKey } from "@/hooks/query/useAdminEventsCatalogSizesQuery";
import { restClient } from "@/lib/api";
import { eventsAdminChromeApiToast } from "@/lib/api-toast-message";
import type { EventsAdminChrome } from "@/types/events-admin-chrome";
import type { EventsCatalogSize } from "@/types/events-catalog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type EventsCatalogSizeWriteInput = {
  id?: string;
  label: string;
  enabled?: boolean;
  sort_order?: number;
  /** null = Unlimited (Arena only). */
  max_players: number | null;
  host_fee_ethiopia_amount: number;
  host_fee_global_amount: number;
  allowed_format_ids: string[];
};

function invalidateSizes(qc: ReturnType<typeof useQueryClient>, token: string | null | undefined) {
  // Sizes list only. Do not invalidate full events catalog draft (formats Save edits must survive).
  void qc.invalidateQueries({ queryKey: ["admin-events-catalog-sizes"] });
  void qc.invalidateQueries({ queryKey: adminEventsCatalogSizesQueryKey(token, 0, 0) });
}

export function useCreateEventsCatalogSizeMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: EventsCatalogSizeWriteInput) => {
      const { data } = await restClient.post<EventsCatalogSize>(
        "/console/events/catalog/sizes",
        payload,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
    onSuccess: () => {
      invalidateSizes(qc, token);
      const chrome = qc.getQueryData<EventsAdminChrome>(eventsAdminChromeQueryKey());
      const msg = (chrome?.sizes_toast_created || "").trim();
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<EventsAdminChrome>(eventsAdminChromeQueryKey());
      const msg = eventsAdminChromeApiToast(
        err,
        chrome as Record<string, unknown> | undefined,
        chrome?.sizes_toast_failed || "",
      );
      if (msg) toast.error(msg);
    },
  });
}

export function useUpdateEventsCatalogSizeMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: EventsCatalogSizeWriteInput & { id: string }) => {
      const { id, ...body } = payload;
      const { data } = await restClient.put<EventsCatalogSize>(
        `/console/events/catalog/sizes/${encodeURIComponent(id)}`,
        body,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
    onSuccess: () => {
      invalidateSizes(qc, token);
      const chrome = qc.getQueryData<EventsAdminChrome>(eventsAdminChromeQueryKey());
      const msg = (chrome?.sizes_toast_updated || "").trim();
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<EventsAdminChrome>(eventsAdminChromeQueryKey());
      const msg = eventsAdminChromeApiToast(
        err,
        chrome as Record<string, unknown> | undefined,
        chrome?.sizes_toast_failed || "",
      );
      if (msg) toast.error(msg);
    },
  });
}

export function useToggleEventsCatalogSizeMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; active: boolean }) => {
      const { data } = await restClient.patch(
        `/console/events/catalog/sizes/${encodeURIComponent(payload.id)}/active`,
        { active: payload.active },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
    onSuccess: () => {
      invalidateSizes(qc, token);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<EventsAdminChrome>(eventsAdminChromeQueryKey());
      const msg = eventsAdminChromeApiToast(
        err,
        chrome as Record<string, unknown> | undefined,
        chrome?.sizes_toast_failed || "",
      );
      if (msg) toast.error(msg);
    },
  });
}

export function useDeleteEventsCatalogSizeMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await restClient.delete(
        `/console/events/catalog/sizes/${encodeURIComponent(id)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
    onSuccess: () => {
      invalidateSizes(qc, token);
      const chrome = qc.getQueryData<EventsAdminChrome>(eventsAdminChromeQueryKey());
      const msg = (chrome?.sizes_toast_deleted || "").trim();
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<EventsAdminChrome>(eventsAdminChromeQueryKey());
      const msg = eventsAdminChromeApiToast(
        err,
        chrome as Record<string, unknown> | undefined,
        chrome?.sizes_toast_failed || "",
      );
      if (msg) toast.error(msg);
    },
  });
}
