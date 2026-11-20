import { useClientEnumsQuery } from "@/hooks/query/useClientEnumsQuery";
import { isConsoleRole } from "@/lib/rbac";
import { useAuthHydrated, useAuthStore } from "@/store/auth";

/** True when the signed-in role is in platform_settings.client_enums.console_roles. */
export function useIsConsoleRole() {
  const hydrated = useAuthHydrated();
  const role = useAuthStore((s) => s.user?.role);
  const enumsQuery = useClientEnumsQuery(hydrated);
  return {
    isConsole: hydrated && isConsoleRole(role, enumsQuery.data),
    isLoading: !hydrated || enumsQuery.isLoading,
    enums: enumsQuery.data,
  };
}
