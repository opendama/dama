import type { ClientEnums } from "@/types/platform";

export function isConsoleRole(
  role: string | undefined | null,
  enums?: ClientEnums | null,
): boolean {
  if (!role || !enums?.console_roles?.length) return false;
  return enums.console_roles.includes(role);
}

export function isPublisherRole(
  role: string | undefined | null,
  enums?: ClientEnums | null,
): boolean {
  if (!role || !enums?.publisher_roles?.length) return false;
  return enums.publisher_roles.includes(role);
}
