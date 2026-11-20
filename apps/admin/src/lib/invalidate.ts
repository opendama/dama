import type { QueryClient } from "@tanstack/react-query";

/** Drop account-scoped cache on login/logout without wiping platform enums/nav. */
export function removeAccountScopedQueries(qc: QueryClient) {
  const roots = [
    "me",
    "tournaments",
    "admin-users",
    "admin-banks",
    "admin-receipts",
    "admin-receipt",
    "admin-kyc",
    "admin-payouts",
    "admin-transactions",
    "admin-avatars",
    "media-pool-channels",
    "console-currency",
    "console-progression",
    "console-game-rules",
    "admin-moderation",
    "admin-fingerprints",
    "admin-geo-ip",
    "admin-audit",
    "gql-feature-flags",
    "console-rbac",
    "console-me-permissions",
    "console-ad-playback",
    "console-ad-campaigns",
  ] as const;
  for (const root of roots) {
    void qc.removeQueries({ queryKey: [root] });
  }
}

export function invalidateAdminTournaments(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: ["tournaments"] });
}

export function invalidateConsoleFeatureFlags(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ["gql-feature-flags"] }),
    qc.invalidateQueries({ queryKey: ["feature-flags"] }),
  ]);
}

export function invalidateMediaPool(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: ["media-pool-channels"] });
}

export function invalidateAdminReceipts(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ["admin-receipts"] }),
    qc.invalidateQueries({ queryKey: ["admin-receipt"] }),
    qc.invalidateQueries({ queryKey: ["admin-transactions"] }),
  ]);
}

export function invalidateAdminKyc(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: ["admin-kyc"] });
}

export function invalidateAdminPayouts(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ["admin-payouts"] }),
    qc.invalidateQueries({ queryKey: ["admin-transactions"] }),
  ]);
}

export function invalidateAdminTransactions(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: ["admin-transactions"] });
}

export function invalidateAdminBanks(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: ["admin-banks"] });
}

export function invalidateAdminUsers(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ["admin-users"] }),
    qc.invalidateQueries({ queryKey: ["admin-user"] }),
  ]);
}

export function invalidateAdminAvatars(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: ["admin-avatars"] });
}

export function invalidatePaymentCurrency(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ["payment-currency"] }),
    qc.invalidateQueries({ queryKey: ["console-currency"] }),
  ]);
}

export function invalidateConsoleProgression(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ["console-progression"] }),
    qc.invalidateQueries({ queryKey: ["ad-pricing"] }),
  ]);
}

export function invalidateConsoleBoardRules(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ["console-game-rules"] }),
    qc.invalidateQueries({ queryKey: ["board-rules"] }),
  ]);
}

export function invalidateAdminModeration(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: ["admin-moderation"] });
}

export function invalidateRbac(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ["console-rbac"] }),
    qc.invalidateQueries({ queryKey: ["console-me-permissions"] }),
    qc.invalidateQueries({ queryKey: ["client-enums"] }),
  ]);
}

export function invalidateAdRuntime(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ["console-ad-playback"] }),
    qc.invalidateQueries({ queryKey: ["console-ad-campaigns"] }),
  ]);
}
