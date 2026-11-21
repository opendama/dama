type NotifyEvent =
  | "match_found"
  | "game_start"
  | "your_turn"
  | "capture"
  | "win"
  | "loss"
  | "error"
  | "info"
  | "move"
  | "promote";

/** Chess.com-style land SFX ([default theme](https://www.youtube.com/watch?v=7skwR49UhqA)). */
export type PieceLandKind = "move" | "capture" | "promote";

const LAND_SRC: Record<PieceLandKind, string> = {
  move: "/sounds/move.mp3",
  capture: "/sounds/capture.mp3",
  promote: "/sounds/promote.mp3",
};

const GAME_START_SRC = "/sounds/game-start.mp3";
/** Soft ClickUp-like delivery ping - recipient-only (original Dama asset). */
const MESSAGE_SRC = "/sounds/message.wav";

let lastMessageNotifyAt = 0;
let lastLandNotifyAt = 0;

let ctx: AudioContext | null = null;

/** Small pools so rapid multi-jump lands never restart a mid-play element (dropout/clip). */
const LAND_POOL = 3;
const landPools: Partial<Record<PieceLandKind, HTMLAudioElement[]>> = {};
const landPoolIdx: Partial<Record<PieceLandKind, number>> = {};
let gameStartPlayer: HTMLAudioElement | null = null;
let messagePlayer: HTMLAudioElement | null = null;

let visibilityHooked = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
  }
  // Tab/background suspends AudioContext → land SFX go silent until resumed.
  if (!visibilityHooked) {
    visibilityHooked = true;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && ctx?.state === "suspended") {
        void ctx.resume();
      }
    });
  }
  return ctx;
}

async function ensureCtx(): Promise<AudioContext | null> {
  const audio = getCtx();
  if (!audio) return null;
  if (audio.state === "suspended") await audio.resume();
  return audio;
}

function beep(
  audio: AudioContext,
  freq: number,
  dur: number,
  type: OscillatorType = "sine",
  gainPeak = 0.08,
) {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.connect(gain);
  gain.connect(audio.destination);
  const now = audio.currentTime;
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

function nextLandPlayer(kind: PieceLandKind): HTMLAudioElement {
  let pool = landPools[kind];
  if (!pool) {
    pool = Array.from({ length: LAND_POOL }, () => {
      const el = new Audio(LAND_SRC[kind]);
      el.preload = "auto";
      return el;
    });
    landPools[kind] = pool;
    landPoolIdx[kind] = 0;
  }
  const idx = landPoolIdx[kind] ?? 0;
  landPoolIdx[kind] = (idx + 1) % pool.length;
  const player = pool[idx];
  if (!player) {
    throw new Error(`land audio pool empty for ${kind}`);
  }
  return player;
}

/**
 * Put-down only: move / capture / promote (king) - Chess.com default samples.
 * Priority when calling: promote > capture > move.
 */
export async function playPieceLandSound(kind: PieceLandKind): Promise<void> {
  if (typeof window === "undefined") return;
  const now = Date.now();
  // Soft debounce only - pool handles true overlap so multi-jumps stay audible.
  if (now - lastLandNotifyAt < 18) return;
  lastLandNotifyAt = now;
  try {
    await ensureCtx();
    const el = nextLandPlayer(kind);
    el.volume = kind === "capture" ? 0.9 : kind === "promote" ? 0.85 : 0.8;
    try {
      el.currentTime = 0;
    } catch {
      /* ignore seek race on some browsers */
    }
    await el.play();
  } catch {
    // Autoplay / decode failure: soft WebAudio fallback with same roles.
    const audio = await ensureCtx();
    if (!audio) return;
    if (kind === "promote") {
      beep(audio, 520, 0.07, "triangle", 0.06);
      window.setTimeout(() => beep(audio, 780, 0.1, "triangle", 0.05), 55);
      return;
    }
    if (kind === "capture") {
      beep(audio, 220, 0.06, "square", 0.05);
      window.setTimeout(() => beep(audio, 140, 0.08, "sine", 0.07), 30);
      return;
    }
    beep(audio, 180, 0.05, "sine", 0.05);
  }
}

/** @deprecated Prefer playPieceLandSound with explicit kind. */
export async function playPiecePlaceSound(captured = false, promoted = false): Promise<void> {
  if (promoted) return playPieceLandSound("promote");
  if (captured) return playPieceLandSound("capture");
  return playPieceLandSound("move");
}

export function pieceLandKind(opts: {
  isCapture?: boolean;
  isPromotion?: boolean;
}): PieceLandKind {
  if (opts.isPromotion) return "promote";
  if (opts.isCapture) return "capture";
  return "move";
}

/**
 * Play when another user’s chat message is delivered to this client
 * (DM / game chat). Debounced; never for own outbound.
 */
export async function playMessageDeliveredSound(): Promise<void> {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (now - lastMessageNotifyAt < 350) return;
  lastMessageNotifyAt = now;
  try {
    await ensureCtx();
    if (!messagePlayer) {
      messagePlayer = new Audio(MESSAGE_SRC);
      messagePlayer.preload = "auto";
    }
    messagePlayer.volume = 0.62;
    messagePlayer.currentTime = 0;
    await messagePlayer.play();
  } catch {
    // Fail closed: no synthetic beep invent when asset/autoplay unavailable.
  }
}

/** Match events + land SFX (move/capture/promote map to Chess.com samples). */
export async function playGameNotify(event: NotifyEvent): Promise<void> {
  if (event === "move") return playPieceLandSound("move");
  if (event === "capture") return playPieceLandSound("capture");
  if (event === "promote") return playPieceLandSound("promote");
  if (event === "game_start" || event === "match_found") {
    if (typeof window !== "undefined") {
      try {
        await ensureCtx();
        if (!gameStartPlayer) {
          gameStartPlayer = new Audio(GAME_START_SRC);
          gameStartPlayer.preload = "auto";
        }
        gameStartPlayer.volume = 0.85;
        gameStartPlayer.currentTime = 0;
        await gameStartPlayer.play();
        return;
      } catch {
        /* fall through to tone */
      }
    }
  }

  const audio = await ensureCtx();
  if (!audio) return;
  const now = audio.currentTime;

  if (event === "win") {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      window.setTimeout(() => beep(audio, f, 0.14, "triangle", 0.07), i * 90);
    });
    return;
  }
  if (event === "loss") {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "sine";
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.frequency.setValueAtTime(330, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.4);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    osc.start(now);
    osc.stop(now + 0.45);
    return;
  }

  const map: Record<string, { freq: number; dur: number }> = {
    match_found: { freq: 660, dur: 0.18 },
    your_turn: { freq: 520, dur: 0.12 },
    error: { freq: 180, dur: 0.2 },
    info: { freq: 400, dur: 0.08 },
  };
  const tone = map[event] ?? { freq: 400, dur: 0.08 };
  beep(audio, tone.freq, tone.dur);
}
