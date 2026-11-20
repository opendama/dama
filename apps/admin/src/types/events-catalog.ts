export type EventsCatalogFormat = {
  id: string;
  label: string;
  enabled: boolean;
  sort_order: number;
};

export type EventsCatalogSize = {
  id: string;
  label: string;
  enabled: boolean;
  sort_order: number;
  /** null = Unlimited open enroll (Arena only). */
  max_players: number | null;
  /** Legacy mirror of Ethiopia fee (ads create-fee parity). */
  host_fee_amount: number;
  host_fee_currency: string;
  host_fee_ethiopia_amount: number;
  host_fee_ethiopia_currency: string;
  host_fee_global_amount: number;
  host_fee_global_currency: string;
  allowed_format_ids: string[];
};

/** Mirrors store.EventsCatalogConfig (platform_settings.events_catalog). */
export type EventsCatalogConfig = {
  join_code_length: number;
  join_code_alphabet: string;
  auto_approve_default: boolean;
  force_auto_approve?: boolean;
  public_host_fee_multiplier: number;
  default_visibility: string;
  report_reason_codes: string[];
  report_reason_labels?: Record<string, string>;
  entry_fee_commission_percent: number;
  share_path_template: string;
  qr_filename_prefix: string;
  min_players_to_start: Record<string, number>;
  /** Max players (string key) → Swiss round count. */
  swiss_rounds_by_max_players: Record<string, number>;
  groups_knockout_target_group_size: number;
  groups_knockout_advance_per_group: number;
  formats: EventsCatalogFormat[];
  sizes: EventsCatalogSize[];
};

export function isEventsCatalogReady(
  data: EventsCatalogConfig | null | undefined,
): data is EventsCatalogConfig {
  if (!data) return false;
  if (!Number.isInteger(data.join_code_length) || data.join_code_length < 4) return false;
  if (typeof data.join_code_alphabet !== "string" || !data.join_code_alphabet.trim()) return false;
  if (typeof data.auto_approve_default !== "boolean") return false;
  if (
    typeof data.public_host_fee_multiplier !== "number" ||
    !(data.public_host_fee_multiplier > 0)
  ) {
    return false;
  }
  if (
    typeof data.entry_fee_commission_percent !== "number" ||
    data.entry_fee_commission_percent < 0 ||
    data.entry_fee_commission_percent > 100
  ) {
    return false;
  }
  if (typeof data.default_visibility !== "string" || !data.default_visibility.trim()) return false;
  if (!Array.isArray(data.report_reason_codes) || data.report_reason_codes.length === 0) {
    return false;
  }
  const reasonLabels = data.report_reason_labels ?? {};
  for (const code of data.report_reason_codes) {
    if (typeof code !== "string" || !code.trim()) return false;
    if (typeof reasonLabels[code] !== "string" || !reasonLabels[code].trim()) return false;
  }
  if (
    typeof data.share_path_template !== "string" ||
    !data.share_path_template.includes("{code}")
  ) {
    return false;
  }
  if (typeof data.qr_filename_prefix !== "string" || !data.qr_filename_prefix.trim()) return false;
  if (!data.formats?.length || !data.sizes?.length) return false;
  if (!data.min_players_to_start || typeof data.min_players_to_start !== "object") return false;
  if (!data.swiss_rounds_by_max_players || typeof data.swiss_rounds_by_max_players !== "object") {
    return false;
  }
  const swissOk = Object.entries(data.swiss_rounds_by_max_players).every(([k, v]) => {
    const maxP = Number(k);
    return (
      Number.isFinite(maxP) && maxP > 0 && typeof v === "number" && Number.isInteger(v) && v > 0
    );
  });
  if (!swissOk || Object.keys(data.swiss_rounds_by_max_players).length === 0) return false;
  if (
    typeof data.groups_knockout_target_group_size !== "number" ||
    !Number.isInteger(data.groups_knockout_target_group_size) ||
    data.groups_knockout_target_group_size < 2
  ) {
    return false;
  }
  if (
    typeof data.groups_knockout_advance_per_group !== "number" ||
    !Number.isInteger(data.groups_knockout_advance_per_group) ||
    data.groups_knockout_advance_per_group < 1
  ) {
    return false;
  }
  const formatsOk = data.formats.every(
    (f) =>
      typeof f.id === "string" &&
      f.id.trim().length > 0 &&
      typeof f.label === "string" &&
      f.label.trim().length > 0 &&
      typeof f.enabled === "boolean",
  );
  if (!formatsOk) return false;
  return data.sizes.every(
    (s) =>
      typeof s.id === "string" &&
      s.id.trim().length > 0 &&
      typeof s.label === "string" &&
      s.label.trim().length > 0 &&
      typeof s.enabled === "boolean" &&
      Array.isArray(s.allowed_format_ids) &&
      s.allowed_format_ids.length > 0 &&
      typeof s.host_fee_ethiopia_amount === "number" &&
      s.host_fee_ethiopia_amount > 0 &&
      typeof s.host_fee_ethiopia_currency === "string" &&
      s.host_fee_ethiopia_currency.trim().length > 0 &&
      typeof s.host_fee_global_amount === "number" &&
      s.host_fee_global_amount > 0 &&
      typeof s.host_fee_global_currency === "string" &&
      s.host_fee_global_currency.trim().length > 0,
  );
}
