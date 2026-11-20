export type ResultCardPlacement = {
  placement: number;
  username: string;
};

export type ResultCardChrome = {
  winners_title: string;
  result_card_sponsor_prefix: string;
  result_card_image_failed: string;
  empty_value: string;
  meta_separator: string;
  /** DB palette; fail closed when missing. */
  result_card_bg_color: string;
  result_card_fg_color: string;
  result_card_muted_color: string;
  result_card_row_wash_color: string;
  /** DB canvas CSS font strings; fail closed when missing. */
  result_card_title_font: string;
  result_card_winners_font: string;
  result_card_sponsor_font: string;
  result_card_placement_font: string;
  result_card_name_font: string;
  /** DB header wash opacity 0..1; fail closed when missing/invalid. */
  result_card_header_wash_alpha: string;
  /** DB layout metrics; fail closed when missing/invalid. */
  result_card_width: string;
  result_card_row_height: string;
  result_card_header_height: string;
  result_card_sponsor_height: string;
  result_card_placements_max: string;
  result_card_row_radius: string;
  result_card_pad: string;
  result_card_logo_size: string;
  result_card_title_y: string;
  result_card_winners_y: string;
  result_card_body_gap: string;
  result_card_rows_top_gap: string;
  result_card_bottom_pad: string;
  result_card_row_inset: string;
  result_card_row_inner_gap: string;
  result_card_placement_x: string;
  result_card_name_x: string;
  result_card_row_text_y: string;
  result_card_sponsor_logo_w: string;
  result_card_sponsor_logo_h: string;
  result_card_sponsor_logo_gap: string;
  result_card_logo_text_gap: string;
};

export type ResultCardInput = {
  title: string;
  logoUrl?: string;
  sponsorName?: string;
  sponsorLogoUrl?: string;
  brandColor?: string;
  placements: ResultCardPlacement[];
  chrome: ResultCardChrome;
};

function loadImage(src: string): Promise<HTMLImageElement | null> {
  const url = (src || "").trim();
  if (!url || typeof Image === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  size: number,
) {
  const scale = Math.max(size / img.width, size / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  const dx = x + (size - w) / 2;
  const dy = y + (size - h) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  ctx.drawImage(img, dx, dy, w, h);
  ctx.restore();
}

function drawContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  maxW: number,
  maxH: number,
) {
  const scale = Math.min(maxW / img.width, maxH / img.height, 1);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, x, y + (maxH - h) / 2, w, h);
}

