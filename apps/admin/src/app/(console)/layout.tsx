import { RequireAuth } from "@/components/auth/RequireAuth";
import { AdminConsoleShell } from "@/components/console/AdminConsoleShell";
import { Suspense } from "react";

/** Admin console: auth-gated Trim-style sidebar shell (DB console_nav). */
export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AdminConsoleShell>
        {/* useUrlSkip / useSearchParams need a Suspense boundary. */}
        <Suspense fallback={null}>{children}</Suspense>
      </AdminConsoleShell>
    </RequireAuth>
  );
}
