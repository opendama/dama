import { restClient } from "@/lib/api";
import { ApiClientError } from "@/lib/api-client-error";
import { QueryStale } from "@/lib/query-policy";
import { type AdminConsoleChrome, isAdminConsoleChromeReady } from "@/types/admin-console-chrome";
import { useQuery } from "@tanstack/react-query";

export function adminConsoleChromeQueryKey() {
  // v11: media_pool CRUD chrome heal (migration 495).
  return ["admin-console-chrome", "v11"] as const;
}

export function useAdminConsoleChromeQuery(enabled = true) {
  return useQuery({
    queryKey: adminConsoleChromeQueryKey(),
    enabled,
    staleTime: QueryStale.platform,
    queryFn: async (): Promise<AdminConsoleChrome> => {
      const { data } = await restClient.get<AdminConsoleChrome>("/public/admin-console-chrome");
      if (!isAdminConsoleChromeReady(data)) {
        const msg = (data?.admin_console_chrome_unavailable || "").trim();
        throw new ApiClientError(msg, {
          status: 503,
          errorKey: "admin_console_chrome_unavailable",
          apiError: msg,
        });
      }
      return data;
    },
  });
}
