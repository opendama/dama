/** Hit-test helpers for area charts (Recharts touch often omits activePayload). */

export type ChartPlotMargin = {
  top: number;
  right: number;
  bottom: number;
  /** Left margin + Y-axis width (Recharts draws axis inside the left gutter). */
  left: number;
};

export function nearestIndexFromClientX(
  wrap: HTMLElement,
  clientX: number,
  pointCount: number,
  margin: ChartPlotMargin,
): number | null {
  if (pointCount <= 0) return null;
  const rect = wrap.getBoundingClientRect();
  if (!(rect.width > 0)) return null;
  const plotLeft = margin.left;
  const plotRight = rect.width - margin.right;
  const plotW = plotRight - plotLeft;
  if (!(plotW > 0)) return null;
  const localX = clientX - rect.left;
  const t = Math.min(1, Math.max(0, (localX - plotLeft) / plotW));
  if (pointCount === 1) return 0;
  return Math.round(t * (pointCount - 1));
}