function parsePositive(raw: string): number | null {
  const n = Number((raw || "").trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function parseNonNeg(raw: string): number | null {
  const n = Number((raw || "").trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Build a PNG blob for the richer result card (logo + sponsor + placements). */
export async function buildResultCardBlob(input: ResultCardInput): Promise<Blob | null> {
  if (typeof document === "undefined") return null;

  const bg = (input.chrome.result_card_bg_color || "").trim();
  const fg = (input.chrome.result_card_fg_color || "").trim();
  const muted = (input.chrome.result_card_muted_color || "").trim();
  const rowWash = (input.chrome.result_card_row_wash_color || "").trim();
  const titleFont = (input.chrome.result_card_title_font || "").trim();
  const winnersFont = (input.chrome.result_card_winners_font || "").trim();
  const sponsorFont = (input.chrome.result_card_sponsor_font || "").trim();
  const placementFont = (input.chrome.result_card_placement_font || "").trim();
  const nameFont = (input.chrome.result_card_name_font || "").trim();
  const washAlphaRaw = (input.chrome.result_card_header_wash_alpha || "").trim();
  const washAlpha = Number(washAlphaRaw);
  const accent = (input.brandColor || "").trim() || bg;

  const width = parsePositive(input.chrome.result_card_width);
  const rowH = parsePositive(input.chrome.result_card_row_height);
  const headerH = parsePositive(input.chrome.result_card_header_height);
  const sponsorHCfg = parsePositive(input.chrome.result_card_sponsor_height);
  const placementsMax = parsePositive(input.chrome.result_card_placements_max);
  const rowRadius = parseNonNeg(input.chrome.result_card_row_radius);
  const pad = parsePositive(input.chrome.result_card_pad);
  const logoSize = parsePositive(input.chrome.result_card_logo_size);
  const titleY = parsePositive(input.chrome.result_card_title_y);
  const winnersY = parsePositive(input.chrome.result_card_winners_y);
  const bodyGap = parsePositive(input.chrome.result_card_body_gap);
  const rowsTopGap = parsePositive(input.chrome.result_card_rows_top_gap);
  const bottomPad = parsePositive(input.chrome.result_card_bottom_pad);
  const rowInset = parsePositive(input.chrome.result_card_row_inset);
  const rowInnerGap = parseNonNeg(input.chrome.result_card_row_inner_gap);
  const placementX = parsePositive(input.chrome.result_card_placement_x);
  const nameX = parsePositive(input.chrome.result_card_name_x);
  const rowTextY = parsePositive(input.chrome.result_card_row_text_y);
  const sponsorLogoW = parsePositive(input.chrome.result_card_sponsor_logo_w);
  const sponsorLogoH = parsePositive(input.chrome.result_card_sponsor_logo_h);
  const sponsorLogoGap = parsePositive(input.chrome.result_card_sponsor_logo_gap);
  const logoTextGap = parsePositive(input.chrome.result_card_logo_text_gap);

  if (
    !bg ||
    !fg ||
    !muted ||
    !rowWash ||
    !titleFont ||
    !winnersFont ||
    !sponsorFont ||
    !placementFont ||
    !nameFont ||
    !Number.isFinite(washAlpha) ||
    washAlpha < 0 ||
    washAlpha > 1 ||
    width == null ||
    rowH == null ||
    headerH == null ||
    sponsorHCfg == null ||
    placementsMax == null ||
    rowRadius == null ||
    pad == null ||
    logoSize == null ||
    titleY == null ||
    winnersY == null ||
    bodyGap == null ||
    rowsTopGap == null ||
    bottomPad == null ||
    rowInset == null ||
    rowInnerGap == null ||
    placementX == null ||
    nameX == null ||
    rowTextY == null ||
    sponsorLogoW == null ||
    sponsorLogoH == null ||
    sponsorLogoGap == null ||
    logoTextGap == null
  ) {
    return null;
  }

  const placements = input.placements.slice(0, Math.floor(placementsMax));
  if (!placements.length) return null;

  const sponsorH =
    (input.sponsorName || "").trim() || (input.sponsorLogoUrl || "").trim() ? sponsorHCfg : 0;
  const height = headerH + sponsorH + bodyGap + placements.length * rowH + bottomPad;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const grad = ctx.createLinearGradient(0, 0, width, headerH);
  grad.addColorStop(0, accent);
  grad.addColorStop(1, bg);
  ctx.fillStyle = grad;
  ctx.globalAlpha = washAlpha;
  ctx.fillRect(0, 0, width, headerH);
  ctx.globalAlpha = 1;

  const [logo, sponsorLogo] = await Promise.all([
    loadImage(input.logoUrl || ""),
    loadImage(input.sponsorLogoUrl || ""),
  ]);

  let textX = pad;
  if (logo) {
    drawCover(ctx, logo, pad, pad, logoSize);
    textX = pad + logoSize + logoTextGap;
  }

  ctx.fillStyle = fg;
  ctx.font = titleFont;
  const title = (input.title || "").trim() || (input.chrome.empty_value || "").trim();
  ctx.fillText(title, textX, titleY, width - textX - pad);

  ctx.fillStyle = accent;
  ctx.font = winnersFont;
  ctx.fillText((input.chrome.winners_title || "").trim(), textX, winnersY, width - textX - pad);

  let y = headerH;
  const sponsorName = (input.sponsorName || "").trim();
  const sponsorPrefix = (input.chrome.result_card_sponsor_prefix || "").trim();
  if (sponsorH > 0 && sponsorPrefix) {
    ctx.fillStyle = muted;
    ctx.font = sponsorFont;
    let sx = pad;
    if (sponsorLogo) {
      drawContain(ctx, sponsorLogo, pad, y + rowInnerGap, sponsorLogoW, sponsorLogoH);
      sx = pad + sponsorLogoW + sponsorLogoGap;
    }
    const label = sponsorName ? `${sponsorPrefix} ${sponsorName}` : sponsorPrefix;
    ctx.fillText(label, sx, y + sponsorLogoH, width - sx - pad);
    y += sponsorH;
  }

  y += rowsTopGap;
  const empty = (input.chrome.empty_value || "").trim();
  for (const row of placements) {
    ctx.fillStyle = rowWash;
    roundRectPath(ctx, rowInset, y, width - rowInset * 2, rowH - rowInnerGap, rowRadius);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.font = placementFont;
    ctx.fillText(String(row.placement), placementX, y + rowTextY);
    ctx.fillStyle = fg;
    ctx.font = nameFont;
    const name = (row.username || "").trim() || empty;
    ctx.fillText(name, nameX, y + rowTextY);
    y += rowH;
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

/**
 * Share or download a result-card PNG.
 * Modes are explicit: share never invents a download path; download never invents share.
 * `shareCompanionText` is Web Share API companion text (not a failure fallback).
 */
export async function shareOrDownloadResultCard(
  blob: Blob,
  filename: string,
  opts: {
    mode: "share" | "download";
    shareActionPresent: boolean;
    canShareFiles: boolean;
    shareCompanionText: string;
  },
): Promise<"shared" | "downloaded" | "failed"> {
  const name = (filename || "").trim();
  if (!name) return "failed";

  if (opts.mode === "download") {
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      return "downloaded";
    } catch {
      return "failed";
    }
  }

  const file = new File([blob], name, { type: "image/png" });
  try {
    if (
      opts.shareActionPresent &&
      opts.canShareFiles &&
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] })
    ) {
      await navigator.share({
        files: [file],
        text: (opts.shareCompanionText || "").trim() || undefined,
      });
      return "shared";
    }
  } catch {
    return "failed";
  }
  return "failed";
}

export function buildResultCardText(input: {
  title: string;
  winnersTitle: string;
  logoUrl?: string;
  sponsorName?: string;
  sponsorLogoUrl?: string;
  sponsorNameLabel?: string;
  placements: ResultCardPlacement[];
  emptyValue: string;
  metaSeparator: string;
}): string {
  const sep = (input.metaSeparator || "").trim();
  const empty = (input.emptyValue || "").trim();
  const lines = input.placements.map(
    (e) => `${e.placement}${sep}${(e.username || "").trim() || empty}`,
  );
  const header = [(input.title || "").trim(), (input.winnersTitle || "").trim()].filter(Boolean);
  const extras: string[] = [];
  const logo = (input.logoUrl || "").trim();
  if (logo) extras.push(logo);
  const sponsor = (input.sponsorName || "").trim();
  if (sponsor) {
    const label = (input.sponsorNameLabel || "").trim();
    extras.push(label ? `${label}${sep}${sponsor}` : sponsor);
  }
  const sponsorLogo = (input.sponsorLogoUrl || "").trim();
  if (sponsorLogo) extras.push(sponsorLogo);
  return [...header, ...extras, ...lines].join("\n");
}
