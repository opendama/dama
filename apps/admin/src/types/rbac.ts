export type RBACPermission = {
  key: string;
  title: string;
  description: string;
};

export type RBACChrome = {
  page_title: string;
  page_body: string;
  catalog_title: string;
  roles_label: string;
  console_roles_label: string;
  publisher_roles_label: string;
  default_role_label: string;
  save_catalog_action: string;
  save_catalog_pending: string;
  permissions_title: string;
  permissions_empty: string;
  perm_key_label: string;
  perm_title_label: string;
  perm_description_label: string;
  upsert_permission_action: string;
  upsert_permission_pending: string;
  delete_permission_action: string;
  delete_permission_pending: string;
  grants_title: string;
  role_label: string;
  save_grants_action: string;
  save_grants_pending: string;
  lacks_manage: string;
  load_failed: string;
  unavailable: string;
  toast_catalog_saved: string;
  toast_permission_saved: string;
  toast_permission_deleted: string;
  toast_grants_saved: string;
  toast_save_failed: string;
  toast_delete_failed: string;
  protected_permission_keys: string[];
  manage_permission_key: string;
  err_protected_delete: string;
  err_protected_last_grant: string;
  select_all_label?: string;
  select_row_label?: string;
  selected_count_fmt?: string;
  clear_selection_action?: string;
  view_action?: string;
  edit_action?: string;
  add_permission_action?: string;
  dialog_close_label?: string;
  cancel_action?: string;
  row_actions_label?: string;
  search_label?: string;
  search_placeholder?: string;
  detail_title?: string;
  empty_value?: string;
  tab_catalog_label?: string;
  tab_permissions_label?: string;
  tab_grants_label?: string;
  confirm_delete_title?: string;
  confirm_delete_description?: string;
  confirm_delete?: string;
  confirm_delete_pending?: string;
  confirm_cancel?: string;
  bulk_delete_action?: string;
  bulk_delete_pending?: string;
  bulk_delete_confirm_title?: string;
  bulk_delete_confirm_description?: string;
  col_role_label?: string;
  col_console_label?: string;
  col_publisher_label?: string;
  col_default_label?: string;
  add_role_action?: string;
  catalog_empty?: string;
  flag_yes_label?: string;
  flag_no_label?: string;
  delete_role_action?: string;
  confirm_delete_role_title?: string;
  confirm_delete_role_description?: string;
  bulk_delete_roles_confirm_title?: string;
  bulk_delete_roles_confirm_description?: string;
  is_console_label?: string;
  is_publisher_label?: string;
  is_default_label?: string;
  upsert_role_action?: string;
  upsert_role_pending?: string;
  role_detail_title?: string;
};

export type RBACSnapshot = {
  roles: string[];
  console_roles: string[];
  publisher_roles: string[];
  default_role: string;
  permissions: RBACPermission[];
  role_permissions: Record<string, string[]>;
  chrome: RBACChrome;
};

export type AdsChromeSnippet = {
  section_title: string;
  lacks_permissions: string;
  unavailable: string;
  runtime_permission_key: string;
  campaigns_permission_key: string;
};

export type MyPermissions = {
  role: string;
  permissions: string[];
  chrome: RBACChrome;
  ads_chrome: AdsChromeSnippet;
};

const RBAC_CHROME_STRING_KEYS: (keyof RBACChrome)[] = [
  "page_title",
  "page_body",
  "catalog_title",
  "roles_label",
  "console_roles_label",
  "publisher_roles_label",
  "default_role_label",
  "save_catalog_action",
  "save_catalog_pending",
  "permissions_title",
  "permissions_empty",
  "perm_key_label",
  "perm_title_label",
  "perm_description_label",
  "upsert_permission_action",
  "upsert_permission_pending",
  "delete_permission_action",
  "delete_permission_pending",
  "grants_title",
  "role_label",
  "save_grants_action",
  "save_grants_pending",
  "lacks_manage",
  "load_failed",
  "unavailable",
  "toast_catalog_saved",
  "toast_permission_saved",
  "toast_permission_deleted",
  "toast_grants_saved",
  "toast_save_failed",
  "toast_delete_failed",
  "manage_permission_key",
  "err_protected_delete",
  "err_protected_last_grant",
  "select_all_label",
  "select_row_label",
  "selected_count_fmt",
  "clear_selection_action",
  "view_action",
  "edit_action",
  "add_permission_action",
  "dialog_close_label",
  "cancel_action",
  "row_actions_label",
  "search_label",
  "search_placeholder",
  "detail_title",
  "empty_value",
  "tab_catalog_label",
  "tab_permissions_label",
  "tab_grants_label",
  "confirm_delete_title",
  "confirm_delete_description",
  "confirm_delete",
  "confirm_delete_pending",
  "confirm_cancel",
  "bulk_delete_action",
  "bulk_delete_pending",
  "bulk_delete_confirm_title",
  "bulk_delete_confirm_description",
  "col_role_label",
  "col_console_label",
  "col_publisher_label",
  "col_default_label",
  "add_role_action",
  "catalog_empty",
  "flag_yes_label",
  "flag_no_label",
  "delete_role_action",
  "confirm_delete_role_title",
  "confirm_delete_role_description",
  "bulk_delete_roles_confirm_title",
  "bulk_delete_roles_confirm_description",
  "is_console_label",
  "is_publisher_label",
  "is_default_label",
  "upsert_role_action",
  "upsert_role_pending",
  "role_detail_title",
];

function rbacFieldReady(key: string, v: unknown): boolean {
  if (typeof v !== "string" || v.length === 0) return false;
  return v.trim().length > 0;
}

/** Fail closed: RBAC chrome strings (including pending labels) must come from the database. */
export function isRbacChromeReady(
  chrome: RBACChrome | null | undefined,
): chrome is RBACChrome & { protected_permission_keys: string[] } {
  if (!chrome) return false;
  if (!chrome.protected_permission_keys?.length) return false;
  if (!chrome.protected_permission_keys.includes(chrome.manage_permission_key)) return false;
  return RBAC_CHROME_STRING_KEYS.every((k) => rbacFieldReady(k, chrome[k]));
}
