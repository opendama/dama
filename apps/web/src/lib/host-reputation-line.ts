/** Build a DB-chrome host reputation meta line for lobby cards (fail closed empty). */
export function hostReputationLine(input: {
  finished?: number | null;
  cancelled?: number | null;
  openReports?: number | null;
  finishedLabel?: string | null;
  cancelledLabel?: string | null;
  reportsLabel?: string | null;
  separator?: string | null;
}): string {
  const sep = typeof input.separator === "string" ? input.separator : "";
  const finishedLabel = (input.finishedLabel || "").trim();
  const cancelledLabel = (input.cancelledLabel || "").trim();
  const reportsLabel = (input.reportsLabel || "").trim();
  if (!sep.length || !finishedLabel || !cancelledLabel || !reportsLabel) return "";
  const finished =
    typeof input.finished === "number" && Number.isFinite(input.finished) ? input.finished : null;
  const cancelled =
    typeof input.cancelled === "number" && Number.isFinite(input.cancelled)
      ? input.cancelled
      : null;
  const openReports =
    typeof input.openReports === "number" && Number.isFinite(input.openReports)
      ? input.openReports
      : null;
  if (finished == null || cancelled == null || openReports == null) return "";
  return [
    `${finishedLabel} ${finished}`,
    `${cancelledLabel} ${cancelled}`,
    `${reportsLabel} ${openReports}`,
  ].join(sep);
}
