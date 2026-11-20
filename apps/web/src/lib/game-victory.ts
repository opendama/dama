/** Victory confetti in brand burgundy + ivory neutrals. */

export async function fireGameVictoryCelebration(): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const confetti = (await import("canvas-confetti")).default;
  const colors = ["#A31D38", "#C0264A", "#800020", "#FFF6E8", "#E8E8E8", "#FFFFFF"];
  confetti({
    particleCount: 100,
    spread: 78,
    origin: { y: 0.62 },
    colors,
    zIndex: 9999,
  });
  window.setTimeout(() => {
    confetti({
      particleCount: 48,
      angle: 60,
      spread: 58,
      origin: { x: 0, y: 0.68 },
      colors,
      zIndex: 9999,
    });
    confetti({
      particleCount: 48,
      angle: 120,
      spread: 58,
      origin: { x: 1, y: 0.68 },
      colors,
      zIndex: 9999,
    });
  }, 180);
  window.setTimeout(() => {
    confetti({
      particleCount: 36,
      spread: 100,
      startVelocity: 28,
      origin: { y: 0.55 },
      colors,
      zIndex: 9999,
    });
  }, 420);
}

/** Short muted ash burst for a loss (opposite of win celebration). */
export async function fireGameDefeatPulse(): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const confetti = (await import("canvas-confetti")).default;
  const colors = ["#3a3a3a", "#5a1a22", "#1a1a1a", "#6b6b6b"];
  confetti({
    particleCount: 36,
    spread: 55,
    startVelocity: 18,
    gravity: 1.2,
    scalar: 0.85,
    origin: { y: 0.55 },
    colors,
    zIndex: 9999,
  });
}
